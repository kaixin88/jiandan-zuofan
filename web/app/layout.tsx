import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import TopNav, { BottomTab } from "@/components/TopNav";
import AppPromo from "@/components/AppPromo";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://modianyu.top"),
  title: {
    default: "简单做饭，快乐生活 · 原视频与手把手菜谱教程",
    template: "%s · 简单做饭，快乐生活",
  },
  description:
    "简单做饭，快乐生活。保留原视频，配上食材用量与详细手把手教程：分步做法、火候时间与先后顺序，还讲清为什么这么做、哪里容易翻车。能搜、能筛、能收藏。",
  applicationName: "简单做饭",
  icons: { icon: "/brand-icon.svg", apple: "/brand-icon.svg" },
  keywords: ["家常菜谱", "菜谱", "做法", "做饭", "美食教程", "手把手教程", "视频菜谱", "食材用量", "简单做饭", "简单做饭，快乐生活"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "简单做饭，快乐生活",
    locale: "zh_CN",
    url: "https://modianyu.top/",
    title: "简单做饭，快乐生活 · 原视频与手把手菜谱教程",
    description: "简单做饭，快乐生活。原视频、食材用量与手把手教程，分步做法和火候顺序，一步步讲清楚。",
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
              <Link href="/" className="brand">
                <span className="brand-logo" aria-hidden="true">
                  <Image src="/brand-icon.svg" alt="" width={34} height={34} />
                </span>
                <span className="brand-copy">
                  <strong>简单做饭</strong>
                  <span>简单做饭，快乐生活</span>
                </span>
              </Link>
              <TopNav />
            </div>
          </header>
          <main className="wrap main">{children}</main>
          <AppPromo />
          <footer className="site-footer">
            <strong className="footer-slogan">简单做饭，快乐生活</strong>
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
