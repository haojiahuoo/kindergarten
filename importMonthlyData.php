<?php
header('Content-Type: application/json; charset=utf-8');

// 数据库配置
$host = 'localhost';
$db   = 'nursery';
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

// 获取前端 POST 的 JSON
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    echo json_encode(['success' => false, 'message' => '无效的数据']);
    exit;
}

$successCount = 0;
$duplicateCount = 0;

try {
    $pdo->beginTransaction();

    // 预处理语句
    $stmt = $pdo->prepare("
        INSERT INTO monthly_data
        (name, birth_order, id_number, parent_name, product_type, class_name, entry_date, payment_date, payment_amount, payment_months, monthly_fee, attendance_days, status, messages)
        VALUES
        (:name, :birth_order, :id_number, :parent_name, :product_type, :class_name, :entry_date, :payment_date, :payment_amount, :payment_months, :monthly_fee, :attendance_days, :status, :messages)
    ");

    // 检查重复 id_number 的语句
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM monthly_data WHERE id_number = :id_number");

    foreach ($input as $row) {
        $idNumber = $row['idNumber'] ?? '';
        if (!$idNumber) continue;

        $checkStmt->execute([':id_number' => $idNumber]);
        if ($checkStmt->fetchColumn() > 0) {
            $duplicateCount++;
            continue; // 跳过重复
        }

        $stmt->execute([
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
        'success' => true,
        'message' => "数据导入完成，成功: $successCount 条，重复跳过: $duplicateCount 条"
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => '导入失败: ' . $e->getMessage()]);
}
?>
