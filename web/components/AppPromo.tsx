"use client";

import { track } from "@/lib/track";

/**
 * 全站通用的 APP 下载提示。
 * 宽屏文章页：右侧悬浮卡片；首页 / 窄屏：自动降级为页面底部横条（见 globals.css）。
 * 改下载地址只需改下面这一个常量；点击会记一次 app_download 事件。
 */
export const APP_DOWNLOAD_URL = "/download/";

export default function AppPromo() {
  return (
    <aside className="app-promo" aria-label="下载简单做饭 APP">
      <div className="ap-ic" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" width="26" height="26">
          <path d="M4 15h24a12 12 0 0 1-12 12 12 12 0 0 1-12-12Z" fill="currentColor" opacity=".95" />
          <path d="M8 11c0-2.2 2-3 2-5M15 11c0-2.8 2.2-3.6 2.2-6.4M22 11c0-2 1.6-2.8 1.6-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="ap-body">
        <strong className="ap-title">下载「简单做饭」APP</strong>
        <p className="ap-desc">菜谱离线看、收藏云同步、买菜清单随手记</p>
        <a
          href={APP_DOWNLOAD_URL}
          className="ap-btn"
          onClick={() => track("app_download", { path: APP_DOWNLOAD_URL })}
        >
          立即下载 <span aria-hidden="true">→</span>
        </a>
        <span className="ap-note">安卓 APK · 免费</span>
      </div>
    </aside>
  );
}
