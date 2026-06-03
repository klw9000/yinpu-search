# 0001 — Service Worker 缓存策略：按资源类型分流

- **状态**：Accepted（2026-06-03）
- **影响范围**：`service-worker.js`、PWA 用户的更新感知路径

## 背景

本项目是一个零构建的纯静态 PWA。资源分为几类，生命周期完全不同：

| 资源 | 是否会变 | URL 是否随内容变化 | 用户更新感知期望 |
|---|---|---|---|
| `seal-image/*.jpg`、`icons/*` | 加/删，不修改 | URL 即身份（同名同内容） | 不需要"刷新" |
| `manifest.json` | 几乎不变；改了往往涉及 PWA 图标/名字 | 否 | 改了希望 Android WebAPK 能尽快感知到 |
| `index.html`（含内嵌 CSS/JS） | 偶尔改 UI | 否 | 下次打开就要新版 |
| `seals.json` | 每加印章都变 | 否 | 加完印章应立即可见 |

如果对所有资源一律用 cache-first，PWA 用户对所有这些更新都"看不到"，除非每次都 bump `CACHE_NAME`——既容易忘，又把"加图"和"改代码"耦合在一起。

如果对所有资源一律用 network-first，每次启动都要为图片付一个 RTT，移动网络下首屏明显变慢、流量也白烧；PWA 的"秒开像 native"体验完全垮掉。两个极端都不合适。

## 决策

按资源类型分三种策略，集中在 [service-worker.js](../../service-worker.js) 中：

1. **cache-first**（默认）——图片、图标
   - 命中缓存即返回，未命中再走网络并写入缓存
   - 适合不可变资源：URL 就是身份，缓存命中就是正确答案

2. **stale-while-revalidate (SWR)**——HTML 文档（导航请求、`*.html`、`/`）
   - 先返回缓存（瞬开），同时后台拉网络并刷新缓存
   - 用户**这次**看到的还是旧版，**下次**打开就是新版
   - 适合"想要新但能等一次"的资源

3. **network-first**——`seals.json`、`manifest.json`
   - 在线时永远拉网络，成功后写入缓存；离线时回退到缓存
   - `seals.json`：用户加完印章应立即可见
   - `manifest.json`：[未验证] Chrome 在 Android 上检查 WebAPK 是否需要重新生成时会读 manifest。如果 SW 用 cache-first 拦截了，理论上有概率给 Chrome 回旧版，从而延迟图标/名字更新——所以这里走 network-first 兜底。代价极小（manifest 只有几百字节，且只在 SW 拦截到它的 fetch 时才走网络）

## 后果

**好处**
- 加印章 → 跑 `scripts/generate-seals.sh` → 推线上 → PWA 用户**立刻**看到新印章，不需要改任何代码或 bump 缓存版本。
- 改 UI（`index.html`）→ 推线上 → 用户**下次**打开就是新版本，不需要 bump 缓存版本。
- 图片资源仍然是 cache-first 的 PWA 体验：秒开、可离线、不重复消耗流量。

**代价 / 留意点**
- HTML 的 SWR 意味着用户**本次**会话拿到的是旧版，所以**真的**需要立即生效的改动（紧急修复 bug、破坏性变更）仍然要 bump `CACHE_NAME`。
- `service-worker.js` 自身的修改有它独立的更新路径——浏览器对 SW 文件有"24 小时内强制重新检查"的特殊处理，但具体能多快接管视浏览器和访问频率而定。涉及 SW 行为本身的改动应明确 bump `CACHE_NAME`，并在 `install`/`activate` 里调用 `skipWaiting()` + `clients.claim()`（已经在做）。
- `seals.json` network-first 在弱网下会比 SWR 略慢首屏（要等网络），但因为它很小（~16KB）且页面 init 时就 fetch，体感差异可忽略。

## 备选方案

- **全部 cache-first（之前的做法）**：被否决——加图必须改代码 + bump 缓存才能让 PWA 用户感知，违反"加图不应该是代码改动"的设计意图。
- **全部 network-first**：被否决——图片这类不可变资源每次启动多一个 RTT 是纯亏，破坏 PWA 核心体验。
- **`seals.json` 用 SWR**：可接受替代方案，速度更优但用户本次会话仍看不到新印章。当前选 network-first 是为了"加完图刷一下就能看到"的直觉行为。如果未来 `seals.json` 变得很大或网络抖动成为问题，可以考虑切换到 SWR。
