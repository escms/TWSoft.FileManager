# GitHub Release 发布说明

## ✅ 发布准备完成

仓库地址：https://github.com/escms/TWSoft.FileManager

### 当前版本

**v1.1.0** - 文件迅传增强版（IP追踪 + 下载统计）

### 发布内容

1. **完整源代码**
2. **配置文件**
3. **详细文档**

### 📦 发布包位置

在 GitHub 仓库中，源码位于根目录：

- `package.json` - 项目配置和依赖
- `server.js` - 主服务器文件（含IP记录和编码处理）
- `config.json` - 配置文件
- `public/` - 前端页面（含增强的后台管理）
- `README.md` - 使用说明
- `RELEASE_NOTES.md` - v1.1.0 详细发布说明
- `DEPLOY_WINDOWS_NGINX.md` - 部署指南
- `SECURITY.md` - 安全说明

### 🎯 创建 GitHub Release

1. 访问：https://github.com/escms/TWSoft.FileManager/releases/new
2. 选择标签：v1.1.0
3. 填写发布信息（见下方模板）
4. 上传附件（可选）
5. 点击 "Publish release"

### 📝 Release 描述模板

```markdown
# 文件迅传 v1.1.0 🚀

一个简洁高效的文件上传下载系统，支持中文文件名、IP追踪、下载统计和后台管理。

## ✨ 新功能 (v1.1.0)

- 🌐 **IP追踪**：自动记录文件上传者IP地址（支持代理环境）
- 📊 **下载统计**：实时统计下载次数和最后下载时间
- 📈 **后台增强**：显示上传IP、下载次数、最后下载时间
- 🎯 **总览面板**：文件总数、总大小、总下载次数统计
- 🔤 **编码优化**：完善中文文件名GBK/UTF-8自动识别
- 🐛 **Bug修复**：修复文件大小显示问题

## 🔧 核心功能

- 📤 **简单上传**：首页只有上传按钮，打开即用
- 🔗 **自动链接**：上传后自动生成唯一下载链接
- 🔒 **安全下载**：所有文件强制下载，禁止执行
- 🛡️ **隐蔽管理**：后台路径隐藏，需要登录认证
- 📦 **大文件支持**：最大支持10GB文件上传
- 🌏 **中文支持**：完美支持中文文件名，无乱码问题
- 🔢 **短链接**：6位短ID分享链接
- 🗑️ **自动清理**：可配置过期文件自动清理

## 🔐 安全机制

- UUID 文件名防止脚本执行
- Content-Disposition 强制下载头
- X-Content-Type-Options 防止 MIME 类型嗅探
- uploads 目录不暴露为静态资源
- 后台管理路径隐藏 (/system-mgmt-2024)
- GBK/UTF-8 编码自动识别
- IP地址记录便于审计

## 📥 安装使用

克隆仓库或下载源码：

```bash
git clone https://github.com/escms/TWSoft.FileManager.git
cd TWSoft.FileManager
```

安装依赖并启动：

```bash
npm install --production
npm start
```

### 访问地址
- 首页：http://localhost:3000
- 管理：http://localhost:3000/system-mgmt-2024

### 默认账号
- 用户名：admin
- 密码：@admin123

⚠️ **首次使用前请修改默认密码！**

## 📖 文档

- [README.md](https://github.com/escms/TWSoft.FileManager/blob/main/README.md) - 使用说明
- [DEPLOY_WINDOWS_NGINX.md](https://github.com/escms/TWSoft.FileManager/blob/main/DEPLOY_WINDOWS_NGINX.md) - 详细部署指南
- [SECURITY.md](https://github.com/escms/TWSoft.FileManager/blob/main/SECURITY.md) - 安全说明

## ⚙️ 配置

编辑 `config.json` 文件：

```json
{
  "admin": {
    "username": "your_username",
    "password": "your_password",
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

## 🛠️ 技术栈

- **后端**: Node.js + Express 5.x
- **文件上传**: connect-busboy
- **字符编码**: iconv-lite (GBK/UTF-8)
- **数据库**: SQLite (better-sqlite3)
- **会话管理**: express-session
- **前端**: 原生 HTML/CSS/JavaScript

## 📋 系统要求

- Node.js 16.x 或更高版本
- 操作系统：Windows 7+ / Linux / macOS
- 内存：512MB RAM（推荐 2GB+）
- 磁盘：100MB（不含上传文件）

## 📝 更新日志

### v1.1.0 (2026-06-17)

**新增功能**：
- ✨ IP追踪：自动记录文件上传者IP地址（支持代理环境）
- ✨ 下载统计：实时统计下载次数和最后下载时间
- ✨ 后台增强：显示上传IP、下载次数、最后下载时间
- ✨ 总览面板：文件总数、总大小、总下载次数统计

**优化改进**：
- 🔧 完善中文文件名编码支持（GBK/UTF-8自动识别）
- 🐛 修复文件大小显示问题（等待异步写入完成）
- 🔧 增强编码兼容性，支持多种编码场景
- 💾 数据库结构升级（添加 upload_ip 字段）

### v1.0.0 (2024-06-16)
- ✨ 首次发布
- ✨ 实现基础文件上传下载功能
- ✨ 添加后台管理功能
- ✨ 实现安全机制
- ✨ 优化界面设计

## ⚠️ 重要提示

1. 首次使用前必须修改默认密码
2. 生产环境建议配置 HTTPS
3. 定期备份 uploads 目录和 files.db
4. 监控磁盘空间使用情况
5. 启用自动清理功能管理存储空间

## 📄 许可证

ISC

---

**问题反馈**: 请在 GitHub Issues 中提出
**项目主页**: https://github.com/escms/TWSoft.FileManager
```

### ✨ 已完成

- [x] 代码准备完成
- [x] 文档更新完成
- [x] 版本号更新至 v1.1.0
- [ ] 在 GitHub 创建 Release（需手动操作）

### 🔗 相关链接

- 仓库主页：https://github.com/escms/TWSoft.FileManager
- Releases：https://github.com/escms/TWSoft.FileManager/releases
- Tags：https://github.com/escms/TWSoft.FileManager/tags
- Issues：https://github.com/escms/TWSoft.FileManager/issues

---

更新时间：2026-06-17
