# 文件迅传 - 发布版本

## 快速开始

### Windows 系统

1. **启动程序**
   - 双击运行 `start.bat`
   - 或在命令行执行：`start.bat`

2. **访问系统**
   - 首页：http://localhost:3000
   - 后台管理：http://localhost:3000/system-mgmt-2024

3. **默认管理员账号**
   - 用户名：admin
   - 密码：admin123

### Linux/Mac 系统

```bash
# 赋予执行权限
chmod +x start.sh

# 启动程序
./start.sh
```

## 配置说明

编辑 `config.json` 文件修改配置：

```json
{
  "admin": {
    "username": "admin",        // 管理员用户名
    "password": "admin123",     // 管理员密码（请修改！）
    "path": "/system-mgmt-2024" // 后台管理路径
  },
  "server": {
    "port": 3000,                        // 服务器端口
    "maxFileSize": 10737418240          // 最大文件大小（10GB）
  }
}
```

## 重要提示

1. **首次使用前请修改默认密码！**
2. 上传的文件存储在 `uploads` 目录
3. 文件元数据存储在 `metadata.json`
4. 建议生产环境配置 HTTPS

## 功能特点

- 无需注册登录，打开即用
- 支持大文件上传（最大10GB）
- 上传后自动生成下载链接
- 所有文件强制下载（禁止执行）
- 隐蔽的后台管理路径
- 简洁的界面设计

## 安全说明

- 后台管理路径已隐藏，只有知道确切路径才能访问
- 所有上传文件使用 UUID 重命名
- 下载时强制设置为附件下载，防止脚本执行
- 禁止直接访问 uploads 目录

## 常见问题

**Q: 如何修改端口？**
A: 编辑 `config.json` 中的 `server.port`

**Q: 如何修改文件大小限制？**
A: 编辑 `config.json` 中的 `server.maxFileSize`（单位：字节）

**Q: 忘记密码怎么办？**
A: 直接编辑 `config.json` 文件修改密码

**Q: 如何查看上传的文件？**
A: 访问后台管理路径 `/system-mgmt-2024` 登录后查看

## 技术支持

如遇问题，请检查：
1. Node.js 是否正确安装
2. 端口是否被占用
3. 防火墙设置

---

版本：1.0.0
发布日期：2024-06-16
