#!/bin/bash

echo "========================================"
echo "  文件迅传 - 启动中..."
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[完成] Node.js 版本: $(node --version)"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "[2/3] 正在安装依赖..."
    npm install --production
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
else
    echo "[完成] 依赖已存在"
fi
echo ""

# 启动服务器
echo "[3/3] 启动服务器..."
echo ""
echo "========================================"
echo "  服务器启动成功！"
echo "========================================"
echo ""
echo "  首页地址: http://localhost:3000"
echo "  管理地址: http://localhost:3000/system-mgmt-2024"
echo ""
echo "  默认管理员账号:"
echo "    用户名: admin"
echo "    密码: admin123"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

node server.js
