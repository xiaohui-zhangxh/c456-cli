<div align="center">

<img src="logo.svg" alt="C456" width="160" height="160" />

<br />

<a href="https://c456.com">https://c456.com</a>

</div>

# c456-cli

C456 命令行工具：通过 **HTTP API v1** 读写收录、打法等数据，适合本地使用或与 AI Agent 集成。

## 用 C456 搭建私人知识库

若你希望把 **[c456.com](https://c456.com)** 当作私人或团队的**云端知识底座**——在本地用「卡帕西式」Wiki 维护笔记与素材，用本 CLI 与线上收录做**同步**，并按权限**对内协作或对外分享**——请直接阅读独立指南：

**[私人知识库：用 AI 客户端使用 C456](https://github.com/xiaohui-zhangxh/c456-cli/blob/main/docs/private-knowledge-base.md)**（克隆仓库后也可打开 [`docs/private-knowledge-base.md`](./docs/private-knowledge-base.md)）

该流程会串联：**注册 C456 → 安装配置 c456-cli → 安装三个 Agent 技能**（`karpathy-wiki`、`c456-llm-wiki`、`c456-cli`，详见 [`docs/private-knowledge-base.md`](./docs/private-knowledge-base.md) §3）→ 初始化知识库目录。

## 安装

```bash
npm install -g c456-cli
# 或
bun add -g c456-cli
```

安装后的命令名为 **`c456`**。也可用 `npx` / `bunx` 单次执行：

```bash
npx c456-cli --help
bunx c456-cli --help
```

### Agent 技能（`c456 skill install`）

已全局安装 **c456-cli** 且本机可用 **`npx`** 后，在目标项目根执行 `c456 skill install`。交互终端下为多选（含 **取消安装**）；传技能 id 或加 **`--with-wiki`** 则不经菜单。常用参数：**`-C`**、**`-g`**、**`-a`**、**`--copy`**（与 `skills add` 一致）。私人知识库三件套见 [private-knowledge-base.md §3](./docs/private-knowledge-base.md)。

```bash
c456 skill install
c456 skill install c456-signal-product-vs c456-signal-researcher
c456 skill install --with-wiki
```

## 配置

### API Key

在 Web 端登录后，于「API Key / 访问令牌」中创建密钥（仅创建时可见全文）。

```bash
c456 config set-key <your-token>
```

或通过环境变量（适合 CI / Agent）：

```bash
export C456_API_KEY=<your-token>
```

### 站点地址

若使用自托管实例，需指定**站点根 URL**（与浏览器访问地址一致，无尾部 `/api`）：

```bash
c456 config set-url https://your-c456.example.com
```

或环境变量：

```bash
export C456_URL=https://your-c456.example.com
```

命令行临时覆盖（**推荐用于多环境**，注意与子命令里的 `-u`「目标 URL」区分）：

```bash
c456 -B https://your-c456.example.com intake list
```

### 查看配置

```bash
c456 config show
```

配置文件分两层：**用户全局**（XDG，默认 `~/.config/c456/config.json`，可用 `XDG_CONFIG_HOME` 调整）与**项目目录**（自当前工作目录向上查找 `.c456-cli/config.json`，命中则与全局合并，项目覆盖全局）。`c456 config set-key` / `set-url` 默认写入当前解析到的项目文件；若未找到 `.c456-cli` 则写入**当前目录**下新建的 `.c456-cli/config.json`。写入全局请加 **`c456 config … -g`**。可用环境变量 **`C456_WORKSPACE`** 指定工作区根（绝对路径），无需依赖目录遍历。**请勿将含密钥的文件提交到仓库**；密钥等效于账户凭据。

## 全局选项

| 选项 | 环境变量 | 说明 |
| --- | --- | --- |
| `-B`, `--base-url <url>` | `C456_URL` | C456 站点根地址；未设置时默认 `https://c456.com`（仍以配置文件为准） |

**API Key** 不设全局短选项（与子命令里 **`-k` = kind** 冲突）：请用「[配置 > API Key](#api-key)」中的 `c456 config set-key` 或 `C456_API_KEY`。

`baseUrl` 优先级：**`-B` / 环境变量 / 配置文件 / 内置默认**；`apiKey` 优先级：**环境变量 / 配置文件**（无内置默认）。

## 常用命令

### 数据管理（5 大类）

```bash
# 工具
c456 tool new -u "https://github.com/owner/repo" --auto-resolve-url

# 渠道
c456 channel new -u "https://example.com" --auto-resolve-url

# 纯文本信号（可无 URL）
c456 signal new -t "标题" -b "正文"

c456 signal show <id>
c456 signal list -q "关键词" --stage raw
c456 signal refine <id> --to cleaned --ai
c456 signal update <id> --refinement-status approved

# 打法（M1/M2 仍为独立资源；M3 会逐步合回 Intake）
c456 playbook new -t "标题" -b "Markdown 正文"
c456 playbook show <id>
c456 playbook list -q "关键词"

# 讲解
c456 walkthrough new -t "标题" --cast-file ./demo.cast
c456 walkthrough list
```

### 素材库（图片）

```bash
c456 asset upload -f ./diagram.png
c456 asset list
c456 asset show <id>
c456 asset update <id> --filename logo.webp
c456 asset delete <id>
c456 asset refresh-markdown --body-file ./note.md > ./note.new.md
c456 asset fingerprint --body-file ./note.md
```

规格见 C456 主仓 [`docs/20-engineering/specs/api-v1.md`](https://github.com/xiaohui-zhangxh/c456/blob/main/docs/20-engineering/specs/api-v1.md) 与 [`docs/10-product/experience/media-library-v1.md`](https://github.com/xiaohui-zhangxh/c456/blob/main/docs/10-product/experience/media-library-v1.md)。

## 浏览器与截图（系统 Chrome，不强制 Chromium 模块）

c456-cli 依赖 **`playwright-core`** 通过 **Chrome DevTools Protocol** 连接**本机已安装的 Google Chrome / Chromium**，**不会**在安装 CLI 时自动下载 Playwright 自带的浏览器二进制。适合为工具/渠道介绍截产品页：先长期会话登录，再多次截图。

### 你需要什么

- **推荐**：安装 [Google Chrome](https://www.google.com/chrome/)（macOS / Windows / Linux 常见路径会自动探测）。
- **可选**：若无系统 Chrome，可自行安装 Playwright 提供的 Chromium，并把可执行路径设为环境变量 **`CHROME_PATH`**（详见 `c456 screenshot --help` 失败时的终端提示）。文档建议：`npx playwright install chromium` 后，用 `node -e "console.log(require('playwright').chromium.executablePath())"` 取路径再 `export CHROME_PATH=...`（需额外安装 npm 包 **`playwright`** 才能调用 `executablePath`，**非** `c456-cli` 的硬依赖）。

### 持久会话（保留登录态）

用户数据目录默认 **`~/.cache/c456-cli/chrome-profile`**（若设置 **`XDG_CACHE_HOME`**，则为 `$XDG_CACHE_HOME/c456-cli/chrome-profile`）。同一目录多次 `browser start` 可复用 Cookie。

```bash
# 选空闲端口启动有头 Chrome，并写入 ~/.cache/c456-cli/browser-daemon.json
c456 browser start

# 在弹出的窗口里登录目标站点（若需要）

# 复用该实例截图（默认加载后再等 3s 再截，可用 --wait-after-load 0 取消）
c456 screenshot "https://example.com/app" -o ./.tmp/example.png

# github.com 仓库页：默认隐藏 README 上方的「文件与目录」表格，便于首屏突出说明文档；需要保留表格时加 --keep-github-files-table
c456 screenshot "https://github.com/owner/repo" -o ./.tmp/repo.png

# 调试：截图前后在终端按 Enter，期间保留标签页便于在 DevTools 里看 DOM（需交互式终端）
c456 screenshot "https://github.com/owner/repo" -o ./.tmp/repo.png --pause

# 用完关闭并释放记录
c456 browser stop
```

查看是否在运行：`c456 browser status`。

### 一次性截图（临时 profile，用完即删）

未执行 `browser start` 或希望强制独立会话时：

```bash
c456 screenshot "https://example.com" -o ./.tmp/once.png --viewport 1280x720
# 加载后等待毫秒数（默认 3000；不需要等待时传 0）
c456 screenshot "https://example.com" -o ./.tmp/once.png --wait-after-load 0
c456 screenshot "https://example.com" -o ./.tmp/once.png --no-reuse
# 省略 -o：按 URL 生成安全文件名 + 本地时间戳，写入当前目录（如 example.com-app_20260512-153045.png）
c456 screenshot "https://example.com/app/dashboard"
```

随后照常 `c456 asset upload -f ./.tmp/once.png` 取得 `markdownSnippet`，写入收录正文的 `--body-file`。

### 资料抓取（fetch）

```bash
c456 fetch profile -u "https://..." -p link_product
```

### 搜索（search）

```bash
c456 search signals -q "关键词"
c456 search playbooks -q "关键词"
```

### AI 自动识别入口（intake）

`intake` 保留为 **AI 识别与录入** 的入口：当你不确定应该落到 signal/tool/channel/playbook 时使用。

```bash
c456 intake new -t "疑似工具/渠道/信号" -b "一段描述或粘贴内容"
```

当 AI 判断不在 `signal/tool/channel/playbook/walkthrough` 五类范围内，会返回 422 并给出错误提示；若识别为 `walkthrough`，会提示改用 `walkthrough` 子命令（因为需要媒体文件/外链）。

### 打法（playbook）

```bash
c456 playbook new -t "标题" -b "Markdown 正文"
c456 playbook show <id>
c456 playbook list -q "关键词"
```

## 开发

```bash
cd c456-cli
bun install
bun run build
node dist/index.js --help
```

构建、发布与 **AI Agent 技能**（`npx skills add … --skill c456-cli`）见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 许可证

MIT
