import { Command } from "commander";
import { loadConfig, saveConfig, CONFIG_PATH } from "../client.js";

const configCmd = new Command()
  .name("config")
  .description("配置管理 - 设置 API Key 和系统地址");

// config set-key
configCmd
  .command("set-key")
  .description("设置 API Key")
  .argument("<token>", "API Key 令牌")
  .action((token, cmd) => {
    const config = loadConfig();
    config.apiKey = token;
    saveConfig(config);

    console.log("✅ API Key 已保存至 ~/.config/c456/config.json");
    console.log(`   提示：也可通过 C456_API_KEY 环境变量设置`);
  });

// config set-url
configCmd
  .command("set-url")
  .description("设置 C456 系统地址")
  .argument("<url>", "系统地址（如 https://c456.com）")
  .action((url, cmd) => {
    const config = loadConfig();
    config.baseUrl = url;
    saveConfig(config);

    console.log(`✅ 系统地址已设置为：${url}`);
    console.log(`   提示：也可通过 C456_URL 环境变量设置`);
  });

// config show
configCmd
  .command("show")
  .description("显示当前配置")
  .action(() => {
    const config = loadConfig();

    console.log("当前配置：");
    console.log(`  系统地址：${config.baseUrl || "https://c456.com"}`);
    console.log(`  API Key：${config.apiKey ? config.apiKey.slice(0, 8) + "..." : "(未设置)"}`);
    console.log(`\n配置文件：~/.config/c456/config.json`);
  });

// config reset
configCmd
  .command("reset")
  .description("重置配置（删除配置文件）")
  .option("-f, --force", "强制重置（无需确认）")
  .action(async (opts) => {
    const fs = await import("node:fs");

    if (!opts.force) {
      const readline = await import("node:readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question("确认删除配置文件？(y/N): ", (ans) => {
          rl.close();
          resolve(ans.toLowerCase());
        });
      });

      if (answer !== "y" && answer !== "yes") {
        console.log("已取消");
        return;
      }
    }

    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log("✅ 配置文件已删除");
    } else {
      console.log("配置文件不存在，无需删除");
    }
  });

export default configCmd;
