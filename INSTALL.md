# 文件迅传 v2.0.0 - 安装说明

## ⚠️ 重要提示

本版本使用 SQLite 数据库，需要编译原生模块。

## Windows 用户

### 方法一：使用预编译版本（推荐）

如果下载的是已编译版本，直接运行即可：

```bash
start.bat
```

### 方法二：从源码编译

如果遇到错误，需要安装编译工具：

1. 安装 Windows Build Tools：
   ```bash
   npm install --global windows-build-tools
   ```

2. 或者安装 Visual Studio Build Tools：
   - 下载：https://visualstudio.microsoft.com/downloads/
   - 选择"使用C++的桌面开发"
   - 勾选"MSVC v14x 生成工具"和"Windows SDK"

3. 重新安装依赖：
   ```bash
   npm install
   ```

## Linux/Mac 用户

确保安装了必要的编译工具：

```bash
# Ubuntu/Debian
sudo apt-get install build-essential python3

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install python3

# macOS
xcode-select --install
```

然后运行：
```bash
./start.sh
```

## 常见问题

### Q: 提示 "better-sqlite3 编译失败"

**解决方案**：
```bash
# Windows
npm install --global windows-build-tools
npm rebuild better-sqlite3

# Linux/Mac
npm rebuild better-sqlite3
```

### Q: 提示 "Python 未找到"

**解决方案**：
```bash
npm config set python python3
npm rebuild better-sqlite3
```

### Q: 首次启动很慢

**原因**：正在编译 SQLite 模块，请耐心等待。

## 最低系统要求

- Node.js 14.x 或更高版本
- npm 6.x 或更高版本
- 磁盘空间：200MB（含依赖）
- 内存：512MB RAM

## 快速开始

1. 解压文件到任意目录
2. 双击 `start.bat` (Windows) 或运行 `./start.sh` (Linux/Mac)
3. 浏览器访问 http://localhost:3000

## 配置

编辑 `config.json` 修改设置：

```json
{
  "admin": {
    "username": "admin",
    "password": "@admin123",
    "path": "/system-mgmt-2024"
  },
  "server": {
    "port": 3000,
    "maxFileSize": 10737418240
  },
  "download": {
    "shortPath": true,
    "prefix": "/d"
  },
  "cleanup": {
    "enabled": true,
    "days": 15,
    "interval": 3600000
  }
}
```

---

版本：v2.0.0
发布日期：2026-06-17
