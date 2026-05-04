import { getApiKey, getBaseUrl, ApiClient, getRootCommand } from "./client.js";

/** 供子命令 action 使用：解析全局 key / base-url 并得到客户端 */
export function resolveApi(cmd) {
  const root = getRootCommand(cmd);
  const o = root.opts();
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl(o.baseUrl);
  return { apiKey, baseUrl, client: new ApiClient(baseUrl, apiKey) };
}
