#!/usr/bin/env node

// src/index.js
import { Command as Command7 } from "commander";

// package.json
var package_default = {
  name: "c456-cli",
  version: "0.1.6",
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
    open: "^10.1.0"
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

// src/client.js
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = dirname(fileURLToPath(import.meta.url));
var CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || process.env.HOME || process.env.USERPROFILE || ".", ".config", "c456");
var CONFIG_PATH = join(CONFIG_DIR, "config.json");
function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function saveConfig(config) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
function getApiKey() {
  return process.env.C456_API_KEY || loadConfig().apiKey || null;
}
function getBaseUrl(cliBaseUrl) {
  const fromCli = cliBaseUrl !== void 0 && cliBaseUrl !== null && String(cliBaseUrl).trim() !== "" ? String(cliBaseUrl).replace(/\/+$/, "") : null;
  const raw = fromCli || process.env.C456_URL || loadConfig().baseUrl || "https://c456.com";
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
  async get(path, params = {}) {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== void 0 && v !== null) url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { headers: this.headers() });
    return this.handleResponse(res);
  }
  /**
   * POST 请求
   */
  async post(path, body = {}) {
    const url = `${this.baseUrl}/api/v1${path}`;
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
  async postMultipart(path, fields = {}, file = null) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const form = new FormData();
    Object.entries(fields || {}).forEach(([k, v]) => {
      if (v === void 0 || v === null) return;
      form.append(k, String(v));
    });
    if (file && file.filePath) {
      const fs = await import("node:fs");
      const pathMod = await import("node:path");
      const bytes = fs.readFileSync(file.filePath);
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
  async patch(path, body = {}) {
    const url = `${this.baseUrl}/api/v1${path}`;
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
  async patchMultipart(path, fields = {}, file = null) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const form = new FormData();
    Object.entries(fields || {}).forEach(([k, v]) => {
      if (v === void 0 || v === null) return;
      form.append(k, String(v));
    });
    if (file && file.filePath) {
      const fs = await import("node:fs");
      const pathMod = await import("node:path");
      const bytes = fs.readFileSync(file.filePath);
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
  async delete(path) {
    const url = `${this.baseUrl}/api/v1${path}`;
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
import { readFileSync as readFileSync2 } from "node:fs";
function readTextFile(path) {
  try {
    return readFileSync2(path, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\u9519\u8BEF\uFF1A\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\uFF1A${path}`);
    console.error(msg);
    process.exit(1);
  }
}

// src/commands/intake.js
var intake = new Command().name("intake").description("\u6536\u5F55\u7BA1\u7406 - \u521B\u5EFA\u3001\u66F4\u65B0\u3001\u5220\u9664\u5DE5\u5177/\u6E20\u9053/\u4FE1\u53F7");
intake.command("new").description("\u521B\u5EFA\u65B0\u6536\u5F55").option("-u, --url <url>", "\u76EE\u6807 URL\uFF08tool/channel \u65F6\u53EF\u9009\uFF1B\u914D\u5408 --auto-resolve-url \u53EF\u81EA\u52A8\u89E3\u6790\u8D44\u6599\uFF09").option("-k, --kind <type>", "\u7C7B\u578B\uFF1Asignal/tool/channel\uFF08\u9ED8\u8BA4 signal\uFF09", "signal").option("-t, --title <title>", "\u6807\u9898\uFF08tool/channel \u5FC5\u586B\uFF09").option("-b, --body <text>", "\u6B63\u6587/\u63CF\u8FF0\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--profile-data-json <json>", "\u8D44\u6599\u6BB5 JSON\uFF08tool/channel\uFF09").option("--auto-resolve-url", "\u81EA\u52A8\u89E3\u6790 URL \u5E76\u586B\u5145\u8D44\u6599\u6BB5 profile_data\uFF08\u4EC5 tool/channel\uFF1B\u4F1A\u53D1\u8D77\u7F51\u7EDC\u8BF7\u6C42\uFF09").action(async (opts, cmd) => {
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
    const body = {
      kind: opts.kind,
      title: opts.title || "",
      body: bodyText
    };
    if (opts.url) {
      body.url = opts.url;
    }
    if (opts.profileDataJson) {
      body.profile_data_json = opts.profileDataJson;
    }
    const kind = String(opts.kind ?? "signal");
    if (opts.autoResolveUrl) {
      if (!opts.url) {
        console.error("\u9519\u8BEF\uFF1A\u4F7F\u7528 --auto-resolve-url \u65F6\u5FC5\u987B\u540C\u65F6\u63D0\u4F9B -u/--url");
        process.exit(1);
      }
      if (kind !== "tool" && kind !== "channel") {
        console.error("\u9519\u8BEF\uFF1A--auto-resolve-url \u4EC5\u9002\u7528\u4E8E -k tool \u6216 -k channel");
        process.exit(1);
      }
      body.auto_resolve_url = true;
    }
    const result = await client.post("/intakes", body);
    console.log("\u2705 \u6536\u5F55\u521B\u5EFA\u6210\u529F");
    console.log(`   ID: ${result.data.id}`);
    console.log(`   \u7C7B\u578B\uFF1A${result.data.kind}`);
    console.log(`   \u6807\u9898\uFF1A${result.data.title || "(\u65E0)"}`);
    console.log("\n--- JSON ---");
    console.log(
      JSON.stringify(
        {
          id: result.data.id,
          kind: result.data.kind,
          title: result.data.title || ""
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error(`\u274C \u521B\u5EFA\u5931\u8D25\uFF1A${err.message}`);
    const kind = String(opts.kind ?? "signal");
    const urlHint = Boolean(opts.url) && kind === "signal" && err instanceof ApiError && err.status === 422;
    if (urlHint) {
      console.error("");
      console.error("\u63D0\u793A\uFF1A\u5F53\u524D\u4E3A signal\uFF08\u9ED8\u8BA4\uFF09\u3002\u82E5\u8981\u89E3\u6790 URL \u7684\u8D44\u6599\u6BB5\uFF0C\u8BF7\u4F7F\u7528 `-k tool`/`-k channel` \u5E76\u663E\u5F0F\u5F00\u542F `--auto-resolve-url`\u3002");
      console.error("  \u793A\u4F8B\uFF1A");
      console.error('    c456 -B <\u7AD9\u70B9> intake new -k channel -u "<\u9891\u9053\u6216\u4E3B\u9875 URL>" --auto-resolve-url');
      console.error('    c456 -B <\u7AD9\u70B9> intake new -k tool -u "<\u5DE5\u5177 / \u4ED3\u5E93 URL>" --auto-resolve-url');
    }
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
intake.command("update").description("\u66F4\u65B0\u6536\u5F55").argument("<id>", "\u6536\u5F55 ID").option("-t, --title <title>", "\u65B0\u6807\u9898").option("-b, --body <text>", "\u65B0\u6B63\u6587\uFF08\u4E0D\u63A8\u8350\u76F4\u63A5\u4F20\uFF1B\u8BF7\u7528 --body-file\uFF09").option("--body-file <path>", "\u65B0\u6B63\u6587\u6587\u4EF6\u8DEF\u5F84\uFF08type: markdown_kramdown\uFF1B\u5EFA\u8BAE\u5199\u5230\u5F53\u524D\u76EE\u5F55 .tmp/\uFF09").option("--favorited", "\u6807\u8BB0\u4E3A\u6536\u85CF").option("--unfavorited", "\u53D6\u6D88\u6536\u85CF").action(async (id, opts, cmd) => {
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
  if (opts.favorited) body.favorited = true;
  if (opts.unfavorited) body.favorited = false;
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

// src/commands/fetch.js
import { Command as Command2 } from "commander";
var fetchProfile = new Command2().name("fetch").description("\u8D44\u6599\u6293\u53D6 - \u4ECE URL \u81EA\u52A8\u89E3\u6790\u5E73\u53F0\u8D44\u6599");
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
import { Command as Command3 } from "commander";
var searchCmd = new Command3().name("search").description("\u641C\u7D22 - \u67E5\u627E\u53EF\u5173\u8054\u7684\u6536\u5F55\u6216\u6253\u6CD5");
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
import { Command as Command4 } from "commander";
var playbookCmd = new Command4().name("playbook").description("\u6253\u6CD5\u7BA1\u7406 - \u521B\u5EFA\u3001\u66F4\u65B0\u3001\u5220\u9664\u6253\u6CD5");
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
import { Command as Command5 } from "commander";
var walkthroughCmd = new Command5().name("walkthrough").description("\u8BB2\u89E3\uFF08Walkthrough\uFF09\u7BA1\u7406 - \u521B\u5EFA\u3001\u66F4\u65B0\u3001\u5220\u9664\u8BB2\u89E3");
function requireApiKey(apiKey) {
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
  requireApiKey(apiKey);
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
  requireApiKey(apiKey);
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
  requireApiKey(apiKey);
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
  requireApiKey(apiKey);
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
  await client.delete(`/walkthroughs/${id}`);
  console.log("\u2705 \u8BB2\u89E3\u5DF2\u5220\u9664");
});
var walkthrough_default = walkthroughCmd;

// src/commands/config.js
import { Command as Command6 } from "commander";
var configCmd = new Command6().name("config").description("\u914D\u7F6E\u7BA1\u7406 - \u8BBE\u7F6E API Key \u548C\u7CFB\u7EDF\u5730\u5740");
configCmd.command("set-key").description("\u8BBE\u7F6E API Key").argument("<token>", "API Key \u4EE4\u724C").action((token, cmd) => {
  const config = loadConfig();
  config.apiKey = token;
  saveConfig(config);
  console.log("\u2705 API Key \u5DF2\u4FDD\u5B58\u81F3 ~/.config/c456/config.json");
  console.log(`   \u63D0\u793A\uFF1A\u4E5F\u53EF\u901A\u8FC7 C456_API_KEY \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E`);
});
configCmd.command("set-url").description("\u8BBE\u7F6E C456 \u7CFB\u7EDF\u5730\u5740").argument("<url>", "\u7CFB\u7EDF\u5730\u5740\uFF08\u5982 https://c456.com\uFF09").action((url, cmd) => {
  const config = loadConfig();
  config.baseUrl = url;
  saveConfig(config);
  console.log(`\u2705 \u7CFB\u7EDF\u5730\u5740\u5DF2\u8BBE\u7F6E\u4E3A\uFF1A${url}`);
  console.log(`   \u63D0\u793A\uFF1A\u4E5F\u53EF\u901A\u8FC7 C456_URL \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E`);
});
configCmd.command("show").description("\u663E\u793A\u5F53\u524D\u914D\u7F6E").action(() => {
  const config = loadConfig();
  console.log("\u5F53\u524D\u914D\u7F6E\uFF1A");
  console.log(`  \u7CFB\u7EDF\u5730\u5740\uFF1A${config.baseUrl || "https://c456.com"}`);
  console.log(`  API Key\uFF1A${config.apiKey ? config.apiKey.slice(0, 8) + "..." : "(\u672A\u8BBE\u7F6E)"}`);
  console.log(`
\u914D\u7F6E\u6587\u4EF6\uFF1A~/.config/c456/config.json`);
});
configCmd.command("reset").description("\u91CD\u7F6E\u914D\u7F6E\uFF08\u5220\u9664\u914D\u7F6E\u6587\u4EF6\uFF09").option("-f, --force", "\u5F3A\u5236\u91CD\u7F6E\uFF08\u65E0\u9700\u786E\u8BA4\uFF09").action(async (opts) => {
  const fs = await import("node:fs");
  if (!opts.force) {
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question("\u786E\u8BA4\u5220\u9664\u914D\u7F6E\u6587\u4EF6\uFF1F(y/N): ", (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });
    if (answer !== "y" && answer !== "yes") {
      console.log("\u5DF2\u53D6\u6D88");
      return;
    }
  }
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
    console.log("\u2705 \u914D\u7F6E\u6587\u4EF6\u5DF2\u5220\u9664");
  } else {
    console.log("\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728\uFF0C\u65E0\u9700\u5220\u9664");
  }
});
var config_default = configCmd;

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

// src/index.js
var program = new Command7();
program.name("c456").description("C456 CLI - \u5FEB\u901F\u5185\u5BB9\u5F55\u5165\u4E0E\u6574\u7406\u5DE5\u5177").version(package_default.version);
program.addHelpText("before", () => getHelpBanner());
program.option(
  "-B, --base-url <url>",
  "C456 \u7AD9\u70B9\u6839\u5730\u5740\uFF1B\u672A\u4F20\u5219\u4F7F\u7528 C456_URL \u73AF\u5883\u53D8\u91CF\u6216 ~/.config/c456/config.json \u7684 baseUrl\uFF0C\u9ED8\u8BA4 https://c456.com"
);
program.addCommand(intake_default);
program.addCommand(fetch_default);
program.addCommand(search_default);
program.addCommand(playbook_default);
program.addCommand(walkthrough_default);
program.addCommand(config_default);
program.on("--help", () => {
  console.log("\n\u793A\u4F8B:");
  console.log("  # \u914D\u7F6E API Key");
  console.log("  c456 config set-key your-api-token");
  console.log("");
  console.log("  # \u81EA\u6258\u7BA1\u7AD9\u70B9 + \u6309 URL \u6536\u5F55\u5DE5\u5177\uFF08-B=\u7AD9\u70B9\uFF0C-u=\u76EE\u6807 URL\uFF09");
  console.log('  c456 -B https://c456.example.com intake new -k tool -u "https://github.com/owner/repo"');
  console.log("");
  console.log("  # \u641C\u7D22\u6536\u5F55");
  console.log('  c456 search signals -q "AI agent"');
  console.log("");
  console.log("\u73AF\u5883\u53D8\u91CF:");
  console.log("  C456_URL        - \u7AD9\u70B9\u6839\u5730\u5740\uFF08\u4E0E -B / --base-url \u4E00\u81F4\uFF09");
  console.log("  C456_API_KEY    - API Key");
});
program.parse();
