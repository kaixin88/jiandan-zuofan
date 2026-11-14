"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/recipes-local";
import { dishThumb } from "@/lib/assets";

const SORTS = [
  { key: "total", label: "综合" },
  { key: "nutrition", label: "营养" },
  { key: "price", label: "价格" },
  { key: "difficulty", label: "难度" },
  { key: "time", label: "时间" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];
type ViewMode = "grid" | "list";

type RecipeListItem = Pick<
  Recipe,
  | "id"
  | "title"
  | "subtitle"
  | "author"
  | "excerpt"
  | "nutrition"
  | "price"
  | "difficulty"
  | "time"
  | "total"
  | "tags"
> & { hasImg?: boolean };

const QUICK_CATS: {
  key: string;
  label: string;
  test: (r: RecipeListItem) => boolean;
}[] = [
  {
    key: "quick",
    label: "快手菜",
    test: (r) => (r.time ?? 0) >= 85 && (r.difficulty ?? 0) >= 80,
  },
  { key: "rice", label: "下饭菜", test: (r) => r.tags.includes("下饭菜") },
  { key: "banquet", label: "宴客菜", test: (r) => r.tags.includes("宴客硬菜") },
  { key: "breakfast", label: "早餐", test: (r) => r.tags.includes("早餐") },
  { key: "staple", label: "主食", test: (r) => r.tags.includes("主食") },
  { key: "soup", label: "汤羹", test: (r) => r.tags.includes("汤羹") },
  { key: "cold", label: "凉菜", test: (r) => r.tags.includes("凉菜") },
  { key: "spicy", label: "辣味", test: (r) => r.tags.includes("辣味") },
  { key: "cunlv", label: "村驴", test: (r) => r.author === "村驴" },
];

const PAGE_SIZE = 30;

export default function HomeList({
  initial,
}: {
  initial: RecipeListItem[];
}) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>(initial);
  const [sort, setSort] = useState<SortKey>("total");
  const [quick, setQuick] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/data/list.json")
      .then((r) => r.json())
      .then((raw: (string | number | string[] | null)[][]) => {
        const data: RecipeListItem[] = raw.map((a) => ({
          id: a[0] as number,
          title: a[1] as string,
          author: a[2] as string,
          excerpt: a[3] as string,
          nutrition: a[4] as number | null,
          price: a[5] as number | null,
          difficulty: a[6] as number | null,
          time: a[7] as number | null,
          total: a[8] as number | null,
          tags: (a[9] as string[]) ?? [],
          subtitle: a[10] as string,
          hasImg: a[11] === 1,
        }));
        setRecipes(data);
      })
      .catch(() => {});
    try {
      const saved = window.localStorage.getItem("dish-view");
      if (saved === "list") setView("list");
    } catch {}
  }, []);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [quick, tags, sort, q]);

  function switchView(v: ViewMode) {
    setView(v);
    try {
      window.localStorage.setItem("dish-view", v);
    } catch {}
  }

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recipes) for (const t of r.tags) m.set(t, (m.get(t) || 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [recipes]);

  const visibleTags = showAllTags ? allTags : allTags.slice(0, 14);

  const filtered = useMemo(() => {
    const cat = quick ? QUICK_CATS.find((c) => c.key === quick) : null;
    const kw = q.trim().toLowerCase();
    const list = recipes.filter((r) => {
      if (cat && !cat.test(r)) return false;
      if (tags.length > 0 && !tags.every((t) => r.tags.includes(t))) return false;
      if (kw) {
        const hay = `${r.title} ${r.subtitle ?? ""} ${r.author ?? ""} ${r.excerpt ?? ""} ${r.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    return [...list].sort(
      (a, b) => ((b[sort] ?? 0) as number) - ((a[sort] ?? 0) as number)
    );
  }, [recipes, quick, tags, sort, q]);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-in">
          <span className="home-hero-kicker">看视频学做菜 · 每道都有详细手把手教程</span>
          <h1>今天，想吃点什么？</h1>
          <p>有原视频、有食材用量、有分步做法，还讲清火候顺序和「为什么这么做」。</p>
        </div>
        <div className="home-hero-orb home-hero-orb-a" aria-hidden="true" />
        <div className="home-hero-orb home-hero-orb-b" aria-hidden="true" />
      </section>

      <div className="search-box" id="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.3" />
          <path d="m15.5 15.5 4.2 4.2" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜菜名、食材或标签，比如「番茄」"
          aria-label="搜索菜谱"
        />
        {q && (
          <button type="button" className="search-clear" onClick={() => setQ("")} aria-label="清空搜索">
            ×
          </button>
        )}
      </div>

      <div className="tagbar" id="cats">
        <div className="chips scroll-x">
          <button
            type="button"
            className={`chip${quick === null ? " on" : ""}`}
            onClick={() => setQuick(null)}
          >
            全部
          </button>
          {QUICK_CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip${quick === c.key ? " on" : ""}`}
              onClick={() => setQuick(quick === c.key ? null : c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sort-wrap">
        <div className="sort-row">
          <span className="sort-label">排序</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`sort-chip${sort === s.key ? " on" : ""}`}
            >
              <span className={`sort-dot dim-${s.key}`}></span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <details className="filter-card">
        <summary>
          标签筛选 <i>{tags.length || "全部"}</i>
        </summary>
        <div className="chips" style={{ marginTop: 12 }}>
          {visibleTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip${tags.includes(t) ? " on" : ""}`}
              onClick={() =>
                setTags((prev) =>
                  prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                )
              }
            >
              {t}
            </button>
          ))}
          {allTags.length > 14 && (
            <button
              type="button"
              className="chip more"
              onClick={() => setShowAllTags(!showAllTags)}
            >
              {showAllTags ? "收起" : `更多 +${allTags.length - 14}`}
            </button>
          )}
        </div>
        {tags.length > 0 && (
          <button
            type="button"
            className="af-clear"
            style={{ marginTop: 10 }}
            onClick={() => setTags([])}
          >
            清空标签
          </button>
        )}
      </details>

      <div className="list-tools">
        <span className="list-count">
          共 <b>{filtered.length}</b> 道菜
        </span>
        <div className="view-switch" role="group" aria-label="切换视图">
          <button
            type="button"
            className={view === "grid" ? "on" : ""}
            onClick={() => switchView("grid")}
            aria-label="网格视图"
            title="网格视图"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="8" height="8" rx="2" />
              <rect x="13" y="3" width="8" height="8" rx="2" />
              <rect x="3" y="13" width="8" height="8" rx="2" />
              <rect x="13" y="13" width="8" height="8" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            className={view === "list" ? "on" : ""}
            onClick={() => switchView("list")}
            aria-label="列表视图"
            title="列表视图"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="4" width="7" height="7" rx="1.8" />
              <rect x="12" y="5.5" width="9" height="1.8" rx=".9" />
              <rect x="12" y="9" width="6" height="1.6" rx=".8" opacity=".55" />
              <rect x="3" y="13" width="7" height="7" rx="1.8" />
              <rect x="12" y="14.5" width="9" height="1.8" rx=".9" />
              <rect x="12" y="18" width="6" height="1.6" rx=".8" opacity=".55" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`dish-grid${view === "list" ? " is-list" : ""}`}>
        {filtered.slice(0, visible).map((r, i) => (
          <Link key={r.id} href={`/recipe/${r.id}/`} className="dish-card">
            <div className="dish-thumb">
              <span className="dish-ph" aria-hidden="true">
                {r.title.slice(0, 1)}
              </span>
              {r.hasImg && (
                <img
                  src={dishThumb(r.id)}
                  alt={r.title}
                  loading={i < 4 ? "eager" : "lazy"}
                  decoding="async"
                  width={256}
                  height={256}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              {r.total != null && (
                <span className="dish-score">
                  {r.total}
                  <small>分</small>
                </span>
              )}
            </div>
            <div className="dish-body">
              <h3>
                {r.title}
                {r.subtitle ? `（${r.subtitle}）` : ""}
              </h3>
              <p className="dish-excerpt">{r.excerpt}</p>
              <div className="dish-tags">
                {r.tags.slice(0, 2).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="dish-foot">
                <span className="dish-author">{r.author}</span>
                <span className="dish-more">看做法 →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length > visible && (
        <button
          type="button"
          className="btn primary load-more"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        >
          加载更多（还有 {filtered.length - visible} 道）
        </button>
      )}

      {filtered.length === 0 && (
        <p className="muted-sm" style={{ textAlign: "center", marginTop: 30 }}>
          没有符合条件的菜，换个关键词或标签试试。
        </p>
      )}
    </div>
  );
}
