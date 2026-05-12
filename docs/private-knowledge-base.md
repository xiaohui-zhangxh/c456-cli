# 用 C456 搭建私人知识库（方案与操作步骤）

本文说明如何把 **[c456.com](https://c456.com)** 当作私人或团队的**云端知识库底座**：本地用「卡帕西式」Wiki 组织素材与笔记，用 **c456-cli** 与线上收录（signal / tool / channel / playbook / walkthrough 等）**双向对齐**；需要时再对团队或对外分享。

适合：希望知识**可积累**（而不是每次问答临时抓文档）、又希望有一份**可信的线上副本**与 C456 生态（搜索、打法、Agent）打通的用法。

---

## 1. 方案概览

| 组件 | 作用 |
| --- | --- |
| **c456.com 账号** | 云端存储与权限；通过 API Key 供 CLI 与 Agent 访问。 |
| **[c456-cli](https://github.com/xiaohui-zhangxh/c456-cli)** | 命令行读写 C456 HTTP API：录入、更新、搜索、与本地脚本/AI 配合。 |
| **[Karpathy Wiki 技能](https://github.com/baklib-tools/skills/tree/main/skills/karpathy-wiki)** | 约定本地 `raw/` → `wiki/` + `AGENTS.md` 的三层结构，让 AI 以「知识编译」方式维护 Wiki。 |
| **[c456-llm-wiki 技能](https://github.com/xiaohui-zhangxh/c456-cli/tree/main/skills/c456-llm-wiki)** | 在 Wiki 之上增加 **`c456-sync/` 镜像层**与 **C456 ↔ 本地** 的映射、上行/下行与状态规范（详见该目录下 `SKILL.md`）。 |

**数据流（简化）**：你把资料放进本地 `raw/` → 在 Agent 中按技能做 **Ingest** 生成/更新 `wiki/` → 需要同步到线上时用 **c456-cli**（或 Agent 按 `SKILL.md` 调用 CLI）创建/更新 C456 收录 → 线上变更可回写到 `c456-sync/` 并与 `wiki/` 通过 Frontmatter、`wiki/c456-meta.yml` 对齐。

---

## 2. 操作步骤

### 步骤 A：注册 C456 并准备 API Key

1. 打开 **[https://c456.com](https://c456.com)** 并完成注册、登录。
2. 在 Web 端进入 **API Key / 访问令牌**（名称以站内为准），创建密钥并**保存好**（通常仅创建时可见全文）。
3. 若使用**自托管**实例，记下站点根地址（浏览器地址栏的根 URL，**不要**带 `/api` 后缀），后面配置 CLI 时会用到。

### 步骤 B：安装并配置 c456-cli

1. 打开仓库说明：**[xiaohui-zhangxh/c456-cli](https://github.com/xiaohui-zhangxh/c456-cli)**，按其中的 **安装**、**配置** 完成：
   - 全局安装：`npm install -g c456-cli` 或 `bun add -g c456-cli`（亦可 `npx` / `bunx` 单次运行）。
   - 写入 API Key：`c456 config set-key <your-token>` 或环境变量 `C456_API_KEY`。
   - 自托管时设置根 URL：`c456 config set-url https://your-c456.example.com` 或 `C456_URL`。
2. 验证：

```bash
c456 config show
c456 --help
```

能正常显示配置与帮助即表示 CLI 与鉴权就绪。

### 步骤 C：安装「卡帕西知识库」技能（Karpathy Wiki）

该技能定义了个人知识库的 **raw / wiki / AGENTS.md** 结构与 Ingest、Query、Lint 等操作约定。

1. 阅读上游说明：**[baklib-tools/skills …/karpathy-wiki](https://github.com/baklib-tools/skills/tree/main/skills/karpathy-wiki)**。
2. 在你**准备当作知识库根目录**的项目里，使用 [Skills CLI](https://skills.sh/) 安装（与上游仓库 README 保持一致；若上游命令有更新，以该仓库为准）：

```bash
npx skills add baklib-tools/skills --skill karpathy-wiki -y
```

3. 按技能文档初始化或调整目录：`raw/`、`wiki/`、`output/`、`AGENTS.md` 等。

### 步骤 D：安装「C456 双向同步」技能（c456-llm-wiki）

该技能在 Karpathy Wiki 之上增加 **`c456-sync/`** 与 **C456 类型映射、Frontmatter、上行/下行、冲突与日志** 等规范，是与 **c456-cli** 配合的「契约」。

1. 阅读规范全文（建议通读一遍）：**[c456-cli/skills/c456-llm-wiki/SKILL.md](https://github.com/xiaohui-zhangxh/c456-cli/tree/main/skills/c456-llm-wiki)**。
2. **从 GitHub 安装技能**（`c456-llm-wiki` 随源码维护在仓库的 `skills/` 下；若你仅全局安装了 npm 包，包内未必包含 `skills` 目录，因此推荐用仓库路径或 GitHub 源安装）：

**方式 1：克隆本仓库后本地安装（稳妥）**

```bash
git clone https://github.com/xiaohui-zhangxh/c456-cli.git
cd /path/to/your-kb-project
npx skills add /path/to/c456-cli --skill c456-llm-wiki -y
```

**方式 2：若你的 Skills CLI 支持直接从 GitHub 包引用**

以你本机 `npx skills add --help` 为准；常见形式与仓库内 [DEVELOPMENT.md](../DEVELOPMENT.md) 中 `c456-cli` 技能安装类似，将 `--skill` 换为 **`c456-llm-wiki`**。

3. 在知识库根目录按 **`c456-llm-wiki` SKILL** 补齐四层结构中的增量部分，尤其是：
   - `c456-sync/`（按 signal / tool / channel / playbook / walkthrough 分目录的镜像层）
   - `wiki/c456-meta.yml`（映射总索引，由同步过程维护）
   - 需要上行到 C456 的页面在 Frontmatter 中准备 **`c456-title`**、**`c456-summary`** 等字段（见技能文档）。

4. 发布到 C456 时，用 **c456-cli** 对应子命令（如 `c456 signal new`、`c456 intake new -k tool` 等）；具体与类型的对应关系以 **`c456-llm-wiki` SKILL** 中的「发布工作流」「内容类型映射」为准。

---

## 3. 日常使用（建议节奏）

1. **收集**：把文章、书摘、链接笔记等放入 `raw/` 合适子目录（你只负责放，结构约定见 Karpathy Wiki 与 c456-llm-wiki）。
2. **编译**：在 Cursor / Claude Code 等支持 Skills 的 Agent 中，按技能执行 **Ingest**，更新 `wiki/`、`wiki/index.md`、`wiki/log.md`。
3. **同步**：把已定稿、需要线上备份或协作的条目，按 `c456-llm-wiki` 的上行规范通过 **c456-cli** 写入 C456；从线上拉回时维护 `c456-sync/` 与映射文件。
4. **检查**：定期按技能做 **Lint**，减少孤立页与矛盾叙述。

---

## 4. 对内分享与对外分享（原则）

- **本地优先**：`raw/` 与未声明上行的 `wiki/` 内容可仅留在本机仓库，不经过 CLI 则不会进入 C456。
- **对内**：在 C456 工作区内，按产品提供的**可见范围、工作区成员、链接分享**等方式，把已同步的收录、打法等给团队使用（具体菜单名称以 [c456.com](https://c456.com) 当前版本为准）。
- **对外**：仅将你愿意公开的条目同步到 C456，或使用导出、公开链接等产品能力做外发；**API Key 等同账号凭据**，勿提交到 Git，勿截图进公开文档。

---

## 5. 参考链接（汇总）

- C456 站点：[https://c456.com](https://c456.com)
- c456-cli 仓库：[https://github.com/xiaohui-zhangxh/c456-cli](https://github.com/xiaohui-zhangxh/c456-cli)
- Karpathy Wiki 技能：[https://github.com/baklib-tools/skills/tree/main/skills/karpathy-wiki](https://github.com/baklib-tools/skills/tree/main/skills/karpathy-wiki)
- C456 × LLM Wiki 双向同步技能：[https://github.com/xiaohui-zhangxh/c456-cli/tree/main/skills/c456-llm-wiki](https://github.com/xiaohui-zhangxh/c456-cli/tree/main/skills/c456-llm-wiki)
- Skills CLI：[https://skills.sh/](https://skills.sh/)

---

若你发现上游仓库的安装命令或目录约定有更新，以**各仓库最新 README / SKILL.md** 为准，并欢迎在本仓库提 Issue 或 PR 更新本文。
