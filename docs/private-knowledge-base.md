# 私人知识库：用 AI 客户端使用 C456

下面前几节只做一件事：把 **c456.com 账号**、本机 `**c456` 命令**、以及两个 **Agent 技能**装好，让 **Cursor / OpenCode / Trae / Claude Code** 里的 AI 能按规范代你操作 C456 与本地 Wiki。

**日常用法**：在客户端里**用对话说明意图**即可；需要访问 c456.com 时，由 Agent 在本机调用已安装的 `c456`（你不必自己背命令）。**要和线上对齐时，用下面两句口令之一即可**（可按需补充范围，例如「只同步刚改的那几页」）。想深究目录与同步规则，再点开文末技能链接。

---

## 1. 账号（必须）

1. 打开 [https://c456.com](https://c456.com) 注册并登录。
2. 在站内创建 **API Key / 访问令牌**，复制保存（一般只显示一次）。

---

## 2. 安装命令行（全局执行即可）

```bash
npm install -g c456-cli
```

写入密钥（把 `<密钥>` 换成上一步复制的）：

```bash
c456 config set-key <密钥>
```

检查：

```bash
c456 config show
c456 --help
```

---

## 3. 安装两个技能（在「知识库项目」文件夹里执行）

先进入你要当知识库根目录的文件夹（没有就 `mkdir` 一个再 `cd` 进去）：

```bash
cd /path/to/your-kb-project
```

依次执行（需要本机能跑 `npx`，会用到 [Skills CLI](https://skills.sh/)）：

```bash
npx skills add baklib-tools/skills --skill karpathy-wiki -y
npx skills add xiaohui-zhangxh/c456-cli --skill c456-llm-wiki -y
```

---

## 4. 装好后怎么用

1. 用 **Cursor / OpenCode / Trae / Claude Code** 打开你的知识库项目文件夹。
2. 把资料放进 `**raw/`**（路径按技能约定即可）。
3. 在对话里直接说你要做什么（见下一节**可复制示例**）。Agent 会按 **karpathy-wiki**、**c456-llm-wiki** 与 **c456-cli** 技能，在本机执行 `c456`、维护 `wiki/` 与 `c456-sync/` 等；你主要负责说清楚意图与确认结果。
4. **需要同步内容时**，对 AI 说下面之一即可（字可以照抄）：
  - **把本地推到线上**：「**同步内容到 C456。**」
  - **把线上拉回本地**：「**从 C456 同步内容。**」

若你坚持自己敲终端命令，见 [c456-cli README](https://github.com/xiaohui-zhangxh/c456-cli#常用命令)。

---

## 5. 使用例子（复制到 AI 对话里）

以下整段复制到客户端输入框即可（把路径或网址换成你的）。

### 例子 1：收录 `raw/` 里的内容

> 整理 `raw/articles/我的笔记.md`

### 例子 2：收录 baklib.com 这个产品

> 收录 Baklib 这个产品，**同步到 C456**。

### 例子 3：记下对 fly.io 界面设计的喜欢

> [https://fly.io/](https://fly.io/) 的界面设计我很喜欢，请记下来：写成一条以后做产品可以借鉴的笔记，更新 wiki；**同步内容到 C456**。

### 例子 4：只做同步（不说别的）

把本地已整理好的内容推到线上：

> 同步内容到 C456。

把线上最新状态拉回本地镜像与 wiki：

> 从 C456 同步内容。

---

## 6. 链接（想细看再点开）

- [c456.com](https://c456.com)
- [c456-cli 仓库与 README](https://github.com/xiaohui-zhangxh/c456-cli)
- [Karpathy Wiki 技能（目录与约定）](https://github.com/baklib-tools/skills/tree/main/skills/karpathy-wiki)
- [c456-llm-wiki 技能（与 C456 双向同步）](https://github.com/xiaohui-zhangxh/c456-cli/tree/main/skills/c456-llm-wiki)

上游安装命令若变更，以对应仓库页面为准。