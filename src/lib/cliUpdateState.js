import fs from "node:fs";
import { getVersionCheckStatePath, ensureC456CacheDir } from "./c456Cache.js";

function readRaw() {
  const p = getVersionCheckStatePath();
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function loadUpdateState() {
  const raw = readRaw();
  if (!raw || typeof raw !== "object") {
    return { lastCheckDay: "", pendingNotifyVersion: "" };
  }
  return {
    lastCheckDay: typeof raw.lastCheckDay === "string" ? raw.lastCheckDay : "",
    pendingNotifyVersion:
      typeof raw.pendingNotifyVersion === "string"
        ? raw.pendingNotifyVersion
        : "",
  };
}

export function writeUpdateState(state) {
  ensureC456CacheDir();
  const p = getVersionCheckStatePath();
  fs.writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function patchUpdateState(partial) {
  const cur = loadUpdateState();
  writeUpdateState({ ...cur, ...partial });
}
