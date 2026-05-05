import { Command } from "commander";
import { metaPerPage, ApiError } from "../client.js";
import { resolveApi } from "../context.js";

const intake = new Command()
  .name("intake")
  .description("收录管理 - 创建、更新、删除工具/渠道/信号");

// intake new
intake
  .command("new")
  .description("创建新收录")
  .option("-u, --url <url>", "目标 URL（tool/channel 时可选，用于自动解析资料）")
  .option("-k, --kind <type>", "类型：signal/tool/channel（默认 signal）", "signal")
  .option("-t, --title <title>", "标题（tool/channel 必填）")
  .option("-b, --body <text>", "正文/描述（type: markdown_kramdown；语法见 references/content-syntax-kramdown.md）")
  .option("--profile-data-json <json>", "资料段 JSON（tool/channel）")
  .action(async (opts, cmd) => {
    const { apiKey, baseUrl, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      console.error("使用 c456 config set-key <token> 配置，或设置 C456_API_KEY 环境变量");
      process.exit(1);
    }

    try {
      const body = {
        kind: opts.kind,
        title: opts.title || "",
        body: opts.body || "",
      };

      if (opts.url) {
        body.url = opts.url;
      }

      if (opts.profileDataJson) {
        body.profile_data_json = opts.profileDataJson;
      }

      const result = await client.post("/intakes", body);

      console.log("✅ 收录创建成功");
      console.log(`   ID: ${result.data.id}`);
      console.log(`   类型：${result.data.kind}`);
      console.log(`   标题：${result.data.title || "(无)"}`);
      console.log("\n--- JSON ---");
      console.log(JSON.stringify(result.data, null, 2));
    } catch (err) {
      console.error(`❌ 创建失败：${err.message}`);
      const kind = String(opts.kind ?? "signal");
      const urlHint =
        Boolean(opts.url) &&
        kind === "signal" &&
        err instanceof ApiError &&
        err.status === 422;
      if (urlHint) {
        console.error("");
        console.error("提示：当前为 signal（默认）。`-u` 仅在 `-k tool` 或 `-k channel` 时会用于自动解析资料。");
        console.error("  示例：");
        console.error('    c456 -B <站点> intake new -k channel -u "<频道或主页 URL>"');
        console.error('    c456 -B <站点> intake new -k tool -u "<工具 / 仓库 URL>"');
      }
      process.exit(1);
    }
  });

// intake show
intake
  .command("show")
  .description("查看收录详情")
  .argument("<id>", "收录 ID")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const result = await client.get(`/intakes/${id}`);
      const data = result.data;

      console.log(`ID: ${data.id}`);
      console.log(`类型：${data.kind}`);
      console.log(`标题：${data.title || "(无)"}`);
      console.log(`正文：${data.body || "(无)"}`);
      if (data.profileData) {
        console.log(`资料段：${JSON.stringify(data.profileData, null, 2)}`);
      }
    } catch (err) {
      console.error(`❌ 查询失败：${err.message}`);
      process.exit(1);
    }
  });

// intake update
intake
  .command("update")
  .description("更新收录")
  .argument("<id>", "收录 ID")
  .option("-t, --title <title>", "新标题")
  .option("-b, --body <text>", "新正文（type: markdown_kramdown；语法见 references/content-syntax-kramdown.md）")
  .option("--favorited", "标记为收藏")
  .option("--unfavorited", "取消收藏")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    const body = {};

    if (opts.title) body.title = opts.title;
    if (opts.body) body.body = opts.body;
    if (opts.favorited) body.favorited = true;
    if (opts.unfavorited) body.favorited = false;

    try {
      await client.patch(`/intakes/${id}`, body);
      console.log("✅ 收录更新成功");
    } catch (err) {
      console.error(`❌ 更新失败：${err.message}`);
      process.exit(1);
    }
  });

// intake delete
intake
  .command("delete")
  .description("删除收录")
  .argument("<id>", "收录 ID")
  .option("-f, --force", "强制删除（无需确认）")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

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

    try {
      await client.delete(`/intakes/${id}`);
      console.log("✅ 收录已删除");
    } catch (err) {
      console.error(`❌ 删除失败：${err.message}`);
      process.exit(1);
    }
  });

// intake list
intake
  .command("list")
  .description("列出收录（分页）")
  .option("-k, --kind <type>", "类型过滤：signal/tool/channel")
  .option("-q, --query <text>", "搜索关键词")
  .option("-p, --page <num>", "页码（1-10000）", "1")
  .option("-n, --per-page <num>", "每页数量（1-100，默认 20）", "20")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const result = await client.get("/intakes", {
        kind: opts.kind,
        q: opts.query,
        page: opts.page,
        per_page: opts.perPage,
      });

      const { data, meta } = result;
      const perPage = metaPerPage(meta);
      const totalPages = Math.max(1, Math.ceil(meta.total / perPage));

      console.log(`共 ${meta.total} 条收录（第 ${meta.page}/${totalPages} 页）\n`);

      data.forEach((item) => {
        const kindBadge = { signal: "📡", tool: "🔧", channel: "📢" }[item.kind] || "•";
        console.log(`${kindBadge} [${item.id}] ${item.kind}`);
        console.log(`   ${item.title || item.listSummary || "(无标题)"}`);
      });
    } catch (err) {
      console.error(`❌ 查询失败：${err.message}`);
      process.exit(1);
    }
  });

export default intake;
