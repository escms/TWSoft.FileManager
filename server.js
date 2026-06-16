const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');

const app = express();

// 加载配置文件
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const PORT = config.server.port || 3000;
const MAX_FILE_SIZE = config.server.maxFileSize || 10 * 1024 * 1024 * 1024; // 默认10GB

// 中间件
app.use(cors());
app.use(express.json());

// 配置session（必须在API路由之前）
app.use(session({
    secret: 'simple-file-manager-secret-key-' + Date.now(),
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

// 静态文件服务（放在API路由之后，避免拦截API请求）
app.use(express.static('public'));

// 创建上传目录和元数据目录
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const METADATA_FILE = path.join(__dirname, 'metadata.json');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 加载元数据
let fileMetadata = {};
if (fs.existsSync(METADATA_FILE)) {
    fileMetadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
}

// 保存元数据
function saveMetadata() {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(fileMetadata, null, 2));
}

// 配置multer存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        // 生成唯一文件名，保留原始扩展名
        const uniqueName = uuidv4().replace(/-/g, '');
        const ext = path.extname(file.originalname);
        cb(null, uniqueName + ext);
    }
});

// 文件大小限制（10GB）
const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: function (req, file, cb) {
        // 允许所有文件类型
        cb(null, true);
    }
});

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 上传文件
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有文件被上传' });
    }

    const fileId = req.file.filename.replace(path.extname(req.file.filename), '');
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // 保存文件元数据
    fileMetadata[fileId] = {
        id: fileId,
        originalName: originalName,
        storedName: req.file.filename,
        size: fileSize,
        uploadTime: new Date().toISOString(),
        mimeType: req.file.mimetype || 'application/octet-stream'
    };

    saveMetadata();

    // 生成下载链接
    const downloadUrl = `/download/${fileId}`;

    res.json({
        success: true,
        fileId: fileId,
        fileName: originalName,
        downloadUrl: downloadUrl,
        fullUrl: `${req.protocol}://${req.get('host')}${downloadUrl}`
    });
});

// 下载文件（强制下载，禁止执行）
app.get('/download/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const metadata = fileMetadata[fileId];

    if (!metadata) {
        return res.status(404).json({ error: '文件不存在' });
    }

    const filePath = path.join(UPLOAD_DIR, metadata.storedName);

    if (!fs.existsSync(filePath)) {
        delete fileMetadata[fileId];
        saveMetadata();
        return res.status(404).json({ error: '文件已被删除' });
    }

    // 设置响应头，强制浏览器下载而不是执行
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(metadata.originalName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');

    // 发送文件
    res.sendFile(filePath);
});

// 后台管理页面（需要登录）- 使用隐蔽路径
app.get('/system-mgmt-2024', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 登录接口
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === config.admin.username && password === config.admin.password) {
        req.session.isLoggedIn = true;
        req.session.username = username;
        res.json({ success: true, message: '登录成功' });
    } else {
        res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
});

// 登出接口
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: '已退出登录' });
});

// 检查登录状态
app.get('/api/check-login', (req, res) => {
    res.json({ isLoggedIn: !!req.session.isLoggedIn });
});

// 获取文件列表（管理接口，需要登录）
app.get('/api/files', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }
    const files = Object.values(fileMetadata).map(file => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        uploadTime: file.uploadTime,
        downloadUrl: `/download/${file.id}`
    }));

    // 按上传时间倒序排列
    files.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

    res.json(files);
});

// 删除文件（需要登录）
app.delete('/api/files/:fileId', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }
    const fileId = req.params.fileId;
    const metadata = fileMetadata[fileId];

    if (!metadata) {
        return res.status(404).json({ error: '文件不存在' });
    }

    const filePath = path.join(UPLOAD_DIR, metadata.storedName);

    // 删除物理文件
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // 删除元数据
    delete fileMetadata[fileId];
    saveMetadata();

    res.json({ success: true, message: '文件已删除' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`简易网盘服务器运行在 http://localhost:${PORT}`);
    console.log(`首页: http://localhost:${PORT}`);
    console.log(`后台管理: http://localhost:${PORT}${config.admin.path || '/system-mgmt-2024'}`);
});
