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
  .requiredOption(
    "-p, --profile-id <type>",
    [
      "资料类型（必填）：",
      "- link_product：普通产品/官网链接（解析名称、图标、简介等）",
      "- package_registry：软件包地址（npm/RubyGems 等）",
      "- github_origin：开源仓库地址（GitHub/GitLab/Gitee）",
      "- social_account：社交账号主页/频道（YouTube/抖音/小红书等）",
    ].join("\n")
  )
  .action(async (opts, cmd) => {
    const { apiKey, client } = resolveApi(cmd);

    if (!apiKey) {
      console.error("错误：未配置 API Key");
      process.exit(1);
    }

    try {
      const body = { url: opts.url, profile_id: opts.profileId };

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

export default fetchProfile;
