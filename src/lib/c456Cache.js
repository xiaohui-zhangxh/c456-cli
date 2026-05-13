import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 用户级缓存根：默认 ~/.cache/c456-cli；可用 XDG_CACHE_HOME 覆盖前半段 */
export function getC456CacheDir() {
  const home = os.homedir();
  const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, ".cache");
  return path.join(xdgCache, "c456-cli");
}

export function ensureC456CacheDir() {
  const dir = getC456CacheDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getPersistentChromeProfileDir() {
  return path.join(getC456CacheDir(), "chrome-profile");
}

export function getBrowserDaemonStatePath() {
  return path.join(getC456CacheDir(), "browser-daemon.json");
}

export function getVersionCheckStatePath() {
  return path.join(getC456CacheDir(), "version-check-state.json");
}
