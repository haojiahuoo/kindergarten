<?php
header('Content-Type: text/html; charset=utf-8');
echo "<h2>多幼儿园管理系统 - 数据库设置</h2>";

$host = 'localhost';
$dbname = 'kindergarten_db';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // 创建数据库
    $pdo->exec("CREATE DATABASE IF NOT EXISTS $dbname CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "<p style='color:green;'>✓ 数据库 kindergarten_db 创建成功</p>";
    
    // 使用数据库
    $pdo->exec("USE $dbname");
    
    // 创建幼儿园表
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS kindergartens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(50) NOT NULL UNIQUE,
        address VARCHAR(200),
        contact_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "<p style='color:green;'>✓ 幼儿园表创建成功</p>";
    
    // 创建人员表
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS kindergarten_persons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kindergarten_id INT NOT NULL,
        serial_number INT NOT NULL,
        child_name VARCHAR(50) NOT NULL,
        birth_order INT NOT NULL,
        child_id CHAR(18) NOT NULL,
        father_name VARCHAR(50) NOT NULL,
        father_id CHAR(18) NOT NULL,
        mother_name VARCHAR(50) NOT NULL,
        mother_id CHAR(18) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_child_id (child_id),
        UNIQUE KEY unique_serial_kindergarten (serial_number, kindergarten_id),
        FOREIGN KEY (kindergarten_id) REFERENCES kindergartens(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "<p style='color:green;'>✓ 人员表创建成功</p>";
    
    // 插入示例幼儿园数据
    $check_kindergartens = $pdo->query("SELECT COUNT(*) as count FROM kindergartens")->fetch();
    if ($check_kindergartens['count'] == 0) {
        $pdo->exec("
        INSERT INTO kindergartens (name, code, address) VALUES
        ('风貌街实验幼儿园', 'FENGMAO', '风貌街123号'),
        ('阳光幼儿园', 'YANGGUANG', '阳光路456号'),
        ('彩虹幼儿园', 'CAIHONG', '彩虹路789号')
        ");
        echo "<p style='color:green;'>✓ 示例幼儿园数据插入成功</p>";
    }
    
    echo "<p style='color:green;'>🎉 数据库设置完成！</p>";
    echo "<p><a href='index.html'>点击这里返回主页面</a></p>";
    
} catch (PDOException $e) {
    echo "<p style='color:red;'>错误: " . $e->getMessage() . "</p>";
}
?>