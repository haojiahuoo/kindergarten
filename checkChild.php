<?php
header('Content-Type: application/json');

// 读取请求数据
$data = json_decode(file_get_contents('php://input'), true);
$name = $data['name'] ?? '';
$child_id = $data['idNumber'] ?? '';

// 数据库配置
$host = 'localhost';
$dbname = 'kindergarten_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 查询孩子信息
    $stmt = $pdo->prepare("SELECT id FROM kindergarten_persons WHERE child_name=? AND child_id=? LIMIT 1");
    $stmt->execute([$name, $child_id]);
    $child = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'exists' => (bool)$child
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'exists' => false,
        'error' => $e->getMessage()
    ]);
}
