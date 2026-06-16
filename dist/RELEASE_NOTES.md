# 文件迅传 v1.0.0 发布说明

## 版本信息

- **版本号**: v1.0.0
- **发布日期**: 2024-06-16
- **类型**: 首次发布

## 功能特性

### 核心功能
- 无需注册登录，打开即用的文件上传服务
- 支持大文件上传（最大10GB，可配置）
- 上传后自动生成唯一下载链接
- 所有文件强制下载（禁止浏览器执行）
- 简洁的首页设计，只有上传按钮和法律提示

### 安全管理
- 隐蔽的后台管理路径（`/system-mgmt-2024`）
- 后台管理需要用户名密码登录
- 所有上传文件使用 UUID 重命名
- 禁止直接访问 uploads 目录
- Content-Disposition 强制下载头
- X-Content-Type-Options 防止 MIME 类型嗅探

### 界面设计
- 响应式设计，支持各种屏幕尺寸
- 渐变色背景，现代化视觉效果
- 上传进度条显示
- 一键复制下载链接
- 法律声明左对齐显示，易于阅读

## 发布包内容

```
FileManager-v1.0.0-release/
├── server.js              # 主服务器文件
├── package.json           # 依赖配置
├── config.json            # 配置文件
├── start.bat              # Windows 启动脚本
├── start.sh               # Linux/Mac 启动脚本
├── README.md              # 使用说明
├── .gitignore             # Git 忽略文件
├── public/                # 前端文件
│   ├── index.html         # 首页
│   ├── admin.html         # 后台管理页面
│   └── login.html         # 登录页面
└── node_modules/          # 依赖包（已预安装）
```

## 系统要求

### 最低要求
- Node.js 14.x 或更高版本
- 操作系统：Windows 7+ / Linux / macOS
- 内存：512MB RAM
- 磁盘空间：100MB（不含上传文件）

### 推荐配置
- Node.js 18.x LTS
- 操作系统：Windows 10+ / Ubuntu 20.04+ / macOS 10.15+
- 内存：2GB RAM
- 磁盘空间：根据存储需求配置（建议 SSD）

## 快速开始

### Windows 用户
1. 解压发布包到目标目录
2. 双击运行 `start.bat`
3. 浏览器访问 http://localhost:3000

### Linux/Mac 用户
1. 解压发布包到目标目录
2. 执行 `chmod +x start.sh`
3. 运行 `./start.sh`
4. 浏览器访问 http://localhost:3000

## 配置修改

编辑 `config.json` 文件：

```json
{
  "admin": {
    "username": "your_username",  // 修改管理员用户名
    "password": "your_password",  // 修改管理员密码
    "path": "/system-mgmt-2024"   // 可修改管理路径
  },
  "server": {
    "port": 3000,                            // 修改端口
    "maxFileSize": 10737418240              // 修改文件大小限制
  }
}
```

## 重要提醒

1. **首次使用前必须修改默认密码！**
2. 生产环境建议配置 HTTPS
3. 定期备份 `uploads` 目录和 `metadata.json`
4. 监控磁盘空间使用情况
5. 定期清理过期文件

## 已知问题

- 无

## 更新日志

### v1.0.0 (2024-06-16)
- 首次发布
- 实现基础文件上传下载功能
- 添加后台管理功能
- 实现安全机制
- 优化界面设计

## 技术支持

如遇问题，请检查：
1. Node.js 是否正确安装（执行 `node --version`）
2. 端口是否被占用
3. 防火墙设置是否允许访问

详细部署文档请参考项目根目录下的 `DEPLOY_WINDOWS_NGINX.md`

---

**开发团队**: TWSoft
**项目名称**: 文件迅传 (File Manager)
**许可证**: ISC
