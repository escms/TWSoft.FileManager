const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const Database = require('better-sqlite3');
const busboy = require('connect-busboy');
const iconv = require('iconv-lite');
const archiver = require('archiver');
const crypto = require('crypto');

// 通用中文文件名编码处理函数
function decodeFilename(encodedName) {
    if (!encodedName || typeof encodedName !== 'string') {
        return encodedName;
    }

    try {
        // 方法1: 尝试将输入视为GBK编码的字符串，重新编码为GBK字节，再用UTF-8解码
        let result = null;
        try {
            const gbkBytes = iconv.encode(encodedName, 'gbk');
            const utf8FromGbk = iconv.decode(gbkBytes, 'utf-8');
            if (!/[\ufffd]/.test(utf8FromGbk) && /[\u4e00-\u9fa5]/.test(utf8FromGbk)) {
                result = utf8FromGbk;
            }
        } catch (e) {}

        // 方法2: 如果方法1失败，尝试Latin-1 -> UTF-8
        if (!result) {
            try {
                const latin1Bytes = Buffer.from(encodedName, 'latin1');
                const utf8FromLatin1 = iconv.decode(latin1Bytes, 'utf-8');
                if (!/[\ufffd]/.test(utf8FromLatin1) && /[\u4e00-\u9fa5]/.test(utf8FromLatin1)) {
                    result = utf8FromLatin1;
                }
            } catch (e) {}
        }

        return result || encodedName;
    } catch (e) {
        return encodedName;
    }
}

const app = express();

// 加载配置文件
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 安全检查：首次启动时生成随机管理路径
if (config.admin.path === '/admin-panel' || !config.admin.path) {
    const randomPath = '/' + Math.random().toString(36).substring(2, 15);
    config.admin.path = randomPath;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[Security] Generated random admin path:', randomPath);
}

// 安全检查：提醒用户修改默认密码
if (config.admin.password === 'CHANGE_ME_PLEASE') {
    console.warn('⚠️  [Security Warning] Default password detected!');
    console.warn('⚠️  Please change the password in config.json immediately!');
    console.warn('⚠️  You can set environment variable ADMIN_PASSWORD to override.');
}

// 支持环境变量覆盖敏感配置
if (process.env.ADMIN_USERNAME) {
    config.admin.username = process.env.ADMIN_USERNAME;
}
if (process.env.ADMIN_PASSWORD) {
    config.admin.password = process.env.ADMIN_PASSWORD;
}
if (process.env.ADMIN_PATH) {
    config.admin.path = process.env.ADMIN_PATH;
}

const PORT = config.server.port || 3000;
const MAX_FILE_SIZE = config.server.maxFileSize || 10 * 1024 * 1024 * 1024;

// i18n 配置
config.i18n = config.i18n || {};
config.i18n.defaultLang = config.i18n.defaultLang || 'zh-CN';
config.i18n.supportedLangs = config.i18n.supportedLangs || ['zh-CN', 'en'];
const LANG_DIR = path.join(__dirname, 'lang');

// 文件预览签名密钥
const PREVIEW_SECRET = crypto.randomBytes(32).toString('hex');

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

// 语言检测中间件
app.use((req, res, next) => {
    const cookieLang = req.session.lang;
    const acceptLang = req.headers['accept-language'];
    const defaultLang = config.i18n.defaultLang;
    const supported = config.i18n.supportedLangs;

    if (cookieLang && supported.includes(cookieLang)) {
        req.lang = cookieLang;
    } else if (acceptLang) {
        for (const prefix of acceptLang.split(',')) {
            const lang = prefix.trim().split(';')[0];
            if (supported.includes(lang)) { req.lang = lang; break; }
            const base = lang.split('-')[0];
            const match = supported.find(s => s.startsWith(base));
            if (match) { req.lang = match; break; }
        }
    }
    if (!req.lang) req.lang = defaultLang;
    next();
});

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

// 添加批次和相对路径列（若不存在）
try { db.exec('ALTER TABLE files ADD COLUMN batch_id TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE files ADD COLUMN relative_path TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE files ADD COLUMN batch_short_id TEXT'); } catch (e) {}

// 为历史文件补齐批次 ID、批次短链和相对路径，避免后台显示 unknown 或空路径
try {
    const orphanFiles = db.prepare('SELECT id, original_name FROM files WHERE batch_id IS NULL OR batch_id = ""').all();
    const updateBatch = db.prepare('UPDATE files SET batch_id = ? WHERE id = ?');
    orphanFiles.forEach(file => updateBatch.run(file.id, file.id));

    const missingPaths = db.prepare('SELECT id, original_name FROM files WHERE relative_path IS NULL OR relative_path = ""').all();
    const updatePath = db.prepare('UPDATE files SET relative_path = ? WHERE id = ?');
    missingPaths.forEach(file => updatePath.run(file.original_name || '', file.id));

    const missingBatchShorts = db.prepare('SELECT batch_id FROM files WHERE batch_id IS NOT NULL AND batch_id != "" AND (batch_short_id IS NULL OR batch_short_id = "") GROUP BY batch_id').all();
    const updateBatchShort = db.prepare('UPDATE files SET batch_short_id = ? WHERE batch_id = ?');
    missingBatchShorts.forEach(row => {
        const shortId = generateShortId(row.batch_id, 'batch_short_id');
        updateBatchShort.run(shortId, row.batch_id);
    });
} catch (e) {
    // 忽略历史数据补齐中的错误
}

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

// 生成短ID（前6位），若碰撞则继续扩展或追加随机字符以避免重复
function generateShortId(fileId, column = 'short_id') {
    const validColumns = ['short_id', 'batch_short_id'];
    if (!validColumns.includes(column)) {
        column = 'short_id';
    }

    const base = fileId.substring(0, 6);
    let candidate = base;
    let length = 6;

    while (true) {
        const exists = db.prepare(`SELECT 1 FROM files WHERE ${column} = ?`).get(candidate);
        if (!exists) {
            return candidate;
        }
        if (length < fileId.length) {
            length += 1;
            candidate = fileId.substring(0, length);
        } else {
            const suffix = Math.random().toString(36).substring(2, 4);
            candidate = base + suffix;
        }
    }
}

// 获取文件下载短路径
function getDownloadUrl(fileId) {
    const row = db.prepare('SELECT short_id FROM files WHERE id = ?').get(fileId);
    return row ? `/f/${row.short_id}` : '#';
}

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 上传文件（支持多文件与文件夹，使用 busboy 处理中文文件名）
app.post('/upload', (req, res) => {
    // 获取上传IP地址
    const uploadIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                     '0.0.0.0';

    const batchId = uuidv4().replace(/-/g, '');
    const batchShortId = generateShortId(batchId, 'batch_short_id');
    const filePromises = [];
    const savedResults = [];
    const relativePaths = {};

    req.busboy.on('field', (fieldname, val) => {
        const match = fieldname.match(/^relativePath\[(\d+)\]$/);
        if (match) {
            relativePaths[match[1]] = decodeFilename(val || '');
        }
    });

    req.busboy.on('file', (fieldname, file, fileInfo) => {
        let filename = '';
        let fileMimeType = 'application/octet-stream';
        let fileIndex = '0';

        const match = fieldname.match(/^files\[(\d+)\]$/);
        if (match) {
            fileIndex = match[1];
        }

                // 支持多种 busboy / connect-busboy 版本的 fileInfo 格式
        if (fileInfo && typeof fileInfo === 'object') {
            filename = fileInfo.filename || fileInfo.name || fileInfo.fileName || '';
            fileMimeType = fileInfo.mimeType || fileInfo.mimetype || fileInfo.type || fileMimeType;
        } else if (typeof fileInfo === 'string') {
            filename = fileInfo;
        }

        // 尝试解码中文文件名
        filename = decodeFilename(filename || '');

        const now = new Date();
        const dateDir = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const saveDir = path.join(UPLOAD_DIR, dateDir);
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

        // 生成唯一存储名并保存相对路径到 DB
        const fileId = uuidv4().replace(/-/g, '');
        const ext = path.extname(filename) || '';
        const storedRel = path.join(dateDir, fileId + ext);
        const saveTo = path.join(UPLOAD_DIR, storedRel);

        const writeStream = fs.createWriteStream(saveTo);
        // 捕获流错误
        file.on('error', err => {
            console.error('[Upload] Incoming file stream error:', err.message);
        });
        writeStream.on('error', err => {
            console.error('[Upload] Write stream error:', err.message);
        });
        file.pipe(writeStream);

        const p = new Promise((resolve, reject) => {
            writeStream.on('finish', () => {
                try {
                    const size = fs.statSync(saveTo).size;
                    const uploadTime = new Date().toISOString();
                    const shortId = generateShortId(fileId);
                    const relativePath = relativePaths[fileIndex] || '';
                    const originalName = path.basename((relativePath || filename).replace(/\\/g, '/')) || filename;

                    const insert = db.prepare(`
                        INSERT INTO files (id, short_id, original_name, stored_name, size, upload_time, mime_type, upload_ip, batch_id, batch_short_id, relative_path)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    insert.run(fileId, shortId, originalName, storedRel, size, uploadTime, fileMimeType, uploadIP, batchId, batchShortId, relativePath);

                    savedResults.push({ fileId, shortId, originalName, storedName: storedRel, size, mimeType: fileMimeType });
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            writeStream.on('error', (err) => {
                console.error('[Upload] Write error:', err.message);
                reject(err);
            });
        });

        filePromises.push(p);
    });

    req.on('aborted', () => {
        console.warn('[Upload] Request aborted by the client');
    });

    req.busboy.on('finish', () => {
        Promise.all(filePromises).then(() => {
            // 返回批次信息与查看页面
            const viewUrl = `/v/${batchShortId}`;
            const filesResp = savedResults.map(f => ({ fileId: f.fileId, fileName: f.originalName, downloadUrl: getDownloadUrl(f.fileId), size: f.size }));
            res.json({ success: true, batchId, batchShortId, files: filesResp, viewUrl, fullViewUrl: `${req.protocol}://${req.get('host')}${viewUrl}` });
        }).catch(err => {
            console.error('[Upload] Error:', err);
            res.status(500).json({ error: '文件处理失败' });
        });
    });

    req.pipe(req.busboy);
});

// 文件下载短路径
app.get('/f/:shortId', (req, res) => {
    const shortId = req.params.shortId;
    const file = db.prepare('SELECT * FROM files WHERE short_id = ?').get(shortId);
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

// 批次查看短路径
app.get('/v/:batchShortId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

app.get(config.admin.path, (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 获取批次文件列表（通过短ID）
app.get('/api/batch/:batchShortId', (req, res) => {
    const batchShortId = req.params.batchShortId;
    const batch = db.prepare('SELECT batch_id FROM files WHERE batch_short_id = ? LIMIT 1').get(batchShortId);
    if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
    }

    const files = db.prepare(`
        SELECT id, original_name as originalName, stored_name as storedName, size, relative_path as relativePath, download_count as downloadCount, upload_time as uploadTime, batch_id as batchId, batch_short_id as batchShortId
        FROM files
        WHERE batch_id = ?
        ORDER BY relative_path
    `).all(batch.batch_id);

    const fileList = files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        storedName: f.storedName,
        relativePath: f.relativePath || f.originalName,
        size: f.size,
        downloadCount: f.downloadCount,
        uploadTime: f.uploadTime,
        batchId: f.batchId,
        batchShortId: f.batchShortId,
        downloadUrl: getDownloadUrl(f.id)
    }));

    res.json(fileList);
});

// 按批次删除（需登录）
app.delete('/api/batch/:batchShortId', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }

    const batchShortId = req.params.batchShortId;
    const batch = db.prepare('SELECT batch_id FROM files WHERE batch_short_id = ? LIMIT 1').get(batchShortId);
    if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
    }

    const files = db.prepare('SELECT * FROM files WHERE batch_id = ?').all(batch.batch_id);
    let deletedCount = 0;
    for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file.stored_name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
        deletedCount++;
    }

    res.json({ success: true, message: `已删除批次及其 ${deletedCount} 个文件` });
});

// 打包下载选中文件（返回 zip 流）
app.post('/download-zip', (req, res) => {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '缺少要打包的文件列表' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipName = `files_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    archive.on('error', err => {
        console.error('[ZIP] Error:', err);
        res.status(500).end();
    });

    archive.pipe(res);

    for (const id of ids) {
        const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
        if (!file) continue;
        const filePath = path.join(UPLOAD_DIR, file.stored_name);
        if (!fs.existsSync(filePath)) continue;

        // 使用相对路径或原始文件名作为 zip 内文件名
        const nameInZip = file.relative_path && file.relative_path.length > 0 ? file.relative_path : file.original_name;
        archive.file(filePath, { name: nameInZip });

        // 更新下载计数（批量下载算作一次下载）
        db.prepare('UPDATE files SET download_count = download_count + 1, last_download = datetime(\'now\') WHERE id = ?').run(id);
    }

    archive.finalize();
});

// === 文件预览（HMAC 签名短时链接）===
const PREVIEW_TTL = 10 * 60 * 1000; // 10分钟有效
const PREVIEW_SECRET_KEY = crypto.createHash('sha256').update(PREVIEW_SECRET).digest('hex').substring(0, 32);

function signPreviewUrl(shortId, expiry) {
    const data = shortId + ':' + expiry;
    const hmac = crypto.createHmac('sha256', PREVIEW_SECRET_KEY).update(data).digest('hex').substring(0, 12);
    return `/pv/${shortId}?exp=${expiry}&sig=${hmac}`;
}

function verifyPreviewUrl(shortId, expiry, sig) {
    const now = Date.now();
    if (now > Number(expiry)) return false;
    const data = shortId + ':' + expiry;
    const expected = crypto.createHmac('sha256', PREVIEW_SECRET_KEY).update(data).digest('hex').substring(0, 12);
    return sig === expected;
}

// MIME 类型映射（用于预览）
const PREVIEW_MIME = {
    '.txt': 'text/plain; charset=utf-8',
    '.css': 'text/plain; charset=utf-8',
    '.js': 'text/plain; charset=utf-8',
    '.json': 'text/plain; charset=utf-8',
    '.html': 'text/plain; charset=utf-8',
    '.htm': 'text/plain; charset=utf-8',
    '.xml': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.csv': 'text/plain; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.yaml': 'text/plain; charset=utf-8',
    '.yml': 'text/plain; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac'
};

function getPreviewType(ext) {
    const mime = PREVIEW_MIME[ext.toLowerCase()];
    if (!mime) return null;
    if (mime.startsWith('text/')) return 'text';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'other';
}

// 获取预览签名链接
app.get('/api/preview-token/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    let file = db.prepare('SELECT * FROM files WHERE short_id = ?').get(fileId);
    if (!file) {
        file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    }
    if (!file) {
        return res.status(404).json({ error: '文件不存在' });
    }
    const shortId = file.short_id;
    const ext = path.extname(file.stored_name).toLowerCase();
    const previewType = getPreviewType(ext);
    if (!previewType) {
        return res.json({ supported: false, error: '格式不支持预览' });
    }
    const expiry = Date.now() + PREVIEW_TTL;
    const url = signPreviewUrl(shortId, expiry);
    res.json({
        supported: true,
        previewType,
        mimeType: PREVIEW_MIME[ext] || 'application/octet-stream',
        url,
        fileName: file.original_name,
        size: file.size,
        expiresIn: PREVIEW_TTL
    });
});

// 预览文件（带签名验证）
app.get('/pv/:shortId', (req, res) => {
    const { shortId } = req.params;
    const { exp, sig } = req.query;

    if (!exp || !sig || !verifyPreviewUrl(shortId, exp, sig)) {
        return res.status(403).json({ error: '预览链接无效或已过期' });
    }

    const file = db.prepare('SELECT * FROM files WHERE short_id = ?').get(shortId);
    if (!file) {
        return res.status(404).json({ error: '文件不存在' });
    }

    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) {
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
        return res.status(404).json({ error: '文件已被删除' });
    }

    const ext = path.extname(file.stored_name).toLowerCase();
    const mimeType = PREVIEW_MIME[ext] || 'application/octet-stream';
    const previewType = getPreviewType(ext);

    // 视频/音频支持 Range 请求
    if ((previewType === 'video' || previewType === 'audio') && req.headers.range) {
        const stat = fs.statSync(filePath);
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
            'Cache-Control': 'private, max-age=300'
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(filePath);
});

// 生成 SVG 验证码
function generateCaptcha() {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const width = 130, height = 44;
    const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="100%" height="100%" fill="#f0f2ff" rx="6"/>`;

    for (let i = 0; i < 6; i++) {
        const x1 = Math.floor(Math.random() * width);
        const y1 = Math.floor(Math.random() * height);
        const x2 = Math.floor(Math.random() * width);
        const y2 = Math.floor(Math.random() * height);
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i]}" stroke-width="1.5" opacity="0.4"/>`;
    }

    code.split('').forEach((ch, i) => {
        const x = 12 + i * 28;
        const y = 30 + Math.floor(Math.random() * 8);
        const color = colors[Math.floor(Math.random() * colors.length)];
        const rot = (Math.random() - 0.5) * 25;
        svg += `<text x="${x}" y="${y}" fill="${color}" font-size="26" font-weight="bold" font-family="Arial" transform="rotate(${rot}, ${x}, ${y})">${ch}</text>`;
    });

    for (let i = 0; i < 20; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        svg += `<circle cx="${x}" cy="${y}" r="1.5" fill="${colors[i % colors.length]}" opacity="0.5"/>`;
    }

    svg += '</svg>';
    return { code, svg };
}

// 获取验证码（返回 SVG 图片，防止前端直接读取）
app.get('/api/captcha', (req, res) => {
    const { code, svg } = generateCaptcha();
    req.session.captcha = { code, time: Date.now() };
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(svg);
});

// 登录接口
app.post('/api/login', (req, res) => {
    const { username, password, captcha } = req.body;

    const captchaData = req.session.captcha;
    if (!captchaData || !captcha || captcha !== captchaData.code) {
        return res.status(401).json({ success: false, message: '验证码错误' });
    }
    if (Date.now() - captchaData.time > 5 * 60 * 1000) {
        return res.status(401).json({ success: false, message: '验证码已过期，请刷新' });
    }

    if (username === config.admin.username && password === config.admin.password) {
        req.session.isLoggedIn = true;
        req.session.username = username;
        res.json({
            success: true,
            message: '登录成功',
            redirectPath: config.admin.path
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

// 获取前端配置（语言等）
app.get('/api/config', (req, res) => {
    res.json({
        i18n: {
            defaultLang: config.i18n.defaultLang,
            supportedLangs: config.i18n.supportedLangs,
            currentLang: req.lang
        },
        previewExtensions: Object.keys(PREVIEW_MIME)
    });
});

// 获取语言包
app.get('/api/lang/:locale', (req, res) => {
    const locale = req.params.locale;
    const supported = config.i18n.supportedLangs;
    if (!supported.includes(locale)) {
        return res.status(404).json({ error: 'Language not supported' });
    }
    const filePath = path.join(LANG_DIR, locale + '.json');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Language file not found' });
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
});

// 切换语言
app.post('/api/lang', (req, res) => {
    const { lang } = req.body;
    const supported = config.i18n.supportedLangs;
    if (!supported.includes(lang)) {
        return res.status(400).json({ error: 'Language not supported' });
    }
    req.session.lang = lang;
    res.json({ success: true, lang });
});

// 获取文件列表
app.get('/api/files', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: '请先登录' });
    }

    const files = db.prepare(`
        SELECT id, original_name as originalName, stored_name as storedName,
               size, upload_time as uploadTime, download_count as downloadCount,
               last_download as lastDownload, upload_ip as uploadIP,
               batch_id as batchId, batch_short_id as batchShortId, relative_path as relativePath
        FROM files
        ORDER BY batch_id DESC, relative_path ASC, upload_time DESC
    `).all();

    const fileList = files.map(file => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        uploadTime: file.uploadTime,
        downloadCount: file.downloadCount,
        lastDownload: file.lastDownload,
        uploadIP: file.uploadIP || '未知',
        batchId: file.batchId || 'unknown',
        batchShortId: file.batchShortId || '',
        relativePath: file.relativePath || file.originalName,
        downloadUrl: getDownloadUrl(file.id)
    }));

    res.json(fileList);
});

// 删除文件
app.delete('/api/files/:fileId', (req, res) => {
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
        console.log('文件短路径下载已启用 (/f/xxxxxx)');
        console.log('批次查看短链已启用 (/v/xxxxxx)');
    }
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close();
    process.exit(0);
});
