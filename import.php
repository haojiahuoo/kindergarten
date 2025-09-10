<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => '只允许POST请求']);
    exit();
}

require_once 'db_connect.php';

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !is_array($data)) {
    echo json_encode(['success' => false, 'message' => '无效的数据格式']);
    exit();
}

// 获取幼儿园信息
$kindergartenName = isset($data['kindergarten']) ? $data['kindergarten'] : '';
$personsData = isset($data['persons']) ? $data['persons'] : [];

if (empty($kindergartenName) || empty($personsData)) {
    echo json_encode(['success' => false, 'message' => '缺少幼儿园信息或人员数据']);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    // 查找或创建幼儿园
    $kindergarten = findOrCreateKindergarten($db, $kindergartenName);
    
    $successCount = 0;
    $errorCount = 0;
    $duplicateCount = 0;
    $errors = [];
    
    $db->beginTransaction();

    foreach ($personsData as $index => $person) {
        if (empty($person['childId']) || empty($person['childName'])) {
            $errors[] = "第 " . ($index + 1) . " 行数据不完整";
            $errorCount++;
            continue;
        }

        // 用来存重复身份证号
        $duplicateIdsArr = $duplicateIdsArr ?? []; // 第一次循环初始化数组

        // 检查重复（基于身份证号）
        $check_sql = "SELECT id FROM kindergarten_persons WHERE child_id = :child_id";
        $check_stmt = $db->prepare($check_sql);
        $check_stmt->bindParam(':child_id', $person['childId']);
        $check_stmt->execute();

        if ($check_stmt->rowCount() > 0) {
            $duplicateCount++;
            $errors[] = "跳过重复数据: " . $person['childName'] . " (" . $person['childId'] . ")";
            $duplicateIdsArr[] = $person['childId']; // 保存重复ID
            continue;
        }

        // 插入数据
        $insert_sql = "INSERT INTO kindergarten_persons 
                      (kindergarten_id, serial_number, child_name, birth_order, child_id, 
                       father_name, father_id, mother_name, mother_id) 
                      VALUES (:kindergarten_id, :serial_number, :child_name, :birth_order, :child_id, 
                              :father_name, :father_id, :mother_name, :mother_id)";

        $insert_stmt = $db->prepare($insert_sql);
        $insert_stmt->bindParam(':kindergarten_id', $kindergarten['id']);
        $insert_stmt->bindParam(':serial_number', $person['serialNumber']);
        $insert_stmt->bindParam(':child_name', $person['childName']);
        $insert_stmt->bindParam(':birth_order', $person['birthOrder']);
        $insert_stmt->bindParam(':child_id', $person['childId']);
        $insert_stmt->bindParam(':father_name', $person['fatherName']);
        $insert_stmt->bindParam(':father_id', $person['fatherId']);
        $insert_stmt->bindParam(':mother_name', $person['motherName']);
        $insert_stmt->bindParam(':mother_id', $person['motherId']);

        if ($insert_stmt->execute()) {
            $successCount++;
        } else {
            $errorCount++;
            $errors[] = "第 " . ($index + 1) . " 行数据插入失败";
        }
    }

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => "导入完成 - {$kindergartenName}",
        'stats' => [
            'total' => count($personsData),
            'success' => $successCount,
            'duplicates' => $duplicateCount,
            'errors' => $errorCount
        ],
        'errors' => $errors,
        'duplicateIds' => $duplicateIdsArr
    ]);

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo json_encode([
        'success' => false,
        'message' => '导入错误: ' . $e->getMessage()
    ]);
}

// 查找或创建幼儿园函数
function findOrCreateKindergarten($db, $name) {
    // 先尝试查找
    $sql = "SELECT * FROM kindergartens WHERE name = :name";
    $stmt = $db->prepare($sql);
    $stmt->bindParam(':name', $name);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        return $stmt->fetch();
    }
    
    // 如果不存在，创建新的幼儿园
    $code = generateKindergartenCode($name);
    $sql = "INSERT INTO kindergartens (name, code) VALUES (:name, :code)";
    $stmt = $db->prepare($sql);
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':code', $code);
    $stmt->execute();
    
    return [
        'id' => $db->lastInsertId(),
        'name' => $name,
        'code' => $code
    ];
}

// 生成幼儿园代码函数
function generateKindergartenCode($name) {
    // 简单的中文转拼音首字母（实际应用中可以使用更复杂的拼音库）
    $pinyinMap = [
        '风' => 'F', '貌' => 'M', '街' => 'J', '实' => 'S', '验' => 'Y',
        '幼' => 'Y', '儿' => 'E', '园' => 'Y', '阳' => 'Y', '光' => 'G',
        '彩' => 'C', '虹' => 'H'
    ];
    
    $code = '';
    for ($i = 0; $i < mb_strlen($name); $i++) {
        $char = mb_substr($name, $i, 1);
        $code .= $pinyinMap[$char] ?? $char;
    }
    
    return $code . '_' . time();
}
?>