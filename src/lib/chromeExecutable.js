import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析本机 Chrome / Chromium 可执行文件路径。
 * 不强制安装 Playwright 自带 Chromium；优先系统 Chrome，其次 CHROME_PATH。
 */
export function resolveChromeExecutable() {
  const env = process.env.CHROME_PATH?.trim();
  if (env && exists(env)) return env;

  const platform = process.platform;
  const candidates = [];

  if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    );
  } else if (platform === "win32") {
    const pf = process.env["PROGRAMFILES"] || "C:\\\\Program Files";
    const pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\\\Program Files (x86)";
    candidates.push(
      path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    );
  }

  for (const p of candidates) {
    if (exists(p)) return p;
  }

  return null;
}

export function chromeExecutableHint() {
  return [
    "未找到 Chrome / Chromium 可执行文件。",
    "请安装 Google Chrome，或设置环境变量 CHROME_PATH 指向可执行文件。",
    "（可选）在无系统 Chrome 的环境可安装 Playwright 自带 Chromium：",
    "  npx playwright install chromium",
    "然后安装 npm 包 playwright，并把 CHROME_PATH 设为 `node -e \"console.log(require('playwright').chromium.executablePath())\"` 的输出。",
  ].join("\n");
}
