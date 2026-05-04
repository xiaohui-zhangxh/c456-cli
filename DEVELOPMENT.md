# c456-cli 开发与发布

本文说明如何在本地开发与构建 **c456-cli**，以及如何发布到 npm。

## 环境要求

- **Node.js** ≥ 20（与 `package.json` 中 `engines.node` 一致）
- 推荐使用 [Bun](https://bun.sh) 安装依赖并运行脚本；使用 **npm** 亦可

## 克隆与安装依赖

```bash
git clone https://github.com/xiaohui-zhangxh/c456.git
cd c456/c456-cli   # 若在 monorepo 根目录，进入本子目录
bun install
# 或: npm install
```

若你只在独立仓库中维护 `c456-cli`，则克隆后进入该仓库根目录执行 `bun install` 即可。

## 仓库布局（与开发相关）

| 路径 | 说明 |
| --- | --- |
| `src/index.js` | CLI 入口 |
| `src/commands/` | 各子命令实现 |
| `scripts/build.js` | esbuild 打包脚本 |
| `dist/index.js` | 构建产物；`package.json` 的 `bin.c456` 指向此文件 |

## 本地开发

1. 修改 `src/` 下源码。
2. 任选一种方式验证：

**直接运行源码（便于快速迭代，不经过 bundle）：**

```bash
node src/index.js --help
```

**构建后与发布物一致：**

```bash
bun run build
# 或: npm run build
node dist/index.js --help
```

`build` 实际执行 `node scripts/build.js`：用 **esbuild** 将入口打成单个 `dist/index.js`（ESM，`target: node20`）。`commander`、`open`、`cfonts` 为 **external**，运行时从 `node_modules` 加载。

## 构建失败时

- 确认 Node 版本：`node -v`
- 删除 `node_modules` 后重新 `bun install` / `npm install`
- 查看 `scripts/build.js` 中的入口与 `outfile` 是否与当前目录结构一致

## 发布到 npm

以下为常规流程；实际操作前请确认你对 npm 包 **c456-cli** 具有发布权限。

### 1. 更新版本号

在 `package.json` 中提升 `version`（建议遵循 [语义化版本](https://semver.org/lang/zh-CN/)），并提交变更。

### 2. 确认产物与包内容

发布前可本地构建并检查：

```bash
bun run build
npm pack --dry-run
```

`package.json` 的 `files` 仅包含 `dist` 与 `README.md`。请勿把含 API Key 的配置或密钥打进包里。

### 3. 登录 npm（首次或 token 失效）

```bash
npm login
```

### 4. 干跑（推荐）

```bash
npm publish --dry-run
```

确认将要上传的文件列表与版本无误。

### 5. 正式发布

```bash
npm publish
```

`prepublishOnly` 已在 `package.json` 中配置为 `npm run build`，会在发布前自动执行一次构建。仍建议在发布前本地手动 `build` 并跑一遍 `node dist/index.js --help`，避免意外。

若将来改为 **scoped 包**（如 `@scope/c456-cli`），首次公开可能需要：

```bash
npm publish --access public
```

### 6.（可选）Git 标签

与版本对齐便于追溯，例如：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Monorepo 说明

若本包位于大仓库的 `c456-cli` 子目录（见 `package.json` 的 `repository.directory`），**请在 `c456-cli` 目录内**执行安装、构建与 `npm publish`，避免路径与发布内容错误。
