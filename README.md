<div align="center">

<img src="logo.svg" alt="C456" width="160" height="160" />

<br />

<a href="https://c456.com">https://c456.com</a>

</div>

# c456-cli

C456 命令行工具：通过 **HTTP API v1** 读写收录、打法等数据，适合本地使用或与 AI Agent 集成。

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

配置文件遵循 XDG：默认 `~/.config/c456/config.json`（可通过 `XDG_CONFIG_HOME` 调整）。**请勿将含密钥的文件提交到仓库**；密钥等效于账户凭据。

## 全局选项

| 选项 | 环境变量 | 说明 |
| --- | --- | --- |
| `-B`, `--base-url <url>` | `C456_URL` | C456 站点根地址；未设置时默认 `https://c456.com`（仍以配置文件为准） |

**API Key** 不设全局短选项（与子命令里 **`-k` = kind** 冲突）：请用「[配置 > API Key](#api-key)」中的 `c456 config set-key` 或 `C456_API_KEY`。

`baseUrl` 优先级：**`-B` / 环境变量 / 配置文件 / 内置默认**；`apiKey` 优先级：**环境变量 / 配置文件**（无内置默认）。

## 常用命令

### 收录（intake）

```bash
# 按 URL 创建 tool 收录（-B 为站点，-u 为收录目标）
c456 -B https://c456.example.com intake new -k tool -u "https://github.com/owner/repo"

# 纯文本信号（可无 URL）
c456 intake new -k signal -t "标题" -b "正文"

c456 intake show <id>
c456 intake list -k signal -q "关键词"
c456 intake update <id> -t "新标题"
c456 intake delete <id> --force
```

### 资料抓取（fetch）

```bash
c456 fetch profile -u "https://..." -p link_product
c456 fetch detect -u "https://..."
```

### 搜索（search）

```bash
c456 search signals -q "关键词"
c456 search playbooks -q "关键词"
```

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
