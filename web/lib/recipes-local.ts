import fs from "fs";
import path from "path";

export interface Recipe {
  id: number;
  slug: string | null;
  title: string;
  subtitle: string | null;
  author: string | null;
  excerpt: string | null;
  content: string;
  video_url: string | null;
  cover_image: string | null;
  nutrition: number | null;
  price: number | null;
  difficulty: number | null;
  time: number | null;
  total: number | null;
  minutes: number | null;
  tags: string[];
}

type RawRecipe = Omit<Recipe, "id">;

let cache: Recipe[] | null = null;
let coverCache: Set<number> | null = null;

/** 构建期读取已生成的成品图清单（静态资源，无运行时请求） */
export function getDishCoverIds(): Set<number> {
  if (coverCache) return coverCache;
  const file = path.join(process.cwd(), "data", "dish_covers.json");
  if (!fs.existsSync(file)) return (coverCache = new Set());
  try {
    const ids: number[] = JSON.parse(fs.readFileSync(file, "utf-8"));
    coverCache = new Set(ids);
  } catch {
    coverCache = new Set();
  }
  return coverCache;
}

export function getAllRecipes(): Recipe[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "recipes.json");
  const raw: RawRecipe[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  cache = raw.map((r, i) => ({ ...r, id: i + 1 }));
  return cache;
}

export function getRecipeById(id: number): Recipe | undefined {
  return getAllRecipes().find((r) => r.id === id);
}

export function getRecipeIds(): number[] {
  return getAllRecipes().map((r) => r.id);
}

export function getAllTags(): string[] {
  const set = new Set<string>();
  for (const r of getAllRecipes()) {
    for (const t of r.tags ?? []) set.add(t);
  }
  return Array.from(set).sort();
}
