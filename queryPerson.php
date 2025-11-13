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

try {
    // 构建查询条件
    $conditions = [];
    $params = [];

    // 孩子姓名查询 (模糊匹配)
    if (!empty($input['childName'])) {
        $conditions[] = "kp.child_name LIKE :child_name";
        $params[':child_name'] = '%' . $input['childName'] . '%';
    }

    // 孩子身份证号码查询 (精确匹配)
    if (!empty($input['childId'])) {
        $conditions[] = "kp.child_id = :child_id";
        $params[':child_id'] = $input['childId'];
    }

    // 孩次查询
    if (!empty($input['birthOrder'])) {
        $conditions[] = "kp.birth_order = :birth_order";
        $params[':birth_order'] = $input['birthOrder'];
    }

    // 父亲姓名查询 (模糊匹配)
    if (!empty($input['fatherName'])) {
        $conditions[] = "kp.father_name LIKE :father_name";
        $params[':father_name'] = '%' . $input['fatherName'] . '%';
    }

    // 父亲身份证号码查询 (精确匹配)
    if (!empty($input['fatherId'])) {
        $conditions[] = "kp.father_id = :father_id";
        $params[':father_id'] = $input['fatherId'];
    }

    // 母亲姓名查询 (模糊匹配)
    if (!empty($input['motherName'])) {
        $conditions[] = "kp.mother_name LIKE :mother_name";
        $params[':mother_name'] = '%' . $input['motherName'] . '%';
    }

    // 母亲身份证号码查询 (精确匹配)
    if (!empty($input['motherId'])) {
        $conditions[] = "kp.mother_id = :mother_id";
        $params[':mother_id'] = $input['motherId'];
    }

    // 托育机构查询 - 通过 kindergarten_id 关联查询
    if (!empty($input['kindergarten'])) {
        // 如果是数字，按 kindergarten_id 查询
        if (is_numeric($input['kindergarten'])) {
            $conditions[] = "kp.kindergarten_id = :kindergarten_id";
            $params[':kindergarten_id'] = $input['kindergarten'];
        } else {
            // 如果是字符串，按幼儿园名称查询，先获取ID
            $kgStmt = $pdo->prepare("SELECT id FROM kindergartens WHERE name = ?");
            $kgStmt->execute([$input['kindergarten']]);
            $kgData = $kgStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($kgData) {
                $conditions[] = "kp.kindergarten_id = :kindergarten_id";
                $params[':kindergarten_id'] = $kgData['id'];
            } else {
                // 如果没有找到对应的幼儿园，返回空结果
                $conditions[] = "1 = 0"; // 强制返回空结果
            }
        }
    }

    // 构建SQL查询 - 关联 kindergarten_persons 和 kindergartens 表
    $sql = "
        SELECT 
            kp.child_name as childName,
            kp.birth_order as birthOrder,
            kp.child_id as childId,
            kp.father_name as fatherName,
            kp.father_id as fatherId,
            kp.mother_name as motherName,
            kp.mother_id as motherId,
            kg.name as kindergartenName,
            kp.kindergarten_id as kindergartenId,
            kp.serial_number as serialNumber,
            kp.created_at as createdAt
        FROM kindergarten_persons kp
        LEFT JOIN kindergartens kg ON kp.kindergarten_id = kg.id
    ";
    
    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(' AND ', $conditions);
    }
    
    // 修改排序：将 serial_number 转换为数字进行排序
$sql .= " ORDER BY CAST(kp.serial_number AS UNSIGNED) ASC, kp.created_at DESC LIMIT 100";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $persons = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($persons) {
        echo json_encode([
            'success' => true,
            'persons' => $persons,
            'count' => count($persons),
            'message' => '查询成功，找到 ' . count($persons) . ' 条记录'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => '未找到符合条件的人员信息'
        ]);
    }
    
} catch (PDOException $e) {
    error_log("查询错误: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'message' => '查询失败: ' . $e->getMessage()
    ]);
}
?>