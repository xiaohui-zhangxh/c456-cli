import path from "node:path";
import { Command } from "commander";
import { runNpxSkillsAdd } from "../lib/runNpxSkills.js";

const REMOTE_SOURCES = [
  { source: "xiaohui-zhangxh/c456-cli", fullDepth: false },
  { source: "xiaohui-zhangxh/c456", fullDepth: true },
];

function buildSkillsOpts(opts) {
  const agent = String(opts.agent ?? "cursor").trim() || "cursor";
  return {
    cwd: path.resolve(String(opts.cwd || process.cwd())),
    global: Boolean(opts.global),
    agent,
    copy: Boolean(opts.copy),
  };
}

/**
 * 依次尝试 GitHub 源安装指定 skill（c456-llm-wiki / c456-cli 等）。
 * @param {string} skillId
 * @param {ReturnType<typeof buildSkillsOpts>} base
 */
async function installSkillFromRemotes(skillId, base) {
  let lastErr;
  for (const { source, fullDepth } of REMOTE_SOURCES) {
    try {
      console.error(`→ npx skills add ${source} --skill ${skillId} …`);
      await runNpxSkillsAdd(source, { ...base, fullDepth, skill: skillId });
      console.log(`✅ 已通过 npx skills 安装 ${skillId}（来源：${source}）`);
      return;
    } catch (e) {
      lastErr = e;
      console.error(`   失败：${e?.message || e}`);
    }
  }
  console.error(
    `错误：无法通过 npx skills 从 GitHub 安装 ${skillId}（已尝试 xiaohui-zhangxh/c456-cli 与 xiaohui-zhangxh/c456）。请检查网络、代理与仓库可访问性。`,
  );
  if (lastErr) {
    console.error(`最后错误：${lastErr.message || lastErr}`);
  }
  process.exit(1);
}

const skillCmd = new Command("skill")
  .name("skill")
  .description("安装 c456-cli 技能：封装官方 npx skills add（仅从网络拉取）");

skillCmd
  .command("install")
  .description(
    "npx skills add：默认只装 c456-cli（GitHub 源依次尝试）；加 --with-wiki 时先装 karpathy-wiki 与 c456-llm-wiki，再装 c456-cli",
  )
  .option(
    "-C, --cwd <path>",
    "执行 skills 的工作目录（默认当前目录；具体写入路径由 skills CLI 与各 Agent 约定）",
  )
  .option("-g, --global", "传给 skills add：安装到用户级技能目录", false)
  .option(
    "-a, --agent <names>",
    "传给 skills add --agent（如 cursor、claude-code 等），默认 cursor",
    "cursor",
  )
  .option("--copy", "传给 skills add：复制文件而非 symlink", false)
  .option(
    "--with-wiki",
    "私人知识库：先装 karpathy-wiki（baklib-tools/skills），再装 c456-llm-wiki 与 c456-cli（均经 npx 从网络拉取）",
    false,
  )
  .action(async (opts) => {
    const base = buildSkillsOpts(opts);

    if (opts.withWiki) {
      try {
        console.error("→ npx skills add baklib-tools/skills --skill karpathy-wiki …");
        await runNpxSkillsAdd("baklib-tools/skills", {
          ...base,
          skill: "karpathy-wiki",
          fullDepth: false,
        });
        console.log("✅ 已安装 karpathy-wiki（Karpathy Wiki 目录约定）");
      } catch (e) {
        console.error(`karpathy-wiki 安装失败：${e?.message || e}`);
        process.exit(1);
      }
      await installSkillFromRemotes("c456-llm-wiki", base);
    }

    await installSkillFromRemotes("c456-cli", base);
  });

export default skillCmd;
