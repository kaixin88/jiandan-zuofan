"use client";

import Image from "next/image";
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
        <Image src="/brand-icon.svg" alt="" width={34} height={34} />
      </div>
      <div className="ap-body">
        <strong className="ap-title">简单做饭，快乐生活</strong>
        <p className="ap-desc">原视频、食材用量与手把手教程随手查，收藏云同步</p>
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
