import {
  getGlobalConfigPath,
  loadMergedConfigSources,
  resolveLocalConfigWritePath,
} from "./lib/workspaceConfig.js";

/** @deprecated 使用 getGlobalConfigPath() */
export const CONFIG_PATH = getGlobalConfigPath();

/**
 * 合并后的有效配置（全局 ~/.config/c456 + 项目 `.c456-cli/config.json`，后者优先）
 */
export function loadConfig() {
  return loadMergedConfigSources().merged;
}

/**
 * 将若干字段写入指定范围：`-g` 为全局；否则写入当前解析到的项目 `.c456-cli`（无则落在 cwd 下新建）
 * @param {Record<string, unknown>} patch
 * @param {{ global?: boolean }} [options]
 */
export async function saveConfigPatch(patch, options = {}) {
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const global = options.global === true;
  const targetPath = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();

  let existing = {};
  try {
    const raw = fs.readFileSync(targetPath, "utf-8");
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && !Array.isArray(o)) existing = o;
  } catch {
    /* 无文件或解析失败 */
  }

  const next = { ...existing, ...patch };
  fs.mkdirSync(pathMod.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(next, null, 2), "utf-8");
}

/**
 * 获取 API Key（环境变量 `C456_API_KEY` > 配置文件 `apiKey`；无命令行传参，避免与 `intake`/`search` 等子命令的 `-k`（kind）冲突）
 */
export function getApiKey() {
  const v = process.env.C456_API_KEY || loadConfig().apiKey;
  return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : null;
}

/**
 * 获取 API Base URL（优先级：CLI 参数 > 环境变量 > 配置文件 > 默认）
 * @param {string | undefined} cliBaseUrl 根命令传入的 --base-url，未传时请传 undefined（勿传 Commander 默认占位符）
 */
export function getBaseUrl(cliBaseUrl) {
  const fromCli =
    cliBaseUrl !== undefined && cliBaseUrl !== null && String(cliBaseUrl).trim() !== ""
      ? String(cliBaseUrl).replace(/\/+$/, "")
      : null;
  const fromFile = loadConfig().baseUrl;
  const raw = fromCli || process.env.C456_URL || fromFile || "https://c456.com";
  return String(raw).replace(/\/+$/, "");
}

/**
 * 回到 Commander 根命令（用于读取全局 --base-url）
 * @param {import("commander").Command} cmd
 */
export function getRootCommand(cmd) {
  let c = cmd;
  while (c.parent) c = c.parent;
  return c;
}

/** API 分页 meta 中每页条数字段（服务端为 snake_case） */
export function metaPerPage(meta) {
  if (!meta) return 20;
  const n = meta.per_page ?? meta.perPage;
  return n !== undefined && n !== null && Number(n) > 0 ? Number(n) : 20;
}

/**
 * 将 API `error` 对象格式化为终端可读文案（含 `fields` 校验明细）
 * @param {{ message?: string, fields?: Record<string, string> }} error
 */
export function formatApiErrorMessage(error) {
  if (!error || typeof error !== "object") {
    return String(error ?? "请求失败");
  }
  const base = (error.message ?? "请求失败").trim();
  const fields = error.fields;
  if (!fields || typeof fields !== "object") {
    return base;
  }
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return base;
  }
  const label = (k) => (k === "base" ? "说明" : k);
  const lines = keys.map((k) => `  • ${label(k)}：${fields[k]}`);
  return `${base}\n${lines.join("\n")}`;
}

/**
 * HTTP API 客户端
 */
export class ApiClient {
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
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
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
      body: JSON.stringify(body),
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
      if (v === undefined || v === null) return;
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
    // fetch 会自动设置 multipart boundary；手动设置会导致 boundary 丢失
    delete headers["Content-Type"];

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: form,
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
      body: JSON.stringify(body),
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
      if (v === undefined || v === null) return;
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
      body: form,
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
      headers: this.headers(),
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
        fields: error.fields && typeof error.fields === "object" ? error.fields : undefined,
        code: error.code,
      });
    }

    return data;
  }
}

/**
 * API 错误类
 */
export class ApiError extends Error {
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
}

export {
  CLI_DIR_NAME,
  getGlobalConfigPath,
  getWorkspaceRoot,
  loadMergedConfigSources,
  resolveLocalConfigWritePath,
} from "./lib/workspaceConfig.js";
