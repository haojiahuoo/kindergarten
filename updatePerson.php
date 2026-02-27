<?php
// updatePerson.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// 数据库配置
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "kindergarten_db";

// 创建连接
$conn = new mysqli($servername, $username, $password, $dbname);

// 检查连接
if ($conn->connect_error) {
    die(json_encode(['success' => false, 'message' => '数据库连接失败: ' . $conn->connect_error]));
}

// 获取POST数据
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => '无效的输入数据']);
    exit;
}

// 转义输入数据
$originalChildId = $conn->real_escape_string($input['originalChildId']);
$childName = $conn->real_escape_string($input['childName']);
$birthOrder = intval($input['birthOrder']);
$childId = $conn->real_escape_string($input['childId']);
$fatherName = $conn->real_escape_string($input['fatherName']);
$fatherId = $conn->real_escape_string($input['fatherId']);
$motherName = $conn->real_escape_string($input['motherName']);
$motherId = $conn->real_escape_string($input['motherId']);
$kindergarten = $conn->real_escape_string($input['kindergarten']);

// 根据幼儿园名称获取 kindergarten_id
$kgSql = "SELECT id FROM kindergartens WHERE name = '$kindergarten'";
$kgResult = $conn->query($kgSql);
if ($kgResult->num_rows > 0) {
    $kgRow = $kgResult->fetch_assoc();
    $kindergartenId = $kgRow['id'];
} else {
    echo json_encode(['success' => false, 'message' => '未找到指定的幼儿园']);
    exit;
}

// 验证新的孩子身份证号是否已存在（排除当前记录）
$checkSql = "SELECT COUNT(*) as count FROM kindergarten_persons WHERE child_id = '$childId' AND child_id != '$originalChildId'";
$checkResult = $conn->query($checkSql);
$checkRow = $checkResult->fetch_assoc();

if ($checkRow['count'] > 0) {
    echo json_encode(['success' => false, 'message' => '新的孩子身份证号已存在，请使用其他身份证号']);
    exit;
}

// 获取当前记录的完整信息
$getCurrentSql = "SELECT * FROM kindergarten_persons WHERE child_id = '$originalChildId'";
$currentResult = $conn->query($getCurrentSql);
if ($currentResult->num_rows > 0) {
    $currentRow = $currentResult->fetch_assoc();
    $currentSerialNumber = $currentRow['serial_number'];
    $currentKindergartenId = $currentRow['kindergarten_id'];
} else {
    echo json_encode(['success' => false, 'message' => '未找到要更新的记录']);
    exit;
}

// 检查是否需要重新生成 serial_number
$needNewSerial = ($currentKindergartenId != $kindergartenId);
$newSerialNumber = $currentSerialNumber;

if ($needNewSerial) {
    // 获取新幼儿园最大的 serial_number
    $maxSerialSql = "SELECT MAX(serial_number) as max_serial FROM kindergarten_persons WHERE kindergarten_id = $kindergartenId";
    $maxSerialResult = $conn->query($maxSerialSql);
    $maxSerialRow = $maxSerialResult->fetch_assoc();
    $maxSerial = $maxSerialRow['max_serial'];
    
    if ($maxSerial === null) {
        // 新幼儿园没有记录，从1开始
        $newSerialNumber = 1;
    } else {
        $newSerialNumber = intval($maxSerial) + 1;
    }
}

// 开始事务处理
$conn->begin_transaction();

try {
    $updateSuccess = true;
    $personsUpdated = 0;
    
    // 1. 更新 kindergarten_persons 表 - 使用正确的 serial_number
    $sql1 = "UPDATE kindergarten_persons SET 
            child_name = '$childName',
            birth_order = $birthOrder,
            child_id = '$childId',
            father_name = '$fatherName',
            father_id = '$fatherId',
            mother_name = '$motherName',
            mother_id = '$motherId',
            kindergarten_id = $kindergartenId,
            serial_number = $newSerialNumber
            WHERE child_id = '$originalChildId'";
    
    if ($conn->query($sql1) === TRUE) {
        $personsUpdated = $conn->affected_rows;
    } else {
        $updateSuccess = false;
        throw new Exception('更新 kindergarten_persons 表失败: ' . $conn->error);
    }
    
    // 2. 只有在身份证号变更时才更新 monthly_data 表的基本信息
    if ($originalChildId != $childId) {
        $sql2 = "UPDATE monthly_data SET 
                name = '$childName',
                birth_order = $birthOrder,
                id_number = '$childId',
                parent_name = '$fatherName'
                WHERE id_number = '$originalChildId'";
        
        if ($conn->query($sql2) === TRUE) {
            $monthlyUpdated = $conn->affected_rows;
        } else {
            $updateSuccess = false;
            throw new Exception('更新 monthly_data 表失败: ' . $conn->error);
        }
    }
    
    // 如果所有更新都成功，提交事务
    if ($updateSuccess) {
        $conn->commit();
        
        if ($personsUpdated > 0) {
            // 获取更新后的完整记录
            $updatedRecordSql = "SELECT kp.*, k.name as kindergarten_name 
                                FROM kindergarten_persons kp 
                                LEFT JOIN kindergartens k ON kp.kindergarten_id = k.id 
                                WHERE kp.child_id = '$childId'";
            $updatedRecordResult = $conn->query($updatedRecordSql);
            $updatedRecord = $updatedRecordResult->fetch_assoc();
            
            echo json_encode([
                'success' => true, 
                'message' => '人员信息更新成功',
                'updatedRecord' => $updatedRecord,
                'details' => [
                    'kindergarten_persons_updated' => $personsUpdated,
                    'kindergarten_changed' => $needNewSerial,
                    'old_serial' => $currentSerialNumber,
                    'new_serial' => $newSerialNumber
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => '未找到要更新的记录或数据无变化']);
        }
    } else {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => '更新失败，事务已回滚']);
    }
    
} catch (Exception $e) {
    // 发生错误时回滚事务
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>