import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 登录/个人页无收录价值；/app/data 是给 APP 同步用的分片 JSON
        disallow: ["/login/", "/account/", "/favorites/", "/stats/", "/app/data/", "/data/"],
      },
    ],
    sitemap: "https://modianyu.top/sitemap.xml",
    host: "https://modianyu.top",
  };
}
