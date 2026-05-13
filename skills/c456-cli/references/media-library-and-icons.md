# 素材库（Asset）与工具/渠道列表图标（Agent 操作说明）

与 HTTP API v1 及 CLI 行为以 C456 主仓 [`docs/20-engineering/specs/api-v1.md`](https://github.com/xiaohui-zhangxh/c456/blob/main/docs/20-engineering/specs/api-v1.md) 为准。

## 素材 CRUD（CLI）

| 操作 | 命令 |
| --- | --- |
| 上传 | `c456 asset upload -f <本地图片路径>` |
| 列表 | `c456 asset list [-p 页] [-n 每页条数]` |
| 详情 | `c456 asset show <id>`（JSON 含 `markdownSnippet`、`previewUrl`） |
| 改展示名 | `c456 asset update <id> --filename <展示文件名.webp>`（不替换图片字节，仅 ActiveStorage 文件名） |
| 删除 | `c456 asset delete <id>`（正文仍引用 `c456:asset/<id>` 时会失败） |
| 续期正文里的预览链 | `c456 asset refresh-markdown --body-file <.md>`（输出到 stdout） |

上传与服务器「上传前字节」去重一致：完全相同文件会 **422**。

## 把图片插入收录/打法/讲解正文

若图片来自 **`c456 screenshot`** 或自建 Playwright 脚本（对产品页或渠道页的截屏），建议先按 [product-screenshots-for-intake.md](product-screenshots-for-intake.md) 保存到 `.tmp/` 再走下列步骤（**不用**浏览器 MCP，降低配置成本）。

1. `c456 asset upload -f ./figure.png` → 终端会打印 **`markdownSnippet`**（一行 Markdown 图片，title 内含 `c456:asset/<id>`）。
2. 将该行（或经编辑器合并后的段落）写入 **`body`**：创建/更新收录或打法时用 **`--body-file`** 传入整篇 Markdown，**不要**在 shell 里直接塞多行引号。
3. 预览 URL 会过期时，对整篇 Markdown 跑 `c456 asset refresh-markdown --body-file note.md > note.new.md` 再写回。

插图以 **title 中的 `c456:asset/<id>`** 为稳定引用；括号内 URL 可续期。

## 工具 / 渠道的「列表图标」（list icon）

列表与卡片上的图标来自收录 **`profile_data`** 顶层的 **`list_icon_url` / `list_icon_url_local`**（以及各资料段解析出的 icon）。Web 端可上传文件；**API / CLI** 常见做法：

1. **先把图标上传到素材库**：`c456 asset upload -f ./logo.png` → 得到 **`previewUrl`**（签名 URL，可作临时图床链）。
2. **再 PATCH 收录**（仅 tool / channel），只改图标、不动原有资料段。将 JSON 写入 `.tmp/icon-patch.json` 后执行：

   ```bash
   c456 intake update <intake_id> --profile-data-json-file .tmp/icon-patch.json
   ```

   文件内容示例：`{ "list_icon_url": "<上一步 asset show 或 upload 输出的 previewUrl>" }`。

   服务端会将外链 **转存** 为站内 `list_icon_url_local`（与 Web 行为一致）；若需清除图标，传 **`"remove_list_icon": true`**（与 `list_icon_url` 二选一逻辑以 API 为准）。

3. **`profile_data` 与 facets 的合并**：`PATCH /api/v1/intakes/:id` 对已有 `profile_data` **按键合并**——请求里**没有** `facets` 键时，不会清空已有资料段；可只传 `list_icon_url`。完整 facets 结构仍见 [intake-profile-data-json.md](intake-profile-data-json.md)。

## 相关 CLI

- `c456 tool …` / `c456 channel …`：新建时常用 `-u` + `--auto-resolve-url`，再按需 `intake update` 补图标。
- `c456 intake update <id> --profile-data-json '…'`：更新 tool/channel 的 `profile_data` 或列表图标。
