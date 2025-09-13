<?php

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$name = $data['name'] ?? '';
$child_id = $data['idNumber'] ?? '';
$kindergartenId = $data['kindergartenId'] ?? 0;

$host = 'localhost';
$dbname = 'kindergarten_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 先检查孩子是否存在于信息库
    $stmt = $pdo->prepare("SELECT kindergarten_id FROM kindergarten_persons WHERE child_name=? AND child_id=? LIMIT 1");
    $stmt->execute([$name, $child_id]);
    $child = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$child) {
        // 根本没有找到这个孩子
        echo json_encode([
            'success' => true,
            'exists' => false,
            'reason' => 'not_found'
        ]);
    } elseif ($child['kindergarten_id'] != $kindergartenId) {
        // 找到了孩子，但幼儿园不匹配
        echo json_encode([
            'success' => true,
            'exists' => false,
            'reason' => 'wrong_kindergarten'
        ]);
    } else {
        // 存在且幼儿园匹配
        echo json_encode([
            'success' => true,
            'exists' => true
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'exists' => false,
        'error' => $e->getMessage()
    ]);
}
