import { Command } from "commander";
import { metaPerPage } from "../client.js";
import { resolveApi } from "../context.js";
import { readTextFile } from "../textFile.js";

const playbookCmd = new Command()
  .name("playbook")
  .description("打法管理 - 创建、更新、删除打法");

// playbook new
playbookCmd
  .command("new")
  .description("创建新打法")
  .requiredOption("-t, --title <title>", "打法标题")
  .option("-b, --body <text>", "打法正文（不推荐直接传；请用 --body-file）")
  .option("--body-file <path>", "打法正文文件路径（type: markdown_kramdown；建议写到当前目录 .tmp/）")
  .option("--ref-intake <id>", "引用收录 ID（可多次指定）")
  .option("--ref-playbook <id>", "引用打法 ID（可多次指定）")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    const referenceTargets = [];

    if (opts.refIntake) {
      const intakeIds = Array.isArray(opts.refIntake) ? opts.refIntake : [opts.refIntake];
      intakeIds.forEach((id) => {
        referenceTargets.push({ type: "intake", id: parseInt(id, 10) });
      });
    }

    if (opts.refPlaybook) {
      const playbookIds = Array.isArray(opts.refPlaybook) ? opts.refPlaybook : [opts.refPlaybook];
      playbookIds.forEach((id) => {
        referenceTargets.push({ type: "playbook", id: parseInt(id, 10) });
      });
    }

    try {
      if (opts.body && opts.bodyFile) {
        console.error("错误：--body 与 --body-file 不能同时使用");
        process.exit(1);
      }
      const bodyText = opts.bodyFile ? readTextFile(opts.bodyFile) : (opts.body || "");
      const body = {
        title: opts.title,
        body: bodyText,
      };

      if (referenceTargets.length > 0) {
        body.reference_targets = referenceTargets;
      }

      const result = await client.post("/playbooks", body);

      console.log("✅ 打法创建成功");
      console.log(`   ID: ${result.data.id}`);
      console.log(`   标题：${result.data.title}`);
    } catch (err) {
      console.error(`❌ 创建失败：${err.message}`);
      process.exit(1);
    }
  });

// playbook show
playbookCmd
  .command("show")
  .description("查看打法详情")
  .argument("<id>", "打法 ID")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const result = await client.get(`/playbooks/${id}`);
      const data = result.data;

      console.log(`ID: ${data.id}`);
      console.log(`标题：${data.title}`);
      console.log(`正文：\n${data.body || "(无)"}`);

      if (data.referenceTargets && data.referenceTargets.length > 0) {
        console.log("\n引用目标：");
        data.referenceTargets.forEach((ref) => {
          console.log(`  - ${ref.targetType} #${ref.targetId}: ${ref.title}`);
        });
      }

      if (data.workflow && (data.workflow.nodes?.length || 0) > 0) {
        console.log("\n工作流：");
        data.workflow.nodes.forEach((node, i) => {
          console.log(`  ${i + 1}. ${node.title || "(无标题)"}`);
        });
      }
    } catch (err) {
      console.error(`❌ 查询失败：${err.message}`);
      process.exit(1);
    }
  });

// playbook update
playbookCmd
  .command("update")
  .description("更新打法")
  .argument("<id>", "打法 ID")
  .option("-t, --title <title>", "新标题")
  .option("-b, --body <text>", "新正文（不推荐直接传；请用 --body-file）")
  .option("--body-file <path>", "新正文文件路径（type: markdown_kramdown；建议写到当前目录 .tmp/）")
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

    try {
      await client.patch(`/playbooks/${id}`, body);
      console.log("✅ 打法更新成功");
    } catch (err) {
      console.error(`❌ 更新失败：${err.message}`);
      process.exit(1);
    }
  });

// playbook delete
playbookCmd
  .command("delete")
  .description("删除打法")
  .argument("<id>", "打法 ID")
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
      await client.delete(`/playbooks/${id}`);
      console.log("✅ 打法已删除");
    } catch (err) {
      console.error(`❌ 删除失败：${err.message}`);
      process.exit(1);
    }
  });

// playbook list
playbookCmd
  .command("list")
  .description("列出打法（分页）")
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
      const result = await client.get("/playbooks", {
        q: opts.query,
        page: opts.page,
        per_page: opts.perPage,
      });

      const { data, meta } = result;
      const perPage = metaPerPage(meta);
      const totalPages = Math.max(1, Math.ceil(meta.total / perPage));

      console.log(`共 ${meta.total} 条打法（第 ${meta.page}/${totalPages} 页）\n`);

      data.forEach((item) => {
        console.log(`📘 [${item.id}] ${item.title}`);
        if (item.listSummary) {
          console.log(`   ${item.listSummary}`);
        }
      });
    } catch (err) {
      console.error(`❌ 查询失败：${err.message}`);
      process.exit(1);
    }
  });

export default playbookCmd;
