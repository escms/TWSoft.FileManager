@echo off
chcp 65001 >nul
echo ========================================
echo   文件迅传 - 启动中...
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [完成] Node.js 版本: 
node --version
echo.

echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install --production
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [完成] 依赖已存在
)
echo.

echo [3/3] 启动服务器...
echo.
echo ========================================
echo   服务器启动成功！
echo ========================================
echo.
echo   首页地址: http://localhost:3000
echo   管理地址: http://localhost:3000/system-mgmt-2024
echo.
echo   默认管理员账号:
echo     用户名: admin
echo     密码: admin123
echo.
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.

node server.js
