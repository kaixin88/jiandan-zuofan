import type { MetadataRoute } from "next";
import { getAllRecipes } from "@/lib/recipes-local";

// Next 16 + output:"export" 要求元数据路由显式声明静态，否则构建期报 force-static 错误
export const dynamic = "force-static";

const BASE = "https://modianyu.top";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily" as const, priority: 1 },
    { url: `${BASE}/download/`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${BASE}/submit/`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.3 },
  ];
  const recipes = getAllRecipes().map((r) => ({
    url: `${BASE}/recipe/${r.id}/`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...staticPages, ...recipes];
}
