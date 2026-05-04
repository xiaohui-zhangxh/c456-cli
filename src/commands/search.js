import { Command } from "commander";
import { resolveApi } from "../context.js";

const searchCmd = new Command()
  .name("search")
  .description("搜索 - 查找可关联的收录或打法");

// search signals
searchCmd
  .command("signals")
  .description("搜索收录（用于信号关联）")
  .option("-q, --query <text>", "搜索关键词", "")
  .option("-k, --kind <type>", "类型过滤：signal/tool/channel")
  .option("-l, --limit <num>", "结果数量限制", "20")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const result = await client.get("/search/intakes", {
        q: opts.query,
        kind: opts.kind,
        limit: opts.limit,
      });

      const data = result.data;

      if (data.length === 0) {
        console.log("未找到匹配的收录");
        return;
      }

      console.log(`找到 ${data.length} 条结果：\n`);

      data.forEach((item) => {
        const kindBadge = { signal: "📡", tool: "🔧", channel: "📢" }[item.kind] || "•";
        const sourceKey = item.source_key ? ` [${item.source_key}]` : "";
        console.log(`${kindBadge} #${item.id}${sourceKey} ${item.title || "(无标题)"}`);
        if (item.list_summary) {
          console.log(`   ${item.list_summary}`);
        }
      });

      console.log("\n--- JSON ---");
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`❌ 搜索失败：${err.message}`);
      process.exit(1);
    }
  });

// search playbooks
searchCmd
  .command("playbooks")
  .description("搜索打法（用于信号关联）")
  .option("-q, --query <text>", "搜索关键词", "")
  .option("-l, --limit <num>", "结果数量限制", "20")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const result = await client.get("/search/playbooks", {
        q: opts.query,
        limit: opts.limit,
      });

      const data = result.data;

      if (data.length === 0) {
        console.log("未找到匹配的打法");
        return;
      }

      console.log(`找到 ${data.length} 条结果：\n`);

      data.forEach((item) => {
        console.log(`📘 #${item.id} ${item.title || "(无标题)"}`);
        if (item.list_summary) {
          console.log(`   ${item.list_summary}`);
        }
      });

      console.log("\n--- JSON ---");
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`❌ 搜索失败：${err.message}`);
      process.exit(1);
    }
  });

export default searchCmd;
