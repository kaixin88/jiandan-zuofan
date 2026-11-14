import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllRecipes, getRecipeById, getDishCoverIds } from "@/lib/recipes-local";
import { dishLarge } from "@/lib/assets";
import ScoreLine from "@/components/ScoreLine";
import Markdown from "@/components/Markdown";
import VideoEmbed from "@/components/VideoEmbed";
import RecipeInteractions from "@/components/RecipeInteractions";

const BASE = "https://modianyu.top";

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ id: String(r.id) }));
}

function stripMd(s: string) {
  return s.replace(/\*\*/g, "").replace(/[`*_]/g, "").trim();
}

/** 从 Markdown 的「## 食材」表格里抽「用料 用量」，供 Recipe 结构化数据使用 */
function ingredientsOf(content: string): string[] {
  const m = content.match(/##\s*食材([\s\S]*?)(?=\n##\s|$)/);
  if (!m) return [];
  const out: string[] = [];
  for (const line of m[1].split("\n")) {
    const cells = line.split("|").map((x) => x.trim()).filter(Boolean);
    if (cells.length < 3 || /^[-:]+$/.test(cells[0]) || cells[1] === "用料") continue;
    out.push(stripMd(`${cells[1]} ${cells[2]}`));
  }
  return out.slice(0, 40);
}

/** 从「## 步骤」有序列表里抽步骤文本 */
function instructionsOf(content: string): string[] {
  const m = content.match(/##\s*步骤([\s\S]*?)(?=\n##\s|$)/);
  if (!m) return [];
  const out: string[] = [];
  for (const line of m[1].split("\n")) {
    const s = line.match(/^\s*\d+[.、)]\s*(.+)$/);
    if (s && stripMd(s[1])) out.push(stripMd(s[1]));
  }
  return out.slice(0, 40);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = getRecipeById(Number(id));
  if (!r) return { title: "菜谱不存在" };
  const title = r.title + (r.subtitle ? `（${r.subtitle}）` : "");
  const desc = (r.excerpt || `${r.title}的详细做法、食材用量与烹饪步骤`).slice(0, 155);
  const url = `/recipe/${r.id}/`;
  const images = getDishCoverIds().has(r.id) ? [dishLarge(r.id)] : [];
  return {
    title,
    description: desc,
    keywords: [r.title, r.author ?? "", ...(r.tags ?? [])].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${title} · 简单做饭`,
      description: desc,
      url,
      images,
    },
    twitter: { card: "summary_large_image", title, description: desc, images },
  };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = getRecipeById(Number(id));
  if (!recipe) notFound();
  const hasImg = getDishCoverIds().has(recipe.id);
  const url = `${BASE}/recipe/${recipe.id}/`;
  const title = recipe.title + (recipe.subtitle ? `（${recipe.subtitle}）` : "");
  const desc = (recipe.excerpt || `${recipe.title}的详细做法、食材用量与烹饪步骤`).slice(0, 155);

  // Recipe 结构化数据：菜谱站拿 Google/百度富媒体摘要的关键。
  // 只写站内真实存在的字段；不编造热量、用户评分、发布日期。
  const recipeLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: title,
    description: desc,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@type": "WebSite", name: "简单做饭", url: BASE },
    author: { "@type": "Person", name: recipe.author || "简单做饭" },
    inLanguage: "zh-CN",
    recipeCuisine: "中式",
    keywords: [recipe.title, ...(recipe.tags ?? [])].filter(Boolean).join("，"),
  };
  if (hasImg) recipeLd.image = [BASE + dishLarge(recipe.id)];
  if (recipe.minutes) recipeLd.totalTime = `PT${recipe.minutes}M`;
  if (recipe.tags?.length) recipeLd.recipeCategory = recipe.tags[0];
  const ings = ingredientsOf(recipe.content);
  if (ings.length) recipeLd.recipeIngredient = ings;
  const steps = instructionsOf(recipe.content);
  if (steps.length) {
    recipeLd.recipeInstructions = steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text: s,
    }));
  }
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: title, item: url },
    ],
  };
  const ld = JSON.stringify([recipeLd, breadcrumbLd]).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld }}
      />
      <article>
        <nav aria-label="面包屑" className="card-meta" style={{ marginTop: 16 }}>
          <Link href="/">首页</Link>
          <span aria-hidden="true"> › </span>
          <span>{recipe.author}</span>
          {recipe.minutes != null && <span>约 {recipe.minutes} 分钟</span>}
        </nav>

        <h1 className="article-title">
          {recipe.title}
          {recipe.subtitle ? `（${recipe.subtitle}）` : ""}
        </h1>
        {recipe.excerpt && <p className="article-excerpt">{recipe.excerpt}</p>}

        {hasImg && (
          <figure className="recipe-hero">
            <img
              src={dishLarge(recipe.id)}
              alt={`${recipe.title}成品图`}
              width={640}
              height={360}
              loading="eager"
              decoding="async"
            />
          </figure>
        )}

        <ScoreLine
          nutrition={recipe.nutrition}
          price={recipe.price}
          difficulty={recipe.difficulty}
          time={recipe.time}
          total={recipe.total}
        />

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="tagbar">
            {recipe.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}

        {recipe.video_url && <VideoEmbed url={recipe.video_url} />}

        <Markdown content={recipe.content} />

        <RecipeInteractions recipeId={recipe.id} />
      </article>
    </>
  );
}
