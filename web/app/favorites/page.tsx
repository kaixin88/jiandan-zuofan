"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface FavItem {
  id: number;
  title: string;
  author: string | null;
  total: number | null;
}

export default function FavoritesPage() {
  const { user, supabase, loading } = useAuth();
  const [items, setItems] = useState<FavItem[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) {
      setBusy(false);
      return;
    }
    (async () => {
      const { data: favs } = await supabase
        .from("favorites")
        .select("recipe_id")
        .eq("user_id", user.id);
      const ids = (favs ?? []).map((f) => f.recipe_id);
      if (ids.length === 0) {
        setItems([]);
        setBusy(false);
        return;
      }
      const { data: recipes } = await supabase
        .from("recipes")
        .select("id, title, author, total")
        .in("id", ids);
      setItems((recipes ?? []) as FavItem[]);
      setBusy(false);
    })();
  }, [user, supabase]);

  if (loading || busy) {
    return <p className="muted-sm" style={{ marginTop: 40 }}>加载中…</p>;
  }

  if (!user) {
    return (
      <div style={{ marginTop: 40 }}>
        <h1 className="page-title">我的收藏</h1>
        <p className="muted-sm">
          请先<Link href="/login">登录</Link>查看收藏。
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">我的收藏</h1>
      {items.length === 0 ? (
        <p className="muted-sm">还没有收藏，去菜谱页点 ☆ 收藏吧。</p>
      ) : (
        <div className="cards">
          {items.map((r) => (
            <Link key={r.id} href={`/recipe/${r.id}/`} className="card">
              <div className="card-top">
                <span>{r.author}</span>
                <span className="card-total">{r.total}</span>
              </div>
              <h3>{r.title}</h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
