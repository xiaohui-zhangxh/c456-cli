# 工具 / 渠道收录：用浏览器（Playwright）截产品图并写入介绍

在收录 **`-k tool`** 或 **`-k channel`** 时，若介绍（`body` / Markdown）需要**真实界面**佐证（官网首屏、产品工作台、渠道主页关键区等），**优先使用 c456-cli 内置命令**（系统 Chrome + `playwright-core` 走 CDP，**不**随包下载 Chromium）：`c456 browser start` 持久 profile → 需要登录时先手动在窗口内登录 → **`c456 screenshot <url> [-o .tmp/…]`** 复用同一浏览器；无长会话需求时可直接 **`c456 screenshot <url>`**（一次性起停；不传 **`-o`** 时在当前目录按 URL 生成文件名）。再经 **`c456 asset upload`** 把图插入正文。

也可在仓库内保留 **自建 Playwright 脚本**（`page.screenshot` 写 `.tmp/`）作为补充；**不推荐 IDE 浏览器 MCP**，以降低配置成本。

## 适用场景

- 工具：产品落地页、文档站、SaaS 控制台（需已登录则由用户说明或跳过敏感区）。
- 渠道：平台内频道/主页的**公开可见**区域（遵守平台 ToS；不要对需付费墙或强反爬页面硬截）。

## 推荐流程（与 CLI 衔接）

### A. 内置 `browser` + `screenshot`（推荐）

1. **`c456 browser start`**：在本机选空闲端口，启动**有头**系统 Chrome；用户数据目录默认 **`~/.cache/c456-cli/chrome-profile`**（可用 `XDG_CACHE_HOME` 改缓存根），**同一路径多次启动可保留 Cookie / 登录态**。状态写入同目录下的 `browser-daemon.json`（含 CDP `http://127.0.0.1:<port>`）。
2. 在打开的窗口中访问需登录的站点并完成登录（若不需要可跳过）。
3. **`c456 screenshot <https://…> [-o .tmp/capture.png]`**：通过 CDP 新开页导航并截图；**默认复用**上一步的 Chrome；省略 **`-o`** 时在当前目录生成「URL 安全化片段 + 时间戳」的 `.png`。**`c456 browser stop`**：结束该 Chrome 并删除 daemon 记录、释放端口。
4. 若**不需要**保留会话、只要一张图：可直接 **`c456 screenshot <url>`** 或带 **`-o`**（无 `browser start` 时 CLI 会**临时**起 Chrome、截图后关闭并删除临时 profile）；加 **`--no-reuse`** 可强制走该一次性路径。
5. **上传素材库**：`c456 asset upload -f .tmp/capture.png` → 取 **`markdownSnippet`**。
6. **写入介绍正文**：合并进 Markdown，用 **`--body-file`** 传给 `c456 intake new` / `intake update`。
7. **预览链续期**：`c456 asset refresh-markdown --body-file <path>`（见 [media-library-and-icons.md](media-library-and-icons.md)）。

CLI 细节与可选 Chromium 安装说明见本仓库 **README**「浏览器与截图」。

### B. 自建 Playwright 脚本（可选）

与 A 相同的后半段（文件落 `.tmp/` → `asset upload` → `body`）；导航逻辑由仓库脚本维护。

1. **打开目标 URL**：脚本内 `chromium.launch` + `page.goto` 等；视口、等待可参数化。
2. **导出 PNG/WebP** 到 **`.tmp/`**。
3. 同 A 的步骤 5–7。

## 与「列表图标」的区别

- **正文插图**：走 **`markdownSnippet` → `body`**（上文流程）。
- **列表 / 卡片小图标**：走 **`list_icon_url`** 与 `profile_data` 补丁，见 [media-library-and-icons.md](media-library-and-icons.md) 第二节。

## 约束（与其它技能一致）

- **严禁编造**：截图须来自真实导航结果；不得用占位图冒充产品界面。
- **鉴权与隐私**：含登录态或敏感数据的页面，仅在用户明确要求且同意展示时截屏；默认优先公开页。
- **自动化栈**：优先 **`c456 browser` / `c456 screenshot`**；依赖为 **`playwright-core` + 本机 Chrome**，**不强制** `npx playwright install chromium`（无 Chrome 时见 README 建议）。亦可用自建脚本；**不用** IDE MCP。
