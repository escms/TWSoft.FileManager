# 文件迅传 (TWSoft.FileManager) v1.1.0

一个简洁高效的文件上传下载系统，短链接分享、IP追踪和后台管理。

## 功能特点

- **简洁界面**：首页只有上传按钮和法律提示，打开即用
- **智能上传**：自动处理文件名冲突，支持最大10GB文件上传（可配置）
- **短链接分享**：自动生成6位短ID下载链接（如 `/d/abc123`）
- **IP追踪**：自动记录文件上传者IP地址
- **下载统计**：实时统计下载次数和最后下载时间
- **安全下载**：所有文件强制下载模式，禁止浏览器直接执行
- **后台管理**：独立的隐蔽管理页面，支持文件列表、下载、删除和统计查看
- **自动清理**：可配置过期文件自动清理（默认15天）
- **数据持久化**：使用SQLite数据库存储文件元数据

## 技术栈

- **后端框架**：Express.js 5.x
- **文件上传**：connect-busboy
- **数据库**：SQLite (better-sqlite3)
- **会话管理**：express-session
- **前端**：原生HTML/CSS/JavaScript

## 安装和运行

### 前置要求

- Node.js 16.x 或更高版本
- npm

### 安装步骤

```bash
# 克隆或下载项目
cd TWSoft.FileManager

# 安装依赖
npm install --production

# 启动服务器
npm start
```

服务器将在 `http://localhost:3000` 启动

## 使用说明

### 用户端

访问 `http://localhost:3000`

1. 点击"上传文件"按钮选择文件
2. 上传成功后显示下载链接和短链接
3. 复制链接即可分享给他人

### 管理端

访问 `http://localhost:3000/system-mgmt-2024`

**默认账号**：
- 用户名：`admin`
- 密码：`@admin123`

**功能**：
- 查看所有已上传文件列表
- 查看文件大小、上传时间、上传IP地址
- 实时下载次数统计和最后下载时间
- 下载文件或复制下载链接
- 删除不需要的文件
- 总览统计：文件总数、总大小、总下载次数

## API接口

### 上传文件

```
POST /upload
Content-Type: multipart/form-data

Request Body:
- file: 要上传的文件

Response:
{
  "success": true,
  "fileId": "完整文件ID",
  "shortId": "6位短ID",
  "fileName": "原始文件名",
  "downloadUrl": "/d/短ID",
  "fullUrl": "http://localhost:3000/d/短ID"
}
```

### 下载文件（短链接）

```
GET /d/:shortId

响应头包含：
- Content-Disposition: attachment; filename="原始文件名"
- Content-Type: application/octet-stream
- X-Content-Type-Options: nosniff
```

### 下载文件（完整链接）

```
GET /download/:fileId
```

### 获取文件列表（需登录）

```
GET /api/files

Response:
[
  {
    "id": "文件ID",
    "originalName": "原始文件名",
    "size": 文件大小(字节),
    "uploadTime": "上传时间",
    "downloadCount": 下载次数,
    "lastDownload": "最后下载时间",
    "uploadIP": "上传者IP地址",
    "downloadUrl": "/d/短ID"
  }
]
```

### 删除文件（需登录）

```
DELETE /api/files/:fileId

Response:
{
  "success": true,
  "message": "文件已删除"
}
```

### 截图
<img width="1279" height="805" alt="ScreenShot_2026-06-17_131941_431" src="https://github.com/user-attachments/assets/5a9d68b0-ccfb-4c63-80a1-dfe9eb00fc13" />
<img width="1057" height="915" alt="ScreenShot_2026-06-17_131921_273" src="https://github.com/user-attachments/assets/a623fd4f-8941-448b-9f05-38e5ae3aa44a" />


## 配置文件

编辑 `config.json`：

```json
{
  "admin": {
    "username": "admin",              // 管理员用户名
    "password": "@admin123",          // 管理员密码（请修改！）
    "path": "/system-mgmt-2024"       // 管理路径（可自定义）
  },
  "server": {
    "port": 3000,                     // 服务器端口
    "maxFileSize": 10737418240        // 最大文件大小（字节），默认10GB
  },
  "download": {
    "shortPath": true,                // 启用短链接
    "prefix": "/d"                    // 短链接前缀
  },
  "cleanup": {
    "enabled": true,                  // 启用自动清理
    "days": 15,                       // 保留天数
    "interval": 3600000               // 检查间隔（毫秒），默认1小时
  }
}
```

## 安全特性

1. **强制下载**：所有文件设置 `Content-Disposition: attachment`，防止浏览器执行
2. **Content-Type保护**：统一使用 `application/octet-stream`
3. **防嗅探**：设置 `X-Content-Type-Options: nosniff`
4. **UUID文件名**：存储时使用UUID重命名，原始文件名仅在下载时恢复
5. **隐蔽管理路径**：管理路径可自定义，提高安全性
6. **会话认证**：后台管理需要登录认证

## 法律声明

请遵守《中华人民共和国网络安全法》及相关法律法规，严禁上传、存储、传播以下内容：
- 危害国家安全、泄露国家秘密的内容
- 暴力恐怖、淫秽色情内容
- 侵犯他人知识产权的内容
- 计算机病毒、木马等恶意程序
- 其他法律法规禁止的内容

上传者需对上传内容承担法律责任，本平台仅提供技术服务。

## 注意事项

1. 文件存储在本地 `uploads` 目录
2. 元数据存储在 SQLite 数据库 (`files.db`)
3. 建议生产环境配置HTTPS
4. 首次使用请修改默认密码
5. 定期备份重要文件和数据
6. 监控磁盘空间使用情况

## 更新日志

### v1.1.0 (2026-06-17)

**新增功能**：
- ✅ IP追踪：自动记录文件上传者IP地址（支持代理环境）
- ✅ 下载统计：实时统计下载次数和最后下载时间
- ✅ 后台增强：显示上传IP、下载次数、最后下载时间
- ✅ 总览面板：文件总数、总大小、总下载次数统计

**优化改进**：
- ✅ 完善中文文件名编码支持（GBK/UTF-8自动识别）
- ✅ 修复文件大小显示问题（等待异步写入完成）
- ✅ 增强编码兼容性，支持多种编码场景
- ✅ 数据库结构升级（添加 upload_ip 字段）

### v1.0.0 (2024-06-16)
- 初始版本发布
- 基础文件上传下载功能
- 后台管理功能
- 短链接分享
- 自动清理机制
