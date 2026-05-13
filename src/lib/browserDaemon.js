import fs from "node:fs";
import process from "node:process";
import { getBrowserDaemonStatePath, ensureC456CacheDir } from "./c456Cache.js";
import { isPortListening } from "./freePort.js";
import { cdpHttpUrl } from "./chromeCdp.js";

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function isPidAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 若磁盘上的 daemon 记录已失效则删除并返回 null */
export async function loadReconciledDaemonState() {
  const path = getBrowserDaemonStatePath();
  const st = readJson(path);
  if (!st?.port || !st?.pid) return null;
  const pidOk = isPidAlive(st.pid);
  const portOk = await isPortListening(st.port);
  if (!pidOk || !portOk) {
    try {
      fs.unlinkSync(path);
    } catch {
      // ignore
    }
    return null;
  }
  return { ...st, statePath: path, cdpHttp: cdpHttpUrl(st.port) };
}

export function writeDaemonState(state) {
  ensureC456CacheDir();
  const path = getBrowserDaemonStatePath();
  fs.writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function clearDaemonStateFile() {
  try {
    fs.unlinkSync(getBrowserDaemonStatePath());
  } catch {
    // ignore
  }
}
