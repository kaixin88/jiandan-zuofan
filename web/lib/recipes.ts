import { createClient } from "./supabase/server";

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
  views: number;
  created_at: string;
}

const SORT_COLS: Record<string, string> = {
  total: "total",
  nutrition: "nutrition",
  price: "price",
  difficulty: "difficulty",
  time: "time",
};

export async function getRecipes(opts?: {
  sort?: string;
  tag?: string;
  author?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let q = supabase.from("recipes").select("*");

  if (opts?.tag) q = q.contains("tags", [opts.tag]);
  if (opts?.author) q = q.eq("author", opts.author);

  const col = SORT_COLS[opts?.sort ?? ""] ?? "total";
  q = q
    .order(col, { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  const limit = opts?.limit ?? 50;
  if (opts?.offset != null) {
    q = q.range(opts.offset, opts.offset + limit - 1);
  } else {
    q = q.limit(limit);
  }

  const { data, error } = await q;
  if (error) {
    console.error("getRecipes error:", error);
    return [];
  }
  return (data ?? []) as Recipe[];
}

export async function getRecipe(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Recipe;
}

export async function getAllTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("tags");
  if (error) return [];
  const set = new Set<string>();
  for (const r of data ?? []) {
    for (const t of r.tags ?? []) set.add(t);
  }
  return Array.from(set).sort();
}

export async function getAuthors(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("author");
  if (error) return [];
  const set = new Set<string>();
  for (const r of data ?? []) if (r.author) set.add(r.author);
  return Array.from(set).sort();
}
