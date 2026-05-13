import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { resolveChromeExecutable, chromeExecutableHint } from "../lib/chromeExecutable.js";
import {
  spawnChromeWithCdp,
  waitForCdpHttp,
  killProcessTree,
  cdpHttpUrl,
} from "../lib/chromeCdp.js";
import { getFreePort } from "../lib/freePort.js";
import {
  getPersistentChromeProfileDir,
  ensureC456CacheDir,
} from "../lib/c456Cache.js";
import {
  loadReconciledDaemonState,
  writeDaemonState,
  clearDaemonStateFile,
} from "../lib/browserDaemon.js";

function requireChrome() {
  const exe = resolveChromeExecutable();
  if (!exe) {
    console.error(chromeExecutableHint());
    process.exit(1);
  }
  return exe;
}

const browserCmd = new Command("browser")
  .name("browser")
  .description(
    "有头 Chrome：持久 profile（默认 ~/.cache/c456-cli/chrome-profile）、CDP 端口自动分配；便于先登录再截图",
  );

browserCmd
  .command("start")
  .description("启动 Chrome（若已在运行则打印现有 CDP 地址）")
  .option(
    "-p, --port <n>",
    "remote-debugging-port；默认自动选择本机可用端口",
  )
  .action(async (opts) => {
    const existing = await loadReconciledDaemonState();
    if (existing) {
      console.log("Chrome 已在运行（CLI 托管）。");
      console.log(`  CDP: ${existing.cdpHttp}`);
      console.log(`  port: ${existing.port}`);
      console.log(`  pid: ${existing.pid}`);
      console.log(`  userDataDir: ${existing.userDataDir}`);
      return;
    }

    const chromePath = requireChrome();
    ensureC456CacheDir();
    const userDataDir = getPersistentChromeProfileDir();
    fs.mkdirSync(userDataDir, { recursive: true });

    const port =
      opts.port != null && opts.port !== ""
        ? Number.parseInt(String(opts.port), 10)
        : await getFreePort();
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      console.error("错误：--port 无效");
      process.exit(1);
    }

    const { child } = spawnChromeWithCdp(chromePath, { userDataDir, port });
    try {
      await waitForCdpHttp(port);
      writeDaemonState({
        port,
        pid: child.pid,
        userDataDir,
        cdpHttp: cdpHttpUrl(port),
        mode: "persistent",
        startedAt: new Date().toISOString(),
      });

      console.log("✅ 已启动有头 Chrome（持久 profile，可在此窗口登录）。");
      console.log(`  CDP: ${cdpHttpUrl(port)}`);
      console.log(`  port: ${port}`);
      console.log(`  pid: ${child.pid}`);
      console.log(`  userDataDir: ${userDataDir}`);
      console.log("");
      console.log("结束请执行：c456 browser stop");
      console.log("截图可执行：c456 screenshot <url> -o <文件.png>（将复用本实例）");
    } catch (e) {
      killProcessTree(child.pid);
      clearDaemonStateFile();
      console.error(e?.message || e);
      process.exit(1);
    }
  });

browserCmd
  .command("stop")
  .description("关闭由 c456 browser start 启动的 Chrome 并释放端口记录")
  .action(async () => {
    const st = await loadReconciledDaemonState();
    if (!st) {
      console.log("当前没有由 c456 browser start 记录的 Chrome 进程。");
      clearDaemonStateFile();
      return;
    }
    killProcessTree(st.pid);
    clearDaemonStateFile();
    console.log(`✅ 已发送结束信号（pid ${st.pid}）。若窗口仍在，请稍候或手动关闭。`);
  });

browserCmd
  .command("status")
  .description("查看 CLI 托管的 Chrome / CDP 是否在运行")
  .action(async () => {
    const st = await loadReconciledDaemonState();
    if (!st) {
      console.log("状态：未运行（无有效 browser-daemon.json）");
      return;
    }
    console.log("状态：运行中");
    console.log(`  CDP: ${st.cdpHttp}`);
    console.log(`  port: ${st.port}`);
    console.log(`  pid: ${st.pid}`);
    console.log(`  userDataDir: ${st.userDataDir}`);
  });

export default browserCmd;
