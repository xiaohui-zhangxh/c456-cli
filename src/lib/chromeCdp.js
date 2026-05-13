import http from "node:http";
import { spawn } from "node:child_process";
import process from "node:process";

export function cdpHttpUrl(port) {
  return `http://127.0.0.1:${port}`;
}

/** 轮询 DevTools HTTP，直到 /json/version 可解析 */
export async function waitForCdpHttp(port, timeoutMs = 45000) {
  const url = `${cdpHttpUrl(port)}/json/version`;
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const body = await httpGet(url);
      if (body && body.includes("webSocketDebuggerUrl")) {
        return JSON.parse(body);
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(
    `等待 Chrome DevTools 端口 ${port} 超时${lastErr ? `：${lastErr.message}` : ""}`,
  );
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        data += c;
      });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error("请求超时"));
    });
  });
}

/**
 * 启动有头 Chrome，开启 remote-debugging-port。
 * @returns {{ child: import('child_process').ChildProcess, port: number }}
 */
export function spawnChromeWithCdp(chromePath, { userDataDir, port, extraArgs = [] }) {
  const args = [
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    "--no-first-run",
    "--no-default-browser-check",
    ...extraArgs,
  ];
  const child = spawn(chromePath, args, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();
  return { child, port };
}

export function killProcessTree(pid) {
  if (!pid || pid <= 0) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      detached: true,
    });
    killer.unref();
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
  }
}
