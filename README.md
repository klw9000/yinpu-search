# 印章检索

“王守桢印风”篆刻群体的中文印章（篆刻）图片检索工具，纯前端，可作为 PWA 安装到桌面/手机离线使用。

- 在搜索框输入一个或多个汉字，按字分别列出印章库里文件名包含该字的所有印章。
- 点击"图片库"按钮可分页浏览全部印章。
- 点击任意印章可在 lightbox 中放大查看；ESC、点击遮罩或右上角 × 关闭。
- 支持 Service Worker 离线缓存。

## 目录结构

```
.
├── index.html              # 单页应用（HTML + 内嵌 CSS/JS）
├── manifest.json           # PWA manifest
├── service-worker.js       # 离线缓存（HTML/manifest/seals.json 走 cache-first；seals.json 走 network-first）
├── seals.json              # 印章文件名清单，由脚本生成
├── scripts/
│   └── generate-seals.sh   # 扫描 seal-image/ 重新生成 seals.json
├── seal-image/             # 所有印章 jpg 的唯一来源
└── icons/                  # PWA 图标
```

## 添加 / 删除印章

1. 把新的 `.jpg` 文件放进 `seal-image/`（或删除不要的）。
2. 在仓库根目录运行：
   ```bash
   bash scripts/generate-seals.sh
   ```
   会重新写入 `seals.json`（按文件名排序）。
3. 提交 `seal-image/` 的改动 + `seals.json`。

**不需要**改 `index.html`，也不需要改 `service-worker.js`。已安装 PWA 的用户下次联网打开时会自动看到新印章（network-first 策略会在线时拉取最新的 `seals.json` 并刷新缓存，离线时回退到上一次缓存的版本）。

> 图片资源是按需缓存的：用户实际查看过的图会缓存到本地，未查看过的图离线时无法显示。

## 本地预览

任何静态 HTTP server 都可以。例如：

```bash
python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/
```

直接用 `file://` 打开 `index.html` **不行**：浏览器不允许从 `file://` 协议注册 Service Worker，且 `fetch('./seals.json')` 也会被 CORS 拦下。

### 开发期的缓存陷阱

改了 `index.html` / `service-worker.js` 后，**已经在浏览器中打开过该域名的页面**可能看到旧版（Service Worker 在拦截）。解决：

- DevTools → Application → Service Workers，勾选 "Update on reload"，或点 "Unregister" 后刷新。
- 或硬刷新：Cmd+Shift+R（macOS）/ Ctrl+Shift+R（Windows/Linux）。

发布到线上时则不用担心：每次升级 `service-worker.js`（例如改了缓存策略）都应该把 `CACHE_NAME` 改成新版本号，激活时旧缓存会被清掉。

## 部署

零构建。直接把仓库内容传到任何静态托管即可（GitHub Pages / Cloudflare Pages / Vercel / Netlify 等）。注意 `seal-image/` 目录较大（700+ 张图），首次部署会比较慢。
