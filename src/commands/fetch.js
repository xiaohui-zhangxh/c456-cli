import { Command } from "commander";
import { resolveApi } from "../context.js";

const fetchProfile = new Command()
  .name("fetch")
  .description("资料抓取 - 从 URL 自动解析平台资料");

// fetch profile
fetchProfile
  .command("profile")
  .description("抓取指定 URL 的资料段数据")
  .requiredOption("-u, --url <url>", "目标 URL")
  .option("-p, --profile-id <type>", "资料类型：link_product/package_registry/github_origin/social_account")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const body = { url: opts.url };
      if (opts.profileId) {
        body.profile_id = opts.profileId;
      }

      const result = await client.post("/fetches", body);
      const { data, suggested_title } = result.data;

      console.log("✅ 资料抓取成功");
      if (suggested_title) {
        console.log(`建议标题：${suggested_title}`);
      }
      console.log("\n资料数据：");
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`❌ 抓取失败：${err.message}`);
      process.exit(1);
    }
  });

// fetch detect
fetchProfile
  .command("detect")
  .description("自动检测 URL 类型并抓取资料并创建 tool 收录")
  .requiredOption("-u, --url <url>", "目标 URL")
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const result = await client.post("/intakes", {
        kind: "tool",
        url: opts.url,
      });

      console.log("✅ 自动检测并收录成功");
      console.log(`ID: ${result.data.id}`);
      console.log(`类型：${result.data.kind}`);
      if (result.data.profileData) {
        console.log("\n解析的资料段：");
        console.log(JSON.stringify(result.data.profileData, null, 2));
      }
    } catch (err) {
      console.error(`❌ 检测失败：${err.message}`);
      process.exit(1);
    }
  });

export default fetchProfile;
