import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KARPATHY_SKILL_ID = "karpathy-wiki";
const MANDATORY_SKILL_ID = "c456-cli";

/**
 * npm 包根（含 `skills/`、`package.json`）。打包后本文件并入 `dist/index.js`，`import.meta.url` 指向该入口。
 */
export function getCliPackageRoot() {
  const entry = fileURLToPath(import.meta.url);
  const dir = path.dirname(entry);
  const base = path.basename(dir);
  if (base === "dist") {
    return path.join(dir, "..");
  }
  // 开发时自源码加载（未打包）
  if (base === "lib") {
    return path.join(dir, "..", "..");
  }
  return path.join(dir, "..", "..");
}

/**
 * @param {string} skillsDir
 * @returns {{ id: string, title: string }[]}
 */
export function discoverBundledSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) {
    return [];
  }
  /** @type {{ id: string, title: string }[]} */
  const out = [];
  for (const ent of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const id = ent.name;
    if (id === MANDATORY_SKILL_ID) continue;
    if (!id.startsWith("c456-")) continue;
    const md = path.join(skillsDir, id, "SKILL.md");
    if (!fs.existsSync(md)) continue;
    out.push({ id, title: readSkillTitle(md) });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

/**
 * @param {string} skillMdPath
 */
function readSkillTitle(skillMdPath) {
  try {
    const raw = fs.readFileSync(skillMdPath, "utf8");
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) return "";
    const block = fm[1];
    const desc = extractYamlDescription(block);
    if (desc) {
      const one = desc
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s+/, "").trimEnd())
        .filter(Boolean)[0];
      if (one) return one.length > 88 ? `${one.slice(0, 85)}…` : one;
    }
    const nameLine = block.match(/^name:\s*(.+)$/m);
    return nameLine ? String(nameLine[1]).trim() : "";
  } catch {
    return "";
  }
}

/**
 * 解析常见 `description: >-` 块或单行 `description:`（仅用于菜单副标题）。
 * @param {string} block YAML frontmatter body（不含 ---）
 */
function extractYamlDescription(block) {
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("description:")) continue;
    const inline = line.slice("description:".length).trim();
    if (inline && inline !== ">-" && inline !== ">" && inline !== "|") {
      return inline.replace(/^["']|["']$/g, "");
    }
    const parts = [];
    for (let j = i + 1; j < lines.length; j++) {
      const L = lines[j];
      if (/^[A-Za-z0-9_-]+:/.test(L)) break;
      if (L.startsWith("  ")) {
        parts.push(L.slice(2));
      } else if (L.trim() === "") {
        parts.push("");
      } else {
        break;
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

export { KARPATHY_SKILL_ID, MANDATORY_SKILL_ID };

/**
 * @param {Set<string>|string[]} selected
 * @returns {string[]}
 */
export function orderedRemoteSkillIds(selected) {
  const set = new Set(Array.isArray(selected) ? selected : [...selected]);
  const out = [];
  if (set.has(KARPATHY_SKILL_ID)) {
    out.push(KARPATHY_SKILL_ID);
  }
  const mid = [...set]
    .filter((id) => id !== KARPATHY_SKILL_ID && id !== MANDATORY_SKILL_ID)
    .sort((a, b) => {
      if (a === "c456-llm-wiki" && b !== "c456-llm-wiki") return -1;
      if (b === "c456-llm-wiki" && a !== "c456-llm-wiki") return 1;
      return a.localeCompare(b);
    });
  out.push(...mid);
  if (set.has(MANDATORY_SKILL_ID)) {
    out.push(MANDATORY_SKILL_ID);
  }
  return out;
}

/**
 * @param {string[]} requested
 * @param {string[]} validBundledIds  skills 目录下可选的 c456-*（不含 c456-cli）
 */
export function validateSkillIds(requested, validBundledIds) {
  const bundledSet = new Set(validBundledIds);
  const allowed = new Set([KARPATHY_SKILL_ID, MANDATORY_SKILL_ID, ...bundledSet]);
  const bad = requested.filter((id) => !allowed.has(id));
  return { ok: bad.length === 0, bad, allowed };
}
