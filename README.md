# 简易网盘系统

一个无需注册和登录的简易文件上传下载系统。

## 功能特点

- 首页简洁，只有上传按钮和法律提示
- 上传后自动生成唯一下载链接
- 所有文件强制下载（禁止浏览器直接执行）
- 独立的后台管理页面
- 文件大小限制：10GB（可配置）
- 使用UUID生成唯一文件名，防止文件名冲突和安全问题

## 安全特性

1. **强制下载**：所有文件下载时设置 `Content-Disposition: attachment`，浏览器会直接下载而不是执行
2. **Content-Type保护**：统一使用 `application/octet-stream`，防止恶意脚本执行
3. **X-Content-Type-Options: nosniff**：防止浏览器进行MIME类型嗅探
4. **随机文件名**：使用UUID重命名存储的文件，原始文件名仅在下载时恢复
5. **无执行权限**：上传目录不设置执行权限

## 安装和运行

### 前置要求

- Node.js (推荐 v14+)
- npm

### 安装步骤

```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

服务器将在 http://localhost:3000 启动

## 使用说明

### 首页
访问 http://localhost:3000
- 点击"上传文件"按钮选择文件
- 上传成功后会显示下载链接
- 可以一键复制链接分享

### 后台管理
访问 http://localhost:3000/system-mgmt-2024
- 需要登录（默认用户名：admin，密码：@admin123）
- 查看所有已上传的文件列表
- 查看文件大小和上传时间
- 下载或复制文件链接
- 删除不需要的文件

**注意**：管理路径已改为隐蔽路径 `/system-mgmt-2024`，提高安全性。

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
  "fileId": "文件ID",
  "fileName": "原始文件名",
  "downloadUrl": "/download/文件ID",
  "fullUrl": "完整下载链接"
}
```

### 下载文件
```
GET /download/:fileId

响应头包含：
- Content-Disposition: attachment; filename="原始文件名"
- Content-Type: application/octet-stream
- X-Content-Type-Options: nosniff
```

### 获取文件列表
```
GET /api/files

Response:
[
  {
    "id": "文件ID",
    "originalName": "原始文件名",
    "size": 文件大小(字节),
    "uploadTime": "上传时间(ISO格式)",
    "downloadUrl": "/download/文件ID"
  }
]
```

### 删除文件
```
DELETE /api/files/:fileId

Response:
{
  "success": true,
  "message": "文件已删除"
}
```

## 法律声明

请遵守《中华人民共和国网络安全法》及相关法律法规，严禁上传、存储、传播以下内容：
- 危害国家安全、泄露国家秘密的内容
- 暴力恐怖、淫秽色情内容
- 侵犯他人知识产权的内容
- 计算机病毒、木马等恶意程序
- 其他法律法规禁止的内容

上传者需对上传内容承担法律责任，本平台仅提供技术服务。

## 技术栈

- **后端框架**: Express.js
- **文件上传**: Multer
- **文件ID生成**: UUID
- **前端**: 原生HTML/CSS/JavaScript

## 注意事项

1. 文件存储在本地 `uploads` 目录
2. 文件元数据存储在 `metadata.json`
3. 单个文件最大10GB（可在 config.json 中配置）
4. 建议在生产环境配置HTTPS
5. 如需长期运行，建议定期清理过期文件
6. 后台管理路径已改为 `/system-mgmt-2024`，请在配置文件中修改默认密码
