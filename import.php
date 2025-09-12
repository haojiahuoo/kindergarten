<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') exit();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => '只允许POST请求']);
    exit();
}

require_once 'db_connect.php';

// 接收 JSON 数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !is_array($data)) {
    echo json_encode(['success' => false, 'message' => '无效的数据格式']);
    exit();
}

$kindergartenName = $data['kindergarten'] ?? '';
$personsData = $data['persons'] ?? [];

if (empty($kindergartenName) || empty($personsData)) {
    echo json_encode(['success' => false, 'message' => '缺少幼儿园信息或人员数据']);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $db->beginTransaction();

    // 查找或创建幼儿园
    $kindergarten = findOrCreateKindergarten($db, $kindergartenName);

    // ------------------------
    // 1️⃣ 全量验证数据
    $errors = [];
    $duplicateIdsArr = [];

    foreach ($personsData as $index => $person) {
        if (empty($person['childId']) || empty($person['childName'])) {
            $errors[] = "第 " . ($index + 1) . " 行数据不完整";
        }

        // 检查数据库中已有身份证
        $checkStmt = $db->prepare("SELECT id FROM kindergarten_persons WHERE child_id = :child_id");
        $checkStmt->bindParam(':child_id', $person['childId']);
        $checkStmt->execute();
        if ($checkStmt->rowCount() > 0) {
            $errors[] = "重复身份证: " . $person['childId'];
            $duplicateIdsArr[] = $person['childId'];
        }

        // 检查当前上传数据内部重复
        $childIds = array_column($personsData, 'childId');
        if (count(array_keys($childIds, $person['childId'])) > 1) {
            if (!in_array($person['childId'], $duplicateIdsArr)) {
                $errors[] = "上传文件内部重复身份证: " . $person['childId'];
                $duplicateIdsArr[] = $person['childId'];
            }
        }
    }

    if (!empty($errors)) {
        $db->rollBack();
        echo json_encode([
            'success' => false,
            'message' => '数据有错误，全部不导入',
            'errors' => $errors,
            'duplicateIds' => $duplicateIdsArr
        ]);
        exit();
    }

    // ------------------------
    // 2️⃣ 没有错误，开始批量插入
    // 获取当前幼儿园最大序号
    $stmt = $db->prepare("SELECT MAX(serial_number) as max_sn FROM kindergarten_persons WHERE kindergarten_id = :kid");
    $stmt->bindParam(':kid', $kindergarten['id']);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $nextSerial = $row['max_sn'] ?? 0;

    $successCount = 0;
    $errorCount = 0;

    foreach ($personsData as $person) {
        $nextSerial++; // 自动递增序号

        $insertSql = "INSERT INTO kindergarten_persons
            (kindergarten_id, serial_number, child_name, birth_order, child_id,
             father_name, father_id, mother_name, mother_id)
            VALUES
            (:kindergarten_id, :serial_number, :child_name, :birth_order, :child_id,
             :father_name, :father_id, :mother_name, :mother_id)";

        $insertStmt = $db->prepare($insertSql);
        $insertStmt->bindParam(':kindergarten_id', $kindergarten['id']);
        $insertStmt->bindParam(':serial_number', $nextSerial);
        $insertStmt->bindParam(':child_name', $person['childName']);
        $insertStmt->bindParam(':birth_order', $person['birthOrder']);
        $insertStmt->bindParam(':child_id', $person['childId']);
        $insertStmt->bindParam(':father_name', $person['fatherName']);
        $insertStmt->bindParam(':father_id', $person['fatherId']);
        $insertStmt->bindParam(':mother_name', $person['motherName']);
        $insertStmt->bindParam(':mother_id', $person['motherId']);

        if ($insertStmt->execute()) {
            $successCount++;
        } else {
            $errorInfo = $insertStmt->errorInfo();
            $errors[] = "插入失败: " . implode(", ", $errorInfo);
            $errorCount++;
        }
    }

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => "导入完成 - {$kindergartenName}",
        'stats' => [
            'total' => count($personsData),
            'success' => $successCount,
            'duplicates' => count($duplicateIdsArr),
            'errors' => $errorCount
        ],
        'errors' => $errors,
        'duplicateIds' => $duplicateIdsArr
    ]);

} catch (PDOException $e) {
    if ($db->inTransaction()) $db->rollBack();
    echo json_encode([
        'success' => false,
        'message' => '导入错误: ' . $e->getMessage()
    ]);
    exit();
}

// ----------------------
// 查找或创建幼儿园
function findOrCreateKindergarten($db, $name) {
    $stmt = $db->prepare("SELECT * FROM kindergartens WHERE name = :name");
    $stmt->bindParam(':name', $name);
    $stmt->execute();

    if ($stmt->rowCount() > 0) return $stmt->fetch(PDO::FETCH_ASSOC);

    // 创建新的幼儿园
    $code = generateKindergartenCode($name);
    $stmt = $db->prepare("INSERT INTO kindergartens (name, code) VALUES (:name, :code)");
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':code', $code);
    $stmt->execute();

    return [
        'id' => $db->lastInsertId(),
        'name' => $name,
        'code' => $code
    ];
}

// 简单生成幼儿园代码
function generateKindergartenCode($name) {
    $pinyinMap = [
        '风' => 'F', '貌' => 'M', '街' => 'J', '实' => 'S', '验' => 'Y',
        '幼' => 'Y', '儿' => 'E', '园' => 'Y'
    ];

    $code = '';
    for ($i = 0; $i < mb_strlen($name); $i++) {
        $char = mb_substr($name, $i, 1);
        $code .= $pinyinMap[$char] ?? $char;
    }

    return $code . '_' . time();
}
?>
