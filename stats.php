<?php
// stats.php - 统计数据处理接口
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
    echo json_encode(['success' => false, 'message' => '数据库连接失败: ' . $e->getMessage()]);
    exit;
}

// 获取POST数据
$input = json_decode(file_get_contents('php://input'), true);

// 构建查询条件
$whereConditions = [];
$params = [];

// 托育机构筛选 - 根据 kindergarten_id 查询
if (!empty($input['kindergarten'])) {
    // 这里需要根据幼儿园名称查询 kindergarten_id
    // 先查询幼儿园名称对应的ID
    $kindergartenStmt = $pdo->prepare("SELECT id FROM kindergartens WHERE name = ?");
    $kindergartenStmt->execute([$input['kindergarten']]);
    $kindergarten = $kindergartenStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($kindergarten) {
        $whereConditions[] = "kindergarten_id = :kindergarten_id";
        $params[':kindergarten_id'] = $kindergarten['id'];
    }
}

// 孩次筛选
if (!empty($input['birthOrder'])) {
    $whereConditions[] = "birth_order = :birth_order";
    $params[':birth_order'] = $input['birthOrder'];
}

// 时间范围筛选
if (!empty($input['startDate'])) {
    $whereConditions[] = "created_at >= :start_date";
    $params[':start_date'] = $input['startDate'];
}
if (!empty($input['endDate'])) {
    $whereConditions[] = "created_at <= :end_date";
    $params[':end_date'] = $input['endDate'] . ' 23:59:59';
}

// 关键词搜索
if (!empty($input['keyword'])) {
    $whereConditions[] = "(child_name LIKE :keyword OR child_id LIKE :keyword)";
    $params[':keyword'] = '%' . $input['keyword'] . '%';
}

$whereClause = '';
if (!empty($whereConditions)) {
    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
}

try {
    // 1. 查询总人数和统计摘要
    // 注意：这里假设补贴金额是固定值，如果需要从其他表获取请修改
    $summarySql = "
        SELECT 
            COUNT(*) as totalCount,
            COUNT(DISTINCT kindergarten_id) as kindergartenCount,
            SUM(CASE WHEN birth_order = 2 THEN 1 ELSE 0 END) as secondChildCount,
            SUM(CASE WHEN birth_order = 3 THEN 1 ELSE 0 END) as thirdChildCount,
            -- 补贴金额计算，这里假设每个孩子固定补贴1500元，请根据实际情况修改
            COUNT(*) * 1500 as totalSubsidy,
            SUM(CASE WHEN birth_order = 2 THEN 1 ELSE 0 END) * 1500 as secondChildSubsidy,
            SUM(CASE WHEN birth_order = 3 THEN 1 ELSE 0 END) * 1500 as thirdChildSubsidy
        FROM kindergarten_persons 
        $whereClause
    ";
    
    $stmt = $pdo->prepare($summarySql);
    $stmt->execute($params);
    $summary = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 2. 查询分页数据
    $page = $input['page'] ?? 1;
    $pageSize = $input['pageSize'] ?? 10;
    $offset = ($page - 1) * $pageSize;
    
    $recordsSql = "
        SELECT 
            p.child_name,
            p.birth_order,
            p.child_id,
            p.father_name,
            p.mother_name,
            p.created_at,
            p.kindergarten_id,
            k.name as kindergarten_name,
            -- 补贴金额，这里假设固定1500元，请根据实际情况修改
            1500 as subsidy_amount,
            'active' as status
        FROM kindergarten_persons p
        LEFT JOIN kindergartens k ON p.kindergarten_id = k.id
        $whereClause
        ORDER BY p.created_at DESC 
        LIMIT :offset, :pageSize
    ";
    
    $stmt = $pdo->prepare($recordsSql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->bindValue(':pageSize', $pageSize, PDO::PARAM_INT);
    $stmt->execute();
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 处理返回数据，统一字段名
    $processedRecords = [];
    foreach ($records as $record) {
        $processedRecords[] = [
            'childName' => $record['child_name'] ?? '',
            'birthOrder' => $record['birth_order'] ?? '',
            'childId' => $record['child_id'] ?? '',
            'kindergarten' => $record['kindergarten_name'] ?? '',
            'fatherName' => $record['father_name'] ?? '',
            'motherName' => $record['mother_name'] ?? '',
            'createTime' => $record['created_at'] ?? '',
            'subsidyAmount' => $record['subsidy_amount'] ?? 1500,
            'status' => $record['status'] ?? 'active'
        ];
    }
    
    // 返回结果
    echo json_encode([
        'success' => true,
        'records' => $processedRecords,
        'totalCount' => $summary['totalCount'] ?? 0,
        'summary' => [
            'totalCount' => $summary['totalCount'] ?? 0,
            'totalSubsidy' => $summary['totalSubsidy'] ?? 0,
            'secondChildCount' => $summary['secondChildCount'] ?? 0,
            'secondChildSubsidy' => $summary['secondChildSubsidy'] ?? 0,
            'thirdChildCount' => $summary['thirdChildCount'] ?? 0,
            'thirdChildSubsidy' => $summary['thirdChildSubsidy'] ?? 0,
            'kindergartenCount' => $summary['kindergartenCount'] ?? 0
        ]
    ]);
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => '数据库查询失败: ' . $e->getMessage()]);
}
?>