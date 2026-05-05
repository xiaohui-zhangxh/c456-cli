---
name: c456-cli
description: >-
  Operates C456 via the c456 Node CLI (HTTP API v1): intakes, playbooks,
  search, fetch, and config. Use when the user mentions C456, c456-cli, 收录,
  打法, intake, playbook, c456.com, or syncing content with a self-hosted C456.
---

# C456 CLI（c456-cli）

在终端通过 **`c456`** 调用 C456 的 **HTTP API v1**，供 Agent 将内容写入/查询 C456，而无需在对话中手写原始 REST 细节。

## 安装 CLI

未安装时可用 **`npx c456-cli …`** 或 **`bunx c456-cli …`**；已全局安装则直接 **`c456`**。

## 安装本技能（给其他仓库）

在目标项目根目录执行（按需加 `-g` 装到用户目录、`--agent cursor` 指定客户端）：

```bash
npx skills add xiaohui-zhangxh/c456-cli --skill c456-cli -y
```

若已克隆 [c456-cli](https://github.com/xiaohui-zhangxh/c456-cli) 仓库，可在该仓库根目录：

```bash
npx skills add . --skill c456-cli -y
```

列出远程包内可用技能而不安装：`npx skills add xiaohui-zhangxh/c456-cli -l`

## 鉴权与站点

| 方式 | 说明 |
| --- | --- |
| **API Key** | `c456 config set-key <token>` 或环境变量 **`C456_API_KEY`** |
| **站点根 URL** | 默认 `https://c456.com`；自托管用 **`c456 config set-url <url>`**、**`C456_URL`**，或单次命令 **`c456 -B <url> …`** |

**短选项冲突**：子命令里的 **`-k` 表示收录类型（kind）**，**不要**用 `-k` 传 API Key。Key 仅通过 `config` / `C456_API_KEY`。

**`-B` 与 `-u`**：根级 **`-B` / `--base-url`** 表示 **C456 站点根地址**；`intake` 等子命令里的 **`-u` 常表示「目标资源 URL」**（如 tool/channel 的链接），不要混用。

## Agent 执行方式

1. 需要真实读写 C456 时，在沙箱/终端中运行 `c456` 子命令，并解析其标准输出（含部分命令附带的 `--- JSON ---` 段）。
2. 非交互场景为 `intake delete` 等加 **`-f` / `--force`**，避免等待终端确认（删除前仍应确认用户意图）。
3. 勿在日志或回复中回显完整 API Key。
4. **严禁编造参数**：只能使用 `c456 <command> --help`（或本仓库源码/文档）明确存在的选项；不确定时先运行 `--help` 再行动。
5. **严禁重复创建**：若 `intake new` / `playbook new` 输出了 `ID:` 或 `--- JSON ---`（含 `id`），视为已成功创建，后续只能 `show <id>` / `update <id>`，不得再次 `new` 重试（避免重复发布两条）。
6. **内容一律用文件传入**：创建/更新正文等长文本时，不要在命令行直接写内容（避免引号/换行/转义错误）。必须把内容写到**当前工作目录**的 `.tmp/` 下临时文件，再用 `--body-file` / `--summary-file` 传入。

## 命令速查

**配置**

- `c456 config set-key <token>` / `c456 config set-url <url>` / `c456 config show` / `c456 config reset`

**收录 `intake`**

- 新建：`c456 intake new [-k signal|tool|channel] [-u <url>] [--auto-resolve-url] [-t 标题] [--body-file <path>]`
- 查看 / 更新 / 删除 / 列表：`c456 intake show <id>` · `c456 intake update <id> …` · `c456 intake delete <id> [-f]` · `c456 intake list [-k] [-q] [-p 页] [-n 每页]`

`--auto-resolve-url` 说明：

- **默认不解析**：`-u/--url` 只保存为 URL 输入；服务端不会默认生成资料段。
- **显式开启才解析**：当 `-k tool|channel` 且传入 `--auto-resolve-url` 时，服务端会尝试检测平台并回填 `profile_data`（可能导致校验失败/成功与否不同；会发起网络请求）。

**搜索 `search`**

- `c456 search signals -q "…" [-k kind] [-l n]`
- `c456 search playbooks -q "…" [-l n]`

**打法 `playbook`**

- 新建：`c456 playbook new -t "标题" [--body-file <path>] [--ref-intake id …] [--ref-playbook id …]`
- 另有 `show` / `list` / `update` / `delete`（与 `c456 playbook --help` 一致）

**资料 `fetch`**

- `c456 fetch profile -u <url> -p <profile_id>`（`profile_id` 必填；否则 API 返回「不支持的资料类型」）

`profile_id` 类型含义：

- `link_product`：产品/官网等普通链接页（解析 name/icon/description）
- `package_registry`：软件包页（npm、RubyGems 等）
- `github_origin`：代码仓库（GitHub/GitLab/Gitee）
- `social_account`：社交账号主页/频道（YouTube/抖音/小红书等）

## 更完整的说明

见各命令的 `--help` 与本仓库 `README.md`、`DEVELOPMENT.md`。

### 分页参数（list 类命令）

- `-p, --page`: **1-10000**
- `-n, --per-page`: **1-100**（默认 20；服务端会截断到最大值）

### 内容语法（富文本）

CLI `--help` 中会用 `type: <type_name>` 标注字段类型；Agent 在生成/写入内容时，必须按下表选择语法与约束：

- `markdown_kramdown` → [references/content-syntax-kramdown.md](references/content-syntax-kramdown.md)（与 `SKILL.md` 同级目录下，随 `npx skills add` 一并安装）
