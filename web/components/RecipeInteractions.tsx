"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

interface Comment {
  id: number;
  content: string;
  created_at: string;
  user_id: string | null;
  nickname: string | null;
  likeCount?: number;
  liked?: boolean;
}

/** 由 B 站热评经 flash 整理生成的静态种子评论（不写入 Supabase） */
interface SeedComment {
  nickname: string;
  content: string;
  created_at: string;
  likes: number;
  source: string;
}

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("visitor_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("visitor_id", id);
  }
  return id;
}

export default function RecipeInteractions({ recipeId }: { recipeId: number }) {
  const { user, supabase } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [seeds, setSeeds] = useState<SeedComment[]>([]);
  const [text, setText] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) {
      setFavorited(false);
      return;
    }
    supabase
      .from("favorites")
      .select("recipe_id")
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setFavorited(!!data));
  }, [user, recipeId, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, nickname")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Comment[];
      if (cancelled) return;
      if (list.length > 0) {
        const ids = list.map((c) => c.id);
        const { data: likes } = await supabase
          .from("comment_likes")
          .select("comment_id, visitor_id")
          .in("comment_id", ids);
        const visitor = getVisitorId();
        const countMap = new Map<number, number>();
        const likedSet = new Set<number>();
        for (const l of likes ?? []) {
          const cid = l.comment_id as number;
          countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
          if (l.visitor_id === visitor) likedSet.add(cid);
        }
        list.forEach((c) => {
          c.likeCount = countMap.get(c.id) ?? 0;
          c.liked = likedSet.has(c.id);
        });
      }
      if (!cancelled) setComments(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId, supabase]);

  // 静态种子按菜谱 id 分片加载，404 表示该篇尚未生成，静默忽略
  useEffect(() => {
    let cancelled = false;
    fetch(`/data/comments/${recipeId}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!cancelled && Array.isArray(d)) setSeeds(d as SeedComment[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  async function toggleLike(c: Comment) {
    const visitor = getVisitorId();
    if (c.liked) {
      await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", c.id)
        .eq("visitor_id", visitor);
      c.liked = false;
      c.likeCount = Math.max(0, (c.likeCount ?? 1) - 1);
    } else {
      await supabase
        .from("comment_likes")
        .insert({ comment_id: c.id, visitor_id: visitor });
      c.liked = true;
      c.likeCount = (c.likeCount ?? 0) + 1;
    }
    setComments([...comments]);
  }

  async function toggleFav() {
    if (!user) return alert("请先登录再收藏");
    if (favorited) {
      await supabase
        .from("favorites")
        .delete()
        .eq("recipe_id", recipeId)
        .eq("user_id", user.id);
      setFavorited(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ recipe_id: recipeId, user_id: user.id });
      setFavorited(true);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!text.trim()) {
      setErr("请先写点内容再发送");
      return;
    }
    if (!user && !nickname.trim()) {
      setErr("游客评论需要先填一个昵称");
      return;
    }
    setBusy(true);
    const displayName = user
      ? ((user.user_metadata?.nickname as string) ||
        user.email?.split("@")[0] ||
        "用户")
      : nickname.trim();
    const { error } = await supabase.from("comments").insert({
      recipe_id: recipeId,
      user_id: user?.id ?? null,
      nickname: displayName,
      content: text.trim(),
    });
    if (error) {
      setErr("评论失败：" + error.message);
    } else {
      setText("");
      const { data } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, nickname")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: false });
      setComments((data ?? []) as Comment[]);
    }
    setBusy(false);
  }

  const fieldStyle: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 999,
    border: "1px solid var(--line)",
    font: "inherit",
    background: "var(--bg2)",
    color: "var(--ink)",
  };

  return (
    <section style={{ marginTop: 36 }}>
      <div
        style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 18, margin: 0 }}>评论 {comments.length}</h2>
        <button
          type="button"
          className={`btn sm${favorited ? " primary" : ""}`}
          onClick={toggleFav}
        >
          {favorited ? "★ 已收藏" : "☆ 收藏"}
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="muted-sm">还没有评论，来做第一个。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {comments.map((c) => (
            <li key={c.id} className="filter-card" style={{ margin: 0 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                {c.nickname || `用户 ${(c.user_id ?? "").slice(0, 4)}`} ·{" "}
                {new Date(c.created_at).toLocaleString("zh-CN")}
              </div>
              <div style={{ fontSize: 14.5, color: "var(--ink)" }}>
                {c.content}
              </div>
              <button
                type="button"
                className={`like-btn${c.liked ? " on" : ""}`}
                onClick={() => toggleLike(c)}
                style={{ marginTop: 8 }}
              >
                ♥ {c.likeCount ?? 0}
              </button>
            </li>
          ))}
        </ul>
      )}

      {seeds.length > 0 && (
        <div className="seed-comments">
          <div className="seed-head">
            <strong>精选评价 {seeds.length}</strong>
            <span className="seed-src">B站热评 · 按原意整理</span>
          </div>
          <p className="seed-note">
            以下为该视频的 B 站热评，按原意整理（含玩笑与调侃），非站内用户发言；昵称与时间为展示用示例。
          </p>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {seeds.map((s, i) => (
              <li key={i} className="filter-card seed-card">
                <div className="tiny" style={{ marginBottom: 4 }}>
                  {s.nickname} · {new Date(s.created_at).toLocaleDateString("zh-CN")}
                  <span className="seed-likes">♥ {s.likes}</span>
                </div>
                <div style={{ fontSize: 14.5, color: "var(--ink)" }}>{s.content}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <form onSubmit={submitComment} style={{ display: "grid", gap: 10 }}>
          {!user && (
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="昵称（游客评论必填）"
              style={fieldStyle}
            />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                user ? "写下你的做法心得…" : "写下你的做法心得（游客也可评论）…"
              }
              className="comment-input"
              style={{ ...fieldStyle, flex: 1 }}
            />
            <button className="btn primary sm" type="submit" disabled={busy}>
              发送
            </button>
          </div>
          {err && (
            <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{err}</p>
          )}
        </form>
      </div>
    </section>
  );
}
