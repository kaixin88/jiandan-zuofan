"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

interface Day {
  day: string;
  pv: number;
  uv: number;
  ip: number;
}
interface Stats {
  today_pv: number;
  today_uv: number;
  today_ip: number;
  d30_pv: number;
  d30_uv: number;
  d30_ip: number;
  app_download: number;
  app_install: number;
  app_open: number;
  app_ip: number;
  app_download_total: number;
  app_install_total: number;
  has_data: boolean;
  updated_at: string;
  daily: Day[];
}

function n(v: number | undefined) {
  return (v ?? 0).toLocaleString("zh-CN");
}

function Card({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{n(value)}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export default function StatsBoard() {
  const { supabase } = useAuth();
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const { data: d, error } = await supabase.rpc("site_stats", { days: 30 });
    if (error) setErr(error.message);
    else setData(d as Stats);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const daily = data?.daily ?? [];
  const maxPv = Math.max(1, ...daily.map((x) => x.pv || 0));

  return (
    <div className="stats-page">
      <div className="stats-head">
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>站点统计</h1>
          <p className="muted-sm" style={{ margin: "6px 0 0" }}>
            数据来自 Cloudflare Pages 采集端点，按北京时间自然日统计
          </p>
        </div>
        <button className="btn sm" onClick={() => void load()} disabled={loading}>
          {loading ? "加载中…" : "刷新"}
        </button>
      </div>

      {err && (
        <div className="stats-empty">
          <strong>暂时读不到统计数据</strong>
          <p>{err}</p>
          <p className="tiny">
            需先在 Supabase 执行 <code>scripts/stats_schema.sql</code>，并部署 Pages Function
            <code> functions/api/hit.ts</code> 且配好环境变量。
          </p>
        </div>
      )}

      {!err && data && !data.has_data && (
        <div className="stats-empty">
          <strong>暂无数据</strong>
          <p>采集链路就绪后，访问与 APP 事件会从下一条开始累计，不会补造历史数字。</p>
        </div>
      )}

      {!err && data && data.has_data && (
        <>
          <h2 className="stats-sec">今日</h2>
          <div className="stat-grid">
            <Card label="独立 IP" value={data.today_ip} />
            <Card label="浏览量 PV" value={data.today_pv} />
            <Card label="访客 UV" value={data.today_uv} />
          </div>

          <h2 className="stats-sec">近 30 日</h2>
          <div className="stat-grid">
            <Card label="独立 IP" value={data.d30_ip} />
            <Card label="浏览量 PV" value={data.d30_pv} />
            <Card label="访客 UV" value={data.d30_uv} />
          </div>

          <h2 className="stats-sec">APP · 今日</h2>
          <div className="stat-grid">
            <Card label="下载量" value={data.app_download} hint={`累计 ${n(data.app_download_total)}`} />
            <Card label="安装量" value={data.app_install} hint={`累计 ${n(data.app_install_total)}`} />
            <Card label="打开次数" value={data.app_open} />
            <Card label="APP 独立 IP" value={data.app_ip} />
          </div>

          <h2 className="stats-sec">近 30 日 PV 趋势</h2>
          <div className="stat-chart" role="img" aria-label="近30日每日浏览量柱状图">
            {daily.map((d) => (
              <div
                key={d.day}
                className="stat-bar"
                style={{ height: `${Math.max(2, ((d.pv || 0) / maxPv) * 100)}%` }}
                title={`${d.day} · PV ${n(d.pv)} · UV ${n(d.uv)} · IP ${n(d.ip)}`}
              />
            ))}
          </div>
          <div className="stat-chart-axis">
            <span>{daily[0]?.day ?? ""}</span>
            <span>{daily[daily.length - 1]?.day ?? ""}</span>
          </div>
        </>
      )}

      {data?.updated_at && (
        <p className="tiny" style={{ marginTop: 22, color: "var(--ink3)" }}>
          更新于 {new Date(data.updated_at).toLocaleString("zh-CN")}
        </p>
      )}
    </div>
  );
}
