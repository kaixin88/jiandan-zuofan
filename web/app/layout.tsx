import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import TopNav, { BottomTab } from "@/components/TopNav";
import AppPromo from "@/components/AppPromo";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://modianyu.top"),
  title: {
    default: "简单做饭 · 看视频学做菜，手把手菜谱教程",
    template: "%s · 简单做饭",
  },
  description:
    "每道菜都配原视频和详细手把手教程：食材用量、分步做法、火候时间与先后顺序，还讲清为什么这么做、哪里容易翻车。能搜、能筛、能收藏。",
  applicationName: "简单做饭",
  keywords: ["家常菜谱", "菜谱", "做法", "做饭", "美食教程", "手把手教程", "视频菜谱", "食材用量", "简单做饭"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "简单做饭",
    locale: "zh_CN",
    url: "https://modianyu.top/",
    title: "简单做饭 · 看视频学做菜，手把手菜谱教程",
    description: "有原视频、有详细手把手教程：食材用量、分步做法、火候顺序，一步步讲清楚。",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <Analytics />
          <header className="topbar">
            <div className="wrap topbar-in">
              <a href="/" className="brand">
                <span className="brand-logo" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none">
                    <path d="M4 15h24a12 12 0 0 1-12 12 12 12 0 0 1-12-12Z" fill="currentColor" opacity=".95" />
                    <path d="M8 11c0-2.2 2-3 2-5M15 11c0-2.8 2.2-3.6 2.2-6.4M22 11c0-2 1.6-2.8 1.6-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                简单做饭
              </a>
              <TopNav />
            </div>
          </header>
          <main className="wrap main">{children}</main>
          <AppPromo />
          <footer className="site-footer">
            <a href="/stats/">站点统计</a>
            <a href="/submit/">投稿</a>
            <a href="/download/">下载 APP</a>
          </footer>
          <BottomTab />
        </AuthProvider>
      </body>
    </html>
  );
}
