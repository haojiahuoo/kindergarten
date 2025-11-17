<?php
// stats.php - 统计数据处理接口

// 开启所有错误显示（仅用于调试）
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 数据库配置
$host = 'localhost';
$dbname = 'kindergarten_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // 确保返回JSON格式的错误信息
    echo json_encode(['success' => false, 'message' => '数据库连接失败: ' . $e->getMessage()]);
    exit;
}

// 获取POST数据
$input = json_decode(file_get_contents('php://input'), true);

// 如果JSON解析失败，返回错误
if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['success' => false, 'message' => 'JSON解析失败: ' . json_last_error_msg()]);
    exit;
}

// 构建查询条件 - 为两个表分别构建
$personsConditions = [];
$monthlyConditions = [];
$personsParams = [];
$monthlyParams = [];

// 托育机构筛选
if (!empty($input['kindergarten'])) {
    if (is_numeric($input['kindergarten'])) {
        $personsConditions[] = "kp.kindergarten_id = :persons_kindergarten_id";
        $monthlyConditions[] = "md.kindergarten_id = :monthly_kindergarten_id";
        $personsParams[':persons_kindergarten_id'] = $input['kindergarten'];
        $monthlyParams[':monthly_kindergarten_id'] = $input['kindergarten'];
    } elseif ($input['kindergarten'] === 'new') {
        $personsConditions[] = "kp.kindergarten_id IS NULL";
        $monthlyConditions[] = "md.kindergarten_id IS NULL";
    }
}

// 孩次筛选
if (!empty($input['birthOrder'])) {
    $personsConditions[] = "kp.birth_order = :persons_birth_order";
    $monthlyConditions[] = "md.birth_order = :monthly_birth_order";
    $personsParams[':persons_birth_order'] = $input['birthOrder'];
    $monthlyParams[':monthly_birth_order'] = $input['birthOrder'];
}

// 时间范围筛选（主要针对 monthly_data 表）- 使用年月格式
if (!empty($input['startDate'])) {
    $startMonth = date('Y-m', strtotime($input['startDate']));
    $monthlyConditions[] = "md.`year_month` >= :start_month";
    $monthlyParams[':start_month'] = $startMonth;
}
if (!empty($input['endDate'])) {
    $endMonth = date('Y-m', strtotime($input['endDate']));
    $monthlyConditions[] = "md.`year_month` <= :end_month";
    $monthlyParams[':end_month'] = $endMonth;
}

// 季度筛选 - 使用年月格式
if (!empty($input['quarter']) && empty($input['startDate']) && empty($input['endDate'])) {
    $quarter = intval($input['quarter']);
    $year = date('Y');
    
    switch ($quarter) {
        case 1:
            $startMonth = $year . '-01';
            $endMonth = $year . '-03';
            break;
        case 2:
            $startMonth = $year . '-04';
            $endMonth = $year . '-06';
            break;
        case 3:
            $startMonth = $year . '-07';
            $endMonth = $year . '-09';
            break;
        case 4:
            $startMonth = $year . '-10';
            $endMonth = $year . '-12';
            break;
        default:
            $startMonth = '';
            $endMonth = '';
    }
    
    if ($startMonth && $endMonth) {
        $monthlyConditions[] = "md.`year_month` >= :quarter_start_month";
        $monthlyConditions[] = "md.`year_month` <= :quarter_end_month";
        $monthlyParams[':quarter_start_month'] = $startMonth;
        $monthlyParams[':quarter_end_month'] = $endMonth;
    }
}

// 关键词搜索
if (!empty($input['keyword'])) {
    $personsConditions[] = "(kp.child_name LIKE :persons_keyword OR kp.child_id LIKE :persons_keyword)";
    $monthlyConditions[] = "(md.name LIKE :monthly_keyword OR md.id_number LIKE :monthly_keyword)";
    $personsParams[':persons_keyword'] = '%' . $input['keyword'] . '%';
    $monthlyParams[':monthly_keyword'] = '%' . $input['keyword'] . '%';
}

// 构建完整的WHERE子句
$personsWhereClause = '';
$monthlyWhereClause = '';

if (!empty($personsConditions)) {
    $personsWhereClause = 'WHERE ' . implode(' AND ', $personsConditions);
}

if (!empty($monthlyConditions)) {
    $monthlyWhereClause = 'WHERE ' . implode(' AND ', $monthlyConditions);
}

try {
    // 1. 从 kindergarten_persons 表统计基础数据
    $personsStatsSql = "
        SELECT 
            COUNT(DISTINCT kp.kindergarten_id) as kindergartenCount,
            COUNT(DISTINCT kp.child_id) as totalCount,
            COUNT(DISTINCT CASE WHEN kp.birth_order = '2' THEN kp.child_id END) as secondChildCount,
            COUNT(DISTINCT CASE WHEN kp.birth_order = '3' THEN kp.child_id END) as thirdChildCount,
            COUNT(DISTINCT CASE WHEN 
                TIMESTAMPDIFF(YEAR, 
                    STR_TO_DATE(SUBSTRING(kp.child_id, 7, 8), '%Y%m%d'),
                    CURDATE()
                ) < 3 
                THEN kp.child_id END
            ) as underThreeTotal,
            COUNT(DISTINCT CASE WHEN 
                kp.birth_order = '2' AND 
                TIMESTAMPDIFF(YEAR, 
                    STR_TO_DATE(SUBSTRING(kp.child_id, 7, 8), '%Y%m%d'),
                    CURDATE()
                ) < 3 
                THEN kp.child_id END
            ) as underThreeSecond,
            COUNT(DISTINCT CASE WHEN 
                kp.birth_order = '3' AND 
                TIMESTAMPDIFF(YEAR, 
                    STR_TO_DATE(SUBSTRING(kp.child_id, 7, 8), '%Y%m%d'),
                    CURDATE()
                ) < 3 
                THEN kp.child_id END
            ) as underThreeThird
        FROM kindergarten_persons kp
        $personsWhereClause
    ";
    
    $stmt = $pdo->prepare($personsStatsSql);
    $stmt->execute($personsParams);
    $personsStats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 2. 从 monthly_data 表统计补贴相关数据
    $monthlyStatsSql = "
        SELECT 
            COUNT(*) as totalApplyCount,
            COUNT(CASE WHEN md.birth_order = '2' THEN 1 ELSE NULL END) as secondChildApplyCount,
            COUNT(CASE WHEN md.birth_order = '3' THEN 1 ELSE NULL END) as thirdChildApplyCount,
            SUM(
                CASE 
                    WHEN md.birth_order = '2' AND md.product_type = '半日托' THEN 150
                    WHEN md.birth_order = '2' THEN 300
                    WHEN md.birth_order = '3' AND md.product_type = '半日托' THEN 200
                    WHEN md.birth_order = '3' THEN 400
                    ELSE 0
                END
            ) as totalSubsidy,
            SUM(
                CASE 
                    WHEN md.birth_order = '2' AND md.product_type = '半日托' THEN 150
                    WHEN md.birth_order = '2' THEN 300
                    ELSE 0
                END
            ) as secondChildSubsidy,
            SUM(
                CASE 
                    WHEN md.birth_order = '3' AND md.product_type = '半日托' THEN 200
                    WHEN md.birth_order = '3' THEN 400
                    ELSE 0
                END
            ) as thirdChildSubsidy
        FROM monthly_data md
        $monthlyWhereClause
    ";
    
    $stmt = $pdo->prepare($monthlyStatsSql);
    $stmt->execute($monthlyParams);
    $monthlyStats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 3. 合并统计结果
    $summary = array_merge($personsStats ?: [], $monthlyStats ?: []);
    
    // 4. 查询分页数据
    $page = $input['page'] ?? 1;
    $pageSize = $input['pageSize'] ?? 10;
    $offset = ($page - 1) * $pageSize;
    
    $recordsSql = "
        SELECT 
            md.name as child_name,
            md.birth_order,
            md.id_number as child_id,
            md.parent_name,
            md.kindergarten_name,
            md.year_month,
            md.kindergarten_id,
            k.name as kindergarten_name,
            md.product_type,
            md.payment_months,
            CASE 
                WHEN md.birth_order = '2' AND md.product_type = '半日托' THEN 150
                WHEN md.birth_order = '2' THEN 300
                WHEN md.birth_order = '3' AND md.product_type = '半日托' THEN 200
                WHEN md.birth_order = '3' THEN 400
                ELSE 0
            END as subsidy_amount,
            md.status
        FROM monthly_data md
        LEFT JOIN kindergartens k ON md.kindergarten_id = k.id
        $monthlyWhereClause
        ORDER BY md.year_month DESC 
        LIMIT :offset, :pageSize
    ";
    
    $stmt = $pdo->prepare($recordsSql);
    foreach ($monthlyParams as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->bindValue(':pageSize', $pageSize, PDO::PARAM_INT);
    $stmt->execute();
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 处理返回数据
    $processedRecords = [];
    foreach ($records as $record) {
        $processedRecords[] = [
            'childName' => $record['child_name'] ?? '',
            'birthOrder' => $record['birth_order'] ?? '',
            'childId' => $record['child_id'] ?? '',
            'kindergarten' => $record['kindergarten_name'] ?? '',
            'fatherName' => $record['parent_name'] ?? '',
            'motherName' => '',
            'createTime' => $record['year_month'] ?? '',
            'subsidyAmount' => $record['subsidy_amount'] ?? 0,
            'status' => $record['status'] ?? 'active',
            'productType' => $record['product_type'] ?? '',
            'paymentMonths' => $record['payment_months'] ?? 0
        ];
    }
    
    // 返回结果
    echo json_encode([
        'success' => true,
        'records' => $processedRecords,
        'totalRecords' => $monthlyStats['totalApplyCount'] ?? 0,
        'filters' => [
            'quarter' => $input['quarter'] ?? null,
            'quarterRange' => isset($startMonth) ? $startMonth . ' 至 ' . $endMonth : null,
            'note' => '季度筛选仅应用于补贴申领数据，建档人数统计为全部数据'
        ],
        'summary' => [
            'kindergartenCount' => $summary['kindergartenCount'] ?? 0,
            'totalCount' => $summary['totalCount'] ?? 0,
            'secondChildCount' => $summary['secondChildCount'] ?? 0,
            'thirdChildCount' => $summary['thirdChildCount'] ?? 0,
            'underThreeTotal' => $summary['underThreeTotal'] ?? 0,
            'underThreeSecond' => $summary['underThreeSecond'] ?? 0,
            'underThreeThird' => $summary['underThreeThird'] ?? 0,
            'totalApplyCount' => $summary['totalApplyCount'] ?? 0,
            'secondChildApplyCount' => $summary['secondChildApplyCount'] ?? 0,
            'thirdChildApplyCount' => $summary['thirdChildApplyCount'] ?? 0,
            'totalSubsidy' => $summary['totalSubsidy'] ?? 0,
            'secondChildSubsidy' => $summary['secondChildSubsidy'] ?? 0,
            'thirdChildSubsidy' => $summary['thirdChildSubsidy'] ?? 0
        ]
    ]);
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => '数据库查询失败: ' . $e->getMessage()]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => '系统错误: ' . $e->getMessage()]);
}
?>