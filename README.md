# 课题志愿收集与分配系统

30 名用户填写 6 个课题的志愿顺序，满员后系统自动分配：每人 1 个课题，每个课题 5 人。分配策略优先满足第一志愿，其次第二志愿，以此类推。

## 功能

- 填写姓名与 6 个课题志愿（不可重复）
- 实时显示已填写人数（X / 30）
- 通过姓名加载并修改自己的志愿
- 30 人填满后自动运行分配算法并展示结果

## 快速开始（本地开发）

```bash
npm install
npm start
```

浏览器访问 [http://localhost:3000](http://localhost:3000)

## 配置

课题名称在 `lib/assign.js` 中的 `TOPICS` 数组修改，需同步修改前端逻辑中的课题数量。

## 数据存储

志愿数据保存在 `data/submissions.json`。部署到服务器时请确保该文件可读写。

## 分配算法

使用最小费用最大流，费用为 `100^(志愿顺位-1)` 加随机微扰（0~0.999）。志愿优先级不变；多个等价最优解时随机选取，结果中的 `tieBreakSeed` 可复现该次分配。

## 重置数据

如需清空所有数据重新开始，向 `POST /api/reset` 发送请求（无请求体）。

---

## 部署到 Linux（camp.genviewtech.com）

本项目为 **Node.js + Express 全栈应用**（非 Vite/Webpack 单页应用）。前端静态文件位于 `public/`，`npm run build` 会将其复制到 **`dist/`** 目录供 Nginx 托管；`/api/*` 接口仍需 Node.js 进程运行。

### 1. 克隆与构建

```bash
git clone https://github.com/LiangChen-SJTU/Preference.git /var/www/camp.genviewtech.com
cd /var/www/camp.genviewtech.com
npm install
npm run build
```

构建产物目录：**`dist/`**（由 `public/` 复制而来，无 `build/` 目录）。

### 2. 启动 Node.js 服务

```bash
# 前台运行（调试）
npm start

# 或使用 PM2 常驻（推荐）
npm install -g pm2
pm2 start server.js --name preference
pm2 save
pm2 startup
```

默认监听 `3000` 端口，可通过环境变量 `PORT` 修改。

### 3. 配置 Nginx

Nginx **应指向构建产物目录** `dist/` 托管静态资源，并将 `/api/` 反向代理到 Node.js：

```bash
sudo cp deploy/nginx.example.conf /etc/nginx/sites-available/camp.genviewtech.com
sudo ln -sf /etc/nginx/sites-available/camp.genviewtech.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

示例配置要点：

- `root /var/www/camp.genviewtech.com/dist;` — 静态文件（HTML/CSS/JS）
- `location /api/` — 反向代理到 `127.0.0.1:3000`

**请勿**将 Nginx `root` 设为仓库根目录。

### 4. SSL 证书

证书与私钥仅存放在服务器本地，**不要提交到 Git**。建议路径：

```
/etc/nginx/ssl/camp.genviewtech.com/fullchain.pem
/etc/nginx/ssl/camp.genviewtech.com/privkey.pem
```

在 `deploy/nginx.example.conf` 中修改 `ssl_certificate` 与 `ssl_certificate_key` 为实际路径。

### 5. 更新部署

```bash
cd /var/www/camp.genviewtech.com
git pull
npm install
npm run build
pm2 restart preference   # 若使用 PM2
```

### 6. 注意事项

- 确保 `data/` 目录对运行 Node.js 的用户可写
- 勿将 `.env`、证书（`.pem`/`.key`/`.crt`）、压缩包提交到仓库
- `output/` 为本地验证脚本生成的 CSV，无需部署
