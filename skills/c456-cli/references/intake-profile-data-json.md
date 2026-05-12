# `profile_data` / `--profile-data-json`（收录 tool / channel）

服务端模型与校验见 C456 仓库 `IntakeProfileRegistry`、`Intake`（`profile_data` 为 JSON）。CLI 创建/更新收录时通过 `**--profile-data-json '<json>'**` 传入**单个 JSON 字符串**（注意 shell 引号；长 JSON 建议写入 `.tmp/*.json` 后再用 `"$(cat .tmp/xxx.json)"` 传入）。

**仅改列表图标、不手改整段 facets**：`PATCH /api/v1/intakes/:id` 会与已有 `profile_data` **按键合并**；可只传 `{ "list_icon_url": "<url>" }` 等（详见 [media-library-and-icons.md](media-library-and-icons.md)）。CLI：`c456 intake update <id> --profile-data-json-file .tmp/patch.json`。

## 顶层结构

```json
{
  "facets": [
    {
      "profile_id": "<见下表>",
      "facet_id": "<可选，字符串；不传则由服务端视为空>",
      "data": { }
    }
  ],
  "primary_profile_id": "<与某条 facet 的 profile_id 一致，建议必填>"
}
```

- `**facets**`：至少 **1** 条、最多 **5** 条（服务端 `MAX_FACETS = 5`）。
- `**profile_id`**：必须为下列枚举之一；且必须与 `**kind`（tool/channel）** 匹配（不匹配会报「该资料类型不能用于当前分区」）。
- **手动录入**：部分 profile 使用 `**_entry_mode`**：`"manual"` 表示手填；省略或为其它值时按 `**resolve`（链接解析路径）** 规则校验（见各小节）。

---

## `profile_id` 与适用 `kind`


| profile_id         | `tool` | `channel` | 说明                         |
| ------------------ | ------ | --------- | -------------------------- |
| `link_product`     | ✅      | ✅         | 官网 / 产品页                   |
| `package_registry` | ✅      | ❌         | npm / RubyGems 等包页         |
| `github_origin`    | ✅      | ✅         | GitHub / GitLab / Gitee 仓库 |
| `social_account`   | ❌      | ✅         | 自媒体 / 社交平台账号主页             |
| `saas_commercial`  | ✅      | ✅         | 定价 / 商业信息                  |


---

## 推荐顺序（Agent）

1. **优先** `c456 intake new -k channel|tool -u "<url>" --auto-resolve-url`（由服务端检测平台并合并 `profile_data`，避免手搓 JSON）。
2. 仅当不能自动解析或需补 second facet 时，再构造 `**--profile-data-json`**（或先 `c456 fetch profile -p <profile_id> -u "<url>"` 查看解析结果结构，再按需填入 `data`）。

---

## 示例：`social_account`（渠道自媒体，最常见）

### A. 解析路径（等价于「先填账号页 URL 再解析」）

`data` 内需能通过校验：`**account_url` 非空**，且 `**platform` 非空**（一般由解析写入；若纯手填且无解析，请改用 B「手动录入」）。

```json
{
  "facets": [
    {
      "profile_id": "social_account",
      "data": {
        "account_url": "https://www.youtube.com/@example",
        "platform": "YouTube",
        "nickname": "示例频道",
        "handle": "@example"
      }
    }
  ],
  "primary_profile_id": "social_account"
}
```

### B. 手动录入（`_entry_mode`: `manual`）

校验要求（节选）：**选择平台或自定义平台**、**平台展示名**，且 `**nickname` / `handle` / `account_url` 至少填一项**。

```json
{
  "facets": [
    {
      "profile_id": "social_account",
      "data": {
        "_entry_mode": "manual",
        "_dict_key": "p_system_youtube",
        "platform": "YouTube",
        "nickname": "示例频道",
        "handle": "@example",
        "account_url": ""
      }
    }
  ],
  "primary_profile_id": "social_account"
}
```

`_dict_key` 为词典项 key（可通过 `GET /api/v1/dictionary/items?category=social_platform` 查找）；若无对应项，可使用 `**_custom_platform_label**`（与 `_dict_key` 二选一逻辑见服务端 `validate_facet_error`）。

---

## 示例：`link_product`（官网 / 产品）

必填字段（`required: true`）：`**url**`、`**name**`。

```json
{
  "facets": [
    {
      "profile_id": "link_product",
      "data": {
        "url": "https://example.com/product",
        "name": "示例产品",
        "description": "可选简介"
      }
    }
  ],
  "primary_profile_id": "link_product"
}
```

---

## 示例：`github_origin`（开源仓库）

- **解析路径**：需 `**repo_url`**，且解析得到的 `**full_name**` 非空（通常由解析写入）。
- **手动录入**：`_entry_mode` 为 `manual` 时，需 `**_dict_key`**（托管方）与 `**full_name**`。

```json
{
  "facets": [
    {
      "profile_id": "github_origin",
      "data": {
        "_entry_mode": "manual",
        "_dict_key": "p_system_github",
        "full_name": "org/repo",
        "repo_url": ""
      }
    }
  ],
  "primary_profile_id": "github_origin"
}
```

---

## 示例：`package_registry`（仅 tool）

手动手填模式需 `**_dict_key**` 与 `**name**`；解析路径需能解析出 `**name**`。细节以服务端 `validate_facet_error` 为准。

---

## 示例：`saas_commercial`（定价补充段）

无 `required: true` 的字段，但整段数据需满足 `coerce_facet_data`；可与其它 facet 并存。

---

## 常见错误（422）

- **「请至少添加一个资料段或图标」**：`facets` 为空且未提供图标相关字段（如顶栏 `list_icon_url`）。
- **「资料类型无效」**：`profile_id` 拼写错误。
- **「该资料类型不能用于当前分区」**：如对 `channel` 使用 `package_registry`。
- **社交账号 / 链接产品等**：见各 profile 下 `**validate_facet_error`** 返回的中文提示。

若不确定字段键名，以 C456 仓库 `app/services/intake_profile_registry.rb` 中对应 profile 的 `field_order` / `fields` 为准。