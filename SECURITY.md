# 安全说明

## uploads目录安全性分析

### 问题：直接访问 uploads/文件名 会不会被执行？

**答案：不会执行，且已被阻止。**

### 详细解释

1. **文件存储机制**
   - 所有上传的文件都被重命名为UUID格式（如：`9407071e4e6b475e81fb617f3f20245f.exe`）
   - 原始文件名仅保存在数据库中，下载时恢复
   - 攻击者无法猜测文件的实际存储名称

2. **Express静态文件配置**
   - `uploads` 目录**不在** Express 的静态文件服务范围内
   - 只有 `public` 目录被设置为静态文件目录
   - 直接访问 `/uploads/xxx` 会返回 404 错误

3. **下载时的安全保护**
   即使通过 `/download/:fileId` 接口下载，也有以下保护：
   ```javascript
   // 强制下载头
   Content-Disposition: attachment; filename="..."

   // 统一使用二进制流类型
   Content-Type: application/octet-stream

   // 禁止MIME类型嗅探
   X-Content-Type-Options: nosniff

   // 禁止缓存
   Cache-Control: no-cache
   ```

4. **为什么不会被执行？**
   - 浏览器收到 `Content-Disposition: attachment` 会直接下载，不会执行
   - `application/octet-stream` 告诉浏览器这是二进制数据
   - `X-Content-Type-Options: nosniff` 防止浏览器猜测文件类型
   - 即使是 `.exe`、`.bat`、`.js` 等可执行文件，也只会作为普通文件下载

### 测试示例

假设上传了一个名为 `virus.exe` 的文件：

1. **存储时**：文件被重命名为类似 `abc123def456.exe`
2. **直接访问 `/uploads/abc123def456.exe`**：返回 404（uploads不是静态目录）
3. **通过 `/download/abc123def` 下载**：
   - 浏览器弹出下载对话框
   - 文件保存为 `virus.exe`
   - **不会自动执行**

### 额外安全建议

如果要在生产环境部署，建议：

1. **Nginx配置**（如果使用）：
   ```nginx
   # 禁止直接访问uploads目录
   location /uploads {
       deny all;
       return 404;
   }
   ```

2. **文件权限**：
   ```bash
   # Linux下设置uploads目录无执行权限
   chmod 755 uploads
   chmod 644 uploads/*
   ```

3. **杀毒扫描**：
   - 集成杀毒软件API扫描上传文件
   - 记录上传IP地址用于追溯

4. **文件大小限制**：
   - 已在 `config.json` 中配置（默认10GB）
   - 可根据实际需求调整

## 配置文件安全

### config.json
```json
{
  "admin": {
    "username": "admin",      // 管理员用户名
    "password": "@admin123"   // 管理员密码（请修改！）
  },
  "server": {
    "port": 3000,                        // 服务器端口
    "maxFileSize": 10737418240          // 最大文件大小（字节），默认10GB
  }
}
```

**重要提示**：
- 首次使用前请修改管理员密码！
- `maxFileSize` 单位为字节，10GB = 10737418240
- 管理路径可自定义，建议使用隐蔽路径

## 会话安全

系统使用 express-session 进行会话管理：
- Session ID 存储在 cookie 中
- 默认有效期 24 小时
- 生产环境建议配置 HTTPS 和安全的 session secret

## 总结

本系统采用了多层安全防护：
1. UUID重命名防止文件名猜测
2. uploads目录不对外公开
3. 下载时强制设置安全响应头
4. 所有文件以二进制流方式传输
5. 后台管理需要登录认证
6. 支持中文文件名编码处理

**即使是恶意文件（病毒、木马等），也只能被下载，不会被执行。**
