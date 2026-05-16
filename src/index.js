#!/usr/bin/env node
// c456-cli: 内容录入与整理工具
// 通过 HTTP API 与 C456 系统交互

import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import intakeCmd from "./commands/intake.js";
import signalCmd from "./commands/signal.js";
import toolCmd from "./commands/tool.js";
import channelCmd from "./commands/channel.js";
import fetchProfile from "./commands/fetch.js";
import searchCmd from "./commands/search.js";
import playbookCmd from "./commands/playbook.js";
import walkthroughCmd from "./commands/walkthrough.js";
import assetCmd from "./commands/asset.js";
import browserCmd from "./commands/browser.js";
import screenshotCmd from "./commands/screenshot.js";
import configCmd from "./commands/config.js";
import skillCmd from "./commands/skills.js";
import { getHelpBanner } from "./banner.js";
import { runCliStartupHooks } from "./startup.js";

const program = new Command();

program
  .name("c456")
  .description("C456 CLI - 快速内容录入与整理工具")
  .version(pkg.version);

program.addHelpText("before", () => {
  const banner = getHelpBanner();
  const versionLine = `c456-cli ${pkg.version}`;
  if (!banner) {
    return `\n${versionLine}\n`;
  }
  return `${banner}\n${versionLine}\n`;
});

// Commander 在「有子命令但未给出子命令」时以 help({ error: true }) 展示帮助并 exit 1；
// 无参裸调 c456 视为成功（exit 0），同时保留其它错误的退出码。
program.exitOverride((err) => {
  if (err.code === "commander.executeSubCommandAsync") {
    process.exit(err.exitCode ?? 1);
    return;
  }
  if (err.code === "commander.help" && err.exitCode === 1) {
    process.exit(0);
    return;
  }
  process.exit(err.exitCode ?? 1);
});

// 全局选项（子命令仍可用 -u 表示「目标 URL」等，故根级用 -B / --base-url 表示站点根地址）
program.option(
  "-B, --base-url <url>",
  "C456 站点根地址；未传则使用 C456_URL，其次合并读取 ~/.config/c456 与自 cwd 向上找到的 .c456-cli/config.json，默认 https://c456.com"
);

// 子命令
program.addCommand(signalCmd);
program.addCommand(toolCmd);
program.addCommand(channelCmd);
program.addCommand(fetchProfile);
program.addCommand(searchCmd);
program.addCommand(playbookCmd);
program.addCommand(walkthroughCmd);
program.addCommand(assetCmd);
program.addCommand(browserCmd);
program.addCommand(screenshotCmd);
program.addCommand(intakeCmd); // AI 入口：自动识别类型并路由（与 5 大类并存）
program.addCommand(configCmd);
program.addCommand(skillCmd);

// 帮助信息增强
program.on("--help", () => {
  console.log("\n示例:");
  console.log("  # 配置 API Key");
  console.log("  c456 config set-key your-api-token");
  console.log("");
  console.log("  # 自托管站点 + 按 URL 收录工具（-B=站点，-u=目标 URL）");
  console.log('  c456 -B https://c456.example.com tool new -u "https://github.com/owner/repo" --auto-resolve-url');
  console.log("");
  console.log("  # 搜索收录");
  console.log('  c456 search signals -q "AI agent"');
  console.log("");
  console.log("  # 安装 Agent 技能（交互 / 传 id / --with-wiki）");
  console.log("  c456 skill install");
  console.log("  c456 skill install c456-signal-researcher c456-sync-public-markdown");
  console.log("  c456 skill install --with-wiki");
  console.log("");
  console.log("环境变量:");
  console.log("  C456_URL        - 站点根地址（与 -B / --base-url 一致）");
  console.log("  C456_API_KEY    - API Key");
  console.log("  C456_WORKSPACE  - 工作区根目录（绝对路径），其下 .c456-cli/config.json 覆盖全局配置");
  console.log("  C456_SKIP_VERSION_CHECK=1 - 跳过每日 npm 版本检查与更新提示");
});

runCliStartupHooks({ currentVersion: pkg.version });
program.parse();
