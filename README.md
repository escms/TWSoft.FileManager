# 文件迅传 (TWSoft.FileManager) v3.0.0

一个简洁高效的文件上传下载系统，支持多文件/文件夹上传、上传ID管理、短链接分享、文件预览、多语言、IP追踪和后台管理。

## 功能特点

- **多文件上传**：支持同时选择多个文件上传
- **文件夹上传**：保留文件夹结构，自动重建目录树
- **上传ID管理**：一次上传生成一个唯一ID，便于整体查看和分享
- **短链接分享**：
  - 上传ID查看短链 `/v/{6位短ID}`（自动防冲突）
  - 文件下载短链 `/f/{6位短ID}`
- **IP追踪**：自动记录文件上传者IP地址
- **下载统计**：实时统计下载次数和最后下载时间
- **文件预览**：支持文本、图片、PDF、视频、音频等格式在线预览（HMAC 签名短时链接防盜链）
- **多语言**：内置中文/英文，可自行配置语言文件扩展
- **安全下载**：所有文件强制下载模式（`Content-Disposition: attachment`）
- **后台管理**：独立的隐蔽管理页面，按上传ID分组展示，支持下载、删除和统计
- **ZIP打包下载**：支持批量选择文件打包为 ZIP 下载
- **自动清理**：可配置过期文件自动清理（默认15天）
- **数据持久化**：使用SQLite数据库存储文件元数据
- **中文编码兼容**：自动识别 GBK/UTF-8/Latin-1 编码

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

1. 点击"上传文件"按钮选择文件或文件夹（使用 `webkitdirectory`）
2. 上传成功后显示上传ID短链 `/v/xxxxxx` 和每个文件的下载短链 `/f/xxxxxx`
3. 上传ID查看页面支持按原始目录树结构展示，可勾选文件打包 ZIP 下载

### 管理端

首次启动后，系统会在控制台输出随机生成的管理路径。

**默认账号**（请在 config.json 中修改）：
- 用户名：`admin`
- 密码：首次启动时请修改 config.json 中的密码

**功能**：
- 按上传ID分组查看所有已上传文件
- 查看文件路径（含文件名）、大小、上传时间、上传IP
- 实时下载次数统计和最后下载时间
- 下载文件或复制下载链接
- 删除不需要的文件
- 总览统计：文件总数、总大小、总下载次数

**安全提示**：
- ⚠️ 首次使用请立即修改 config.json 中的管理员密码
- 💡 支持通过环境变量 `ADMIN_PASSWORD` 设置密码
- 🔒 管理路径在首次启动时会随机生成

## API接口

### 上传文件（多文件/文件夹）

```
POST /upload
Content-Type: multipart/form-data

Request Body:
- files[]: 文件流（支持多个）
- relativePath[N]: 对应文件的相对路径（含文件名）

Response:
{
  "success": true,
  "batchId": "完整上传ID",
  "batchShortId": "6位上传短ID",
  "files": [
    {
      "fileId": "完整文件ID",
      "fileName": "原始文件名",
      "downloadUrl": "/f/短ID",
      "size": 文件大小
    }
  ],
  "viewUrl": "/v/上传短ID",
  "fullViewUrl": "http://localhost:3000/v/上传短ID"
}
```

### 查看上传ID文件列表

短链方式：
```
GET /api/batch/short/:batchShortId
```

长链方式：
```
GET /api/batch/:batchId
```

Response:
```json
[
  {
    "id": "文件ID",
    "originalName": "原始文件名",
    "relativePath": "相对路径",
    "size": 文件大小(字节),
    "downloadCount": 下载次数,
    "uploadTime": "上传时间",
    "batchId": "上传ID",
    "batchShortId": "上传短ID",
    "downloadUrl": "/f/短ID"
  }
]
```

### 下载文件

短链接下载：
```
GET /f/:shortId
```

完整链接下载：
```
GET /download/:fileId
```

### 打包下载（ZIP）

```
POST /download-zip
Content-Type: application/json

Body: { "ids": ["fileId1", "fileId2", ...] }
Response: application/zip 流
```

### 获取文件列表（需登录）

```
GET /api/files

Response:
[
  {
    "id": "文件ID",
    "originalName": "原始文件名",
    "relativePath": "相对路径",
    "size": 文件大小(字节),
    "uploadTime": "上传时间",
    "downloadCount": 下载次数,
    "lastDownload": "最后下载时间",
    "uploadIP": "上传者IP地址",
    "batchId": "上传ID",
    "batchShortId": "上传短ID",
    "downloadUrl": "/f/短ID"
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

### 获取预览签名

```
GET /api/preview-token/:shortId

Response:
{
  "supported": true,
  "previewType": "image|text|pdf|video|audio",
  "mimeType": "image/png",
  "url": "/pv/xxx?exp=...&sig=...",
  "fileName": "原始文件名",
  "size": 文件大小
}
```

### 预览文件

```
GET /pv/:shortId?exp=...&sig=...

响应头（根据类型）：
- 文本: Content-Type: text/plain; charset=utf-8
- 图片: Content-Type: image/png (等)
- PDF: Content-Type: application/pdf
- 视频/音频: 支持 Range 请求分段流式播放
```

### 多语言

```
GET /api/lang/:locale
Response: { "key": "value", ... }

POST /api/lang
Body: { "lang": "en" }
Response: { "success": true, "lang": "en" }

GET /api/config
Response: { "i18n": { "defaultLang": "zh-CN", "supportedLangs": ["zh-CN","en"] } }
```

### 登录/登出

```
POST /api/login
Body: { "username": "admin", "password": "xxx", "captcha": "1234" }
Response: { "success": true, "redirectPath": "/随机管理路径" }

POST /api/logout
Response: { "success": true, "message": "已退出登录" }

GET /api/check-login
Response: { "isLoggedIn": true/false }
```

### 截图
<img width="1279" height="805" alt="ScreenShot_2026-06-17_131941_431" src="https://github.com/user-attachments/assets/5a9d68b0-ccfb-4c63-80a1-dfe9eb00fc13" />
<img width="1057" height="915" alt="ScreenShot_2026-06-17_131921_273" src="https://github.com/user-attachments/assets/a623fd4f-8941-448b-9f05-38e5ae3aa44a" />


## 配置文件

编辑 `config.json`：

```json
{
  "admin": {
    "username": "admin",              // 管理员用户名（建议修改）
    "password": "CHANGE_ME_PLEASE",   // ⚠️ 请立即修改此密码！
    "path": "/admin-panel"            // 管理路径（首次启动会自动生成随机路径）
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
  },
  "i18n": {
    "defaultLang": "zh-CN",           // 默认语言
    "supportedLangs": ["zh-CN","en"]  // 支持的语言列表
  }
}
```

### 环境变量配置（推荐）

为了安全起见，推荐使用环境变量配置敏感信息：

```bash
# Linux/Mac
export ADMIN_USERNAME="your_username"
export ADMIN_PASSWORD="your_secure_password"
export ADMIN_PATH="/your_custom_path"

# Windows
set ADMIN_USERNAME=your_username
set ADMIN_PASSWORD=your_secure_password
set ADMIN_PATH=/your_custom_path

# 然后启动
npm start
```

或在 `.env` 文件中配置（需要安装 dotenv）：

```env
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_secure_password
ADMIN_PATH=/your_custom_path
```

## 短链接系统

### 上传ID查看短链

格式： `/v/{shortId}`  
shortId 由上传ID（UUID）的前6位生成，若冲突则逐位扩展或追加随机后缀，确保唯一。

### 文件下载短链

格式： `/f/{shortId}`  
shortId 由文件UUID的前6位生成，碰撞时自动扩展，保证每个文件有唯一短链。

## 文件预览

支持文本、图片、PDF、视频、音频等格式在线预览。

**预览链接**：`/pv/{shortId}?exp=时间戳&sig=签名`  
- HMAC-SHA256 签名，10 分钟有效期，无法伪造
- 视频/音频支持 Range 请求分段流式播放
- 不支持的格式提示用户下载查看

**支持的格式**：
- 文本：`.txt .css .js .json .html .xml .md .csv .log .yaml .yml`
- 图片：`.jpg .jpeg .png .gif .webp .svg .bmp .ico`
- PDF：`.pdf`
- 视频：`.mp4 .webm .avi .mov .mkv .wmv .flv`
- 音频：`.mp3 .wav .ogg .flac .aac`

## 多语言（i18n）

默认内置中文（zh-CN）和英文（en），可在 `lang/` 目录下添加语言文件扩展。

**语言文件格式**（JSON key-value）：
```json
{ "app.name": "文件迅传", "upload.btn": "上传文件", ... }
```

**检测顺序**：
1. 用户通过页面右上角下拉菜单切换（存入 session）
2. 浏览器 `Accept-Language` 请求头自动匹配
3. `config.json` 中 `i18n.defaultLang` 配置项（默认 `zh-CN`）

## 安全特性

1. **强制下载**：所有文件设置 `Content-Disposition: attachment`，防止浏览器执行
2. **Content-Type保护**：统一使用 `application/octet-stream`
3. **防嗅探**：设置 `X-Content-Type-Options: nosniff`
4. **UUID文件名**：存储时使用UUID重命名，原始文件名仅在下载时恢复
5. **随机管理路径**：首次启动自动生成随机管理路径
6. **环境变量支持**：支持通过环境变量覆盖敏感配置
7. **会话认证**：后台管理需要登录认证
8. **密码安全提醒**：检测到默认密码时会发出警告

## 法律声明

请遵守《中华人民共和国网络安全法》及相关法律法规，严禁上传、存储、传播以下内容：
- 危害国家安全、泄露国家秘密的内容
- 暴力恐怖、淫秽色情内容
- 侵犯他人知识产权的内容
- 计算机病毒、木马等恶意程序
- 其他法律法规禁止的内容

上传者需对上传内容承担法律责任，本平台仅提供技术服务。

## 注意事项

1. 文件存储在本地 `uploads` 目录（按 `yyyyMMdd` 日期目录归档）
2. 元数据存储在 SQLite 数据库 (`files.db`)
3. 建议生产环境配置HTTPS
4. 首次使用请修改默认密码
5. 定期备份重要文件和数据
6. 监控磁盘空间使用情况

## 更新日志

### v3.0.0

**多语言（i18n）**：
- 新增语言包系统（`lang/` 目录），默认内置中文（zh-CN）和英文（en）
- 前端 `t(key)` 函数统一管理 UI 文本
- 页面右上角语言切换下拉菜单，选择后存入 session
- 支持 `Accept-Language` 请求头自动检测
- 新增 `GET /api/lang/:locale`、`POST /api/lang`、`GET /api/config` 接口

**文件预览**：
- HMAC-SHA256 签名短时链接（10分钟有效），防止盗链
- 支持文本（txt/css/js/html/md/json 等）、图片（jpg/png/gif/webp/svg）、PDF、视频（mp4/webm/avi 等）、音频（mp3/wav 等）在线预览
- 视频/音频支持 Range 请求分段流式播放
- 管理页和上传查看页面增加"预览"按钮
- 新增 `GET /api/preview-token/:shortId`、`GET /pv/:shortId?exp=&sig=` 接口

### v2.0.0

**安全增强**：
- 新增登录验证码（数学SVG图形验证码），防止暴力破解
- 全系统仅保留短链接（`/v/` 上传ID查看、`/f/` 文件下载），移除长链接兼容代码

**存储与代码优化**：
- 存储目录从 `YYYY/MM/DD` 嵌套结构改为 `yyyyMMdd` 单层目录，路径更简洁
- 移除 `formidable` 未使用依赖
- 清理 `decodeFilename` 中的调试日志，保留注释说明

### v1.3.0

**上传ID与短链系统**：
- 新增多文件/文件夹上传，保留原始目录结构
- 新增上传ID管理：一次上传生成一个唯一ID
- 上传ID查看短链 `/v/{shortId}`（自动防冲突）
- 文件下载短链 `/f/{shortId}`（自动防冲突）
- 后台按上传ID分组展示文件，查看链接使用短链
- 支持 ZIP 打包下载选中文件
- 管理页面路径列替代文件名列，更清晰地展示目录结构

### v1.2.0 (2026-06-19)

**安全增强**：
- 移除默认密码，使用占位符提醒用户修改
- 首次启动自动生成随机管理路径
- 支持环境变量配置敏感信息（ADMIN_USERNAME、ADMIN_PASSWORD、ADMIN_PATH）
- 检测到默认密码时发出安全警告
- 提供 config.example.json 示例配置文件

### v1.1.0 (2026-06-17)

**新增功能**：
- IP追踪：自动记录文件上传者IP地址（支持代理环境）
- 下载统计：实时统计下载次数和最后下载时间
- 后台增强：显示上传IP、下载次数、最后下载时间
- 总览面板：文件总数、总大小、总下载次数统计

**优化改进**：
- 完善中文文件名编码支持（GBK/UTF-8自动识别）
- 修复文件大小显示问题（等待异步写入完成）
- 增强编码兼容性，支持多种编码场景
- 数据库结构升级（添加 upload_ip 字段）

### v1.0.0 (2024-06-16)
- 初始版本发布
- 基础文件上传下载功能
- 后台管理功能
- 短链接分享
- 自动清理机制
