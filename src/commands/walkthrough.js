import { Command } from "commander";
import { metaPerPage } from "../client.js";
import { resolveApi } from "../context.js";

const walkthroughCmd = new Command()
  .name("walkthrough")
  .description("讲解（Walkthrough）管理 - 创建、更新、删除讲解");

function requireApiKey(apiKey) {
  if (!apiKey) {
    console.error("错误：未配置 API Key");
    process.exit(1);
  }
}

function ensureSourceKind(kind) {
  const k = String(kind || "").trim() || "upload";
  if (!["upload", "external_url"].includes(k)) {
    console.error("错误：--source-kind 仅支持 upload 或 external_url");
    process.exit(1);
  }
  return k;
}

function buildWalkthroughFields(opts) {
  const w = {};
  if (opts.title !== undefined) w.title = opts.title;
  if (opts.summary !== undefined) w.summary = opts.summary;
  if (opts.body !== undefined) w.body = opts.body;
  if (opts.sourceKind !== undefined) w.source_kind = opts.sourceKind;
  if (opts.externalUrl !== undefined) w.external_url = opts.externalUrl;
  if (opts.posterAt !== undefined) w.poster_preview_at_seconds = opts.posterAt;
  if (opts.publicationStatus !== undefined) w.publication_status = opts.publicationStatus;
  return w;
}

// walkthrough new
walkthroughCmd
  .command("new")
  .description("创建新讲解")
  .requiredOption("-t, --title <title>", "标题")
  .option("-s, --summary <text>", "摘要")
  .option("-b, --body <text>", "正文（type: markdown_kramdown；语法见 references/content-syntax-kramdown.md）")
  .option("--source-kind <kind>", "来源：upload/external_url（默认 upload）", "upload")
  .option("--external-url <url>", "asciinema.org 链接（source-kind=external_url 时必填）")
  .option("--cast-file <path>", ".cast 文件路径（source-kind=upload 时必填）")
  .option("--poster-at <seconds>", "封面预览秒数（>=0 的整数）")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);

    const sourceKind = ensureSourceKind(opts.sourceKind);
    const posterAt = opts.posterAt !== undefined ? Number.parseInt(String(opts.posterAt), 10) : undefined;

    const w = {
      title: opts.title,
      summary: opts.summary || "",
      body: opts.body || "",
      source_kind: sourceKind,
      external_url: opts.externalUrl || "",
      poster_preview_at_seconds: Number.isFinite(posterAt) ? posterAt : undefined,
    };

    if (sourceKind === "external_url") {
      if (!w.external_url) {
        console.error("错误：source-kind=external_url 时必须提供 --external-url");
        process.exit(1);
      }
      const result = await client.post("/walkthroughs", { walkthrough: w });
      console.log("✅ 讲解创建成功");
      console.log(`   ID: ${result.data.id}`);
      console.log(`   标题：${result.data.title}`);
      return;
    }

    // upload
    if (!opts.castFile) {
      console.error("错误：source-kind=upload 时必须提供 --cast-file");
      process.exit(1);
    }
    // multipart: walkthrough[xxx] + walkthrough[cast_file]
    const fields = {
      "walkthrough[title]": w.title,
      "walkthrough[summary]": w.summary,
      "walkthrough[body]": w.body,
      "walkthrough[source_kind]": "upload",
    };
    if (w.poster_preview_at_seconds !== undefined) {
      fields["walkthrough[poster_preview_at_seconds]"] = w.poster_preview_at_seconds;
    }
    const result = await client.postMultipart(
      "/walkthroughs",
      fields,
      { fieldName: "walkthrough[cast_file]", filePath: opts.castFile, filename: "upload.cast" },
    );
    console.log("✅ 讲解创建成功");
    console.log(`   ID: ${result.data.id}`);
    console.log(`   标题：${result.data.title}`);
  });

// walkthrough list
walkthroughCmd
  .command("list")
  .description("列出讲解（分页）")
  .option("-q, --query <text>", "搜索关键词")
  .option("-p, --page <num>", "页码（1-10000）", "1")
  .option("-n, --per-page <num>", "每页数量（1-100，默认 20）", "20")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);

    const result = await client.get("/walkthroughs", {
      q: opts.query,
      page: opts.page,
      per_page: opts.perPage,
    });

    const { data, meta } = result;
    const perPage = metaPerPage(meta);
    const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
    console.log(`共 ${meta.total} 条讲解（第 ${meta.page}/${totalPages} 页）\n`);
    data.forEach((w) => {
      console.log(`🎬 [${w.id}] ${w.title}`);
      if (w.durationLabel) console.log(`   时长：${w.durationLabel}`);
      if (w.summary) console.log(`   ${w.summary}`);
    });
  });

// walkthrough show
walkthroughCmd
  .command("show")
  .description("查看讲解详情")
  .argument("<id>", "讲解 ID")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);

    const result = await client.get(`/walkthroughs/${id}`);
    const w = result.data;
    console.log(`ID: ${w.id}`);
    console.log(`标题：${w.title}`);
    console.log(`状态：${w.publicationStatus}`);
    if (w.summary) console.log(`摘要：${w.summary}`);
    console.log(`正文：\n${w.body || "(无)"}`);
    console.log(`来源：${w.sourceKind}`);
    if (w.src) console.log(`媒体：${w.src}`);
  });

// walkthrough update
walkthroughCmd
  .command("update")
  .description("更新讲解")
  .argument("<id>", "讲解 ID")
  .option("-t, --title <title>", "新标题")
  .option("-s, --summary <text>", "新摘要")
  .option("-b, --body <text>", "新正文（type: markdown_kramdown；语法见 references/content-syntax-kramdown.md）")
  .option("--publication-status <status>", "发布状态：pending_review/private")
  .option("--source-kind <kind>", "来源：upload/external_url")
  .option("--external-url <url>", "asciinema.org 链接（source-kind=external_url）")
  .option("--cast-file <path>", ".cast 文件路径（上传替换）")
  .option("--poster-at <seconds>", "封面预览秒数（>=0 的整数）")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);

    const posterAt = opts.posterAt !== undefined ? Number.parseInt(String(opts.posterAt), 10) : undefined;
    const w = buildWalkthroughFields({
      title: opts.title,
      summary: opts.summary,
      body: opts.body,
      sourceKind: opts.sourceKind ? ensureSourceKind(opts.sourceKind) : undefined,
      externalUrl: opts.externalUrl,
      posterAt: Number.isFinite(posterAt) ? posterAt : undefined,
      publicationStatus: opts.publicationStatus,
    });

    const hasFile = Boolean(opts.castFile);
    if (!hasFile) {
      const result = await client.patch(`/walkthroughs/${id}`, { walkthrough: w });
      console.log("✅ 讲解更新成功");
      console.log(`   标题：${result.data.title}`);
      return;
    }

    const fields = {};
    Object.entries(w).forEach(([k, v]) => {
      fields[`walkthrough[${k}]`] = v;
    });
    const result = await client.patchMultipart(
      `/walkthroughs/${id}`,
      fields,
      { fieldName: "walkthrough[cast_file]", filePath: opts.castFile, filename: "upload.cast" },
    );
    console.log("✅ 讲解更新成功");
    console.log(`   标题：${result.data.title}`);
  });

// walkthrough delete
walkthroughCmd
  .command("delete")
  .description("删除讲解")
  .argument("<id>", "讲解 ID")
  .option("-f, --force", "强制删除（无需确认）")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    requireApiKey(apiKey);

    if (!opts.force) {
      const readline = await import("node:readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question("确认删除？(y/N): ", (ans) => {
          rl.close();
          resolve(ans.toLowerCase());
        });
      });
      if (answer !== "y" && answer !== "yes") {
        console.log("已取消");
        return;
      }
    }

    await client.delete(`/walkthroughs/${id}`);
    console.log("✅ 讲解已删除");
  });

export default walkthroughCmd;

