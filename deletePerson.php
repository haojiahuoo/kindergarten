<?php
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
$childId = $input['childId'] ?? '';

if (empty($childId)) {
    echo json_encode(['success' => false, 'message' => '身份证号码不能为空']);
    exit;
}

try {
    $stmt = $pdo->prepare("DELETE FROM kindergarten_persons WHERE child_id = ?");
    $stmt->execute([$childId]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => '删除成功']);
    } else {
        echo json_encode(['success' => false, 'message' => '未找到要删除的记录']);
    }
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => '删除失败: ' . $e->getMessage()]);
}
?>