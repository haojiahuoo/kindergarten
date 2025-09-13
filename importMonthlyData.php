<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');


header('Content-Type: application/json; charset=utf-8');

// 数据库配置
$host = 'localhost';
$db   = 'kindergarten_db';
$user = 'root';
$pass = '';  // XAMPP 默认空
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
try {
    // 获取前端 POST 的 JSON
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !is_array($input)) {
        echo json_encode(['success' => false, 'message' => '无效的数据']);
        exit;
    }

    $successCount = 0;
    $errors = [];

    $pdo->beginTransaction();

    // 插入 monthly_data 的预处理语句
    $stmt = $pdo->prepare("
        INSERT INTO `monthly_data`
        (`kindergarten_id`, `kindergarten_name`, `year_month`, `name`, `birth_order`, `id_number`, `parent_name`, `product_type`, `class_name`, `entry_date`, `payment_date`, `payment_amount`, `payment_months`, `monthly_fee`, `attendance_days`, `status`, `messages`)
        VALUES
        (:kindergarten_id, :kindergarten_name, :year_month, :name, :birth_order, :id_number, :parent_name, :product_type, :class_name, :entry_date, :payment_date, :payment_amount, :payment_months, :monthly_fee, :attendance_days, :status, :messages)
    ");

    // 检查重复 id_number
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM `monthly_data` WHERE `id_number` = :id_number");

    // 检查 kindergartenId 是否存在
    $checkKindergarten = $pdo->prepare("SELECT COUNT(*) FROM `kindergartens` WHERE `id` = :id");

    foreach ($input as $row) {
        $idNumber = $row['idNumber'] ?? '';
        $kindergartenId = $row['kindergartenId'] ?? 0;
        $kindergartenName = $row['kindergartenName'] ?? '';
        $yearMonth = $row['yearMonth'] ?? '';

        if (!$idNumber || !$kindergartenId || !$kindergartenName || !$yearMonth) 
            $errors[] = "第".($index+1)."行：信息不完整";
            continue;

        // 检查幼儿园是否存在
        $checkKindergarten->execute([':id' => $kindergartenId]);
        if ($checkKindergarten->fetchColumn() == 0) {
            $errors[] = "第".($index+1)."行：幼儿园ID {$kindergartenId} 不存在";
            continue;
        }

        // 检查本月是否已存在相同的 id_number
        $checkStmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM `monthly_data` 
            WHERE `id_number` = :id_number
            AND `kindergarten_id` = :kindergarten_id
            AND `year_month` = :year_month
        ");
        $checkStmt->execute([
            ':id_number' => $idNumber,
            ':kindergarten_id' => $kindergartenId,
            ':year_month' => $yearMonth
        ]);

        if ($checkStmt->fetchColumn() > 0) {
            $errors[] = "第".($index+1)."行：身份证号 {$idNumber} 在 {$yearMonth} 已存在，不允许重复导入";
            continue;
        }

        // 插入数据
        $stmt->execute([
            ':kindergarten_id' => $kindergartenId,
            ':kindergarten_name' => $kindergartenName,
            ':year_month' => $yearMonth,
            ':name' => $row['name'] ?? '',
            ':birth_order' => $row['birthOrder'] ?? '',
            ':id_number' => $idNumber,
            ':parent_name' => $row['parentName'] ?? '',
            ':product_type' => $row['productType'] ?? '',
            ':class_name' => $row['className'] ?? '',
            ':entry_date' => $row['entryDate'] ?? null,
            ':payment_date' => $row['paymentDate'] ?? null,
            ':payment_amount' => $row['paymentAmount'] ?? 0,
            ':payment_months' => $row['paymentMonths'] ?? 0,
            ':monthly_fee' => $row['monthlyFee'] ?? 0,
            ':attendance_days' => $row['attendanceDays'] ?? 0,
            ':status' => $row['status'] ?? '',
            ':messages' => $row['messages'] ?? ''
        ]);

        $successCount++;
    }

    $pdo->commit();

    echo json_encode([
        'success' => $successCount > 0,
        'successCount' => $successCount,
        'errors' => $errors
    ]);

}   catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode([
            'success' => false,
            'successCount' => 0,
            'errors' => '导入失败: ' . $e->getMessage()
        ]);
}
?>
