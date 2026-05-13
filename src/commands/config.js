import fs from "node:fs";
import { Command } from "commander";
import {
  saveConfigPatch,
  loadMergedConfigSources,
  getGlobalConfigPath,
  resolveLocalConfigWritePath,
} from "../client.js";

const GLOBAL_OPT = "-g, --global";
const GLOBAL_DESC = "读写用户全局配置（XDG ~/.config/c456），不写入当前项目的 .c456-cli";

const configCmd = new Command()
  .name("config")
  .description("配置管理 - 设置 API Key 和系统地址（默认写入项目 .c456-cli；加 -g 写入全局）");

// config set-key
configCmd
  .command("set-key")
  .description("设置 API Key")
  .argument("<token>", "API Key 令牌")
  .option(GLOBAL_OPT, GLOBAL_DESC)
  .action(async (token, opts) => {
    const global = opts.global === true;
    await saveConfigPatch({ apiKey: token }, { global });
    const target = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();
    console.log(`✅ API Key 已保存至 ${target}`);
    console.log(`   提示：也可通过 C456_API_KEY 环境变量设置`);
  });

// config set-url
configCmd
  .command("set-url")
  .description("设置 C456 系统地址")
  .argument("<url>", "系统地址（如 https://c456.com）")
  .option(GLOBAL_OPT, GLOBAL_DESC)
  .action(async (url, opts) => {
    const global = opts.global === true;
    await saveConfigPatch({ baseUrl: url }, { global });
    const target = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();
    console.log(`✅ 系统地址已设置为：${url}`);
    console.log(`   已写入：${target}`);
    console.log(`   提示：也可通过 C456_URL 环境变量设置`);
  });

// config show
configCmd
  .command("show")
  .description("显示当前有效配置及配置文件路径")
  .option(GLOBAL_OPT, "仅查看全局配置文件中的内容（不合并项目覆盖）")
  .action((opts) => {
    const globalOnly = opts.global === true;
    if (globalOnly) {
      const p = getGlobalConfigPath();
      let raw = {};
      try {
        raw = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
      } catch {
        raw = {};
      }
      console.log("全局配置文件内容：");
      console.log(`  系统地址：${raw.baseUrl || "(未设置，合并后默认 https://c456.com)"}`);
      console.log(`  API Key：${raw.apiKey ? String(raw.apiKey).slice(0, 8) + "..." : "(未设置)"}`);
      console.log(`\n文件：${p}`);
      return;
    }

    const { merged, globalPath, localPath, workspaceRoot } = loadMergedConfigSources();
    console.log("当前有效配置（项目覆盖全局，环境变量优先于文件）：");
    console.log(`  系统地址：${merged.baseUrl || "https://c456.com"}`);
    console.log(`  API Key：${merged.apiKey ? String(merged.apiKey).slice(0, 8) + "..." : "(未设置)"}`);

    console.log(`\n全局配置：${globalPath}`);
    if (workspaceRoot) {
      console.log(`工作区根：${workspaceRoot}`);
      console.log(
        `项目配置：${localPath}${localPath && fs.existsSync(localPath) ? "" : "（尚未创建，有效值来自全局）"}`,
      );
    } else {
      console.log(
        `项目配置：未检测到自 cwd 向上的 .c456-cli；无 C456_WORKSPACE 时，默认可写入路径为 ${resolveLocalConfigWritePath()}`,
      );
    }
  });

// config reset
configCmd
  .command("reset")
  .description("重置配置（删除对应范围内的配置文件）")
  .option(GLOBAL_OPT, GLOBAL_DESC)
  .option("-f, --force", "强制重置（无需确认）")
  .action(async (opts) => {
    const fs = await import("node:fs");
    const global = opts.global === true;
    const targetPath = global ? getGlobalConfigPath() : resolveLocalConfigWritePath();

    if (!opts.force) {
      const readline = await import("node:readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question(`确认删除配置文件？\n  ${targetPath}\n(y/N): `, (ans) => {
          rl.close();
          resolve(ans.toLowerCase());
        });
      });

      if (answer !== "y" && answer !== "yes") {
        console.log("已取消");
        return;
      }
    }

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`✅ 已删除：${targetPath}`);
    } else {
      console.log("配置文件不存在，无需删除");
    }
  });

export default configCmd;
