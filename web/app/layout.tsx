import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import TopNav, { BottomTab } from "@/components/TopNav";
import AppPromo from "@/components/AppPromo";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://modianyu.top"),
  title: {
    default: "简单做饭 · 1077 道家常菜谱",
    template: "%s · 简单做饭",
  },
  description: "把美食博主的视频，整理成能搜、能筛、能收藏的结构化菜谱。今天，想吃点什么？",
  applicationName: "简单做饭",
  keywords: ["家常菜谱", "菜谱", "做法", "做饭", "美食教程", "食材用量", "简单做饭"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "简单做饭",
    locale: "zh_CN",
    url: "https://modianyu.top/",
    title: "简单做饭 · 1077 道家常菜谱",
    description: "把美食博主的视频，整理成能搜、能筛、能收藏的结构化菜谱。",
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
