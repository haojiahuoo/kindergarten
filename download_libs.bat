@echo off
setlocal enabledelayedexpansion

:: 设置目标目录
set BASE_DIR=D:\xampp\htdocs\kindergarten\libs
set FONT_DIR=%BASE_DIR%\fontawesome

:: 创建目录
if not exist "%BASE_DIR%" mkdir "%BASE_DIR%"
if not exist "%FONT_DIR%" mkdir "%FONT_DIR%"

echo ===============================================
echo 🚀 开始下载依赖文件 (xlsx.full.min.js + Font Awesome)
echo ===============================================

:: 下载 xlsx.full.min.js
echo [1/3] 下载 xlsx.full.min.js ...
powershell -Command "Invoke-WebRequest -Uri https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js -OutFile '%BASE_DIR%\xlsx.full.min.js'"

:: 下载 Font Awesome Free v6.4.0 压缩包
echo [2/3] 下载 Font Awesome Free v6.4.0 ...
powershell -Command "Invoke-WebRequest -Uri https://use.fontawesome.com/releases/v6.4.0/fontawesome-free-6.4.0-web.zip -OutFile '%FONT_DIR%\fa.zip'"

:: 解压 Font Awesome
echo [3/3] 解压 Font Awesome ...
powershell -Command "Expand-Archive -Path '%FONT_DIR%\fa.zip' -DestinationPath '%FONT_DIR%' -Force"

:: 移动 css 和 webfonts 到统一目录
echo [整理] 移动 Font Awesome css 和 webfonts ...
if not exist "%FONT_DIR%\css" mkdir "%FONT_DIR%\css"
if not exist "%FONT_DIR%\webfonts" mkdir "%FONT_DIR%\webfonts"
xcopy "%FONT_DIR%\fontawesome-free-6.4.0-web\css" "%FONT_DIR%\css" /E /Y
xcopy "%FONT_DIR%\fontawesome-free-6.4.0-web\webfonts" "%FONT_DIR%\webfonts" /E /Y

:: 删除临时文件
rmdir /S /Q "%FONT_DIR%\fontawesome-free-6.4.0-web"
del "%FONT_DIR%\fa.zip"

echo ===============================================
echo ✅ 下载完成，目录结构如下：
echo %BASE_DIR%\xlsx.full.min.js
echo %FONT_DIR%\css\all.min.css
echo %FONT_DIR%\webfonts\...
echo ===============================================

pause
