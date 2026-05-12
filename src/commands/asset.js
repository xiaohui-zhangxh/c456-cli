import { createHash } from "node:crypto";
import { extname } from "node:path";
import { Command } from "commander";
import { metaPerPage } from "../client.js";
import { resolveApi } from "../context.js";
import { readTextFile } from "../textFile.js";
import { normalizeForFingerprint } from "../mediaLibraryFingerprint.js";

const extToMime = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function guessImageContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return extToMime[ext] || "application/octet-stream";
}

const assetCmd = new Command()
  .name("asset")
  .description("素材库（图片）— 上传、列表、续期正文中的预览链接");

function requireApiKey(apiKey) {
  if (!apiKey) {
    console.error("错误：未配置 API Key");
    process.exit(1);
  }
}

/** Node 无 WebCrypto 时的 SHA256 hex（与 fingerprintSha256Hex 等价） */
function sha256HexUtf8(markdown) {
  return createHash("sha256").update(normalizeForFingerprint(markdown), "utf8").digest("hex");
}

assetCmd
  .command("upload")
  .description("上传图片到素材库")
  .requiredOption("-f, --file <path>", "本地图片路径")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);
    const result = await client.postMultipart(
      "/assets",
      {},
      {
        fieldName: "file",
        filePath: opts.file,
        filename: undefined,
        contentType: guessImageContentType(opts.file),
      },
    );
    const d = result.data;
    console.log("✅ 上传成功");
    console.log(`   id: ${d.id}`);
    console.log(`   previewUrl: ${d.previewUrl}`);
    console.log("");
    console.log(d.markdownSnippet);
  });

assetCmd
  .command("list")
  .description("列出素材")
  .option("-p, --page <num>", "页码", "1")
  .option("-n, --per-page <num>", "每页条数", "50")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);
    const page = Number.parseInt(String(opts.page), 10) || 1;
    const perPage = Number.parseInt(String(opts.perPage), 10) || 50;
    const { data, meta } = await client.get("/assets", { page, per_page: perPage });
    const n = metaPerPage(meta);
    console.log(`共 ${meta?.total ?? "?"} 条 · 每页 ${n} · 第 ${meta?.page ?? page} 页`);
    for (const row of data || []) {
      console.log(`- #${row.id} ${row.filename ?? ""} ${row.markdownSnippet ?? ""}`);
    }
  });

assetCmd
  .command("update")
  .description("更新素材在库中的展示文件名（不替换图片内容；JSON PATCH /assets/:id）")
  .argument("<id>", "素材 ID")
  .requiredOption("--filename <name>", "新的展示文件名，如 logo.webp")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);
    const { data } = await client.patch(`/assets/${id}`, { filename: opts.filename });
    console.log("✅ 已更新");
    console.log(`   id: ${data.id}`);
    console.log(`   filename: ${data.filename ?? ""}`);
    console.log("");
    console.log(data.markdownSnippet ?? "");
  });

assetCmd
  .command("show")
  .description("查看单条素材")
  .argument("<id>", "素材 ID")
  .action(async (id, _opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);
    const { data } = await client.get(`/assets/${id}`);
    console.log(JSON.stringify(data, null, 2));
  });

assetCmd
  .command("delete")
  .description("删除素材（若仍被正文引用会失败）")
  .argument("<id>", "素材 ID")
  .action(async (id, _opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);
    await client.delete(`/assets/${id}`);
    console.log("✅ 已删除");
  });

assetCmd
  .command("refresh-markdown")
  .description("续期正文中的素材预览 URL（读入 Markdown，输出替换后的全文到 stdout）")
  .option("-b, --body <text>", "Markdown 字符串")
  .option("--body-file <path>", "Markdown 文件路径")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);
    if (opts.body && opts.bodyFile) {
      console.error("错误：--body 与 --body-file 不能同时使用");
      process.exit(1);
    }
    const markdown = opts.bodyFile ? readTextFile(opts.bodyFile) : (opts.body ?? "");
    if (!markdown) {
      console.error("错误：请提供 --body 或 --body-file");
      process.exit(1);
    }
    const { data } = await client.post("/assets/refresh_markdown", { markdown });
    process.stdout.write(String(data.markdown ?? ""));
  });

assetCmd
  .command("fingerprint")
  .description("对正文做与服务器一致的规范化后输出 sha256 hex（不调用网络）")
  .option("-b, --body <text>", "Markdown 字符串")
  .option("--body-file <path>", "Markdown 文件路径")
  .action(async (opts) => {
    if (opts.body && opts.bodyFile) {
      console.error("错误：--body 与 --body-file 不能同时使用");
      process.exit(1);
    }
    const markdown = opts.bodyFile ? readTextFile(opts.bodyFile) : (opts.body ?? "");
    if (!markdown) {
      console.error("错误：请提供 --body 或 --body-file");
      process.exit(1);
    }
    console.log(sha256HexUtf8(markdown));
  });

export default assetCmd;
