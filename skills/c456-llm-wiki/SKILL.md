---
name: c456-llm-wiki
description: >-
  将 Karpathy LLM Wiki 三层架构与 C456.com 双向同步结合的知识库管理规范。
  支持 raw/wiki/c456-sync 四层架构、多对多映射、双向同步、自动 Ingest。
  Use when the user mentions LLM Wiki, C456 sync, knowledge base, c456-sync,
  bidirectional sync, or ingesting content to wiki and c456.com.
---

# LLM Wiki + C456 双向同步

## 核心思想

在 Karpathy LLM Wiki 三层架构（raw/wiki/schema）基础上增加 C456 双向同步层，实现本地知识库与 c456.com 之间的内容发布与拉取。

## 四层架构

```
raw/（原始素材层）  ← 你存放，AI 只读
    ↑↓
c456-sync/（镜像层）← C456 线上内容的本地镜像
    ↑↓
wiki/（知识库层）   ← AI 生成的结构化 Markdown，互相链接
    ↑↓
AGENTS.md（Schema） ← 定义 AI 如何组织 Wiki
```

## 目录结构

```
.
├── raw/
│   ├── articles/  books/  papers/  courses/
│   ├── resources/  quotes/  tools/  work/
├── c456-sync/
│   ├── signal/  tool/  channel/  playbook/  walkthrough/
├── wiki/
│   ├── index.md  log.md  c456-meta.yml
│   ├── entities/  concepts/  threads/  sources/  agents/
├── output/
└── AGENTS.md
```

### 四层关系


| 层级           | 谁维护   | 用途      | 与 C456 关系 |
| ------------ | ----- | ------- | --------- |
| `raw/`       | 用户放入  | 原始素材    | 上行时作为内容来源 |
| `c456-sync/` | AI 同步 | C456 镜像 | 与线上一一对应   |
| `wiki/`      | AI 生成 | 提炼后的知识库 | 多对多映射     |
| `output/`    | 用户创作  | 主动产出    | 可发布到 C456 |


**关键原则**：`c456-sync/` 与 `wiki/` 之间不用 symlink。关联通过 Frontmatter 引用 + `wiki/c456-meta.yml` 实现。

---

## 页面类型

### 实体页 `wiki/entities/`

- 命名：小写 kebab-case，如 `andrej-karpathy.md`
- Frontmatter：`type: entity` + `c456-id` + `c456-kind` + `c456-sync-path` + `tags: [...]`

### 概念页 `wiki/concepts/`

- 命名：小写 kebab-case，如 `rag.md`

### 线索页 `wiki/threads/`

- 命名：小写 kebab-case，如 `ai-engineering-trilogy.md`

### 来源摘要页 `wiki/sources/`

- 命名：与 raw 文件名呼应
- Frontmatter：`type: source` + `c456-kind` + **`c456-title`** + **`c456-summary`**（上行必备）+ `c456-id` + `c456-status` + `date: YYYY-MM-DD` + `raw: raw/.../xxx.md`

---

## 链接规范

- 使用 Obsidian Wikilink：`[[page-name]]`
- 链接目标文件名不带 `.md` 后缀
- 页面标题使用一级标题 `# Title`

---

## 三种核心操作

### Ingest（摄入）

1. 读取素材
2. 判定 C456 类型（signal/tool/channel/playbook/walkthrough）
3. 创建/更新来源摘要页（Frontmatter 含 `c456-title` + `c456-summary`，供后续上行）
4. 提取实体（无则新建，有则追加）
5. 提取概念（无则新建，有则整合）
6. 更新线索页
7. 更新 `wiki/index.md`
8. 追加 `wiki/log.md`

**C456 类型判定**：介绍工具用法 → `tool`；介绍作者/频道 → `channel`；step-by-step → `walkthrough`；策略/框架 → `playbook`；其余 → `signal`。

### Query（查询）

1. 先读 `wiki/index.md`
2. 定位相关页
3. 读取并综合
4. 引用来源
5. 回写好答案：若用户认可，提议保存为 wiki 新页面

### Lint（检查）

1. 扫描矛盾
2. 发现孤立页
3. 检查缺失页
4. 评估数据缺口
5. 输出 Markdown 报告

---

## C456 集成规范

### 内容类型映射


| C456 类型         | 含义     | 对应 raw/                        | 对应 wiki/                      | 对应 output/ |
| --------------- | ------ | ------------------------------ | ----------------------------- | ---------- |
| **signal**      | 信息片段   | articles/, quotes/, resources/ | wiki/sources/                 | 短评         |
| **tool**        | 工具/软件  | tools/                         | wiki/entities/                | 工具评测       |
| **channel**     | 频道/账号  | resources/                     | wiki/entities/                | 频道推荐       |
| **playbook**    | 方法论/框架 | work/, books/                  | wiki/concepts/, wiki/threads/ | 方法论文章      |
| **walkthrough** | 教程     | courses/, articles/            | wiki/threads/                 | 教程         |


### Frontmatter 扩展

收录五种 C456 类型并准备**上行**时，须在 Frontmatter 中写明 **`c456-title`** 与 **`c456-summary`**，作为同步到 C456 的展示标题信息（与页面正文的一级标题 `# Title` 区分，避免与通用 `title` 字段混淆）。

- **`c456-title`**：主标题（单行，对应 CLI/API 的标题字段）。
- **`c456-summary`**：紧跟标题语义的一句简短说明，用于列表/卡片上的补充展示；上行时与 `c456-title` 一并交给 Agent 或写入请求（具体拼接格式以当次 CLI/API 为准）。

**这句简短描述叫什么**：若强调「从属于主标题的补充短语」，中文常用 **副标题**，英文 **subtitle**；若强调「一句话概括、列表摘要」，产品与 API 语境常用 **摘要**，英文 **summary**（C456 Intake 卡片上与标题配对展示的也是 summary）。营销语境也可称 **标语 / tagline**。本规范 Frontmatter 使用字段名 **`c456-summary`**，语义与上述「摘要」对齐。

```yaml
---
type: source
c456-kind: signal      # signal | tool | channel | playbook | walkthrough
c456-title: "主标题"
c456-summary: "一句简短描述，用作上行列表/卡片摘要（副标题语义）"
c456-id: 42            # 发布后回填
c456-status: draft     # draft | published | outdated | conflict
date: 2026-05-08
---
```

### 发布工作流（上行）

1. 扫描带 `c456-kind` 但缺 `c456-id` 或 `status: draft` 的页面
2. 转换 Markdown 为 C456 富文本格式（移除 Wikilink、Frontmatter）
3. 选择命令：signal/tool/channel → `c456 intake new -k <kind>`；playbook/walkthrough → `c456 playbook new`
4. 正文写入 `.tmp/`，通过 `--body-file` 传入 CLI
5. 回填 ID 到 Frontmatter `c456-id`，改 `c456-status: published`
6. 记录日志到 `wiki/log.md`

更新已有内容：用 `c456 intake update <id>` 或 `c456 playbook update <id>`，不重复新建。

### 双向同步

**c456-sync/ 目录**：作为 C456 镜像层，按五类型分目录存储。

**关联方式**：`c456-sync/` 文件 Frontmatter 标注 `local-wiki-source`、`local-wiki-entities` 等字段；`wiki/` 页面 Frontmatter 标注 `c456-id`、`c456-sync-path`；`wiki/c456-meta.yml` 记录总索引。

**双向索引**：`wiki/index.md` 中已发布条目可标注 `[c456:#id]`。C456 正文可保留回链到本地 Wiki 的链接。

### 状态流转

```
draft → publishing → published → outdated → published
                                    ↘ conflict
```

---

## 特殊文件规范

### `wiki/index.md`

内容导向的目录，每页一行摘要 + 链接。按分类组织。每次 Ingest 后更新。

### `wiki/log.md`

时间导向的追加日志。条目格式：`## [YYYY-MM-DD] 操作类型 | 标题/简述`
操作类型：`ingest`、`query`、`lint`、`update`、`create`、`c456-publish`、`c456-down-ingest`、`c456-conflict`
保持 append-only。

### `wiki/c456-meta.yml`

C456 ↔ 本地映射总索引。记录每个 C456 ID 的 `sync_path`、`wiki_pages[]`、状态、时间戳、checksum。AI 在同步操作中自动维护。

---

## 产品录入调研与数据自动补充（Enrichment）

录入产品（tool 类型）时，若提供的信息不完整（如仅给 GitHub 仓库 URL），AI 应主动上网调研并自动补充多种数据类型。

### 调研来源

| 信息类型 | 调研方法 | 示例 |
|---|---|---|
| **官网** | 从 GitHub README 或组织页提取 | `github.com/rails/rails` → `rubyonrails.org` |
| **包管理器** | 搜索 npm / RubyGems / PyPI / Crates.io / Homebrew | `github.com/rails/rails` → `gem rails` |
| **GitHub 元数据** | 读取仓库页（stars、license、语言、最新发布） | 自动记录 stars 数、许可证、主要语言 |
| **产品描述** | 从官网首页或 README 提炼一句话简介 | 用于 `c456-summary` |
| **核心功能** | 从官网 Features 页或 README 提取 | 用于正文 |
| **安装方式** | 从 README 或官网提取 | apt / brew / npm / Docker 等 |

### 调研流程

1. **输入**：用户提供任意信息（官网 URL、GitHub URL、产品名等）
2. **调研**：AI 使用 WebFetch 工具获取官网、GitHub、包管理器页面
3. **交叉验证**：确认官网与 GitHub 的对应关系
4. **补充**：将调研结果填入 raw 素材、c456-sync 镜像、wiki 页面
5. **发布**：按标准 Ingest 流程创建/更新所有页面

### 数据填充规则

- **c456-title**：`品牌名 | 定位 · 特色后缀`
- **c456-summary**：一句话概括核心价值
- **正文**：包含核心功能模块表、安装方式、适用场景
- **实体页**：包含关键属性表（官网、GitHub、stars、许可证、语言）、核心功能、差异化亮点、竞品对比
- **来源摘要**：包含核心信息、关键功能、开源信息

### 示例：GitHub URL → 多类型数据

给定 `github.com/rails/rails`，AI 应自动：
1. 读取 GitHub README → 提取官网 `rubyonrails.org`
2. 搜索 RubyGems → 找到 `gem rails`
3. 记录 GitHub stars、许可证（MIT）、主要语言（Ruby）
4. 访问官网 → 提取产品描述、核心功能
5. 创建完整 raw / c456-sync / wiki 页面
6. 发布到 C456