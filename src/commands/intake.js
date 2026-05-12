import { Command } from "commander";
import { metaPerPage } from "../client.js";
import { resolveApi } from "../context.js";
import { readTextFile } from "../textFile.js";

const intake = new Command()
  .name("intake")
  .description("AI 录入入口 - 自动识别类型并创建（signal/tool/channel/playbook；walkthrough 需走 walkthrough 命令）");

// intake new
intake
  .command("new")
  .description("AI 自动识别并创建（旧的 kind 手动创建请改用 signal/tool/channel 子命令）")
  .option("-u, --url <url>", "可选：目标 URL（有时有助于 AI 判断）")
  .option("--hint <type>", "可选：提示类型 signal/tool/channel/playbook（不会强制）")
  .option("-t, --title <title>", "可选：标题（AI 可能会重写）")
  .option("-b, --body <text>", "正文/描述（不推荐直接传；请用 --body-file）")
  .option("--body-file <path>", "正文文件路径（type: markdown_kramdown；建议写到当前目录 .tmp/）")
  .option("--dry-run", "只做识别与草稿生成，不落库（若服务端支持）")
  .action(async (opts, cmd) => {
    const { apiKey, baseUrl, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      console.error("使用 c456 config set-key <token> 配置，或设置 C456_API_KEY 环境变量");
      process.exit(1);
    }

    try {
      if (opts.body && opts.bodyFile) {
        console.error("错误：--body 与 --body-file 不能同时使用");
        process.exit(1);
      }
      const bodyText = opts.bodyFile ? readTextFile(opts.bodyFile) : (opts.body || "");
      const payload = {
        title: opts.title || "",
        body: bodyText,
        url: opts.url || "",
        hint: opts.hint || "",
        dry_run: Boolean(opts.dryRun),
      };

      const result = await client.post("/intakes/ai", payload);

      console.log("✅ AI 识别成功");
      if (result.data.kind) console.log(`   识别类型：${result.data.kind}`);
      if (result.data.id) console.log(`   ID: ${result.data.id}`);
      if (result.data.title) console.log(`   标题：${result.data.title}`);
      console.log("\n--- JSON ---");
      console.log(JSON.stringify(result.data, null, 2));
    } catch (err) {
      console.error(`❌ 创建失败：${err.message}`);
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
  .option("-b, --body <text>", "新正文（不推荐直接传；请用 --body-file）")
  .option("--body-file <path>", "新正文文件路径（type: markdown_kramdown；建议写到当前目录 .tmp/）")
  .option("--profile-data-json <json>", "tool/channel：profile_data 片段（JSON 字符串，与 API 合并规则一致）")
  .option("--profile-data-json-file <path>", "从文件读取 profile_data 片段 JSON（与 --profile-data-json 互斥）")
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
    if (opts.body && opts.bodyFile) {
      console.error("错误：--body 与 --body-file 不能同时使用");
      process.exit(1);
    }
    if (opts.bodyFile) body.body = readTextFile(opts.bodyFile);
    if (opts.body) body.body = opts.body;
    if (opts.profileDataJson && opts.profileDataJsonFile) {
      console.error("错误：--profile-data-json 与 --profile-data-json-file 不能同时使用");
      process.exit(1);
    }
    if (opts.profileDataJsonFile) {
      try {
        body.profile_data = JSON.parse(readTextFile(opts.profileDataJsonFile));
      } catch (e) {
        console.error(`错误：无法解析 profile_data JSON（${e.message}）`);
        process.exit(1);
      }
    } else if (opts.profileDataJson) {
      try {
        body.profile_data = JSON.parse(opts.profileDataJson);
      } catch (e) {
        console.error(`错误：无法解析 --profile-data-json（${e.message}）`);
        process.exit(1);
      }
    }
    if (opts.favorited) body.favorited = true;
    if (opts.unfavorited) body.favorited = false;

    if (Object.keys(body).length === 0) {
      console.error(
        "错误：请至少提供 --title、--body/--body-file、--profile-data-json/--profile-data-json-file 或 --favorited/--unfavorited",
      );
      process.exit(1);
    }

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
