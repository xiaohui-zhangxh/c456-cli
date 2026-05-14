#!/usr/bin/env node

// src/index.js
import { Command as Command13 } from "commander";

// package.json
var package_default = {
  name: "c456-cli",
  version: "0.5.0",
  description: "C456 CLI - \u5185\u5BB9\u5F55\u5165\u4E0E\u6574\u7406\u5DE5\u5177",
  type: "module",
  bin: {
    c456: "dist/index.js"
  },
  files: [
    "dist",
    "README.md"
  ],
  scripts: {
    build: "node scripts/build.js",
    prepublishOnly: "npm run build"
  },
  dependencies: {
    cfonts: "^3.3.1",
    commander: "^12.1.0",
    open: "^10.1.0",
    "playwright-core": "^1.50.0"
  },
  devDependencies: {
    esbuild: "^0.24.0"
  },
  keywords: [
    "c456",
    "cli",
    "content",
    "intake"
  ],
  license: "MIT",
  engines: {
    node: ">=20.0.0"
  },
  homepage: "https://github.com/xiaohui-zhangxh/c456#c456-cli",
  repository: {
    type: "git",
    url: "git+https://github.com/xiaohui-zhangxh/c456.git",
    directory: "c456-cli"
  }
};

// src/commands/intake.js
import { Command } from "commander";

// src/lib/workspaceConfig.js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var CLI_DIR_NAME = ".c456-cli";
function getGlobalConfigDir() {
  const home = os.homedir();
  const base = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(base, "c456");
}
function getGlobalConfigPath() {
  return path.join(getGlobalConfigDir(), "config.json");
}
function findWorkspaceRootWalk(startDir) {
  let cur = path.resolve(startDir);
  for (; ; ) {
    const marker = path.join(cur, CLI_DIR_NAME);
    try {
      if (fs.existsSync(marker) && fs.statSync(marker).isDirectory()) {
        return cur;
      }
    } catch {
    }
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}
function getWorkspaceRoot() {
  const raw = process.env.C456_WORKSPACE?.trim();
  if (raw) {
    return path.resolve(raw);
  }
  return findWorkspaceRootWalk(process.cwd());
}
function getProjectConfigPath(workspaceRoot) {
  return path.join(workspaceRoot, CLI_DIR_NAME, "config.json");
}
function resolveLocalConfigWritePath() {
  const root = getWorkspaceRoot();
  if (root) return getProjectConfigPath(root);
  return path.join(process.cwd(), CLI_DIR_NAME, "config.json");
}
function loadMergedConfigSources() {
  const globalPath = getGlobalConfigPath();
  const globalCfg = readJsonFile(globalPath);
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return { merged: { ...globalCfg }, globalPath, localPath: null, workspaceRoot: null };
  }
  const localPath = getProjectConfigPath(workspaceRoot);
  if (!fs.existsSync(localPath)) {
    return { merged: { ...globalCfg }, globalPath, localPath, workspaceRoot };
  }
  const localCfg = readJsonFile(localPath);
  return {
    merged: { ...globalCfg, ...localCfg },
    globalPath,
    localPath,
    workspaceRoot
  };
}
function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

// src/client.js
var CONFIG_PATH = getGlobalConfigPath();
function loadConfig() {
  return loadMergedConfigSources().merged;
}
async function saveConfigPatch(patch, options = {}) {
  const fs9 = await import("node:fs");
  const pathMod = await import("node:path");
  const global = options.global === true;
  const targetPath = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();
  let existing = {};
  try {
    const raw = fs9.readFileSync(targetPath, "utf-8");
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && !Array.isArray(o)) existing = o;
  } catch {
  }
  const next = { ...existing, ...patch };
  fs9.mkdirSync(pathMod.dirname(targetPath), { recursive: true });
  fs9.writeFileSync(targetPath, JSON.stringify(next, null, 2), "utf-8");
}
function getApiKey() {
  const v = process.env.C456_API_KEY || loadConfig().apiKey;
  return v !== void 0 && v !== null && String(v).trim() !== "" ? String(v) : null;
}
function getBaseUrl(cliBaseUrl) {
  const fromCli = cliBaseUrl !== void 0 && cliBaseUrl !== null && String(cliBaseUrl).trim() !== "" ? String(cliBaseUrl).replace(/\/+$/, "") : null;
  const fromFile = loadConfig().baseUrl;
  const raw = fromCli || process.env.C456_URL || fromFile || "https://c456.com";
  return String(raw).replace(/\/+$/, "");
}
function getRootCommand(cmd) {
  let c = cmd;
  while (c.parent) c = c.parent;
  return c;
}
function metaPerPage(meta) {
  if (!meta) return 20;
  const n = meta.per_page ?? meta.perPage;
  return n !== void 0 && n !== null && Number(n) > 0 ? Number(n) : 20;
}
function formatApiErrorMessage(error) {
  if (!error || typeof error !== "object") {
    return String(error ?? "\u8BF7\u6C42\u5931\u8D25");
  }
  const base = (error.message ?? "\u8BF7\u6C42\u5931\u8D25").trim();
  const fields = error.fields;
  if (!fields || typeof fields !== "object") {
    return base;
  }
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return base;
  }
  const label = (k) => k === "base" ? "\u8BF4\u660E" : k;
  const lines = keys.map((k) => `  \u2022 ${label(k)}\uFF1A${fields[k]}`);
  return `${base}
${lines.join("\n")}`;
}
var ApiClient = class {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }
  /**
   * 构建请求头
   */
  headers() {
    const h = { "Content-Type": "application/json" };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }
  /**
   * GET 请求
   */
  async get(path6, params = {}) {
    const url = new URL(`${this.baseUrl}/api/v1${path6}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== void 0 && v !== null) url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { headers: this.headers() });
    return this.handleResponse(res);
  }
  /**
   * POST 请求
   */
  async post(path6, body = {}) {
    const url = `${this.baseUrl}/api/v1${path6}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    return this.handleResponse(res);
  }
  /**
   * POST multipart/form-data（用于上传文件）
   * @param {string} path
   * @param {Record<string, any>} fields
   * @param {{ fieldName: string, filePath: string, filename?: string, contentType?: string } | null} file
   */
  async postMultipart(path6, fields = {}, file = null) {
    const url = `${this.baseUrl}/api/v1${path6}`;
    const form = new FormData();
    Object.entries(fields || {}).forEach(([k, v]) => {
      if (v === void 0 || v === null) return;
      form.append(k, String(v));
    });
    if (file && file.filePath) {
      const fs9 = await import("node:fs");
      const pathMod = await import("node:path");
      const bytes = fs9.readFileSync(file.filePath);
      const blob = new Blob([bytes], { type: file.contentType || "application/octet-stream" });
      const name = file.filename || pathMod.basename(file.filePath);
      form.append(file.fieldName, blob, name);
    }
    const headers = { ...this.headers() };
    delete headers["Content-Type"];
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: form
    });
    return this.handleResponse(res);
  }
  /**
   * PATCH 请求
   */
  async patch(path6, body = {}) {
    const url = `${this.baseUrl}/api/v1${path6}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    return this.handleResponse(res);
  }
  /**
   * PATCH multipart/form-data（用于上传文件）
   * @param {string} path
   * @param {Record<string, any>} fields
   * @param {{ fieldName: string, filePath: string, filename?: string, contentType?: string } | null} file
   */
  async patchMultipart(path6, fields = {}, file = null) {
    const url = `${this.baseUrl}/api/v1${path6}`;
    const form = new FormData();
    Object.entries(fields || {}).forEach(([k, v]) => {
      if (v === void 0 || v === null) return;
      form.append(k, String(v));
    });
    if (file && file.filePath) {
      const fs9 = await import("node:fs");
      const pathMod = await import("node:path");
      const bytes = fs9.readFileSync(file.filePath);
      const blob = new Blob([bytes], { type: file.contentType || "application/octet-stream" });
      const name = file.filename || pathMod.basename(file.filePath);
      form.append(file.fieldName, blob, name);
    }
    const headers = { ...this.headers() };
    delete headers["Content-Type"];
    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: form
    });
    return this.handleResponse(res);
  }
  /**
   * DELETE 请求
   */
  async delete(path6) {
    const url = `${this.baseUrl}/api/v1${path6}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.headers()
    });
    return this.handleResponse(res);
  }
  /**
   * 统一响应处理
   */
  async handleResponse(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = data.error || { message: `HTTP ${res.status}` };
      const message = formatApiErrorMessage(error);
      throw new ApiError(message, res.status, {
        fields: error.fields && typeof error.fields === "object" ? error.fields : void 0,
        code: error.code
      });
    }
    return data;
  }
};
var ApiError = class extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {{ fields?: Record<string, string>, code?: string }} [meta]
   */
  constructor(message, status, meta = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = meta.fields;
    this.code = meta.code;
  }
};

// src/context.js
function resolveApi(cmd) {
  const root = getRootCommand(cmd);
  const o = root.opts();
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl(o.baseUrl);
  return { apiKey, baseUrl, client: new ApiClient(baseUrl, apiKey) };
}

// src/textFile.js
import { readFileSync } from "node:fs";
function readTextFile(path6) {
  try {
    return readFileSync(path6, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\u9519\u8BEF\uFF1A\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\uFF1A${path6}`);
    console.error(msg);
    process.exit(1);
  }
}

// src/commands/intake.js
var intake = new Command().name("intake").description("AI \u5F55\u5165\u5165\u53E3 - \u81EA\u52A8\u8BC6\u522B\u7C7B\u578B\u5E76\u521B\u5EFA\uFF08signal/tool/channel/playbook\uFF1Bwalkthrough \u9700\u8D70 walkthrough \u547D\u4EE4\uFF09");
intake.command("new").description("AI \u81EA\u52A8\u8BC6\u522B\u5E76\u521B\u5EFA\uFF08\u65E7\u7684 kind \u624B\u52A8\u521B\u5EFA\u8BF7\u6539\u7528 signal/tool/channel \u5B50\u547D\u4EE4\uFF09").option("-u, --url <url>", "\u53EF\u9009\uFF1A\u76EE\u6807 URL\uFF08\u6709\u65F6\u6709\u52A9\u4E8E AI \u5224\u65AD\uFF09").option("--hint <type>", "\u53EF\u9009\uFF1A\u63D0\u793A\u7C7B\u578B signal/tool/channel/playbook\uFF08\u4E0D\u4F1A\u5F3A\u5236\uFF09").option("-t, --title <title>", "\u53EF\u9009\uFF1A\u6807\u9898\uFF08AI \u53EF\u80FD\u4F1A\u91CD\u5199\uFF09").option("-b, --body <text>", "\u6B63\u6587/\u63CF\u8FF0\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--dry-run", "\u53EA\u505A\u8BC6\u522B\u4E0E\u8349\u7A3F\u751F\u6210\uFF0C\u4E0D\u843D\u5E93\uFF08\u82E5\u670D\u52A1\u7AEF\u652F\u6301\uFF09").action(async (opts, cmd) => {
  const { apiKey, baseUrl, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    console.error("\u4F7F\u7528 c456 config set-key <token> \u914D\u7F6E\uFF0C\u6216\u8BBE\u7F6E C456_API_KEY \u73AF\u5883\u53D8\u91CF");
    process.exit(1);
  }
  try {
    if (opts.body && opts.bodyFile) {
      console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
      process.exit(1);
    }
    const bodyText = opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body || "";
    const payload = {
      title: opts.title || "",
      body: bodyText,
      url: opts.url || "",
      hint: opts.hint || "",
      dry_run: Boolean(opts.dryRun)
    };
    const result = await client.post("/intakes/ai", payload);
    console.log("\u2705 AI \u8BC6\u522B\u6210\u529F");
    if (result.data.kind) console.log(`   \u8BC6\u522B\u7C7B\u578B\uFF1A${result.data.kind}`);
    if (result.data.id) console.log(`   ID: ${result.data.id}`);
    if (result.data.title) console.log(`   \u6807\u9898\uFF1A${result.data.title}`);
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(result.data, null, 2));
  } catch (err) {
    console.error(`\u274C \u521B\u5EFA\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
intake.command("show").description("\u67E5\u770B\u6536\u5F55\u8BE6\u60C5").argument("<id>", "\u6536\u5F55 ID").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const result = await client.get(`/intakes/${id}`);
    const data = result.data;
    console.log(`ID: ${data.id}`);
    console.log(`\u7C7B\u578B\uFF1A${data.kind}`);
    console.log(`\u6807\u9898\uFF1A${data.title || "(\u65E0)"}`);
    console.log(`\u6B63\u6587\uFF1A${data.body || "(\u65E0)"}`);
    if (data.profileData) {
      console.log(`\u8D44\u6599\u6BB5\uFF1A${JSON.stringify(data.profileData, null, 2)}`);
    }
  } catch (err) {
    console.error(`\u274C \u67E5\u8BE2\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
intake.command("update").description("\u66F4\u65B0\u6536\u5F55").argument("<id>", "\u6536\u5F55 ID").option("-t, --title <title>", "\u65B0\u6807\u9898").option("-b, --body <text>", "\u65B0\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u65B0\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--profile-data-json <json>", "tool/channel\uFF1Aprofile_data \u7247\u6BB5\uFF08JSON \u5B57\u7B26\u4E32\uFF0C\u4E0E API \u5408\u5E76\u89C4\u5219\u4E00\u81F4\uFF09").option("--profile-data-json-file <path>", "\u4ECE\u6587\u4EF6\u8BFB\u53D6 profile_data \u7247\u6BB5 JSON\uFF08\u4E0E --profile-data-json \u4E92\u65A5\uFF09").option("--favorited", "\u6807\u8BB0\u4E3A\u6536\u85CF").option("--unfavorited", "\u53D6\u6D88\u6536\u85CF").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  const body = {};
  if (opts.title) body.title = opts.title;
  if (opts.body && opts.bodyFile) {
    console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  if (opts.bodyFile) body.body = readTextFile(opts.bodyFile);
  if (opts.body) body.body = opts.body;
  if (opts.profileDataJson && opts.profileDataJsonFile) {
    console.error("\u9519\u8BEF\uFF1A--profile-data-json \u4E0E --profile-data-json-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  if (opts.profileDataJsonFile) {
    try {
      body.profile_data = JSON.parse(readTextFile(opts.profileDataJsonFile));
    } catch (e) {
      console.error(`\u9519\u8BEF\uFF1A\u65E0\u6CD5\u89E3\u6790 profile_data JSON\uFF08${e.message}\uFF09`);
      process.exit(1);
    }
  } else if (opts.profileDataJson) {
    try {
      body.profile_data = JSON.parse(opts.profileDataJson);
    } catch (e) {
      console.error(`\u9519\u8BEF\uFF1A\u65E0\u6CD5\u89E3\u6790 --profile-data-json\uFF08${e.message}\uFF09`);
      process.exit(1);
    }
  }
  if (opts.favorited) body.favorited = true;
  if (opts.unfavorited) body.favorited = false;
  if (Object.keys(body).length === 0) {
    console.error(
      "\u9519\u8BEF\uFF1A\u8BF7\u81F3\u5C11\u63D0\u4F9B --title\u3001--body/--body-file\u3001--profile-data-json/--profile-data-json-file \u6216 --favorited/--unfavorited"
    );
    process.exit(1);
  }
  try {
    await client.patch(`/intakes/${id}`, body);
    console.log("\u2705 \u6536\u5F55\u66F4\u65B0\u6210\u529F");
  } catch (err) {
    console.error(`\u274C \u66F4\u65B0\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
intake.command("delete").description("\u5220\u9664\u6536\u5F55").argument("<id>", "\u6536\u5F55 ID").option("-f, --force", "\u5F3A\u5236\u5220\u9664\uFF08\u65E0\u9700\u786E\u8BA4\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  if (!opts.force) {
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question("\u786E\u8BA4\u5220\u9664\uFF1F(y/N): ", (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\u5DF2\u53D6\u6D88");
      return;
    }
  }
  try {
    await client.delete(`/intakes/${id}`);
    console.log("\u2705 \u6536\u5F55\u5DF2\u5220\u9664");
  } catch (err) {
    console.error(`\u274C \u5220\u9664\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
intake.command("list").description("\u5217\u51FA\u6536\u5F55\uFF08\u5206\u9875\uFF09").option("-k, --kind <type>", "\u7C7B\u578B\u8FC7\u6EE4\uFF1Asignal/tool/channel").option("-q, --query <text>", "\u641C\u7D22\u5173\u952E\u8BCD").option("-p, --page <num>", "\u9875\u7801\uFF081-10000\uFF09", "1").option("-n, --per-page <num>", "\u6BCF\u9875\u6570\u91CF\uFF081-100\uFF0C\u9ED8\u8BA4 20\uFF09", "20").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const result = await client.get("/intakes", {
      kind: opts.kind,
      q: opts.query,
      page: opts.page,
      per_page: opts.perPage
    });
    const { data, meta } = result;
    const perPage = metaPerPage(meta);
    const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
    console.log(`\u5171 ${meta.total} \u6761\u6536\u5F55\uFF08\u7B2C ${meta.page}/${totalPages} \u9875\uFF09
`);
    data.forEach((item) => {
      const kindBadge = { signal: "\u{1F4E1}", tool: "\u{1F527}", channel: "\u{1F4E2}" }[item.kind] || "\u2022";
      console.log(`${kindBadge} [${item.id}] ${item.kind}`);
      console.log(`   ${item.title || item.listSummary || "(\u65E0\u6807\u9898)"}`);
    });
  } catch (err) {
    console.error(`\u274C \u67E5\u8BE2\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
var intake_default = intake;

// src/commands/signal.js
import { Command as Command3 } from "commander";

// src/commands/_intake_kind_helpers.js
import { Command as Command2 } from "commander";
function requireApiKey(apiKey) {
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    console.error("\u4F7F\u7528 c456 config set-key <token> \u914D\u7F6E\uFF0C\u6216\u8BBE\u7F6E C456_API_KEY \u73AF\u5883\u53D8\u91CF");
    process.exit(1);
  }
}
function buildKindCommand(kind, label) {
  const cmd = new Command2().name(kind).description(`${label} \u7BA1\u7406 - \u521B\u5EFA\u3001\u66F4\u65B0\u3001\u5220\u9664\u3001\u5217\u8868`);
  cmd.command("new").description(`\u521B\u5EFA\u65B0${label}`).option("-u, --url <url>", "\u76EE\u6807 URL\uFF08tool/channel \u65F6\u53EF\u9009\uFF1B\u914D\u5408 --auto-resolve-url \u53EF\u81EA\u52A8\u89E3\u6790\u8D44\u6599\uFF09").option("-t, --title <title>", "\u6807\u9898\uFF08tool/channel \u5FC5\u586B\uFF1Bsignal \u53EF\u9009\uFF09").option("-b, --body <text>", "\u6B63\u6587/\u63CF\u8FF0\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--profile-data-json <json>", "\u8D44\u6599\u6BB5 JSON\uFF08tool/channel\uFF09").option("--auto-resolve-url", "\u81EA\u52A8\u89E3\u6790 URL \u5E76\u586B\u5145\u8D44\u6599\u6BB5 profile_data\uFF08\u4EC5 tool/channel\uFF1B\u4F1A\u53D1\u8D77\u7F51\u7EDC\u8BF7\u6C42\uFF09").action(async (opts, cmd2) => {
    const { apiKey, client } = resolveApi(cmd2);
    requireApiKey(apiKey);
    if (opts.body && opts.bodyFile) {
      console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
      process.exit(1);
    }
    const bodyText = opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body || "";
    const body = {
      kind,
      title: opts.title || "",
      body: bodyText
    };
    if (opts.url) body.url = opts.url;
    if (opts.profileDataJson) body.profile_data_json = opts.profileDataJson;
    if (opts.autoResolveUrl) {
      if (!opts.url) {
        console.error("\u9519\u8BEF\uFF1A\u4F7F\u7528 --auto-resolve-url \u65F6\u5FC5\u987B\u540C\u65F6\u63D0\u4F9B -u/--url");
        process.exit(1);
      }
      if (kind !== "tool" && kind !== "channel") {
        console.error("\u9519\u8BEF\uFF1A--auto-resolve-url \u4EC5\u9002\u7528\u4E8E tool \u6216 channel");
        process.exit(1);
      }
      body.auto_resolve_url = true;
    }
    try {
      const result = await client.post("/intakes", body);
      console.log(`\u2705 ${label}\u521B\u5EFA\u6210\u529F`);
      console.log(`   ID: ${result.data.id}`);
      console.log(`   \u7C7B\u578B\uFF1A${result.data.kind}`);
      console.log(`   \u6807\u9898\uFF1A${result.data.title || "(\u65E0)"}`);
    } catch (err) {
      console.error(`\u274C \u521B\u5EFA\u5931\u8D25\uFF1A${err.message}`);
      process.exit(1);
    }
  });
  cmd.command("show").description(`\u67E5\u770B${label}\u8BE6\u60C5`).argument("<id>", `${label} ID`).action(async (id, opts, cmd2) => {
    const { apiKey, client } = resolveApi(cmd2);
    requireApiKey(apiKey);
    try {
      const result = await client.get(`/intakes/${id}`);
      const data = result.data;
      console.log(`ID: ${data.id}`);
      console.log(`\u7C7B\u578B\uFF1A${data.kind}`);
      console.log(`\u6807\u9898\uFF1A${data.title || "(\u65E0)"}`);
      if (data.stage) console.log(`\u6F0F\u6597\uFF1A${data.stage} / ${data.refinementStatus || ""}`.trim());
      if (data.derivedFromId) console.log(`\u4E0A\u6E38\uFF1AIntake #${data.derivedFromId}`);
      console.log(`\u6B63\u6587\uFF1A${data.body || "(\u65E0)"}`);
    } catch (err) {
      console.error(`\u274C \u67E5\u8BE2\u5931\u8D25\uFF1A${err.message}`);
      process.exit(1);
    }
  });
  cmd.command("update").description(`\u66F4\u65B0${label}`).argument("<id>", `${label} ID`).option("-t, --title <title>", "\u65B0\u6807\u9898").option("-b, --body <text>", "\u65B0\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u65B0\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--favorited", "\u6807\u8BB0\u4E3A\u6536\u85CF").option("--unfavorited", "\u53D6\u6D88\u6536\u85CF").option("--refinement-status <status>", "\u6F0F\u6597\u5904\u7406\u72B6\u6001\uFF08signal\uFF09\uFF1Aapproved/ai_drafting/ai_drafted/rejected/dropped").action(async (id, opts, cmd2) => {
    const { apiKey, client } = resolveApi(cmd2);
    requireApiKey(apiKey);
    const body = {};
    if (opts.title) body.title = opts.title;
    if (opts.body && opts.bodyFile) {
      console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
      process.exit(1);
    }
    if (opts.bodyFile) body.body = readTextFile(opts.bodyFile);
    if (opts.body) body.body = opts.body;
    if (opts.favorited) body.favorited = true;
    if (opts.unfavorited) body.favorited = false;
    if (opts.refinementStatus) body.refinement_status = opts.refinementStatus;
    try {
      await client.patch(`/intakes/${id}`, body);
      console.log(`\u2705 ${label}\u66F4\u65B0\u6210\u529F`);
    } catch (err) {
      console.error(`\u274C \u66F4\u65B0\u5931\u8D25\uFF1A${err.message}`);
      process.exit(1);
    }
  });
  cmd.command("delete").description(`\u5220\u9664${label}`).argument("<id>", `${label} ID`).option("-f, --force", "\u5F3A\u5236\u5220\u9664\uFF08\u65E0\u9700\u786E\u8BA4\uFF09").action(async (id, opts, cmd2) => {
    const { apiKey, client } = resolveApi(cmd2);
    requireApiKey(apiKey);
    if (!opts.force) {
      const readline = await import("node:readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question("\u786E\u8BA4\u5220\u9664\uFF1F(y/N): ", (ans) => {
          rl.close();
          resolve(ans.toLowerCase());
        });
      });
      if (answer !== "y" && answer !== "yes") {
        console.log("\u5DF2\u53D6\u6D88");
        return;
      }
    }
    try {
      await client.delete(`/intakes/${id}`);
      console.log(`\u2705 ${label}\u5DF2\u5220\u9664`);
    } catch (err) {
      console.error(`\u274C \u5220\u9664\u5931\u8D25\uFF1A${err.message}`);
      process.exit(1);
    }
  });
  cmd.command("list").description(`\u5217\u51FA${label}\uFF08\u5206\u9875\uFF09`).option("-q, --query <text>", "\u641C\u7D22\u5173\u952E\u8BCD").option("-p, --page <num>", "\u9875\u7801\uFF081-10000\uFF09", "1").option("-n, --per-page <num>", "\u6BCF\u9875\u6570\u91CF\uFF081-100\uFF0C\u9ED8\u8BA4 20\uFF09", "20").option("--stage <stage>", "\uFF08signal\uFF09\u6F0F\u6597\u9636\u6BB5\uFF1Araw/cleaned/curated/playbook").option("--refinement-status <status>", "\uFF08signal\uFF09\u5904\u7406\u72B6\u6001\uFF1Aapproved/ai_drafting/ai_drafted/rejected/dropped").option("--include-dropped", "\uFF08signal\uFF09\u5305\u542B dropped\uFF08\u9ED8\u8BA4\u9690\u85CF\uFF09").option("--derived-from-id <id>", "\uFF08signal\uFF09\u53EA\u770B\u76F4\u63A5\u5B50\u9879").option("--tree-root-id <id>", "\uFF08signal\uFF09\u67E5\u770B\u67D0\u68F5\u6D3E\u751F\u6811\uFF08\u542B\u6839\uFF09").action(async (opts, cmd2) => {
    const { apiKey, client } = resolveApi(cmd2);
    requireApiKey(apiKey);
    const params = {
      kind,
      q: opts.query,
      page: opts.page,
      per_page: opts.perPage
    };
    if (kind === "signal") {
      if (opts.stage) params.stage = opts.stage;
      if (opts.refinementStatus) params.refinement_status = opts.refinementStatus;
      if (opts.includeDropped) params.include_dropped = 1;
      if (opts.derivedFromId) params.derived_from_id = opts.derivedFromId;
      if (opts.treeRootId) params.tree_root_id = opts.treeRootId;
    }
    try {
      const result = await client.get("/intakes", params);
      const { data, meta } = result;
      const perPage = metaPerPage(meta);
      const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
      console.log(`\u5171 ${meta.total} \u6761${label}\uFF08\u7B2C ${meta.page}/${totalPages} \u9875\uFF09
`);
      data.forEach((item) => {
        const stage = item.stage ? ` ${item.stage}/${item.refinementStatus || ""}` : "";
        console.log(`\u2022 [${item.id}] ${item.kind}${stage}`);
        console.log(`   ${item.title || item.listSummary || "(\u65E0\u6807\u9898)"}`);
      });
    } catch (err) {
      console.error(`\u274C \u67E5\u8BE2\u5931\u8D25\uFF1A${err.message}`);
      const urlHint = Boolean(opts.url) && kind === "signal" && err instanceof ApiError && err.status === 422;
      if (urlHint) {
        console.error("");
        console.error("\u63D0\u793A\uFF1A\u82E5\u8981\u89E3\u6790 URL \u7684\u8D44\u6599\u6BB5\uFF0C\u8BF7\u4F7F\u7528 tool/channel \u547D\u4EE4\u5E76\u663E\u5F0F\u5F00\u542F --auto-resolve-url\u3002");
      }
      process.exit(1);
    }
  });
  return cmd;
}

// src/commands/signal.js
var signalCmd = buildKindCommand("signal", "\u4FE1\u53F7");
signalCmd.command("refine").description("\u6D3E\u751F\u4E0B\u4E00\u7EA7\uFF08raw\u2192cleaned / cleaned\u2192curated / curated\u2192playbook\uFF09").argument("<id>", "\u4FE1\u53F7 Intake ID").requiredOption("--to <stage>", "\u76EE\u6807\u9636\u6BB5\uFF1Acleaned/curated/playbook").option("--ai", "\u4F7F\u7528 AI \u8D77\u8349\uFF08mode=ai\uFF09").option("--manual", "\u624B\u52A8\u6D3E\u751F\uFF08\u9ED8\u8BA4\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  const mode = opts.ai ? "ai" : "";
  const result = await client.post(`/intakes/${id}/refinements`, { target_stage: opts.to, mode });
  console.log("\u2705 \u5DF2\u6D3E\u751F");
  console.log(`   \u5B50\u9879 ID: ${result.data.id}`);
  console.log(`   stage: ${result.data.stage} / ${result.data.refinementStatus}`);
});
signalCmd.command("redraft").description("\u5BF9\u5931\u8D25\u7684 AI \u8D77\u8349\u91CD\u8BD5\uFF08rejected\u2192ai_drafting\uFF0C\u5E76\u5165\u961F Job\uFF09").argument("<id>", "\u5B50\u4FE1\u53F7 Intake ID\uFF08refinement_status=rejected\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  await client.patch(`/intakes/${id}`, { refinement_status: "ai_drafting" });
  console.log("\u2705 \u5DF2\u63D0\u4EA4\u91CD\u8BD5\u8D77\u8349");
});
var signal_default = signalCmd;

// src/commands/tool.js
var tool_default = buildKindCommand("tool", "\u5DE5\u5177");

// src/commands/channel.js
var channel_default = buildKindCommand("channel", "\u6E20\u9053");

// src/commands/fetch.js
import { Command as Command4 } from "commander";
var fetchProfile = new Command4().name("fetch").description("\u8D44\u6599\u6293\u53D6 - \u4ECE URL \u81EA\u52A8\u89E3\u6790\u5E73\u53F0\u8D44\u6599");
fetchProfile.command("profile").description("\u6293\u53D6\u6307\u5B9A URL \u7684\u8D44\u6599\u6BB5\u6570\u636E").requiredOption("-u, --url <url>", "\u76EE\u6807 URL").requiredOption(
  "-p, --profile-id <type>",
  [
    "\u8D44\u6599\u7C7B\u578B\uFF08\u5FC5\u586B\uFF09\uFF1A",
    "- link_product\uFF1A\u666E\u901A\u4EA7\u54C1/\u5B98\u7F51\u94FE\u63A5\uFF08\u89E3\u6790\u540D\u79F0\u3001\u56FE\u6807\u3001\u7B80\u4ECB\u7B49\uFF09",
    "- package_registry\uFF1A\u8F6F\u4EF6\u5305\u5730\u5740\uFF08npm/RubyGems \u7B49\uFF09",
    "- github_origin\uFF1A\u5F00\u6E90\u4ED3\u5E93\u5730\u5740\uFF08GitHub/GitLab/Gitee\uFF09",
    "- social_account\uFF1A\u793E\u4EA4\u8D26\u53F7\u4E3B\u9875/\u9891\u9053\uFF08YouTube/\u6296\u97F3/\u5C0F\u7EA2\u4E66\u7B49\uFF09"
  ].join("\n")
).action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const body = { url: opts.url, profile_id: opts.profileId };
    const result = await client.post("/fetches", body);
    const { data, suggested_title } = result.data;
    console.log("\u2705 \u8D44\u6599\u6293\u53D6\u6210\u529F");
    if (suggested_title) {
      console.log(`\u5EFA\u8BAE\u6807\u9898\uFF1A${suggested_title}`);
    }
    console.log("\n\u8D44\u6599\u6570\u636E\uFF1A");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`\u274C \u6293\u53D6\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
var fetch_default = fetchProfile;

// src/commands/search.js
import { Command as Command5 } from "commander";
var searchCmd = new Command5().name("search").description("\u641C\u7D22 - \u67E5\u627E\u53EF\u5173\u8054\u7684\u6536\u5F55\u6216\u6253\u6CD5");
searchCmd.command("signals").description("\u641C\u7D22\u6536\u5F55\uFF08\u7528\u4E8E\u4FE1\u53F7\u5173\u8054\uFF09").option("-q, --query <text>", "\u641C\u7D22\u5173\u952E\u8BCD", "").option("-k, --kind <type>", "\u7C7B\u578B\u8FC7\u6EE4\uFF1Asignal/tool/channel").option("-l, --limit <num>", "\u7ED3\u679C\u6570\u91CF\u9650\u5236", "20").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const result = await client.get("/search/intakes", {
      q: opts.query,
      kind: opts.kind,
      limit: opts.limit
    });
    const data = result.data;
    if (data.length === 0) {
      console.log("\u672A\u627E\u5230\u5339\u914D\u7684\u6536\u5F55");
      return;
    }
    console.log(`\u627E\u5230 ${data.length} \u6761\u7ED3\u679C\uFF1A
`);
    data.forEach((item) => {
      const kindBadge = { signal: "\u{1F4E1}", tool: "\u{1F527}", channel: "\u{1F4E2}" }[item.kind] || "\u2022";
      const sourceKey = item.source_key ? ` [${item.source_key}]` : "";
      console.log(`${kindBadge} #${item.id}${sourceKey} ${item.title || "(\u65E0\u6807\u9898)"}`);
      if (item.list_summary) {
        console.log(`   ${item.list_summary}`);
      }
    });
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`\u274C \u641C\u7D22\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
searchCmd.command("playbooks").description("\u641C\u7D22\u6253\u6CD5\uFF08\u7528\u4E8E\u4FE1\u53F7\u5173\u8054\uFF09").option("-q, --query <text>", "\u641C\u7D22\u5173\u952E\u8BCD", "").option("-l, --limit <num>", "\u7ED3\u679C\u6570\u91CF\u9650\u5236", "20").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const result = await client.get("/search/playbooks", {
      q: opts.query,
      limit: opts.limit
    });
    const data = result.data;
    if (data.length === 0) {
      console.log("\u672A\u627E\u5230\u5339\u914D\u7684\u6253\u6CD5");
      return;
    }
    console.log(`\u627E\u5230 ${data.length} \u6761\u7ED3\u679C\uFF1A
`);
    data.forEach((item) => {
      console.log(`\u{1F4D8} #${item.id} ${item.title || "(\u65E0\u6807\u9898)"}`);
      if (item.list_summary) {
        console.log(`   ${item.list_summary}`);
      }
    });
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`\u274C \u641C\u7D22\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
var search_default = searchCmd;

// src/commands/playbook.js
import { Command as Command6 } from "commander";
var playbookCmd = new Command6().name("playbook").description("\u6253\u6CD5\u7BA1\u7406 - \u521B\u5EFA\u3001\u66F4\u65B0\u3001\u5220\u9664\u6253\u6CD5");
playbookCmd.command("new").description("\u521B\u5EFA\u65B0\u6253\u6CD5").requiredOption("-t, --title <title>", "\u6253\u6CD5\u6807\u9898").option("-b, --body <text>", "\u6253\u6CD5\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u6253\u6CD5\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--ref-intake <id>", "\u5F15\u7528\u6536\u5F55 ID\uFF08\u53EF\u591A\u6B21\u6307\u5B9A\uFF09").option("--ref-playbook <id>", "\u5F15\u7528\u6253\u6CD5 ID\uFF08\u53EF\u591A\u6B21\u6307\u5B9A\uFF09").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  const referenceTargets = [];
  if (opts.refIntake) {
    const intakeIds = Array.isArray(opts.refIntake) ? opts.refIntake : [opts.refIntake];
    intakeIds.forEach((id) => {
      referenceTargets.push({ type: "intake", id: parseInt(id, 10) });
    });
  }
  if (opts.refPlaybook) {
    const playbookIds = Array.isArray(opts.refPlaybook) ? opts.refPlaybook : [opts.refPlaybook];
    playbookIds.forEach((id) => {
      referenceTargets.push({ type: "playbook", id: parseInt(id, 10) });
    });
  }
  try {
    if (opts.body && opts.bodyFile) {
      console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
      process.exit(1);
    }
    const bodyText = opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body || "";
    const body = {
      title: opts.title,
      body: bodyText
    };
    if (referenceTargets.length > 0) {
      body.reference_targets = referenceTargets;
    }
    const result = await client.post("/playbooks", body);
    console.log("\u2705 \u6253\u6CD5\u521B\u5EFA\u6210\u529F");
    console.log(`   ID: ${result.data.id}`);
    console.log(`   \u6807\u9898\uFF1A${result.data.title}`);
  } catch (err) {
    console.error(`\u274C \u521B\u5EFA\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
playbookCmd.command("show").description("\u67E5\u770B\u6253\u6CD5\u8BE6\u60C5").argument("<id>", "\u6253\u6CD5 ID").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const result = await client.get(`/playbooks/${id}`);
    const data = result.data;
    console.log(`ID: ${data.id}`);
    console.log(`\u6807\u9898\uFF1A${data.title}`);
    console.log(`\u6B63\u6587\uFF1A
${data.body || "(\u65E0)"}`);
    if (data.referenceTargets && data.referenceTargets.length > 0) {
      console.log("\n\u5F15\u7528\u76EE\u6807\uFF1A");
      data.referenceTargets.forEach((ref) => {
        console.log(`  - ${ref.targetType} #${ref.targetId}: ${ref.title}`);
      });
    }
    if (data.workflow && (data.workflow.nodes?.length || 0) > 0) {
      console.log("\n\u5DE5\u4F5C\u6D41\uFF1A");
      data.workflow.nodes.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.title || "(\u65E0\u6807\u9898)"}`);
      });
    }
  } catch (err) {
    console.error(`\u274C \u67E5\u8BE2\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
playbookCmd.command("update").description("\u66F4\u65B0\u6253\u6CD5").argument("<id>", "\u6253\u6CD5 ID").option("-t, --title <title>", "\u65B0\u6807\u9898").option("-b, --body <text>", "\u65B0\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u65B0\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  const body = {};
  if (opts.title) body.title = opts.title;
  if (opts.body && opts.bodyFile) {
    console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  if (opts.bodyFile) body.body = readTextFile(opts.bodyFile);
  if (opts.body) body.body = opts.body;
  try {
    await client.patch(`/playbooks/${id}`, body);
    console.log("\u2705 \u6253\u6CD5\u66F4\u65B0\u6210\u529F");
  } catch (err) {
    console.error(`\u274C \u66F4\u65B0\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
playbookCmd.command("delete").description("\u5220\u9664\u6253\u6CD5").argument("<id>", "\u6253\u6CD5 ID").option("-f, --force", "\u5F3A\u5236\u5220\u9664\uFF08\u65E0\u9700\u786E\u8BA4\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  if (!opts.force) {
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question("\u786E\u8BA4\u5220\u9664\uFF1F(y/N): ", (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\u5DF2\u53D6\u6D88");
      return;
    }
  }
  try {
    await client.delete(`/playbooks/${id}`);
    console.log("\u2705 \u6253\u6CD5\u5DF2\u5220\u9664");
  } catch (err) {
    console.error(`\u274C \u5220\u9664\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
playbookCmd.command("list").description("\u5217\u51FA\u6253\u6CD5\uFF08\u5206\u9875\uFF09").option("-q, --query <text>", "\u641C\u7D22\u5173\u952E\u8BCD").option("-p, --page <num>", "\u9875\u7801\uFF081-10000\uFF09", "1").option("-n, --per-page <num>", "\u6BCF\u9875\u6570\u91CF\uFF081-100\uFF0C\u9ED8\u8BA4 20\uFF09", "20").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
  try {
    const result = await client.get("/playbooks", {
      q: opts.query,
      page: opts.page,
      per_page: opts.perPage
    });
    const { data, meta } = result;
    const perPage = metaPerPage(meta);
    const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
    console.log(`\u5171 ${meta.total} \u6761\u6253\u6CD5\uFF08\u7B2C ${meta.page}/${totalPages} \u9875\uFF09
`);
    data.forEach((item) => {
      console.log(`\u{1F4D8} [${item.id}] ${item.title}`);
      if (item.listSummary) {
        console.log(`   ${item.listSummary}`);
      }
    });
  } catch (err) {
    console.error(`\u274C \u67E5\u8BE2\u5931\u8D25\uFF1A${err.message}`);
    process.exit(1);
  }
});
var playbook_default = playbookCmd;

// src/commands/walkthrough.js
import { Command as Command7 } from "commander";
var walkthroughCmd = new Command7().name("walkthrough").description("\u8BB2\u89E3\uFF08Walkthrough\uFF09\u7BA1\u7406 - \u521B\u5EFA\u3001\u66F4\u65B0\u3001\u5220\u9664\u8BB2\u89E3");
function requireApiKey2(apiKey) {
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
}
function ensureSourceKind(kind) {
  const k = String(kind || "").trim() || "upload";
  if (!["upload", "external_url"].includes(k)) {
    console.error("\u9519\u8BEF\uFF1A--source-kind \u4EC5\u652F\u6301 upload \u6216 external_url");
    process.exit(1);
  }
  return k;
}
function buildWalkthroughFields(opts) {
  const w = {};
  if (opts.title !== void 0) w.title = opts.title;
  if (opts.summary !== void 0) w.summary = opts.summary;
  if (opts.body !== void 0) w.body = opts.body;
  if (opts.sourceKind !== void 0) w.source_kind = opts.sourceKind;
  if (opts.externalUrl !== void 0) w.external_url = opts.externalUrl;
  if (opts.posterAt !== void 0) w.poster_preview_at_seconds = opts.posterAt;
  if (opts.publicationStatus !== void 0) w.publication_status = opts.publicationStatus;
  return w;
}
walkthroughCmd.command("new").description("\u521B\u5EFA\u65B0\u8BB2\u89E3").requiredOption("-t, --title <title>", "\u6807\u9898").option("-s, --summary <text>", "\u6458\u8981\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --summary-file\uFF09").option("--summary-file <path>", "\u6458\u8981\u6587\u4EF6\u8DEF\u5F84\uFF08\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("-b, --body <text>", "\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--source-kind <kind>", "\u6765\u6E90\uFF1Aupload/external_url\uFF08\u9ED8\u8BA4 upload\uFF09", "upload").option("--external-url <url>", "asciinema.org \u94FE\u63A5\uFF08source-kind=external_url \u65F6\u5FC5\u586B\uFF09").option("--cast-file <path>", ".cast \u6587\u4EF6\u8DEF\u5F84\uFF08source-kind=upload \u65F6\u5FC5\u586B\uFF09").option("--poster-at <seconds>", "\u5C01\u9762\u9884\u89C8\u79D2\u6570\uFF08>=0 \u7684\u6574\u6570\uFF09").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey2(apiKey);
  const sourceKind = ensureSourceKind(opts.sourceKind);
  const posterAt = opts.posterAt !== void 0 ? Number.parseInt(String(opts.posterAt), 10) : void 0;
  if (opts.body && opts.bodyFile) {
    console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  if (opts.summary && opts.summaryFile) {
    console.error("\u9519\u8BEF\uFF1A--summary \u4E0E --summary-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  const w = {
    title: opts.title,
    summary: opts.summaryFile ? readTextFile(opts.summaryFile) : opts.summary || "",
    body: opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body || "",
    source_kind: sourceKind,
    external_url: opts.externalUrl || "",
    poster_preview_at_seconds: Number.isFinite(posterAt) ? posterAt : void 0
  };
  if (sourceKind === "external_url") {
    if (!w.external_url) {
      console.error("\u9519\u8BEF\uFF1Asource-kind=external_url \u65F6\u5FC5\u987B\u63D0\u4F9B --external-url");
      process.exit(1);
    }
    const result2 = await client.post("/walkthroughs", { walkthrough: w });
    console.log("\u2705 \u8BB2\u89E3\u521B\u5EFA\u6210\u529F");
    console.log(`   ID: ${result2.data.id}`);
    console.log(`   \u6807\u9898\uFF1A${result2.data.title}`);
    return;
  }
  if (!opts.castFile) {
    console.error("\u9519\u8BEF\uFF1Asource-kind=upload \u65F6\u5FC5\u987B\u63D0\u4F9B --cast-file");
    process.exit(1);
  }
  const fields = {
    "walkthrough[title]": w.title,
    "walkthrough[summary]": w.summary,
    "walkthrough[body]": w.body,
    "walkthrough[source_kind]": "upload"
  };
  if (w.poster_preview_at_seconds !== void 0) {
    fields["walkthrough[poster_preview_at_seconds]"] = w.poster_preview_at_seconds;
  }
  const result = await client.postMultipart(
    "/walkthroughs",
    fields,
    { fieldName: "walkthrough[cast_file]", filePath: opts.castFile, filename: "upload.cast" }
  );
  console.log("\u2705 \u8BB2\u89E3\u521B\u5EFA\u6210\u529F");
  console.log(`   ID: ${result.data.id}`);
  console.log(`   \u6807\u9898\uFF1A${result.data.title}`);
});
walkthroughCmd.command("list").description("\u5217\u51FA\u8BB2\u89E3\uFF08\u5206\u9875\uFF09").option("-q, --query <text>", "\u641C\u7D22\u5173\u952E\u8BCD").option("-p, --page <num>", "\u9875\u7801\uFF081-10000\uFF09", "1").option("-n, --per-page <num>", "\u6BCF\u9875\u6570\u91CF\uFF081-100\uFF0C\u9ED8\u8BA4 20\uFF09", "20").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey2(apiKey);
  const result = await client.get("/walkthroughs", {
    q: opts.query,
    page: opts.page,
    per_page: opts.perPage
  });
  const { data, meta } = result;
  const perPage = metaPerPage(meta);
  const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
  console.log(`\u5171 ${meta.total} \u6761\u8BB2\u89E3\uFF08\u7B2C ${meta.page}/${totalPages} \u9875\uFF09
`);
  data.forEach((w) => {
    console.log(`\u{1F3AC} [${w.id}] ${w.title}`);
    if (w.durationLabel) console.log(`   \u65F6\u957F\uFF1A${w.durationLabel}`);
    if (w.summary) console.log(`   ${w.summary}`);
  });
});
walkthroughCmd.command("show").description("\u67E5\u770B\u8BB2\u89E3\u8BE6\u60C5").argument("<id>", "\u8BB2\u89E3 ID").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey2(apiKey);
  const result = await client.get(`/walkthroughs/${id}`);
  const w = result.data;
  console.log(`ID: ${w.id}`);
  console.log(`\u6807\u9898\uFF1A${w.title}`);
  console.log(`\u72B6\u6001\uFF1A${w.publicationStatus}`);
  if (w.summary) console.log(`\u6458\u8981\uFF1A${w.summary}`);
  console.log(`\u6B63\u6587\uFF1A
${w.body || "(\u65E0)"}`);
  console.log(`\u6765\u6E90\uFF1A${w.sourceKind}`);
  if (w.src) console.log(`\u5A92\u4F53\uFF1A${w.src}`);
});
walkthroughCmd.command("update").description("\u66F4\u65B0\u8BB2\u89E3").argument("<id>", "\u8BB2\u89E3 ID").option("-t, --title <title>", "\u65B0\u6807\u9898").option("-s, --summary <text>", "\u65B0\u6458\u8981\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --summary-file\uFF09").option("--summary-file <path>", "\u65B0\u6458\u8981\u6587\u4EF6\u8DEF\u5F84\uFF08\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("-b, --body <text>", "\u65B0\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u65B0\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--publication-status <status>", "\u53D1\u5E03\u72B6\u6001\uFF1Apending_review/private").option("--source-kind <kind>", "\u6765\u6E90\uFF1Aupload/external_url").option("--external-url <url>", "asciinema.org \u94FE\u63A5\uFF08source-kind=external_url\uFF09").option("--cast-file <path>", ".cast \u6587\u4EF6\u8DEF\u5F84\uFF08\u4E0A\u4F20\u66FF\u6362\uFF09").option("--poster-at <seconds>", "\u5C01\u9762\u9884\u89C8\u79D2\u6570\uFF08>=0 \u7684\u6574\u6570\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey2(apiKey);
  const posterAt = opts.posterAt !== void 0 ? Number.parseInt(String(opts.posterAt), 10) : void 0;
  if (opts.body && opts.bodyFile) {
    console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  if (opts.summary && opts.summaryFile) {
    console.error("\u9519\u8BEF\uFF1A--summary \u4E0E --summary-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  const w = buildWalkthroughFields({
    title: opts.title,
    summary: opts.summaryFile ? readTextFile(opts.summaryFile) : opts.summary,
    body: opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body,
    sourceKind: opts.sourceKind ? ensureSourceKind(opts.sourceKind) : void 0,
    externalUrl: opts.externalUrl,
    posterAt: Number.isFinite(posterAt) ? posterAt : void 0,
    publicationStatus: opts.publicationStatus
  });
  const hasFile = Boolean(opts.castFile);
  if (!hasFile) {
    const result2 = await client.patch(`/walkthroughs/${id}`, { walkthrough: w });
    console.log("\u2705 \u8BB2\u89E3\u66F4\u65B0\u6210\u529F");
    console.log(`   \u6807\u9898\uFF1A${result2.data.title}`);
    return;
  }
  const fields = {};
  Object.entries(w).forEach(([k, v]) => {
    fields[`walkthrough[${k}]`] = v;
  });
  const result = await client.patchMultipart(
    `/walkthroughs/${id}`,
    fields,
    { fieldName: "walkthrough[cast_file]", filePath: opts.castFile, filename: "upload.cast" }
  );
  console.log("\u2705 \u8BB2\u89E3\u66F4\u65B0\u6210\u529F");
  console.log(`   \u6807\u9898\uFF1A${result.data.title}`);
});
walkthroughCmd.command("delete").description("\u5220\u9664\u8BB2\u89E3").argument("<id>", "\u8BB2\u89E3 ID").option("-f, --force", "\u5F3A\u5236\u5220\u9664\uFF08\u65E0\u9700\u786E\u8BA4\uFF09").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey2(apiKey);
  if (!opts.force) {
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question("\u786E\u8BA4\u5220\u9664\uFF1F(y/N): ", (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\u5DF2\u53D6\u6D88");
      return;
    }
  }
  await client.delete(`/walkthroughs/${id}`);
  console.log("\u2705 \u8BB2\u89E3\u5DF2\u5220\u9664");
});
var walkthrough_default = walkthroughCmd;

// src/commands/asset.js
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { Command as Command8 } from "commander";

// src/mediaLibraryFingerprint.js
function normalizeForFingerprint(markdown) {
  const OMIT = "__C456_ASSET_URL_OMITTED__";
  const dquote = /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s+"(c456:asset\/(\d+))"\s*\)/g;
  const squote = /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s+'(c456:asset\/(\d+))'\s*\)/g;
  let s = String(markdown ?? "");
  s = s.replace(dquote, (_m, alt, _url, title) => `![${alt}](${OMIT} "${title}")`);
  s = s.replace(squote, (_m, alt, _url, title) => `![${alt}](${OMIT} '${title}')`);
  return s;
}

// src/commands/asset.js
var extToMime = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};
function guessImageContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return extToMime[ext] || "application/octet-stream";
}
var assetCmd = new Command8().name("asset").description("\u7D20\u6750\u5E93\uFF08\u56FE\u7247\uFF09\u2014 \u4E0A\u4F20\u3001\u5217\u8868\u3001\u7EED\u671F\u6B63\u6587\u4E2D\u7684\u9884\u89C8\u94FE\u63A5");
function requireApiKey3(apiKey) {
  if (!apiKey) {
    console.error("\u9519\u8BEF\uFF1A\u672A\u914D\u7F6E API Key");
    process.exit(1);
  }
}
function sha256HexUtf8(markdown) {
  return createHash("sha256").update(normalizeForFingerprint(markdown), "utf8").digest("hex");
}
assetCmd.command("upload").description("\u4E0A\u4F20\u56FE\u7247\u5230\u7D20\u6750\u5E93").requiredOption("-f, --file <path>", "\u672C\u5730\u56FE\u7247\u8DEF\u5F84").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey3(apiKey);
  const result = await client.postMultipart(
    "/assets",
    {},
    {
      fieldName: "file",
      filePath: opts.file,
      filename: void 0,
      contentType: guessImageContentType(opts.file)
    }
  );
  const d = result.data;
  console.log("\u2705 \u4E0A\u4F20\u6210\u529F");
  console.log(`   id: ${d.id}`);
  console.log(`   previewUrl: ${d.previewUrl}`);
  console.log("");
  console.log(d.markdownSnippet);
});
assetCmd.command("list").description("\u5217\u51FA\u7D20\u6750").option("-p, --page <num>", "\u9875\u7801", "1").option("-n, --per-page <num>", "\u6BCF\u9875\u6761\u6570", "50").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey3(apiKey);
  const page = Number.parseInt(String(opts.page), 10) || 1;
  const perPage = Number.parseInt(String(opts.perPage), 10) || 50;
  const { data, meta } = await client.get("/assets", { page, per_page: perPage });
  const n = metaPerPage(meta);
  console.log(`\u5171 ${meta?.total ?? "?"} \u6761 \xB7 \u6BCF\u9875 ${n} \xB7 \u7B2C ${meta?.page ?? page} \u9875`);
  for (const row of data || []) {
    console.log(`- #${row.id} ${row.filename ?? ""} ${row.markdownSnippet ?? ""}`);
  }
});
assetCmd.command("update").description("\u66F4\u65B0\u7D20\u6750\u5728\u5E93\u4E2D\u7684\u5C55\u793A\u6587\u4EF6\u540D\uFF08\u4E0D\u66FF\u6362\u56FE\u7247\u5185\u5BB9\uFF1BJSON PATCH /assets/:id\uFF09").argument("<id>", "\u7D20\u6750 ID").requiredOption("--filename <name>", "\u65B0\u7684\u5C55\u793A\u6587\u4EF6\u540D\uFF0C\u5982 logo.webp").action(async (id, opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey3(apiKey);
  const { data } = await client.patch(`/assets/${id}`, { filename: opts.filename });
  console.log("\u2705 \u5DF2\u66F4\u65B0");
  console.log(`   id: ${data.id}`);
  console.log(`   filename: ${data.filename ?? ""}`);
  console.log("");
  console.log(data.markdownSnippet ?? "");
});
assetCmd.command("show").description("\u67E5\u770B\u5355\u6761\u7D20\u6750").argument("<id>", "\u7D20\u6750 ID").action(async (id, _opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey3(apiKey);
  const { data } = await client.get(`/assets/${id}`);
  console.log(JSON.stringify(data, null, 2));
});
assetCmd.command("delete").description("\u5220\u9664\u7D20\u6750\uFF08\u82E5\u4ECD\u88AB\u6B63\u6587\u5F15\u7528\u4F1A\u5931\u8D25\uFF09").argument("<id>", "\u7D20\u6750 ID").action(async (id, _opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey3(apiKey);
  await client.delete(`/assets/${id}`);
  console.log("\u2705 \u5DF2\u5220\u9664");
});
assetCmd.command("refresh-markdown").description("\u7EED\u671F\u6B63\u6587\u4E2D\u7684\u7D20\u6750\u9884\u89C8 URL\uFF08\u8BFB\u5165 Markdown\uFF0C\u8F93\u51FA\u66FF\u6362\u540E\u7684\u5168\u6587\u5230 stdout\uFF09").option("-b, --body <text>", "Markdown \u5B57\u7B26\u4E32").option("--body-file <path>", "Markdown \u6587\u4EF6\u8DEF\u5F84").action(async (opts, cmd) => {
  const { apiKey, client } = resolveApi(cmd);
  requireApiKey3(apiKey);
  if (opts.body && opts.bodyFile) {
    console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  const markdown = opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body ?? "";
  if (!markdown) {
    console.error("\u9519\u8BEF\uFF1A\u8BF7\u63D0\u4F9B --body \u6216 --body-file");
    process.exit(1);
  }
  const { data } = await client.post("/assets/refresh_markdown", { markdown });
  process.stdout.write(String(data.markdown ?? ""));
});
assetCmd.command("fingerprint").description("\u5BF9\u6B63\u6587\u505A\u4E0E\u670D\u52A1\u5668\u4E00\u81F4\u7684\u89C4\u8303\u5316\u540E\u8F93\u51FA sha256 hex\uFF08\u4E0D\u8C03\u7528\u7F51\u7EDC\uFF09").option("-b, --body <text>", "Markdown \u5B57\u7B26\u4E32").option("--body-file <path>", "Markdown \u6587\u4EF6\u8DEF\u5F84").action(async (opts) => {
  if (opts.body && opts.bodyFile) {
    console.error("\u9519\u8BEF\uFF1A--body \u4E0E --body-file \u4E0D\u80FD\u540C\u65F6\u4F7F\u7528");
    process.exit(1);
  }
  const markdown = opts.bodyFile ? readTextFile(opts.bodyFile) : opts.body ?? "";
  if (!markdown) {
    console.error("\u9519\u8BEF\uFF1A\u8BF7\u63D0\u4F9B --body \u6216 --body-file");
    process.exit(1);
  }
  console.log(sha256HexUtf8(markdown));
});
var asset_default = assetCmd;

// src/commands/browser.js
import fs5 from "node:fs";
import { Command as Command9 } from "commander";

// src/lib/chromeExecutable.js
import fs2 from "node:fs";
import path2 from "node:path";
import process2 from "node:process";
function exists(p) {
  try {
    fs2.accessSync(p, fs2.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function resolveChromeExecutable() {
  const env = process2.env.CHROME_PATH?.trim();
  if (env && exists(env)) return env;
  const platform = process2.platform;
  const candidates = [];
  if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
    );
  } else if (platform === "win32") {
    const pf = process2.env["PROGRAMFILES"] || "C:\\\\Program Files";
    const pf86 = process2.env["PROGRAMFILES(X86)"] || "C:\\\\Program Files (x86)";
    candidates.push(
      path2.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
      path2.join(pf86, "Google", "Chrome", "Application", "chrome.exe")
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium"
    );
  }
  for (const p of candidates) {
    if (exists(p)) return p;
  }
  return null;
}
function chromeExecutableHint() {
  return [
    "\u672A\u627E\u5230 Chrome / Chromium \u53EF\u6267\u884C\u6587\u4EF6\u3002",
    "\u8BF7\u5B89\u88C5 Google Chrome\uFF0C\u6216\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF CHROME_PATH \u6307\u5411\u53EF\u6267\u884C\u6587\u4EF6\u3002",
    "\uFF08\u53EF\u9009\uFF09\u5728\u65E0\u7CFB\u7EDF Chrome \u7684\u73AF\u5883\u53EF\u5B89\u88C5 Playwright \u81EA\u5E26 Chromium\uFF1A",
    "  npx playwright install chromium",
    "\u7136\u540E\u5B89\u88C5 npm \u5305 playwright\uFF0C\u5E76\u628A CHROME_PATH \u8BBE\u4E3A `node -e \"console.log(require('playwright').chromium.executablePath())\"` \u7684\u8F93\u51FA\u3002"
  ].join("\n");
}

// src/lib/chromeCdp.js
import http from "node:http";
import { spawn } from "node:child_process";
import process3 from "node:process";
function cdpHttpUrl(port) {
  return `http://127.0.0.1:${port}`;
}
async function waitForCdpHttp(port, timeoutMs = 45e3) {
  const url = `${cdpHttpUrl(port)}/json/version`;
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const body = await httpGet(url);
      if (body && body.includes("webSocketDebuggerUrl")) {
        return JSON.parse(body);
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(
    `\u7B49\u5F85 Chrome DevTools \u7AEF\u53E3 ${port} \u8D85\u65F6${lastErr ? `\uFF1A${lastErr.message}` : ""}`
  );
}
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        data += c;
      });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(2e3, () => {
      req.destroy();
      reject(new Error("\u8BF7\u6C42\u8D85\u65F6"));
    });
  });
}
function spawnChromeWithCdp(chromePath, { userDataDir, port, extraArgs = [] }) {
  const args = [
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    "--no-first-run",
    "--no-default-browser-check",
    ...extraArgs
  ];
  const child = spawn(chromePath, args, {
    detached: true,
    stdio: "ignore",
    env: { ...process3.env }
  });
  child.unref();
  return { child, port };
}
function killProcessTree(pid) {
  if (!pid || pid <= 0) return;
  if (process3.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      detached: true
    });
    killer.unref();
    return;
  }
  try {
    process3.kill(-pid, "SIGTERM");
  } catch {
    try {
      process3.kill(pid, "SIGTERM");
    } catch {
    }
  }
}

// src/lib/freePort.js
import net from "node:net";
function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : null;
      s.close(() => {
        if (port) resolve(port);
        else reject(new Error("\u65E0\u6CD5\u5206\u914D\u672C\u5730\u7AEF\u53E3"));
      });
    });
  });
}
function isPortListening(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host }, () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(800, () => {
      s.destroy();
      resolve(false);
    });
  });
}

// src/lib/c456Cache.js
import fs3 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";
function getC456CacheDir() {
  const home = os2.homedir();
  const xdgCache = process.env.XDG_CACHE_HOME || path3.join(home, ".cache");
  return path3.join(xdgCache, "c456-cli");
}
function ensureC456CacheDir() {
  const dir = getC456CacheDir();
  fs3.mkdirSync(dir, { recursive: true });
  return dir;
}
function getPersistentChromeProfileDir() {
  return path3.join(getC456CacheDir(), "chrome-profile");
}
function getBrowserDaemonStatePath() {
  return path3.join(getC456CacheDir(), "browser-daemon.json");
}
function getVersionCheckStatePath() {
  return path3.join(getC456CacheDir(), "version-check-state.json");
}

// src/lib/browserDaemon.js
import fs4 from "node:fs";
import process4 from "node:process";
function readJson(path6) {
  try {
    return JSON.parse(fs4.readFileSync(path6, "utf8"));
  } catch {
    return null;
  }
}
function isPidAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process4.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function loadReconciledDaemonState() {
  const path6 = getBrowserDaemonStatePath();
  const st = readJson(path6);
  if (!st?.port || !st?.pid) return null;
  const pidOk = isPidAlive(st.pid);
  const portOk = await isPortListening(st.port);
  if (!pidOk || !portOk) {
    try {
      fs4.unlinkSync(path6);
    } catch {
    }
    return null;
  }
  return { ...st, statePath: path6, cdpHttp: cdpHttpUrl(st.port) };
}
function writeDaemonState(state) {
  ensureC456CacheDir();
  const path6 = getBrowserDaemonStatePath();
  fs4.writeFileSync(path6, `${JSON.stringify(state, null, 2)}
`, "utf8");
}
function clearDaemonStateFile() {
  try {
    fs4.unlinkSync(getBrowserDaemonStatePath());
  } catch {
  }
}

// src/commands/browser.js
function requireChrome() {
  const exe = resolveChromeExecutable();
  if (!exe) {
    console.error(chromeExecutableHint());
    process.exit(1);
  }
  return exe;
}
var browserCmd = new Command9("browser").name("browser").description(
  "\u6709\u5934 Chrome\uFF1A\u6301\u4E45 profile\uFF08\u9ED8\u8BA4 ~/.cache/c456-cli/chrome-profile\uFF09\u3001CDP \u7AEF\u53E3\u81EA\u52A8\u5206\u914D\uFF1B\u4FBF\u4E8E\u5148\u767B\u5F55\u518D\u622A\u56FE"
);
browserCmd.command("start").description("\u542F\u52A8 Chrome\uFF08\u82E5\u5DF2\u5728\u8FD0\u884C\u5219\u6253\u5370\u73B0\u6709 CDP \u5730\u5740\uFF09").option(
  "-p, --port <n>",
  "remote-debugging-port\uFF1B\u9ED8\u8BA4\u81EA\u52A8\u9009\u62E9\u672C\u673A\u53EF\u7528\u7AEF\u53E3"
).action(async (opts) => {
  const existing = await loadReconciledDaemonState();
  if (existing) {
    console.log("Chrome \u5DF2\u5728\u8FD0\u884C\uFF08CLI \u6258\u7BA1\uFF09\u3002");
    console.log(`  CDP: ${existing.cdpHttp}`);
    console.log(`  port: ${existing.port}`);
    console.log(`  pid: ${existing.pid}`);
    console.log(`  userDataDir: ${existing.userDataDir}`);
    return;
  }
  const chromePath = requireChrome();
  ensureC456CacheDir();
  const userDataDir = getPersistentChromeProfileDir();
  fs5.mkdirSync(userDataDir, { recursive: true });
  const port = opts.port != null && opts.port !== "" ? Number.parseInt(String(opts.port), 10) : await getFreePort();
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    console.error("\u9519\u8BEF\uFF1A--port \u65E0\u6548");
    process.exit(1);
  }
  const { child } = spawnChromeWithCdp(chromePath, { userDataDir, port });
  try {
    await waitForCdpHttp(port);
    writeDaemonState({
      port,
      pid: child.pid,
      userDataDir,
      cdpHttp: cdpHttpUrl(port),
      mode: "persistent",
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    console.log("\u2705 \u5DF2\u542F\u52A8\u6709\u5934 Chrome\uFF08\u6301\u4E45 profile\uFF0C\u53EF\u5728\u6B64\u7A97\u53E3\u767B\u5F55\uFF09\u3002");
    console.log(`  CDP: ${cdpHttpUrl(port)}`);
    console.log(`  port: ${port}`);
    console.log(`  pid: ${child.pid}`);
    console.log(`  userDataDir: ${userDataDir}`);
    console.log("");
    console.log("\u7ED3\u675F\u8BF7\u6267\u884C\uFF1Ac456 browser stop");
    console.log("\u622A\u56FE\u53EF\u6267\u884C\uFF1Ac456 screenshot <url> -o <\u6587\u4EF6.png>\uFF08\u5C06\u590D\u7528\u672C\u5B9E\u4F8B\uFF09");
  } catch (e) {
    killProcessTree(child.pid);
    clearDaemonStateFile();
    console.error(e?.message || e);
    process.exit(1);
  }
});
browserCmd.command("stop").description("\u5173\u95ED\u7531 c456 browser start \u542F\u52A8\u7684 Chrome \u5E76\u91CA\u653E\u7AEF\u53E3\u8BB0\u5F55").action(async () => {
  const st = await loadReconciledDaemonState();
  if (!st) {
    console.log("\u5F53\u524D\u6CA1\u6709\u7531 c456 browser start \u8BB0\u5F55\u7684 Chrome \u8FDB\u7A0B\u3002");
    clearDaemonStateFile();
    return;
  }
  killProcessTree(st.pid);
  clearDaemonStateFile();
  console.log(`\u2705 \u5DF2\u53D1\u9001\u7ED3\u675F\u4FE1\u53F7\uFF08pid ${st.pid}\uFF09\u3002\u82E5\u7A97\u53E3\u4ECD\u5728\uFF0C\u8BF7\u7A0D\u5019\u6216\u624B\u52A8\u5173\u95ED\u3002`);
});
browserCmd.command("status").description("\u67E5\u770B CLI \u6258\u7BA1\u7684 Chrome / CDP \u662F\u5426\u5728\u8FD0\u884C").action(async () => {
  const st = await loadReconciledDaemonState();
  if (!st) {
    console.log("\u72B6\u6001\uFF1A\u672A\u8FD0\u884C\uFF08\u65E0\u6709\u6548 browser-daemon.json\uFF09");
    return;
  }
  console.log("\u72B6\u6001\uFF1A\u8FD0\u884C\u4E2D");
  console.log(`  CDP: ${st.cdpHttp}`);
  console.log(`  port: ${st.port}`);
  console.log(`  pid: ${st.pid}`);
  console.log(`  userDataDir: ${st.userDataDir}`);
});
var browser_default = browserCmd;

// src/commands/screenshot.js
import fs6 from "node:fs";
import path4 from "node:path";
import crypto from "node:crypto";
import { Command as Command10 } from "commander";
import { chromium } from "playwright-core";
function parseViewport(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}
function assertHttpUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    throw new Error("URL \u65E0\u6548");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("\u4EC5\u652F\u6301 http(s) URL");
  }
  return url.toString();
}
var INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
function pad2(n) {
  return String(n).padStart(2, "0");
}
function localTimestamp(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
function inferScreenshotOutputPath(urlString, cwd = process.cwd()) {
  const u = new URL(urlString);
  let slug = u.hostname;
  if (u.pathname && u.pathname !== "/") {
    const pathPart = u.pathname.replace(/\/+/g, "-").replace(/^-|-$/g, "");
    if (pathPart) {
      slug += `-${pathPart}`;
    }
  }
  slug = slug.replace(INVALID_FILE_CHARS, "_").replace(/_+/g, "_").replace(/^\.+/, "");
  if (!slug || slug === "_") {
    slug = "screenshot";
  }
  const max = 120;
  if (slug.length > max) {
    slug = `${slug.slice(0, max - 10)}_${slug.slice(-8)}`;
  }
  const name = `${slug}_${localTimestamp()}.png`;
  return path4.resolve(cwd, name);
}
async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
function isGithubComHost(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase();
  return h === "github.com" || h === "www.github.com";
}
var GITHUB_FILES_TABLE_SELECTOR = 'table[aria-labelledby="folders-and-files"], [aria-labelledby="folders-and-files"]';
async function maybeHideGithubFilesTable(page, targetUrl, captureOpts) {
  if (captureOpts.keepGithubFilesTable) {
    return;
  }
  if (!isGithubComHost(targetUrl)) {
    return;
  }
  try {
    await page.waitForSelector(GITHUB_FILES_TABLE_SELECTOR, {
      timeout: 15e3,
      state: "attached"
    });
  } catch {
  }
  let hidden = 0;
  try {
    hidden = await page.evaluate(() => {
      const sels = [
        'table[aria-labelledby="folders-and-files"]',
        '[aria-labelledby="folders-and-files"]'
      ];
      const seen = /* @__PURE__ */ new Set();
      let n = 0;
      for (const sel of sels) {
        for (const el of document.querySelectorAll(sel)) {
          if (seen.has(el)) {
            continue;
          }
          seen.add(el);
          el.style.setProperty("display", "none", "important");
          n += 1;
        }
      }
      return n;
    });
  } catch (e) {
    console.error(`[c456 screenshot] GitHub \u9690\u85CF\u6587\u4EF6\u8868\u5931\u8D25\uFF1A${e?.message || e}`);
    return;
  }
  if (hidden === 0) {
    console.error(
      "[c456 screenshot] \u63D0\u793A\uFF1A\u672A\u627E\u5230\u53EF\u9690\u85CF\u7684\u6587\u4EF6\u8868\u8282\u70B9\uFF08\u9875\u9762\u672A\u542B\u8BE5\u7ED3\u6784\u3001\u4ECD\u5728\u9AA8\u67B6\u3001\u6216 GitHub DOM \u5DF2\u6539\u7248\uFF09\u3002\u53EF\u52A0 --pause \u5728\u6D4F\u89C8\u5668\u91CC\u624B\u52A8\u68C0\u67E5\uFF1B\u4E0D\u9700\u8981\u9690\u85CF\u65F6\u53EF\u7528 --keep-github-files-table\u3002"
    );
  }
}
async function waitForEnterFromStdin(message) {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve(void 0);
    });
  });
}
async function captureScreenshotPipeline(page, targetUrl, outPath, captureOpts) {
  const waitUntil = isGithubComHost(targetUrl) ? "load" : "domcontentloaded";
  await page.goto(targetUrl, { waitUntil, timeout: 12e4 });
  if (captureOpts.waitAfterMs > 0) {
    await sleep(captureOpts.waitAfterMs);
  }
  await maybeHideGithubFilesTable(page, targetUrl, captureOpts);
  if (captureOpts.pause) {
    await waitForEnterFromStdin(
      "\uFF08\u8C03\u8BD5\uFF09\u5DF2\u5728\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210\u52A0\u8F7D\u4E0E GitHub \u9690\u85CF\u5904\u7406\uFF1B\u68C0\u67E5\u9875\u9762\u540E\u6309 Enter \u7EE7\u7EED\u622A\u56FE\u2026\n"
    );
  }
  await page.screenshot({
    path: outPath,
    fullPage: captureOpts.fullPage
  });
  if (captureOpts.pause) {
    await waitForEnterFromStdin(
      "\uFF08\u8C03\u8BD5\uFF09\u622A\u56FE\u5DF2\u5199\u5165\uFF1B\u6309 Enter \u5173\u95ED\u672C\u6807\u7B7E\u9875\u5E76\u7ED3\u675F CLI\uFF08\u4E00\u6B21\u6027\u4F1A\u8BDD\u4E0B\u968F\u540E\u4F1A\u9000\u51FA Chrome\uFF09\u2026\n"
    );
  }
}
async function captureWithCdp(cdpHttp, targetUrl, outPath, captureOpts) {
  const browser = await chromium.connectOverCDP(cdpHttp);
  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("\u672A\u627E\u5230\u9ED8\u8BA4 browser context\uFF08CDP \u5F02\u5E38\uFF09");
    }
    const page = await context.newPage();
    try {
      await captureScreenshotPipeline(page, targetUrl, outPath, captureOpts);
    } finally {
      await page.close().catch(() => {
      });
    }
  } finally {
    await browser.close().catch(() => {
    });
  }
}
async function captureEphemeral(targetUrl, outPath, captureOpts) {
  const chromePath = resolveChromeExecutable();
  if (!chromePath) {
    console.error(chromeExecutableHint());
    process.exit(1);
  }
  ensureC456CacheDir();
  const sessionId = crypto.randomUUID();
  const userDataDir = path4.join(
    getC456CacheDir(),
    "chrome-ephemeral",
    sessionId
  );
  fs6.mkdirSync(userDataDir, { recursive: true });
  const port = await getFreePort();
  const { child } = spawnChromeWithCdp(chromePath, { userDataDir, port });
  let browser;
  try {
    await waitForCdpHttp(port);
    browser = await chromium.connectOverCDP(cdpHttpUrl(port));
    const context = browser.contexts()[0];
    if (!context) throw new Error("\u672A\u627E\u5230\u9ED8\u8BA4 browser context");
    const page = await context.newPage();
    if (captureOpts.viewport) {
      await page.setViewportSize(captureOpts.viewport);
    }
    await captureScreenshotPipeline(page, targetUrl, outPath, captureOpts);
    await page.close().catch(() => {
    });
  } catch (e) {
    try {
      await browser?.close();
    } catch {
    }
    killProcessTree(child.pid);
    await sleep(400);
    try {
      fs6.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
    }
    throw e;
  }
  try {
    await browser?.close();
  } catch {
  }
  killProcessTree(child.pid);
  await sleep(400);
  try {
    fs6.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
  }
}
var screenshotCmd = new Command10("screenshot").name("screenshot").description("\u6253\u5F00 URL \u5E76\u622A\u56FE\uFF08\u9ED8\u8BA4\u590D\u7528 c456 browser start\uFF1B\u5426\u5219\u4E00\u6B21\u6027\u542F\u52A8\u5E76\u5173\u95ED\uFF09").argument("<url>", "\u8981\u6253\u5F00\u7684 http(s) \u5730\u5740").option(
  "-o, --output <path>",
  "\u8F93\u51FA\u56FE\u7247\u8DEF\u5F84\uFF08\u5EFA\u8BAE .png\uFF09\uFF1B\u7701\u7565\u5219\u6839\u636E URL \u751F\u6210\u5B89\u5168\u6587\u4EF6\u540D + \u672C\u5730\u65F6\u95F4\u6233\uFF0C\u5199\u5165\u5F53\u524D\u76EE\u5F55"
).option("-f, --full-page", "\u6574\u9875\u957F\u622A\u56FE", false).option(
  "--viewport <WxH>",
  "\u89C6\u53E3\u5927\u5C0F\uFF0C\u5982 1280x720\uFF08\u4EC5\u5BF9\u4E00\u6B21\u6027\u4F1A\u8BDD\u751F\u6548\uFF1B\u590D\u7528\u5DF2\u542F\u52A8 Chrome \u65F6\u6CBF\u7528\u7A97\u53E3\u5C3A\u5BF8\uFF09"
).option(
  "--wait-after-load <ms>",
  "\u9875\u9762 domcontentloaded \u540E\u518D\u7B49\u5F85\u7684\u6BEB\u79D2\u6570\uFF08\u9ED8\u8BA4 3000\uFF0C\u4FBF\u4E8E JS/\u52A8\u753B\u6E32\u67D3\uFF09\uFF1B\u8BBE\u4E3A 0 \u5219\u4E0D\u989D\u5916\u7B49\u5F85",
  "3000"
).option(
  "--no-reuse",
  "\u4E0D\u590D\u7528 browser start \u7684\u5B9E\u4F8B\uFF0C\u59CB\u7EC8\u5355\u72EC\u8D77 Chrome \u5E76\u5728\u7ED3\u675F\u540E\u5173\u95ED\u3001\u5220\u9664\u4E34\u65F6 profile"
).option(
  "--keep-github-files-table",
  "github.com \u4E0A\u4FDD\u7559\u300C\u6587\u4EF6\u4E0E\u76EE\u5F55\u300D\u8868\u683C\uFF08\u9ED8\u8BA4\u4F1A\u9690\u85CF\u8BE5\u8868\u4EE5\u4FBF\u622A\u56FE\u7A81\u51FA README\uFF09",
  false
).option(
  "--pause",
  "\u8C03\u8BD5\uFF1A\u622A\u56FE\u524D\u540E\u5728\u7EC8\u7AEF\u6309 Enter \u518D\u7EE7\u7EED\uFF1B\u671F\u95F4\u4E0D\u5173\u95ED\u6807\u7B7E\u9875\uFF0C\u4FBF\u4E8E\u5728\u6D4F\u89C8\u5668\u91CC\u68C0\u67E5 DOM\uFF08\u9700\u4EA4\u4E92\u5F0F\u7EC8\u7AEF\uFF09",
  false
).action(async (urlArg, opts) => {
  try {
    const targetUrl = assertHttpUrl(urlArg);
    const outPath = opts.output != null && String(opts.output).trim() !== "" ? path4.resolve(process.cwd(), String(opts.output).trim()) : inferScreenshotOutputPath(targetUrl, process.cwd());
    const waitAfterMs = Number.parseInt(String(opts.waitAfterLoad), 10);
    const wait = Number.isFinite(waitAfterMs) ? Math.max(0, waitAfterMs) : 3e3;
    const viewport = parseViewport(opts.viewport);
    const fullPage = Boolean(opts.fullPage);
    const reuse = opts.reuse !== false;
    const keepGithubFilesTable = Boolean(opts.keepGithubFilesTable);
    const pause = Boolean(opts.pause);
    if (pause && !process.stdin.isTTY) {
      console.error("\u9519\u8BEF\uFF1A--pause \u4EC5\u5728\u4EA4\u4E92\u5F0F\u7EC8\u7AEF\uFF08stdin \u4E3A TTY\uFF09\u4E0B\u53EF\u7528");
      process.exit(1);
    }
    const captureOpts = {
      fullPage,
      waitAfterMs: wait,
      viewport,
      keepGithubFilesTable,
      pause
    };
    if (reuse) {
      const daemon = await loadReconciledDaemonState();
      if (daemon) {
        await captureWithCdp(daemon.cdpHttp, targetUrl, outPath, {
          fullPage,
          waitAfterMs: wait,
          viewport: null,
          keepGithubFilesTable,
          pause
        });
        console.log(`\u2705 \u5DF2\u622A\u56FE\uFF08\u590D\u7528 CDP ${daemon.cdpHttp}\uFF09\u2192 ${outPath}`);
        return;
      }
    }
    await captureEphemeral(targetUrl, outPath, captureOpts);
    console.log(`\u2705 \u5DF2\u622A\u56FE\uFF08\u4E00\u6B21\u6027\u4F1A\u8BDD\uFF0C\u5DF2\u5173\u95ED\uFF09\u2192 ${outPath}`);
  } catch (e) {
    console.error(e?.message || e);
    process.exit(1);
  }
});
var screenshot_default = screenshotCmd;

// src/commands/config.js
import fs7 from "node:fs";
import { Command as Command11 } from "commander";
var GLOBAL_OPT = "-g, --global";
var GLOBAL_DESC = "\u8BFB\u5199\u7528\u6237\u5168\u5C40\u914D\u7F6E\uFF08XDG ~/.config/c456\uFF09\uFF0C\u4E0D\u5199\u5165\u5F53\u524D\u9879\u76EE\u7684 .c456-cli";
var configCmd = new Command11().name("config").description("\u914D\u7F6E\u7BA1\u7406 - \u8BBE\u7F6E API Key \u548C\u7CFB\u7EDF\u5730\u5740\uFF08\u9ED8\u8BA4\u5199\u5165\u9879\u76EE .c456-cli\uFF1B\u52A0 -g \u5199\u5165\u5168\u5C40\uFF09");
configCmd.command("set-key").description("\u8BBE\u7F6E API Key").argument("<token>", "API Key \u4EE4\u724C").option(GLOBAL_OPT, GLOBAL_DESC).action(async (token, opts) => {
  const global = opts.global === true;
  await saveConfigPatch({ apiKey: token }, { global });
  const target = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();
  console.log(`\u2705 API Key \u5DF2\u4FDD\u5B58\u81F3 ${target}`);
  console.log(`   \u63D0\u793A\uFF1A\u4E5F\u53EF\u901A\u8FC7 C456_API_KEY \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E`);
});
configCmd.command("set-url").description("\u8BBE\u7F6E C456 \u7CFB\u7EDF\u5730\u5740").argument("<url>", "\u7CFB\u7EDF\u5730\u5740\uFF08\u5982 https://c456.com\uFF09").option(GLOBAL_OPT, GLOBAL_DESC).action(async (url, opts) => {
  const global = opts.global === true;
  await saveConfigPatch({ baseUrl: url }, { global });
  const target = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();
  console.log(`\u2705 \u7CFB\u7EDF\u5730\u5740\u5DF2\u8BBE\u7F6E\u4E3A\uFF1A${url}`);
  console.log(`   \u5DF2\u5199\u5165\uFF1A${target}`);
  console.log(`   \u63D0\u793A\uFF1A\u4E5F\u53EF\u901A\u8FC7 C456_URL \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E`);
});
configCmd.command("show").description("\u663E\u793A\u5F53\u524D\u6709\u6548\u914D\u7F6E\u53CA\u914D\u7F6E\u6587\u4EF6\u8DEF\u5F84").option(GLOBAL_OPT, "\u4EC5\u67E5\u770B\u5168\u5C40\u914D\u7F6E\u6587\u4EF6\u4E2D\u7684\u5185\u5BB9\uFF08\u4E0D\u5408\u5E76\u9879\u76EE\u8986\u76D6\uFF09").action((opts) => {
  const globalOnly = opts.global === true;
  if (globalOnly) {
    const p = getGlobalConfigPath();
    let raw = {};
    try {
      raw = JSON.parse(fs7.readFileSync(p, "utf-8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    } catch {
      raw = {};
    }
    console.log("\u5168\u5C40\u914D\u7F6E\u6587\u4EF6\u5185\u5BB9\uFF1A");
    console.log(`  \u7CFB\u7EDF\u5730\u5740\uFF1A${raw.baseUrl || "(\u672A\u8BBE\u7F6E\uFF0C\u5408\u5E76\u540E\u9ED8\u8BA4 https://c456.com)"}`);
    console.log(`  API Key\uFF1A${raw.apiKey ? String(raw.apiKey).slice(0, 8) + "..." : "(\u672A\u8BBE\u7F6E)"}`);
    console.log(`
\u6587\u4EF6\uFF1A${p}`);
    return;
  }
  const { merged, globalPath, localPath, workspaceRoot } = loadMergedConfigSources();
  console.log("\u5F53\u524D\u6709\u6548\u914D\u7F6E\uFF08\u9879\u76EE\u8986\u76D6\u5168\u5C40\uFF0C\u73AF\u5883\u53D8\u91CF\u4F18\u5148\u4E8E\u6587\u4EF6\uFF09\uFF1A");
  console.log(`  \u7CFB\u7EDF\u5730\u5740\uFF1A${merged.baseUrl || "https://c456.com"}`);
  console.log(`  API Key\uFF1A${merged.apiKey ? String(merged.apiKey).slice(0, 8) + "..." : "(\u672A\u8BBE\u7F6E)"}`);
  console.log(`
\u5168\u5C40\u914D\u7F6E\uFF1A${globalPath}`);
  if (workspaceRoot) {
    console.log(`\u5DE5\u4F5C\u533A\u6839\uFF1A${workspaceRoot}`);
    console.log(
      `\u9879\u76EE\u914D\u7F6E\uFF1A${localPath}${localPath && fs7.existsSync(localPath) ? "" : "\uFF08\u5C1A\u672A\u521B\u5EFA\uFF0C\u6709\u6548\u503C\u6765\u81EA\u5168\u5C40\uFF09"}`
    );
  } else {
    console.log(
      `\u9879\u76EE\u914D\u7F6E\uFF1A\u672A\u68C0\u6D4B\u5230\u81EA cwd \u5411\u4E0A\u7684 .c456-cli\uFF1B\u65E0 C456_WORKSPACE \u65F6\uFF0C\u9ED8\u8BA4\u53EF\u5199\u5165\u8DEF\u5F84\u4E3A ${resolveLocalConfigWritePath()}`
    );
  }
});
configCmd.command("reset").description("\u91CD\u7F6E\u914D\u7F6E\uFF08\u5220\u9664\u5BF9\u5E94\u8303\u56F4\u5185\u7684\u914D\u7F6E\u6587\u4EF6\uFF09").option(GLOBAL_OPT, GLOBAL_DESC).option("-f, --force", "\u5F3A\u5236\u91CD\u7F6E\uFF08\u65E0\u9700\u786E\u8BA4\uFF09").action(async (opts) => {
  const fs9 = await import("node:fs");
  const global = opts.global === true;
  const targetPath = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();
  if (!opts.force) {
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question(`\u786E\u8BA4\u5220\u9664\u914D\u7F6E\u6587\u4EF6\uFF1F
  ${targetPath}
(y/N): `, (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\u5DF2\u53D6\u6D88");
      return;
    }
  }
  if (fs9.existsSync(targetPath)) {
    fs9.unlinkSync(targetPath);
    console.log(`\u2705 \u5DF2\u5220\u9664\uFF1A${targetPath}`);
  } else {
    console.log("\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728\uFF0C\u65E0\u9700\u5220\u9664");
  }
});
var config_default = configCmd;

// src/commands/skill.js
import path5 from "node:path";
import { Command as Command12 } from "commander";

// src/lib/runNpxSkills.js
import { spawn as spawn2 } from "node:child_process";
function runNpxSkillsAdd(source, opts = {}) {
  const {
    cwd = process.cwd(),
    global = false,
    agent = "cursor",
    copy = false,
    fullDepth = false,
    skill = "c456-cli"
  } = opts;
  const args = ["--yes", "skills", "add", source, "--skill", skill, "-y"];
  if (global) args.push("-g");
  if (agent) {
    args.push("--agent", agent);
  }
  if (copy) args.push("--copy");
  if (fullDepth) args.push("--full-depth");
  return new Promise((resolve, reject) => {
    const child = spawn2("npx", args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const sig = signal ? ` signal=${signal}` : "";
      reject(new Error(`npx skills add \u9000\u51FA\u7801 ${code ?? "?"}${sig}`));
    });
  });
}

// src/commands/skill.js
var REMOTE_SOURCES = [
  { source: "xiaohui-zhangxh/c456-cli", fullDepth: false },
  { source: "xiaohui-zhangxh/c456", fullDepth: true }
];
function buildSkillsOpts(opts) {
  const agent = String(opts.agent ?? "cursor").trim() || "cursor";
  return {
    cwd: path5.resolve(String(opts.cwd || process.cwd())),
    global: Boolean(opts.global),
    agent,
    copy: Boolean(opts.copy)
  };
}
async function installSkillFromRemotes(skillId, base) {
  let lastErr;
  for (const { source, fullDepth } of REMOTE_SOURCES) {
    try {
      console.error(`\u2192 npx skills add ${source} --skill ${skillId} \u2026`);
      await runNpxSkillsAdd(source, { ...base, fullDepth, skill: skillId });
      console.log(`\u2705 \u5DF2\u901A\u8FC7 npx skills \u5B89\u88C5 ${skillId}\uFF08\u6765\u6E90\uFF1A${source}\uFF09`);
      return;
    } catch (e) {
      lastErr = e;
      console.error(`   \u5931\u8D25\uFF1A${e?.message || e}`);
    }
  }
  console.error(
    `\u9519\u8BEF\uFF1A\u65E0\u6CD5\u901A\u8FC7 npx skills \u4ECE GitHub \u5B89\u88C5 ${skillId}\uFF08\u5DF2\u5C1D\u8BD5 xiaohui-zhangxh/c456-cli \u4E0E xiaohui-zhangxh/c456\uFF09\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u4EE3\u7406\u4E0E\u4ED3\u5E93\u53EF\u8BBF\u95EE\u6027\u3002`
  );
  if (lastErr) {
    console.error(`\u6700\u540E\u9519\u8BEF\uFF1A${lastErr.message || lastErr}`);
  }
  process.exit(1);
}
var skillCmd = new Command12("skill").name("skill").description("\u5B89\u88C5 c456-cli \u6280\u80FD\uFF1A\u5C01\u88C5\u5B98\u65B9 npx skills add\uFF08\u4EC5\u4ECE\u7F51\u7EDC\u62C9\u53D6\uFF09");
skillCmd.command("install").description(
  "npx skills add\uFF1A\u9ED8\u8BA4\u53EA\u88C5 c456-cli\uFF08GitHub \u6E90\u4F9D\u6B21\u5C1D\u8BD5\uFF09\uFF1B\u52A0 --with-wiki \u65F6\u5148\u88C5 karpathy-wiki \u4E0E c456-llm-wiki\uFF0C\u518D\u88C5 c456-cli"
).option(
  "-C, --cwd <path>",
  "\u6267\u884C skills \u7684\u5DE5\u4F5C\u76EE\u5F55\uFF08\u9ED8\u8BA4\u5F53\u524D\u76EE\u5F55\uFF1B\u5177\u4F53\u5199\u5165\u8DEF\u5F84\u7531 skills CLI \u4E0E\u5404 Agent \u7EA6\u5B9A\uFF09"
).option("-g, --global", "\u4F20\u7ED9 skills add\uFF1A\u5B89\u88C5\u5230\u7528\u6237\u7EA7\u6280\u80FD\u76EE\u5F55", false).option(
  "-a, --agent <names>",
  "\u4F20\u7ED9 skills add --agent\uFF08\u5982 cursor\u3001claude-code \u7B49\uFF09\uFF0C\u9ED8\u8BA4 cursor",
  "cursor"
).option("--copy", "\u4F20\u7ED9 skills add\uFF1A\u590D\u5236\u6587\u4EF6\u800C\u975E symlink", false).option(
  "--with-wiki",
  "\u79C1\u4EBA\u77E5\u8BC6\u5E93\uFF1A\u5148\u88C5 karpathy-wiki\uFF08baklib-tools/skills\uFF09\uFF0C\u518D\u88C5 c456-llm-wiki \u4E0E c456-cli\uFF08\u5747\u7ECF npx \u4ECE\u7F51\u7EDC\u62C9\u53D6\uFF09",
  false
).action(async (opts) => {
  const base = buildSkillsOpts(opts);
  if (opts.withWiki) {
    try {
      console.error("\u2192 npx skills add baklib-tools/skills --skill karpathy-wiki \u2026");
      await runNpxSkillsAdd("baklib-tools/skills", {
        ...base,
        skill: "karpathy-wiki",
        fullDepth: false
      });
      console.log("\u2705 \u5DF2\u5B89\u88C5 karpathy-wiki\uFF08Karpathy Wiki \u76EE\u5F55\u7EA6\u5B9A\uFF09");
    } catch (e) {
      console.error(`karpathy-wiki \u5B89\u88C5\u5931\u8D25\uFF1A${e?.message || e}`);
      process.exit(1);
    }
    await installSkillFromRemotes("c456-llm-wiki", base);
  }
  await installSkillFromRemotes("c456-cli", base);
});
var skill_default = skillCmd;

// src/banner.js
import cfonts from "cfonts";
var { render } = cfonts;
var CFONTS_OPTIONS = {
  font: "block",
  colors: ["red", "white"],
  env: "node",
  spaceless: true
};
var ANSI_RE = /\u001b\[[\d;]*m/g;
function stripAnsi(s) {
  return s.replace(ANSI_RE, "");
}
function renderBannerColored() {
  const out = render("C456", CFONTS_OPTIONS, false, 0);
  if (!out || !out.string) {
    return "";
  }
  return out.string;
}
var _cachedColored;
var _cachedPlain;
function getBannerColored() {
  if (_cachedColored === void 0) {
    _cachedColored = renderBannerColored();
  }
  return _cachedColored;
}
function getBannerPlainText() {
  if (_cachedPlain === void 0) {
    _cachedPlain = stripAnsi(getBannerColored());
  }
  return _cachedPlain;
}
function getHelpBanner() {
  if (process.env.C456_NO_BANNER === "1") {
    return "";
  }
  const body = process.stdout.isTTY ? getBannerColored() : getBannerPlainText();
  if (!body) {
    return "";
  }
  return `
${body}
`;
}

// src/lib/npmLatestVersion.js
async function fetchNpmLatestVersion(packageName = "c456-cli") {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "follow"
  });
  if (!res.ok) {
    throw new Error(`registry \u54CD\u5E94 ${res.status}`);
  }
  const data = await res.json();
  const v = data?.version;
  if (!v || typeof v !== "string") {
    throw new Error("registry \u8FD4\u56DE\u65E0 version \u5B57\u6BB5");
  }
  return v;
}

// src/lib/cliUpdateState.js
import fs8 from "node:fs";
function readRaw() {
  const p = getVersionCheckStatePath();
  try {
    return JSON.parse(fs8.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
function loadUpdateState() {
  const raw = readRaw();
  if (!raw || typeof raw !== "object") {
    return { lastCheckDay: "", pendingNotifyVersion: "" };
  }
  return {
    lastCheckDay: typeof raw.lastCheckDay === "string" ? raw.lastCheckDay : "",
    pendingNotifyVersion: typeof raw.pendingNotifyVersion === "string" ? raw.pendingNotifyVersion : ""
  };
}
function writeUpdateState(state) {
  ensureC456CacheDir();
  const p = getVersionCheckStatePath();
  fs8.writeFileSync(p, `${JSON.stringify(state, null, 2)}
`, "utf8");
}
function patchUpdateState(partial) {
  const cur = loadUpdateState();
  writeUpdateState({ ...cur, ...partial });
}

// src/lib/semverGt.js
function semverGt(a, b) {
  const pa = String(a).split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => Number.parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < n; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// src/lib/localCalendarDay.js
function localCalendarDay() {
  const d = /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// src/startup.js
function printPendingUpdateNotice(currentVersion) {
  const st = loadUpdateState();
  const pending = st.pendingNotifyVersion?.trim();
  if (!pending) return;
  if (!semverGt(pending, currentVersion)) {
    patchUpdateState({ pendingNotifyVersion: "" });
    return;
  }
  console.error("");
  console.error(
    `[c456-cli] \u6709\u65B0\u7248\u672C ${pending}\uFF08\u5F53\u524D ${currentVersion}\uFF09\u3002\u53EF\u6267\u884C\uFF1Anpm i -g c456-cli`
  );
  console.error("");
  patchUpdateState({ pendingNotifyVersion: "" });
}
function scheduleDailyNpmVersionCheck(currentVersion) {
  const today = localCalendarDay();
  const st = loadUpdateState();
  if (st.lastCheckDay === today) return;
  setImmediate(() => {
    void (async () => {
      let latest;
      try {
        latest = await fetchNpmLatestVersion("c456-cli");
      } catch {
        patchUpdateState({ lastCheckDay: today });
        return;
      }
      const patch = { lastCheckDay: today };
      if (semverGt(latest, currentVersion)) {
        patch.pendingNotifyVersion = latest;
      }
      patchUpdateState(patch);
    })();
  });
}
function runCliStartupHooks({ currentVersion }) {
  if (process.env.C456_SKIP_VERSION_CHECK === "1") return;
  printPendingUpdateNotice(currentVersion);
  scheduleDailyNpmVersionCheck(currentVersion);
}

// src/index.js
var program = new Command13();
program.name("c456").description("C456 CLI - \u5FEB\u901F\u5185\u5BB9\u5F55\u5165\u4E0E\u6574\u7406\u5DE5\u5177").version(package_default.version);
program.addHelpText("before", () => {
  const banner = getHelpBanner();
  const versionLine = `c456-cli ${package_default.version}`;
  if (!banner) {
    return `
${versionLine}
`;
  }
  return `${banner}
${versionLine}
`;
});
program.exitOverride((err) => {
  if (err.code === "commander.executeSubCommandAsync") {
    process.exit(err.exitCode ?? 1);
    return;
  }
  if (err.code === "commander.help" && err.exitCode === 1) {
    process.exit(0);
    return;
  }
  process.exit(err.exitCode ?? 1);
});
program.option(
  "-B, --base-url <url>",
  "C456 \u7AD9\u70B9\u6839\u5730\u5740\uFF1B\u672A\u4F20\u5219\u4F7F\u7528 C456_URL\uFF0C\u5176\u6B21\u5408\u5E76\u8BFB\u53D6 ~/.config/c456 \u4E0E\u81EA cwd \u5411\u4E0A\u627E\u5230\u7684 .c456-cli/config.json\uFF0C\u9ED8\u8BA4 https://c456.com"
);
program.addCommand(signal_default);
program.addCommand(tool_default);
program.addCommand(channel_default);
program.addCommand(fetch_default);
program.addCommand(search_default);
program.addCommand(playbook_default);
program.addCommand(walkthrough_default);
program.addCommand(asset_default);
program.addCommand(browser_default);
program.addCommand(screenshot_default);
program.addCommand(intake_default);
program.addCommand(config_default);
program.addCommand(skill_default);
program.on("--help", () => {
  console.log("\n\u793A\u4F8B:");
  console.log("  # \u914D\u7F6E API Key");
  console.log("  c456 config set-key your-api-token");
  console.log("");
  console.log("  # \u81EA\u6258\u7BA1\u7AD9\u70B9 + \u6309 URL \u6536\u5F55\u5DE5\u5177\uFF08-B=\u7AD9\u70B9\uFF0C-u=\u76EE\u6807 URL\uFF09");
  console.log('  c456 -B https://c456.example.com tool new -u "https://github.com/owner/repo" --auto-resolve-url');
  console.log("");
  console.log("  # \u641C\u7D22\u6536\u5F55");
  console.log('  c456 search signals -q "AI agent"');
  console.log("");
  console.log("  # \u5B89\u88C5 Agent \u6280\u80FD\uFF08\u5C01\u88C5 npx skills add\uFF1B\u77E5\u8BC6\u5E93\u4E00\u6761\u88C5\u9F50\u8BF7\u52A0 --with-wiki\uFF09");
  console.log("  c456 skill install --with-wiki");
  console.log("");
  console.log("\u73AF\u5883\u53D8\u91CF:");
  console.log("  C456_URL        - \u7AD9\u70B9\u6839\u5730\u5740\uFF08\u4E0E -B / --base-url \u4E00\u81F4\uFF09");
  console.log("  C456_API_KEY    - API Key");
  console.log("  C456_WORKSPACE  - \u5DE5\u4F5C\u533A\u6839\u76EE\u5F55\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09\uFF0C\u5176\u4E0B .c456-cli/config.json \u8986\u76D6\u5168\u5C40\u914D\u7F6E");
  console.log("  C456_SKIP_VERSION_CHECK=1 - \u8DF3\u8FC7\u6BCF\u65E5 npm \u7248\u672C\u68C0\u67E5\u4E0E\u66F4\u65B0\u63D0\u793A");
});
runCliStartupHooks({ currentVersion: package_default.version });
program.parse();
