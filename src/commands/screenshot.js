import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Command } from "commander";
import { chromium } from "playwright-core";
import { resolveChromeExecutable, chromeExecutableHint } from "../lib/chromeExecutable.js";
import {
  spawnChromeWithCdp,
  waitForCdpHttp,
  killProcessTree,
  cdpHttpUrl,
} from "../lib/chromeCdp.js";
import { getFreePort } from "../lib/freePort.js";
import {
  getC456CacheDir,
  ensureC456CacheDir,
} from "../lib/c456Cache.js";
import { loadReconciledDaemonState } from "../lib/browserDaemon.js";

function parseViewport(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}

function assertHttpUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    throw new Error("URL 无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http(s) URL");
  }
  return url.toString();
}

const INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** 本地时间戳 YYYYMMDD-HHmmss */
function localTimestamp(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

/**
 * 由 URL 推导当前目录下的默认截图路径：安全化 hostname+pathname + 时间戳 + .png
 */
function inferScreenshotOutputPath(urlString, cwd = process.cwd()) {
  const u = new URL(urlString);
  let slug = u.hostname;
  if (u.pathname && u.pathname !== "/") {
    const pathPart = u.pathname
      .replace(/\/+/g, "-")
      .replace(/^-|-$/g, "");
    if (pathPart) {
      slug += `-${pathPart}`;
    }
  }
  slug = slug.replace(INVALID_FILE_CHARS, "_").replace(/_+/g, "_").replace(/^\.+/, "");
  if (!slug || slug === "_") {
    slug = "screenshot";
  }
  const max = 120;
  if (slug.length > max) {
    slug = `${slug.slice(0, max - 10)}_${slug.slice(-8)}`;
  }
  const name = `${slug}_${localTimestamp()}.png`;
  return path.resolve(cwd, name);
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function captureWithCdp(cdpHttp, targetUrl, outPath, captureOpts) {
  const browser = await chromium.connectOverCDP(cdpHttp);
  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("未找到默认 browser context（CDP 异常）");
    }
    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      if (captureOpts.waitAfterMs > 0) {
        await sleep(captureOpts.waitAfterMs);
      }
      await page.screenshot({
        path: outPath,
        fullPage: captureOpts.fullPage,
      });
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

async function captureEphemeral(targetUrl, outPath, captureOpts) {
  const chromePath = resolveChromeExecutable();
  if (!chromePath) {
    console.error(chromeExecutableHint());
    process.exit(1);
  }

  ensureC456CacheDir();
  const sessionId = crypto.randomUUID();
  const userDataDir = path.join(
    getC456CacheDir(),
    "chrome-ephemeral",
    sessionId,
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const port = await getFreePort();
  const { child } = spawnChromeWithCdp(chromePath, { userDataDir, port });
  let browser;
  try {
    await waitForCdpHttp(port);
    browser = await chromium.connectOverCDP(cdpHttpUrl(port));
    const context = browser.contexts()[0];
    if (!context) throw new Error("未找到默认 browser context");
    const page = await context.newPage();
    if (captureOpts.viewport) {
      await page.setViewportSize(captureOpts.viewport);
    }
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    if (captureOpts.waitAfterMs > 0) {
      await sleep(captureOpts.waitAfterMs);
    }
    await page.screenshot({ path: outPath, fullPage: captureOpts.fullPage });
    await page.close().catch(() => {});
  } catch (e) {
    try {
      await browser?.close();
    } catch {
      // ignore
    }
    killProcessTree(child.pid);
    await sleep(400);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    throw e;
  }
  try {
    await browser?.close();
  } catch {
    // ignore
  }
  killProcessTree(child.pid);
  await sleep(400);
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

const screenshotCmd = new Command("screenshot")
  .name("screenshot")
  .description("打开 URL 并截图（默认复用 c456 browser start；否则一次性启动并关闭）")
  .argument("<url>", "要打开的 http(s) 地址")
  .option(
    "-o, --output <path>",
    "输出图片路径（建议 .png）；省略则根据 URL 生成安全文件名 + 本地时间戳，写入当前目录",
  )
  .option("-f, --full-page", "整页长截图", false)
  .option(
    "--viewport <WxH>",
    "视口大小，如 1280x720（仅对一次性会话生效；复用已启动 Chrome 时沿用窗口尺寸）",
  )
  .option(
    "--wait-after-load <ms>",
    "页面 domcontentloaded 后再等待的毫秒数（默认 3000，便于 JS/动画渲染）；设为 0 则不额外等待",
    "3000",
  )
  .option(
    "--no-reuse",
    "不复用 browser start 的实例，始终单独起 Chrome 并在结束后关闭、删除临时 profile",
  )
  .action(async (urlArg, opts) => {
    try {
      const targetUrl = assertHttpUrl(urlArg);
      const outPath =
        opts.output != null && String(opts.output).trim() !== ""
          ? path.resolve(process.cwd(), String(opts.output).trim())
          : inferScreenshotOutputPath(targetUrl, process.cwd());

      const waitAfterMs = Number.parseInt(String(opts.waitAfterLoad), 10);
      const wait = Number.isFinite(waitAfterMs) ? Math.max(0, waitAfterMs) : 3000;
      const viewport = parseViewport(opts.viewport);
      const fullPage = Boolean(opts.fullPage);
      const reuse = opts.reuse !== false;

      const captureOpts = { fullPage, waitAfterMs: wait, viewport };

      if (reuse) {
        const daemon = await loadReconciledDaemonState();
        if (daemon) {
          await captureWithCdp(daemon.cdpHttp, targetUrl, outPath, {
            fullPage,
            waitAfterMs: wait,
            viewport: null,
          });
          console.log(`✅ 已截图（复用 CDP ${daemon.cdpHttp}）→ ${outPath}`);
          return;
        }
      }

      await captureEphemeral(targetUrl, outPath, captureOpts);
      console.log(`✅ 已截图（一次性会话，已关闭）→ ${outPath}`);
    } catch (e) {
      console.error(e?.message || e);
      process.exit(1);
    }
  });

export default screenshotCmd;
