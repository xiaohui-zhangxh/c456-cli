import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CLI_DIR_NAME = ".c456-cli";

/** 用户全局配置目录（XDG） */
export function getGlobalConfigDir() {
  const home = os.homedir();
  const base = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(base, "c456");
}

export function getGlobalConfigPath() {
  return path.join(getGlobalConfigDir(), "config.json");
}

/**
 * 自 cwd 起向父目录查找名为 `.c456-cli` 的目录，返回其所在项目根（即 `.c456-cli` 的父目录）
 * @param {string} startDir
 * @returns {string | null}
 */
export function findWorkspaceRootWalk(startDir) {
  let cur = path.resolve(startDir);
  for (;;) {
    const marker = path.join(cur, CLI_DIR_NAME);
    try {
      if (fs.existsSync(marker) && fs.statSync(marker).isDirectory()) {
        return cur;
      }
    } catch {
      /* ignore */
    }
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

/**
 * 工作区根：优先 `C456_WORKSPACE`（绝对路径），否则为自 cwd 向上找到的含 `.c456-cli` 的目录
 * @returns {string | null} 未设置环境变量且未找到标记目录时为 null
 */
export function getWorkspaceRoot() {
  const raw = process.env.C456_WORKSPACE?.trim();
  if (raw) {
    return path.resolve(raw);
  }
  return findWorkspaceRootWalk(process.cwd());
}

/** 项目内配置文件路径（不一定已存在） */
export function getProjectConfigPath(workspaceRoot) {
  return path.join(workspaceRoot, CLI_DIR_NAME, "config.json");
}

/**
 * 非全局写入时的目标配置文件：已解析到工作区则写该工作区；否则写 cwd 下 `.c456-cli`
 */
export function resolveLocalConfigWritePath() {
  const root = getWorkspaceRoot();
  if (root) return getProjectConfigPath(root);
  return path.join(process.cwd(), CLI_DIR_NAME, "config.json");
}

/**
 * 合并读取：全局为底，项目内覆盖（仅当存在可解析的工作区且对应 config.json 存在时参与合并）
 * @returns {{ merged: Record<string, unknown>, globalPath: string, localPath: string | null, workspaceRoot: string | null }}
 */
export function loadMergedConfigSources() {
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
    workspaceRoot,
  };
}

/**
 * @param {string} filePath
 * @returns {Record<string, unknown>}
 */
function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}
