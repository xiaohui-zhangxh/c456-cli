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

function isGithubComHost(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase();
  return h === "github.com" || h === "www.github.com";
}

/** GitHub 文件表常见选择器（`aria-labelledby` 指向 `#folders-and-files` 的 h2） */
const GITHUB_FILES_TABLE_SELECTOR =
  'table[aria-labelledby="folders-and-files"], [aria-labelledby="folders-and-files"]';

/**
 * 开源项目主页截图时弱化目录树：在 github.com 用 DOM 内联样式隐藏文件表（避免页面 CSP 拒绝 Playwright 注入的 style 元素）。
 * React 往往在 `domcontentloaded` 之后才挂载表格，故由调用方对 github 使用更晚的 `load` + 可选 `waitForSelector`。
 * @param {import("playwright-core").Page} page
 * @param {string} targetUrl
 * @param {{ keepGithubFilesTable?: boolean }} captureOpts
 */
async function maybeHideGithubFilesTable(page, targetUrl, captureOpts) {
  if (captureOpts.keepGithubFilesTable) {
    return;
  }
  if (!isGithubComHost(targetUrl)) {
    return;
  }
  try {
    await page.waitForSelector(GITHUB_FILES_TABLE_SELECTOR, {
      timeout: 15_000,
      state: "attached",
    });
  } catch {
    // 非仓库页或改版：仍尝试 evaluate，避免静默无操作
  }

  let hidden = 0;
  try {
    hidden = await page.evaluate(() => {
      const sels = [
        'table[aria-labelledby="folders-and-files"]',
        '[aria-labelledby="folders-and-files"]',
      ];
      const seen = new Set();
      let n = 0;
      for (const sel of sels) {
        for (const el of document.querySelectorAll(sel)) {
          if (seen.has(el)) {
            continue;
          }
          seen.add(el);
          el.style.setProperty("display", "none", "important");
          n += 1;
        }
      }
      return n;
    });
  } catch (e) {
    console.error(`[c456 screenshot] GitHub 隐藏文件表失败：${e?.message || e}`);
    return;
  }
  if (hidden === 0) {
    console.error(
      "[c456 screenshot] 提示：未找到可隐藏的文件表节点（页面未含该结构、仍在骨架、或 GitHub DOM 已改版）。可加 --pause 在浏览器里手动检查；不需要隐藏时可用 --keep-github-files-table。",
    );
  }
}

async function waitForEnterFromStdin(message) {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve(undefined);
    });
  });
}

/**
 * @param {import("playwright-core").Page} page
 * @param {string} targetUrl
 * @param {string} outPath
 * @param {{
 *   fullPage: boolean
 *   waitAfterMs: number
 *   keepGithubFilesTable?: boolean
 *   pause?: boolean
 * }} captureOpts
 */
async function captureScreenshotPipeline(page, targetUrl, outPath, captureOpts) {
  const waitUntil = isGithubComHost(targetUrl) ? "load" : "domcontentloaded";
  await page.goto(targetUrl, { waitUntil, timeout: 120_000 });
  if (captureOpts.waitAfterMs > 0) {
    await sleep(captureOpts.waitAfterMs);
  }
  await maybeHideGithubFilesTable(page, targetUrl, captureOpts);
  if (captureOpts.pause) {
    await waitForEnterFromStdin(
      "（调试）已在浏览器中完成加载与 GitHub 隐藏处理；检查页面后按 Enter 继续截图…\n",
    );
  }
  await page.screenshot({
    path: outPath,
    fullPage: captureOpts.fullPage,
  });
  if (captureOpts.pause) {
    await waitForEnterFromStdin(
      "（调试）截图已写入；按 Enter 关闭本标签页并结束 CLI（一次性会话下随后会退出 Chrome）…\n",
    );
  }
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
      await captureScreenshotPipeline(page, targetUrl, outPath, captureOpts);
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
    await captureScreenshotPipeline(page, targetUrl, outPath, captureOpts);
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
  .option(
    "--keep-github-files-table",
    "github.com 上保留「文件与目录」表格（默认会隐藏该表以便截图突出 README）",
    false,
  )
  .option(
    "--pause",
    "调试：截图前后在终端按 Enter 再继续；期间不关闭标签页，便于在浏览器里检查 DOM（需交互式终端）",
    false,
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
      const keepGithubFilesTable = Boolean(opts.keepGithubFilesTable);
      const pause = Boolean(opts.pause);
      if (pause && !process.stdin.isTTY) {
        console.error("错误：--pause 仅在交互式终端（stdin 为 TTY）下可用");
        process.exit(1);
      }

      const captureOpts = {
        fullPage,
        waitAfterMs: wait,
        viewport,
        keepGithubFilesTable,
        pause,
      };

      if (reuse) {
        const daemon = await loadReconciledDaemonState();
        if (daemon) {
          await captureWithCdp(daemon.cdpHttp, targetUrl, outPath, {
            fullPage,
            waitAfterMs: wait,
            viewport: null,
            keepGithubFilesTable,
            pause,
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
