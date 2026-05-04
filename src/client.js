import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || process.env.HOME || process.env.USERPROFILE || ".", ".config", "c456");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/**
 * 读取配置文件
 */
export function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * 保存配置文件
 */
export async function saveConfig(config) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.dirname(CONFIG_PATH);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * 获取 API Key（环境变量 `C456_API_KEY` > 配置文件 `apiKey`；无命令行传参，避免与 `intake`/`search` 等子命令的 `-k`（kind）冲突）
 */
export function getApiKey() {
  return process.env.C456_API_KEY || loadConfig().apiKey || null;
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
  const raw = fromCli || process.env.C456_URL || loadConfig().baseUrl || "https://c456.com";
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
