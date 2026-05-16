import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { checkbox } from "@inquirer/prompts";
import { Command } from "commander";
import { runNpxSkillsAdd } from "../lib/runNpxSkills.js";
import {
  discoverBundledSkills,
  getCliPackageRoot,
  KARPATHY_SKILL_ID,
  MANDATORY_SKILL_ID,
  orderedRemoteSkillIds,
  validateSkillIds,
} from "../lib/skillCatalog.js";

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
 * @param {unknown} skillIds
 * @returns {string[]}
 */
function normalizeCliSkillArgs(skillIds) {
  if (skillIds == null) return [];
  if (Array.isArray(skillIds)) {
    return skillIds.map((s) => String(s).trim()).filter(Boolean);
  }
  const one = String(skillIds).trim();
  return one ? [one] : [];
}

/**
 * 依次尝试 GitHub 源安装指定 skill（c456-llm-wiki / c456-cli 等，不含 karpathy-wiki）。
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

/**
 * @param {ReturnType<typeof buildSkillsOpts>} base
 */
async function installKarpathyWiki(base) {
  console.error(`→ npx skills add baklib-tools/skills --skill ${KARPATHY_SKILL_ID} …`);
  await runNpxSkillsAdd("baklib-tools/skills", {
    ...base,
    skill: KARPATHY_SKILL_ID,
    fullDepth: false,
  });
  console.log(`✅ 已安装 ${KARPATHY_SKILL_ID}（Karpathy Wiki 目录约定，来源：baklib-tools/skills）`);
}

/**
 * @param {string} skillId
 * @param {ReturnType<typeof buildSkillsOpts>} base
 */
async function installOne(skillId, base) {
  if (skillId === KARPATHY_SKILL_ID) {
    await installKarpathyWiki(base);
    return;
  }
  await installSkillFromRemotes(skillId, base);
}

/**
 * @param {Set<string>} idSet
 * @param {ReturnType<typeof buildSkillsOpts>} base
 */
async function installSkillSet(idSet, base) {
  const order = orderedRemoteSkillIds(idSet);
  for (const id of order) {
    await installOne(id, base);
  }
}

/**
 * @param {{ id: string, title: string }[]} bundled
 * @returns {Promise<Set<string>>}
 */
async function promptInteractiveSelection(bundled) {
  if (!input.isTTY || !output.isTTY) {
    console.error(
      "提示：非交互终端未展示菜单，仅安装 c456-cli。请显式指定：c456 skill install <技能id> …",
    );
    return new Set([MANDATORY_SKILL_ID]);
  }

  const CANCEL_VALUE = "__cancel__";
  const choices = [
    {
      name: "c456-cli（必选）",
      value: MANDATORY_SKILL_ID,
      checked: true,
      description: "终端与 HTTP API 说明",
    },
    {
      name: "karpathy-wiki（可选）",
      value: KARPATHY_SKILL_ID,
      description: "LLM Wiki 目录约定（baklib-tools/skills）",
    },
    ...bundled.map((b) => ({
      name: b.id,
      value: b.id,
      description: b.title || undefined,
    })),
    {
      name: "取消安装",
      value: CANCEL_VALUE,
    },
  ];

  try {
    const picked = await checkbox({
      message: "选择要安装的技能",
      pageSize: 14,
      loop: true,
      required: false,
      validate: (selection) => {
        const ids = new Set(selection.map((c) => c.value));
        if (ids.has(CANCEL_VALUE)) return true;
        if (!ids.has(MANDATORY_SKILL_ID)) {
          return "请勾选 c456-cli，或勾选「取消安装」";
        }
        return true;
      },
      instructions: "↑↓ 移动，空格 勾选，回车 确认",
      shortcuts: { all: null, invert: null },
      choices,
    });
    if (picked.includes(CANCEL_VALUE)) {
      console.error("\n已取消安装。");
      process.exit(0);
    }
    return new Set([MANDATORY_SKILL_ID, ...picked]);
  } catch (e) {
    const n = e && typeof e === "object" && "name" in e ? e.name : "";
    if (n === "CancelPromptError" || n === "AbortPromptError") {
      console.error("\n已取消安装。");
      process.exit(130);
    }
    throw e;
  }
}

const skillCmd = new Command("skill")
  .name("skill")
  .description("安装 Agent 技能（npx skills add）");

skillCmd
  .command("install")
  .description("TTY 多选；传技能 id 免交互；--with-wiki 装知识库三件套")
  .argument("[skillIds...]", "技能 id，可多个；与 c456-cli 一并安装")
  .option("-C, --cwd <path>", "skills add 的工作目录（默认当前目录）")
  .option("-g, --global", "用户级技能目录", false)
  .option("-a, --agent <names>", "目标 Agent，默认 cursor", "cursor")
  .option("--copy", "复制文件而非 symlink", false)
  .option(
    "--with-wiki",
    "karpathy-wiki + c456-llm-wiki + c456-cli，不经菜单",
    false,
  )
  .action(async (skillIds, opts) => {
    const base = buildSkillsOpts(opts);
    const pkgRoot = getCliPackageRoot();
    const skillsDir = path.join(pkgRoot, "skills");
    const bundled = discoverBundledSkills(skillsDir);
    const bundledIds = bundled.map((b) => b.id);

    if (opts.withWiki) {
      await installSkillSet(
        new Set([KARPATHY_SKILL_ID, "c456-llm-wiki", MANDATORY_SKILL_ID]),
        base,
      );
      return;
    }

    const fromCli = normalizeCliSkillArgs(skillIds);
    let toInstall;

    if (fromCli.length > 0) {
      const expanded = new Set(fromCli);
      expanded.add(MANDATORY_SKILL_ID);
      const { ok, bad } = validateSkillIds([...expanded], bundledIds);
      if (!ok) {
        const valid = [KARPATHY_SKILL_ID, MANDATORY_SKILL_ID, ...bundledIds].sort();
        console.error(
          `错误：未知技能 id：${bad.join(", ")}。允许值：\n  ${valid.join("\n  ")}`,
        );
        process.exit(1);
      }
      toInstall = expanded;
    } else {
      toInstall = await promptInteractiveSelection(bundled);
    }

    await installSkillSet(toInstall, base);
  });

export default skillCmd;
