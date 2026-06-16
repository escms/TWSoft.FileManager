# 文件迅传 - 构建说明

## 发布包内容

### 1. 压缩包格式
- `FileManager-v1.0.0-release.tar.gz` - tar.gz 格式（推荐 Linux/Mac）
- `FileManager-v1.0.0-release.zip` - zip 格式（推荐 Windows）

### 2. release/ 目录
包含完整的可运行程序，已预安装依赖。

## 使用方法

### Windows 用户
1. 下载 `FileManager-v1.0.0-release.zip`
2. 解压到任意目录
3. 双击 `start.bat` 启动

### Linux/Mac 用户
1. 下载 `FileManager-v1.0.0-release.tar.gz`
2. 解压：`tar -xzf FileManager-v1.0.0-release.tar.gz`
3. 进入目录：`cd release`
4. 赋予权限：`chmod +x start.sh`
5. 运行：`./start.sh`

## 重新打包

如果需要重新打包发布版本：

```bash
# 进入项目根目录
cd TWSoft.FileManager

# 清理旧的发布目录
rm -rf dist/release

# 创建新的发布目录
mkdir -p dist/release

# 复制必要文件
cp server.js dist/release/
cp package.json dist/release/
cp config.json dist/release/
cp -r public dist/release/

# 安装生产依赖
cd dist/release
npm install --production

# 创建启动脚本和文档
# (手动创建 start.bat, start.sh, README.md)

# 返回 dist 目录打包
cd ..
tar -czf FileManager-v1.0.0-release.tar.gz release/
```

## 注意事项

1. **不要提交的文件**
   - `node_modules/` - 依赖包（应通过 npm install 安装）
   - `uploads/` - 用户上传的文件
   - `metadata.json` - 文件元数据
   - `.env` - 环境变量文件

2. **必须包含的文件**
   - `server.js` - 主服务器文件
   - `package.json` - 依赖配置
   - `config.json` - 配置文件
   - `public/` - 前端静态文件

3. **配置文件**
   - 发布前请检查 `config.json` 中的默认密码
   - 建议首次使用时修改管理员密码

## 版本更新

更新版本号需要修改：
1. `package.json` 中的 `version` 字段
2. `dist/RELEASE_NOTES.md` 中的版本信息
3. `dist/release/VERSION` 文件

---

构建日期：2024-06-16
