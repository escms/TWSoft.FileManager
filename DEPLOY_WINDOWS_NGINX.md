# Windows + Nginx 部署指南

## 目录
- [环境要求](#环境要求)
- [第一步：安装 Node.js](#第一步安装-nodejs)
- [第二步：安装 Nginx](#第二步安装-nginx)
- [第三步：部署应用](#第三步部署应用)
- [第四步：配置 Nginx](#第四步配置-nginx)
- [第五步：配置防火墙](#第五步配置防火墙)
- [第六步：设置为开机自启动](#第六步设置为开机自启动)
- [安全加固建议](#安全加固建议)
- [常见问题](#常见问题)

---

## 环境要求

### 系统要求
- Windows Server 2012 R2 或更高版本
- Windows 10/11 Professional（测试环境）

### 软件要求
- Node.js 16.x 或更高版本
- Nginx for Windows 1.20.x 或更高版本
- Git（可选，用于代码管理）

### 硬件要求
- CPU: 2核心以上
- 内存: 4GB 以上
- 硬盘: 根据存储需求配置（建议 SSD）

---

## 第一步：安装 Node.js

### 1.1 下载 Node.js

访问 Node.js 官网：https://nodejs.org/

下载 **LTS（长期支持）** 版本的 Windows Installer (.msi)

### 1.2 安装步骤

1. 双击下载的 `.msi` 文件
2. 点击 "Next" 接受许可协议
3. 选择安装路径（推荐：`C:\Program Files\nodejs\`）
4. 勾选 "Automatically install the necessary tools"（自动安装必要工具）
5. 点击 "Install" 开始安装
6. 安装完成后点击 "Finish"

### 1.3 验证安装

打开命令提示符（CMD）或 PowerShell，执行：

```bash
node --version
npm --version
```

应该显示类似：
```
v18.17.0
9.6.7
```

---

## 第二步：安装 Nginx

### 2.1 下载 Nginx

访问 Nginx 官网：http://nginx.org/en/download.html

下载 **Stable version** 的 Windows 版本（nginx/Windows-1.xx.x）

### 2.2 安装步骤

1. 解压下载的压缩包到目标目录，例如：`C:\nginx\`
2. 目录结构应该是：
   ```
   C:\nginx\
   ├── conf\
   ├── html\
   ├── logs\
   ├── temp\
   └── nginx.exe
   ```

### 2.3 测试 Nginx

打开命令提示符（以管理员身份运行）：

```bash
cd C:\nginx
start nginx
```

在浏览器中访问 `http://localhost`，应该看到 "Welcome to nginx!" 页面。

### 2.4 Nginx 常用命令

```bash
# 启动 Nginx
start nginx

# 停止 Nginx
nginx -s stop

# 重新加载配置
nginx -s reload

# 检查配置文件语法
nginx -t

# 优雅关闭（完成当前请求后关闭）
nginx -s quit
```

---

## 第三步：部署应用

### 3.1 准备应用文件

将项目文件复制到服务器，例如：`C:\www\filemanager\`

目录结构：
```
C:\www\filemanager\
├── config.json
├── server.js
├── package.json
├── public\
│   ├── index.html
│   ├── admin.html
│   └── login.html
├── uploads\          (运行时自动创建)
└── files.db          (运行时自动创建)
```

### 3.2 安装依赖

打开命令提示符：

```bash
cd C:\www\filemanager
npm install --production
```

### 3.3 修改配置文件

编辑 `config.json`：

```json
{
  "admin": {
    "username": "your_admin_username",
    "password": "your_strong_password"
  },
  "server": {
    "port": 3000,
    "maxFileSize": 10737418240
  }
}
```

**重要**：请修改默认的用户名和密码！

### 3.4 测试应用

```bash
cd C:\www\filemanager
npm start
```

在浏览器中访问 `http://localhost:3000`，确认应用正常运行。

按 `Ctrl+C` 停止应用。

---

## 第四步：配置 Nginx

### 4.1 备份默认配置

```bash
cd C:\nginx\conf
copy nginx.conf nginx.conf.bak
```

### 4.2 编辑 Nginx 配置文件

用文本编辑器打开 `C:\nginx\conf\nginx.conf`，替换为以下内容：

```nginx
# 工作进程数（通常设置为CPU核心数）
worker_processes  4;

# 错误日志
error_log  logs/error.log  warn;

# PID文件
pid        logs/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  logs/access.log  main;

    # 性能优化
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;

    # 上传文件大小限制（与Node.js配置保持一致，10GB）
    client_max_body_size 10G;

    # Gzip压缩
    gzip  on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 上游Node.js服务器
    upstream nodejs_app {
        server 127.0.0.1:3000;
        keepalive 64;
    }

    # HTTP服务器配置
    server {
        listen       80;
        server_name  your_domain.com www.your_domain.com;

        # 字符集
        charset utf-8;

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # 禁止访问隐藏文件
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        # 禁止直接访问uploads目录（重要安全措施）
        location /uploads/ {
            deny all;
            return 404;
        }

        # 禁止访问敏感文件
        location ~* \.(json|md|txt)$ {
            deny all;
        }

        # 代理到Node.js应用
        location / {
            proxy_pass http://nodejs_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # 超时设置（支持大文件上传）
            proxy_connect_timeout 60s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;

            # 缓冲设置
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # 静态文件缓存（可选，提高性能）
        location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
            proxy_pass http://nodejs_app;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # HTTPS配置（推荐启用）
    # server {
    #     listen       443 ssl http2;
    #     server_name  your_domain.com www.your_domain.com;
    #
    #     # SSL证书
    #     ssl_certificate      C:/ssl/your_domain.crt;
    #     ssl_certificate_key  C:/ssl/your_domain.key;
    #
    #     # SSL配置
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #     ssl_prefer_server_ciphers on;
    #     ssl_session_cache shared:SSL:10m;
    #     ssl_session_timeout 10m;
    #
    #     # 其他配置同上...
    # }
}
```

### 4.3 修改配置要点

根据实际情况修改以下配置：

1. **worker_processes**: 设置为服务器CPU核心数
2. **server_name**: 修改为你的域名
3. **client_max_body_size**: 与 `config.json` 中的 `maxFileSize` 保持一致
4. **SSL证书**: 如果启用HTTPS，配置证书路径

### 4.4 测试配置

```bash
cd C:\nginx
nginx -t
```

如果显示 `syntax is ok` 和 `test is successful`，说明配置正确。

### 4.5 启动服务

```bash
# 停止Nginx（如果正在运行）
nginx -s stop

# 重新启动
start nginx
```

---

## 第五步：配置防火墙

### 5.1 开放端口

以管理员身份运行 PowerShell：

```powershell
# 开放HTTP端口（80）
New-NetFirewallRule -DisplayName "Nginx HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# 开放HTTPS端口（443，如果启用）
New-NetFirewallRule -DisplayName "Nginx HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# 如果直接访问Node.js（不推荐），开放3000端口
# New-NetFirewallRule -DisplayName "Node.js App" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

或者通过图形界面：
1. 打开 "高级安全 Windows 防火墙"
2. 点击 "入站规则" -> "新建规则"
3. 选择 "端口" -> "TCP" -> 输入端口号（80, 443）
4. 选择 "允许连接"
5. 命名规则并保存

### 5.2 验证防火墙

从外部机器访问：
```bash
curl http://your_server_ip
```

---

## 第六步：设置为开机自启动

### 方法一：使用 Windows 任务计划程序（推荐）

#### 6.1.1 创建启动脚本

创建文件 `C:\www\filemanager\start.bat`：

```batch
@echo off
cd /d C:\www\filemanager
npm start >> C:\www\filemanager\logs\app.log 2>&1
```

创建日志目录：
```bash
mkdir C:\www\filemanager\logs
```

#### 6.1.2 创建任务计划

1. 打开 "任务计划程序"
2. 点击 "创建基本任务"
3. 名称：`FileManager App`
4. 触发器：选择 "计算机启动时"
5. 操作：选择 "启动程序"
6. 程序/脚本：浏览选择 `C:\www\filemanager\start.bat`
7. 完成向导

#### 6.1.3 配置Nginx自启动

同样创建任务，启动程序为 `C:\nginx\nginx.exe`

### 方法二：使用 NSSM（Non-Sucking Service Manager）

#### 6.2.1 下载 NSSM

访问：https://nssm.cc/release/

下载最新版本的 ZIP 包，解压到 `C:\nssm\`

#### 6.2.2 安装 Node.js 应用为服务

以管理员身份运行 CMD：

```bash
cd C:\nssm

# 安装Node.js应用服务
nssm install FileManagerApp

# 在弹出的GUI中配置：
# Path: C:\Program Files\nodejs\node.exe
# Startup directory: C:\www\filemanager
# Arguments: C:\www\filemanager\server.js

# 或者直接命令行配置
nssm set FileManagerApp Application C:\Program Files\nodejs\node.exe
nssm set FileManagerApp AppDirectory C:\www\filemanager
nssm set FileManagerApp AppParameters C:\www\filemanager\server.js
nssm set FileManagerApp DisplayName "File Manager Application"
nssm set FileManagerApp Description "Simple File Manager Node.js Application"
nssm set FileManagerApp Start SERVICE_AUTO_START
```

#### 6.2.3 安装 Nginx 为服务

```bash
nssm install NginxService
nssm set NginxService Application C:\nginx\nginx.exe
nssm set NginxService AppDirectory C:\nginx
nssm set NginxService AppParameters ""
nssm set NginxService DisplayName "Nginx Web Server"
nssm set NginxService Start SERVICE_AUTO_START
```

#### 6.2.4 管理服务

```bash
# 启动服务
net start FileManagerApp
net start NginxService

# 停止服务
net stop FileManagerApp
net stop NginxService

# 查看服务状态
sc query FileManagerApp
sc query NginxService
```

### 方法三：使用 PM2（推荐用于Node.js应用）

#### 6.3.1 安装 PM2

```bash
npm install -g pm2
```

#### 6.3.2 创建 PM2 配置文件

创建 `C:\www\filemanager\pm2.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'filemanager',
    script: 'server.js',
    cwd: 'C:\\www\\filemanager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: 'C:\\www\\filemanager\\logs\\pm2-error.log',
    out_file: 'C:\\www\\filemanager\\logs\\pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

#### 6.3.3 启动应用

```bash
cd C:\www\filemanager
pm2 start pm2.config.js
```

#### 6.3.4 设置开机自启动

```bash
# 生成启动脚本
pm2 startup

# 保存当前进程列表
pm2 save
```

按照提示执行生成的命令。

#### 6.3.5 PM2 常用命令

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs filemanager

# 重启应用
pm2 restart filemanager

# 停止应用
pm2 stop filemanager

# 删除应用
pm2 delete filemanager

# 监控
pm2 monit
```

---

## 安全加固建议

### 1. 修改默认密码

编辑 `config.json`，设置强密码：

```json
{
  "admin": {
    "username": "your_unique_username",
    "password": "Your$tr0ng&P@ssw0rd!2024"
  }
}
```

### 2. 启用 HTTPS

#### 2.1 获取 SSL 证书

选项：
- Let's Encrypt（免费）：https://letsencrypt.org/
- 商业证书（付费）

#### 2.2 配置 Nginx SSL

取消注释 `nginx.conf` 中的 HTTPS 配置部分，修改证书路径：

```nginx
ssl_certificate      C:/ssl/fullchain.pem;
ssl_certificate_key  C:/ssl/privkey.pem;
```

#### 2.3 强制 HTTPS 重定向

在 HTTP server 块中添加：

```nginx
server {
    listen       80;
    server_name  your_domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. 限制访问 IP（可选）

如果只允许特定 IP 访问后台：

```nginx
location /system-mgmt-2024 {
    allow 192.168.1.100;  # 允许的IP
    deny all;
    proxy_pass http://nodejs_app;
}
```

### 4. 启用访问日志审计

在 `nginx.conf` 中确保启用了访问日志：

```nginx
access_log  logs/access.log  main;
```

定期审查日志：
```bash
# 查看最近的访问
tail -f C:\nginx\logs\access.log
```

### 5. 配置 fail2ban 类似功能

使用 Windows 防火墙动态阻止恶意 IP，或编写脚本分析日志并封禁。

### 6. 定期备份

创建备份脚本 `backup.bat`：

```batch
@echo off
set BACKUP_DIR=C:\backups\filemanager
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%

mkdir %BACKUP_DIR%

# 备份数据库
copy C:\www\filemanager\files.db %BACKUP_DIR%\files_%DATE%.db

# 备份配置文件
copy C:\www\filemanager\config.json %BACKUP_DIR%\config_%DATE%.json

# 备份上传文件（可选，体积可能很大）
xcopy C:\www\filemanager\uploads %BACKUP_DIR%\uploads_%DATE%\ /E /I /Y

echo Backup completed: %DATE%
```

设置任务计划每天执行备份。

### 7. 磁盘空间监控

创建监控脚本 `monitor_disk.bat`：

```batch
@echo off
for /f "tokens=3" %%a in ('dir C:\www\filemanager\uploads ^| findstr "bytes free"') do set FREE_SPACE=%%a
echo Free space: %FREE_SPACE%

if %FREE_SPACE% LSS 10737418240 (
    echo WARNING: Less than 10GB free space!
    # 发送警报邮件或通知
)
```

---

## 常见问题

### Q1: Nginx 启动失败

**问题**：执行 `start nginx` 后没有反应或报错

**解决**：
```bash
# 检查配置文件语法
nginx -t

# 查看错误日志
type C:\nginx\logs\error.log

# 检查端口是否被占用
netstat -ano | findstr :80

# 如果是权限问题，以管理员身份运行
```

### Q2: 上传大文件失败

**问题**：上传超过一定大小的文件失败

**解决**：
1. 检查 Nginx 配置中的 `client_max_body_size`
2. 检查 `config.json` 中的 `maxFileSize`
3. 增加超时时间：
   ```nginx
   proxy_send_timeout 600s;
   proxy_read_timeout 600s;
   ```

### Q3: 502 Bad Gateway

**问题**：访问网站显示 502 错误

**解决**：
```bash
# 检查Node.js应用是否运行
netstat -ano | findstr :3000

# 查看应用日志
type C:\www\filemanager\logs\app.log

# 重启应用
pm2 restart filemanager
# 或
npm start

# 检查Nginx错误日志
type C:\nginx\logs\error.log
```

### Q4: 文件上传成功但下载失败

**问题**：可以上传但无法下载文件

**解决**：
1. 检查 `uploads` 目录权限
2. 检查 `files.db` 是否存在且可写
3. 查看应用日志

### Q5: Session 丢失频繁

**问题**：需要频繁重新登录

**解决**：
修改 `server.js` 中的 session 配置，使用固定的 secret：

```javascript
app.use(session({
    secret: 'your-fixed-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    }
}));
```

### Q6: 中文文件名乱码

**问题**：上传的文件名显示乱码

**解决**：
v1.1.0 已完美解决中文文件名编码问题，支持 GBK 和 UTF-8 自动识别。

### Q7: 如何更改端口

**问题**：想将应用运行在其他端口

**解决**：
1. 修改 `config.json`：
   ```json
   {
     "server": {
       "port": 8080
     }
   }
   ```
2. 修改 `nginx.conf` 中的 upstream：
   ```nginx
   upstream nodejs_app {
       server 127.0.0.1:8080;
   }
   ```
3. 重启应用和 Nginx

### Q8: 如何查看实时日志

**PowerShell**：
```powershell
# 查看应用日志
Get-Content C:\www\filemanager\logs\app.log -Wait -Tail 50

# 查看Nginx访问日志
Get-Content C:\nginx\logs\access.log -Wait -Tail 50

# 查看Nginx错误日志
Get-Content C:\nginx\logs\error.log -Wait -Tail 50
```

**CMD**：
```cmd
# 使用 PowerShell 命令
powershell -Command "Get-Content C:\nginx\logs\access.log -Wait -Tail 50"
```

### Q9: 磁盘空间不足

**问题**：uploads 目录占用大量空间

**解决**：
1. 清理旧文件（通过后台管理界面）
2. 启用自动清理功能（config.json 中配置）
3. 扩展磁盘空间
4. 考虑使用对象存储（如阿里云OSS、腾讯云COS）

### Q10: 如何升级应用

**解决**：
```bash
# 1. 备份当前版本
xcopy C:\www\filemanager C:\backups\filemanager_backup /E /I /Y

# 2. 停止应用
pm2 stop filemanager
# 或
net stop FileManagerApp

# 3. 复制新版本文件到 C:\www\filemanager

# 4. 安装依赖
cd C:\www\filemanager
npm install --production

# 5. 恢复配置文件（如果需要）
copy C:\backups\filemanager_backup\config.json C:\www\filemanager\config.json

# 6. 启动应用
pm2 start filemanager
# 或
net start FileManagerApp

# 7. 重载Nginx
nginx -s reload
```

---

## 性能优化建议

### 1. Nginx 优化

```nginx
# 增加工作进程数（CPU核心数）
worker_processes auto;

# 增加连接数
events {
    worker_connections 2048;
}

# 启用缓存
proxy_cache_path /tmp/nginx_cache levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
```

### 2. Node.js 优化

使用 PM2 集群模式：

```javascript
// pm2.config.js
module.exports = {
  apps: [{
    name: 'filemanager',
    script: 'server.js',
    instances: 'max',  // 使用所有CPU核心
    exec_mode: 'cluster'
  }]
};
```

### 3. 操作系统优化

- 禁用不必要的服务
- 调整 TCP/IP 参数
- 使用 SSD 存储
- 增加内存

---

## 监控与维护

### 定期检查清单

- [ ] 检查磁盘空间
- [ ] 审查访问日志
- [ ] 检查错误日志
- [ ] 验证备份完整性
- [ ] 更新系统和软件补丁
- [ ] 检查 SSL 证书有效期
- [ ] 测试上传下载功能
- [ ] 监控系统资源使用

### 监控工具推荐

- **Windows Performance Monitor**: 系统资源监控
- **PM2 Plus**: Node.js 应用监控
- **Nginx Amplify**: Nginx 监控（需要注册）
- **自定义脚本**: 定期健康检查

---

## 技术支持

如遇到问题，请检查：
1. 应用日志：`C:\www\filemanager\logs\`
2. Nginx 日志：`C:\nginx\logs\`
3. Windows 事件查看器

---

**最后更新时间**: 2026年6月
