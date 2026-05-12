import { Command } from "commander";
import { resolveApi } from "../context.js";
import { buildKindCommand } from "./_intake_kind_helpers.js";

const signalCmd = buildKindCommand("signal", "信号");

// 漏斗派生/生成：对应 POST /api/v1/intakes/:id/refinements
signalCmd
  .command("refine")
  .description("派生下一级（raw→cleaned / cleaned→curated / curated→playbook）")
  .argument("<id>", "信号 Intake ID")
  .requiredOption("--to <stage>", "目标阶段：cleaned/curated/playbook")
  .option("--ai", "使用 AI 起草（mode=ai）")
  .option("--manual", "手动派生（默认）")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }
    const mode = opts.ai ? "ai" : "";
    const result = await client.post(`/intakes/${id}/refinements`, { target_stage: opts.to, mode });
    console.log("✅ 已派生");
    console.log(`   子项 ID: ${result.data.id}`);
    console.log(`   stage: ${result.data.stage} / ${result.data.refinementStatus}`);
  });

// 重试起草：rejected -> ai_drafting（服务端会自动入队）
signalCmd
  .command("redraft")
  .description("对失败的 AI 起草重试（rejected→ai_drafting，并入队 Job）")
  .argument("<id>", "子信号 Intake ID（refinement_status=rejected）")
  .action(async (id, opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);
    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }
    await client.patch(`/intakes/${id}`, { refinement_status: "ai_drafting" });
    console.log("✅ 已提交重试起草");
  });

export default signalCmd;

