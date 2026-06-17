const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const Database = require('better-sqlite3');
const { IncomingForm } = require('formidable');
const busboy = require('connect-busboy');
const iconv = require('iconv-lite');

// 通用中文文件名编码处理函数
function decodeFilename(encodedName) {
    if (!encodedName || typeof encodedName !== 'string') {
        return encodedName;
    }

    try {
        console.log('[Encoding] Processing filename:', encodedName);

        // 方法1: 尝试将输入视为GBK编码的字符串，重新编码为GBK字节，再用UTF-8解码
        // 这处理"UTF-8字节被当作GBK解码"的情况（如服务器上的"鍦ㄧ嚎"乱码）
        let result = null;
        try {
            const gbkBytes = iconv.encode(encodedName, 'gbk');
            const utf8FromGbk = iconv.decode(gbkBytes, 'utf-8');
            // 检查是否成功解码且没有替换字符
            if (!/[\ufffd]/.test(utf8FromGbk) && /[\u4e00-\u9fa5]/.test(utf8FromGbk)) {
                console.log('[Encoding] UTF-8 from GBK re-encode successful:', utf8FromGbk);
                result = utf8FromGbk;
            }
        } catch (e) {
            console.log('[Encoding] UTF-8 from GBK failed:', e.message);
        }

        // 方法2: 如果方法1失败，尝试Latin-1 -> UTF-8
        if (!result) {
            try {
                const latin1Bytes = Buffer.from(encodedName, 'latin1');
                const utf8FromLatin1 = iconv.decode(latin1Bytes, 'utf-8');
                if (!/[\ufffd]/.test(utf8FromLatin1) && /[\u4e00-\u9fa5]/.test(utf8FromLatin1)) {
                    console.log('[Encoding] UTF-8 from Latin-1 successful:', utf8FromLatin1);
                    result = utf8FromLatin1;
                }
            } catch (e) {
                console.log('[Encoding] UTF-8 from Latin-1 failed:', e.message);
            }
        }

        // 如果找到有效的解码结果，返回它；否则返回原始名称
        if (result) {
            console.log('[Encoding] Using decoded result:', result);
            return result;
        } else {
            console.log('[Encoding] Keeping original filename');
            return encodedName;
        }
    } catch (e) {
        console.error('[Encoding] Fatal error:', e.message);
        return encodedName;
    }
}

const app = express();

// 加载配置文件
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const PORT = config.server.port || 3000;
const MAX_FILE_SIZE = config.server.maxFileSize || 10 * 1024 * 1024 * 1024;

// 中间件
app.use(cors());
app.use(express.json());
app.use(busboy());

// 配置session
app.use(session({
    secret: 'simple-file-manager-secret-key-' + Date.now(),
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// 静态文件服务
app.use(express.static('public'));

// 创建上传目录
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 初始化SQLite数据库
const DB_PATH = path.join(__dirname, 'files.db');
const db = new Database(DB_PATH);

// 创建表
db.exec(`
    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        short_id TEXT UNIQUE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        upload_time TEXT NOT NULL,
        mime_type TEXT,
        download_count INTEGER DEFAULT 0,
        last_download TEXT,
        upload_ip TEXT
    )
`);

// 添加upload_ip列（如果不存在）
try {
    db.exec('ALTER TABLE files ADD COLUMN upload_ip TEXT');
} catch (e) {
    // 列已存在，忽略错误
}

// 创建索引
db.exec('CREATE INDEX IF NOT EXISTS idx_upload_time ON files(upload_time)');
db.exec('CREATE INDEX IF NOT EXISTS idx_short_id ON files(short_id)');

// 从metadata.json迁移数据（仅首次运行）
const METADATA_FILE = path.join(__dirname, 'metadata.json');
if (fs.existsSync(METADATA_FILE)) {
    try {
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        const migrateStmt = db.prepare(`
            INSERT OR IGNORE INTO files 
            (id, short_id, original_name, stored_name, size, upload_time, mime_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const [fileId, data] of Object.entries(metadata)) {
            const shortId = fileId.substring(0, 6);
            migrateStmt.run(
                fileId,
                shortId,
                data.originalName,
                data.storedName,
                data.size,
                data.uploadTime,
                data.mimeType || 'application/octet-stream'
            );
        }
        
        // 备份并删除旧文件
        fs.renameSync(METADATA_FILE, METADATA_FILE + '.bak');
        console.log('已从 metadata.json 迁移数据到 SQLite 数据库');
    } catch (err) {
        console.error('数据迁移失败:', err.message);
    }
}

// 生成短ID（前6位）
function generateShortId(fileId) {
    return fileId.substring(0, 6);
}

// 获取下载URL
function getDownloadUrl(fileId) {
    if (config.download && config.download.shortPath) {
        const shortId = generateShortId(fileId);
        const prefix = config.download.prefix || '/d';
        return `${prefix}/${shortId}`;
    }
    return `/download/${fileId}`;
}

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 上传文件（使用busboy处理中文文件名）
app.post('/upload', (req, res) => {
    let originalName = '';
    let storedName = '';
    let fileSize = 0;
    let mimeType = '';
    let fileWriteComplete = false;

    // 获取上传IP地址
    const uploadIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                     '0.0.0.0';

    req.busboy.on('file', (fieldname, file, fileInfo) => {
        // busboy 新版本返回对象: { filename, encoding, mimeType }
        let filename, fileMimeType;
        if (typeof fileInfo === 'object' && fileInfo !== null && 'filename' in fileInfo) {
            filename = fileInfo.filename;
            fileMimeType = fileInfo.mimeType;
        } else {
            // 旧版本 API
            filename = fileInfo;
            fileMimeType = arguments[4];
        }

        originalName = filename || '';
        mimeType = fileMimeType || 'application/octet-stream';

        // 使用通用编码处理函数解码中文文件名
        originalName = decodeFilename(originalName);

        // 生成唯一的存储文件名
        const fileId = uuidv4().replace(/-/g, '');
        const ext = path.extname(originalName);
        storedName = fileId + ext;

        const saveTo = path.join(UPLOAD_DIR, storedName);
        const writeStream = fs.createWriteStream(saveTo);

        file.pipe(writeStream);

        writeStream.on('finish', () => {
            fileSize = fs.statSync(saveTo).size;
            fileWriteComplete = true;
            console.log('[Upload] File written successfully, size:', fileSize);
        });

        writeStream.on('error', (err) => {
            console.error('[Upload] File write error:', err.message);
            fileWriteComplete = true; // 标记为完成以避免超时
        });
    });

    req.busboy.on('field', (fieldname, val) => {
        // 处理表单字段（如果有）
    });

    req.busboy.on('finish', () => {
        if (!storedName) {
            return res.status(400).json({ error: '没有文件被上传' });
        }

        // 等待文件写入完成
        const checkInterval = setInterval(() => {
            if (fileWriteComplete) {
                clearInterval(checkInterval);
                
                console.log('Upload success:', originalName);

                const fileId = storedName.replace(path.extname(storedName), '');
                const shortId = generateShortId(fileId);
                const uploadTime = new Date().toISOString();

                console.log('上传成功:', originalName, 'Size:', fileSize, 'IP:', uploadIP);

                const stmt = db.prepare(`
                    INSERT INTO files (id, short_id, original_name, stored_name, size, upload_time, mime_type, upload_ip)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                stmt.run(fileId, shortId, originalName, storedName, fileSize, uploadTime, mimeType, uploadIP);

                const downloadUrl = getDownloadUrl(fileId);

                res.json({
                    success: true,
                    fileId: fileId,
                    shortId: shortId,
                    fileName: originalName,
                    downloadUrl: downloadUrl,
                    fullUrl: `${req.protocol}://${req.get('host')}${downloadUrl}`,
                    debug: {
                        rawBytes: Buffer.from(originalName).toString('hex'),
                        length: originalName.length
                    }
                });
            }
        }, 50);
        
        // 设置超时保护，最多等待10秒
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!res.headersSent) {
                console.error('[Upload] Timeout waiting for file write');
                res.status(500).json({ error: '文件上传超时' });
            }
        }, 10000);
    });

    req.pipe(req.busboy);
});

// 短路径下载
if (config.download && config.download.shortPath) {
    const prefix = config.download.prefix || '/d';
    app.get(`${prefix}/:shortId`, (req, res) => {
        const shortId = req.params.shortId;
        
        const file = db.prepare('SELECT * FROM files WHERE short_id = ?').get(shortId);
        
        if (!file) {
            return res.status(404).json({ error: '文件不存在' });
        }
        
        handleDownload(res, file);
    });
}

// 下载文件（强制下载，禁止执行）
app.get('/download/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    
    if (!file) {
        return res.status(404).json({ error: '文件不存在' });
    }
    
    handleDownload(res, file);
});

// 处理下载的通用函数
function handleDownload(res, file) {
    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    
    if (!fs.existsSync(filePath)) {
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
        return res.status(404).json({ error: '文件已被删除' });
    }
    
    // 更新下载次数
    db.prepare(`
        UPDATE files 
        SET download_count = download_count + 1, last_download = datetime('now')
        WHERE id = ?
    `).run(file.id);
    
    // 设置响应头，强制浏览器下载
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');
    
    res.sendFile(filePath);
}

// 后台管理页面
app.get(config.admin.path, (req, res) => {
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
        // 登录成功后返回管理路径，由前端跳转
        res.json({ 
            success: true, 
            message: '登录成功',
            redirectPath: config.admin.path  // 仅在登录成功时返回
        });
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

// 获取文件列表
app.get('/api/files', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }
    
    const files = db.prepare(`
        SELECT id, original_name as originalName, stored_name as storedName, 
               size, upload_time as uploadTime, download_count as downloadCount,
               last_download as lastDownload, upload_ip as uploadIP
        FROM files 
        ORDER BY upload_time DESC
    `).all();
    
    const fileList = files.map(file => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        uploadTime: file.uploadTime,
        downloadCount: file.downloadCount,
        lastDownload: file.lastDownload,
        uploadIP: file.uploadIP || '未知',
        downloadUrl: getDownloadUrl(file.id)
    }));
    
    res.json(fileList);
});

// 删除文件
app.delete('/api/files/:fileId', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }
    
    const fileId = req.params.fileId;
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    
    if (!file) {
        return res.status(404).json({ error: '文件不存在' });
    }
    
    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
    
    res.json({ success: true, message: '文件已删除' });
});

// 自动清理过期文件
function cleanupExpiredFiles() {
    if (!config.cleanup || !config.cleanup.enabled) {
        return;
    }
    
    const days = config.cleanup.days || 15;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffDateISO = cutoffDate.toISOString();
    
    console.log(`开始清理 ${days} 天前的文件（${cutoffDateISO}之前）...`);
    
    const expiredFiles = db.prepare('SELECT * FROM files WHERE upload_time < ?').all(cutoffDateISO);
    
    let deletedCount = 0;
    for (const file of expiredFiles) {
        const filePath = path.join(UPLOAD_DIR, file.stored_name);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
        deletedCount++;
        
        console.log(`已删除过期文件: ${file.original_name}`);
    }
    
    if (deletedCount > 0) {
        console.log(`清理完成，共删除 ${deletedCount} 个过期文件`);
    } else {
        console.log('没有需要清理的过期文件');
    }
}

// 启动时执行一次清理
cleanupExpiredFiles();

// 定期清理（默认每小时）
if (config.cleanup && config.cleanup.enabled) {
    const interval = config.cleanup.interval || 3600000; // 默认1小时
    setInterval(cleanupExpiredFiles, interval);
    console.log(`自动清理已启用，间隔: ${interval / 1000 / 60} 分钟`);
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`文件迅传服务器运行在 http://localhost:${PORT}`);
    console.log(`首页: http://localhost:${PORT}`);
    console.log(`后台管理: http://localhost:${PORT}${config.admin.path}`);
    if (config.download && config.download.shortPath) {
        console.log(`短路径下载: 已启用 (${config.download.prefix}/xxxxxx)`);
    }
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
});
