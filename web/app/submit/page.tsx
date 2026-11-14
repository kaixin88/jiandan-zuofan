"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function SubmitPage() {
  const { supabase } = useAuth();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const inputStyle: React.CSSProperties = {
    padding: "11px 16px",
    borderRadius: 12,
    border: "1px solid var(--line)",
    font: "inherit",
    background: "var(--bg2)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!url.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("submissions").insert({
      url: url.trim(),
      note: note.trim() || null,
      nickname: nickname.trim() || null,
      email: email.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg("提交失败：" + error.message);
    } else {
      setDone(true);
      setUrl("");
      setNote("");
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 520, margin: "40px auto" }}>
        <h1 className="page-title">提交成功</h1>
        <p className="muted-sm">
          已收到你的链接，后台会尽快提炼成结构化菜谱。感谢贡献！
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={() => setDone(false)}
        >
          再提交一个
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      <h1 className="page-title">提交菜谱链接</h1>
      <p className="muted-sm" style={{ marginBottom: 16 }}>
        把你想整理的 B 站美食视频链接发来，后台会自动提炼成结构化菜谱。
      </p>
      <form
        onSubmit={handleSubmit}
        className="filter-card"
        style={{ display: "grid", gap: 12 }}
      >
        <input
          type="url"
          placeholder="视频链接（https://www.bilibili.com/video/BV...）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="备注（可选，如：想要详细的火候说明）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="你的昵称（可选）"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="你的邮箱（可选，提炼完成通知你）"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "提交中…" : "提交"}
        </button>
        {msg && <p style={{ color: "var(--ink2)", fontSize: 14 }}>{msg}</p>}
      </form>
    </div>
  );
}
