<?php
header('Content-Type: application/json');
ini_set('display_errors', 1);
error_reporting(E_ALL);

// 数据库配置
$host = 'localhost';
$db   = 'kindergarten_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => '数据库连接失败: ' . $e->getMessage()]);
    exit;
}

// 获取前端 POST 数据
$input = json_decode(file_get_contents('php://input'), true);

$kindergarten = $input['kindergarten'] ?? '';
$birthOrder = $input['birthOrder'] ?? '';
$startDate = $input['startDate'] ?? '';
$endDate = $input['endDate'] ?? '';
$keyword = $input['keyword'] ?? '';
$page = max(1, (int)($input['page'] ?? 1));
$pageSize = max(10, (int)($input['pageSize'] ?? 10));
$offset = ($page - 1) * $pageSize;

// 构建查询条件
$where = [];
$params = [];

if ($kindergarten) {
    $where[] = "`kindergarten_name` = :kindergarten";
    $params[':kindergarten'] = $kindergarten;
}
if ($birthOrder) {
    $where[] = "`birth_order` = :birthOrder";
    $params[':birthOrder'] = $birthOrder;
}
if ($startDate) {
    $where[] = "`entry_date` >= :startDate";
    $params[':startDate'] = $startDate;
}
if ($endDate) {
    $where[] = "`entry_date` <= :endDate";
    $params[':endDate'] = $endDate;
}
if ($keyword) {
    $where[] = "(`name` LIKE :keyword OR `id_number` LIKE :keyword)";
    $params[':keyword'] = "%$keyword%";
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// 查询总数
$totalStmt = $pdo->prepare("SELECT COUNT(*) FROM `monthly_data` $whereSql");
$totalStmt->execute($params);
$totalCount = $totalStmt->fetchColumn();

// 查询分页数据
$dataStmt = $pdo->prepare("SELECT * FROM `monthly_data` $whereSql ORDER BY `id` DESC LIMIT :offset, :pageSize");
foreach ($params as $k => $v) {
    $dataStmt->bindValue($k, $v);
}
$dataStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$dataStmt->bindValue(':pageSize', $pageSize, PDO::PARAM_INT);
$dataStmt->execute();
$records = $dataStmt->fetchAll();

// 返回 JSON
echo json_encode([
    'success' => true,
    'totalCount' => $totalCount,
    'records' => $records,
    'summary' => [
        'total' => $totalCount,
        // 这里可以加其他统计字段，比如二孩、三孩人数等
    ]
]);
