## 内容语法（Kramdown Markdown）

本文件定义：通过 **c456 HTTP API v1** 写入的富文本字段（例如 `body`）应使用的**内容语法**。

### 总原则

- **一律使用 Markdown 字符串**作为富文本内容（例如 `body`）。
- **基线语法**：Kramdown 风格 Markdown（与 c456 Web 端编辑器/展示端实现对齐）。
- **不要依赖任意 HTML** 来实现排版或交互；展示端会做 HTML 净化（sanitize），未在白名单内的标签/属性可能被剥离或失效。

### 支持的 Markdown 能力（白名单）

#### 1) GFM（GitHub Flavored Markdown）常见子集

我们支持与 `remark-gfm` / 编辑器常见能力对齐的子集，包括：

- 标题：`#` ~ `######`
- 段落、换行
- 强调：`**bold**`、`*italic*`
- 删除线：`~~text~~`
- 行内代码与代码块：反引号与 fenced code（```）
- 引用：`>`
- 列表：有序/无序
- 链接/图片：`[label](url)`、`![alt](url)`
- 表格：GFM table
- 任务列表：`- [ ]` / `- [x]`
- 裸链：
  - `https://...` 纯文本链接会被识别为可点击链接
  - `<https://...>` 形式也可用

#### 2) Kramdown 块级 IAL（Inline Attribute List）

支持 **kramdown 风格块级 IAL**：把属性写在“紧跟某个块之后”的单独一行里，用于对齐与图片尺寸。

- 语法：`{: align=center width=120 height=120}`
- 关键约束：`{` 与 `:` 之间 **不得有空格**（必须是 `{: ...}`）
- 绑定规则：IAL 行绑定到**上一段/上一标题**
- 支持的 key：
  - `align`：`left | center | right | justify`
  - `width` / `height`：数字字符串（可带 `px`）

示例：

```markdown
这一段将居中。
{: align=center}

![logo](https://example.com/logo.png)
{: width=120 height=120}
```

#### 3) 扩展：`:::walkthrough{...}` 指令块

支持用容器指令在 Markdown 中嵌入 Walkthrough 播放器块：

```markdown
:::walkthrough{id=42}
:::

:::walkthrough{url="https://asciinema.org/a/abc123"}
:::

:::walkthrough{cast-src="https://example.com/x.cast" title="演示" cols=100 rows=28}
:::
```

属性白名单（其余键会被丢弃，不会注入到 DOM）：

- `id`：数字（仅标记，渲染时不查库）
- `url`：仅允许 `https://asciinema.org/a/...`
- `cast-src`：已解析的 `.cast` URL（`https?://...`）
- `title` / `summary`：展示文案（会被截断）
- `cols` / `rows`：终端尺寸（1~4 位数字）

### AI/脚本写入约定

- 当字段语义为“富文本/正文/说明”（如 `body`），默认输出 **Markdown（Kramdown + 白名单扩展）**。
- 不要输出 HTML 作为正文内容（除非是 `:::walkthrough` 这类受控扩展语法的序列化结果）。
- 需要对齐/尺寸时，优先用 `{: ...}` 块级 IAL，不要用内联 `style`。

