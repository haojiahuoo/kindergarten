<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

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
$kindergarten = $input['kindergarten'] ?? '';
$quarter = $input['quarter'] ?? '';

if (empty($kindergarten) || empty($quarter)) {
    echo json_encode(['success' => false, 'message' => '参数不完整']);
    exit;
}

// 根据季度确定月份范围
$monthRanges = [
    '1' => ['01', '02', '03'],
    '2' => ['04', '05', '06'], 
    '3' => ['07', '08', '09'],
    '4' => ['10', '11', '12']
];

$months = $monthRanges[$quarter] ?? $monthRanges['1'];
$currentYear = date('Y');

try {
    $secondChildCounts = [];
    $thirdChildCounts = [];
    
    // 第一步：检查数据库中是否有数据
    $checkSql = "SELECT COUNT(*) as total_count FROM monthly_data";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute();
    $totalCount = $checkStmt->fetch(PDO::FETCH_ASSOC)['total_count'];
    
    // 第二步：检查该机构是否存在
    $checkKindergartenSql = "SELECT DISTINCT kindergarten_name FROM monthly_data WHERE kindergarten_name LIKE :kindergarten";
    $checkKindergartenStmt = $pdo->prepare($checkKindergartenSql);
    $checkKindergartenStmt->execute([':kindergarten' => '%' . $kindergarten . '%']);
    $existingKindergartens = $checkKindergartenStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 第三步：检查年份和月份数据
    $checkYearMonthSql = "SELECT DISTINCT `year_month` FROM monthly_data ORDER BY `year_month` DESC LIMIT 6";
    $checkYearMonthStmt = $pdo->prepare($checkYearMonthSql);
    $checkYearMonthStmt->execute();
    $existingYearMonths = $checkYearMonthStmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($months as $month) {
        $yearMonth = $currentYear . '-' . $month;
        
        // 方法1：使用精确匹配
        $sql2 = "SELECT COUNT(*) as count 
                FROM monthly_data 
                WHERE kindergarten_name = :kindergarten 
                AND birth_order = '2'
                AND `year_month` = :yearMonth";
        
        $stmt2 = $pdo->prepare($sql2);
        $stmt2->execute([
            ':kindergarten' => $kindergarten,
            ':yearMonth' => $yearMonth
        ]);
        $result2 = $stmt2->fetch(PDO::FETCH_ASSOC);
        $secondChildCounts[] = (int)$result2['count'];
        
        $sql3 = "SELECT COUNT(*) as count 
                FROM monthly_data 
                WHERE kindergarten_name = :kindergarten 
                AND birth_order = '3'
                AND `year_month` = :yearMonth";
        
        $stmt3 = $pdo->prepare($sql3);
        $stmt3->execute([
            ':kindergarten' => $kindergarten,
            ':yearMonth' => $yearMonth
        ]);
        $result3 = $stmt3->fetch(PDO::FETCH_ASSOC);
        $thirdChildCounts[] = (int)$result3['count'];
    }
    
    // 如果所有数据都是0，尝试使用模糊匹配
    $allZero = array_sum($secondChildCounts) === 0 && array_sum($thirdChildCounts) === 0;
    
    if ($allZero) {
        // 尝试模糊匹配机构名称
        $fuzzyKindergarten = $existingKindergartens[0]['kindergarten_name'] ?? $kindergarten;
        
        $secondChildCounts = [];
        $thirdChildCounts = [];
        
        foreach ($months as $month) {
            $yearMonth = $currentYear . '-' . $month;
            
            $sql2 = "SELECT COUNT(*) as count 
                    FROM monthly_data 
                    WHERE kindergarten_name = :kindergarten 
                    AND birth_order = '2'
                    AND `year_month` = :yearMonth";
            
            $stmt2 = $pdo->prepare($sql2);
            $stmt2->execute([
                ':kindergarten' => $fuzzyKindergarten,
                ':yearMonth' => $yearMonth
            ]);
            $result2 = $stmt2->fetch(PDO::FETCH_ASSOC);
            $secondChildCounts[] = (int)$result2['count'];
            
            $sql3 = "SELECT COUNT(*) as count 
                    FROM monthly_data 
                    WHERE kindergarten_name = :kindergarten 
                    AND birth_order = '3'
                    AND `year_month` = :yearMonth";
            
            $stmt3 = $pdo->prepare($sql3);
            $stmt3->execute([
                ':kindergarten' => $fuzzyKindergarten,
                ':yearMonth' => $yearMonth
            ]);
            $result3 = $stmt3->fetch(PDO::FETCH_ASSOC);
            $thirdChildCounts[] = (int)$result3['count'];
        }
    }
    
    echo json_encode([
        'success' => true,
        'secondChildCounts' => $secondChildCounts,
        'thirdChildCounts' => $thirdChildCounts,
        'kindergarten' => $kindergarten,
        'quarter' => $quarter,
        'year' => $currentYear,
        'debug_info' => [
            'total_records_in_table' => $totalCount,
            'requested_kindergarten' => $kindergarten,
            'existing_kindergartens' => $existingKindergartens,
            'existing_year_months' => $existingYearMonths,
            'searched_year_months' => array_map(function($month) use ($currentYear) {
                return $currentYear . '-' . $month;
            }, $months),
            'all_data_zero' => $allZero
        ]
    ]);
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => '查询失败: ' . $e->getMessage()]);
}
?>