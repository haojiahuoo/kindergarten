<?php
header('Content-Type: application/json; charset=utf-8');
$mysqli = new mysqli("localhost", "root", "", "kindergarten_db");

if ($mysqli->connect_errno) {
    echo json_encode(["success" => false, "error" => $mysqli->connect_error]);
    exit();
}

$result = $mysqli->query("SELECT id, name FROM kindergartens ORDER BY id DESC");
$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode(["success" => true, "kindergartens" => $data]);
?>
