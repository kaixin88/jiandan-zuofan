"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { supabase } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle: React.CSSProperties = {
    padding: "11px 16px",
    borderRadius: 999,
    border: "1px solid var(--line)",
    font: "inherit",
    background: "var(--bg2)",
    color: "var(--ink)",
    outline: "none",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname.trim() || email.split("@")[0] } },
        });
        if (error) throw error;
        setMsg("注册成功！现在可以直接登录了。");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
      }
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg("错误：" + m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1 className="page-title">{mode === "signin" ? "登录" : "注册"}</h1>
      <form
        onSubmit={handleSubmit}
        className="filter-card"
        style={{ display: "grid", gap: 12 }}
      >
        {mode === "signup" && (
          <input
            type="text"
            placeholder="昵称（别人看到的名字）"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="密码（至少 6 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
        </button>
        {msg && <p style={{ color: "var(--ink2)", fontSize: 14 }}>{msg}</p>}
        <button
          type="button"
          className="btn ghost"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "没有账号？去注册" : "已有账号？去登录"}
        </button>
      </form>
    </div>
  );
}
