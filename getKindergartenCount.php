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
$kindergarten = $input['kindergarten'] ?? '';

if (empty($kindergarten)) {
    echo json_encode(['success' => false, 'message' => '幼儿园名称不能为空']);
    exit;
}

try {
    // 首先根据幼儿园名称获取幼儿园ID
    $stmt = $pdo->prepare("SELECT id FROM kindergartens WHERE name = ?");
    $stmt->execute([$kindergarten]);
    $kindergartenData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$kindergartenData) {
        echo json_encode([
            'success' => false, 
            'message' => '未找到该幼儿园信息',
            'kindergartenCount' => 0
        ]);
        exit;
    }
    
    $kindergartenId = $kindergartenData['id'];
    
    // 查询选定幼儿园的总记录数（使用 kindergarten_id）
    $stmt = $pdo->prepare("SELECT COUNT(*) as kindergarten_count FROM kindergarten_persons WHERE kindergarten_id = ?");
    $stmt->execute([$kindergartenId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $kindergartenCount = $result['kindergarten_count'] ? (int)$result['kindergarten_count'] : 0;
    
    echo json_encode([
        'success' => true,
        'kindergartenCount' => $kindergartenCount,
        'message' => '获取幼儿园记录数成功'
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => '获取幼儿园记录数失败: ' . $e->getMessage()
    ]);
}
?>