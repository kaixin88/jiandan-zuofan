"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPage() {
  const { user, supabase, loading } = useAuth();
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setNickname((user.user_metadata?.nickname as string) || "");
    }
  }, [user]);

  const inputStyle: React.CSSProperties = {
    padding: "11px 16px",
    borderRadius: 999,
    border: "1px solid var(--line)",
    font: "inherit",
    background: "var(--bg2)",
    color: "var(--ink)",
    outline: "none",
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.updateUser({
      data: { nickname: nickname.trim() },
    });
    setBusy(false);
    setMsg(error ? "保存失败：" + error.message : "昵称已更新");
  }

  if (loading) {
    return <p className="muted-sm" style={{ marginTop: 40 }}>加载中…</p>;
  }
  if (!user) {
    return (
      <div style={{ marginTop: 40 }}>
        <h1 className="page-title">我的资料</h1>
        <p className="muted-sm">
          请先<Link href="/login">登录</Link>。
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1 className="page-title">我的资料</h1>
      <p className="muted-sm" style={{ marginBottom: 16 }}>
        邮箱：{user.email}
      </p>
      <form
        onSubmit={save}
        className="filter-card"
        style={{ display: "grid", gap: 12 }}
      >
        <label className="muted-sm" style={{ marginBottom: -4 }}>
          昵称（评论、留言都会显示这个名字）
        </label>
        <input
          type="text"
          placeholder="给自己取个昵称"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          style={inputStyle}
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "保存中…" : "保存昵称"}
        </button>
        {msg && <p style={{ color: "var(--ink2)", fontSize: 14 }}>{msg}</p>}
      </form>
    </div>
  );
}
