<?php
header('Content-Type: application/json');

// 获取前端传来的 JSON 数据
$data = json_decode(file_get_contents('php://input'), true);
$name = $data['name'] ?? '';
$child_id = $data['idNumber'] ?? '';
$birthOrder = isset($data['birthOrder']) ? intval($data['birthOrder']) : 0;

// 数据库配置
$host = 'localhost';
$dbname = 'kindergarten_db';
$username = 'root';
$password = '';

try {
    // 连接数据库
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 查询幼儿信息并比对胎次
    $stmt = $pdo->prepare("SELECT birth_order FROM kindergarten_persons WHERE child_name=? AND child_id=? LIMIT 1");
    $stmt->execute([$name, $child_id]);
    $child = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($child) {
        // 存在幼儿，检查胎次是否一致
        $match = ($child['birth_order'] == $birthOrder);
        echo json_encode([
            'success' => true,
            'match' => $match
        ]);
    } else {
        // 幼儿不存在
        echo json_encode([
            'success' => false,
            'match' => false,
            'error' => '幼儿不存在'
        ]);
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'match' => false,
        'error' => $e->getMessage()
    ]);
}
