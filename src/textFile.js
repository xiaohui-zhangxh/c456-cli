import { readFileSync } from "node:fs";

export function readTextFile(path) {
  try {
    return readFileSync(path, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`错误：无法读取文件：${path}`);
    console.error(msg);
    process.exit(1);
  }
}

