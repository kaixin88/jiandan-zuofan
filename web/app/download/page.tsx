import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DownloadButtons from "@/components/DownloadButtons";

export const metadata: Metadata = {
  title: "下载 APP",
  description:
    "简单做饭，快乐生活。下载「简单做饭」安卓 APP v1.4.0：原视频、食材用量与手把手教程随手查，收藏云同步，支持自动更新。内置列表快照可离线浏览，完整教程与视频需要联网。",
  alternates: { canonical: "/download/" },
};

export default function DownloadPage() {
  return (
    <div className="dl-page">
      <div className="dl-brand">
        <Image src="/brand-icon.svg" alt="" width={56} height={56} />
        <span>简单做饭，快乐生活</span>
      </div>
      <h1 className="article-title">下载「简单做饭」APP</h1>
      <p className="article-excerpt">
        把做饭的快乐装进口袋：保留原视频，配上食材用量与手把手教程，讲清分步做法、火候顺序与为什么这么做。按食材与标签筛选，收藏云同步，让每顿家常饭更从容。
      </p>
      <p className="muted-sm">
        内置列表快照可离线浏览；完整教程与原视频需要联网查看。
      </p>

      <DownloadButtons />

      <div className="dl-grid">
        <div className="dl-card">
          <strong>当前版本</strong>
          <span>v1.4.0 · versionCode 5</span>
        </div>
        <div className="dl-card">
          <strong>系统要求</strong>
          <span>Android 8.0 及以上</span>
        </div>
      </div>

      <h2>自动更新</h2>
      <p>
        APP 每次启动会静默检查版本清单，只有发现更高版本时才在首页顶部提示；
        点击更新后后台下载、校验 SHA-256，再交给系统安装器。同版本或检查失败完全静默。
      </p>
      <p className="muted-sm">
        版本清单与安装包托管在 CNB 公开仓库（国内访问稳定）；GitHub 提供项目介绍与备用下载入口。
      </p>

      <h2>不想装 APP？</h2>
      <p>
        网站 <Link href="/">modianyu.top</Link> 是完整的菜谱站，所有内容都能直接看，也能收藏、评论。
      </p>

      <h2>安装提示</h2>
      <ul className="dl-list">
        <li>首次安装需要在系统设置里允许「安装未知来源应用」，这是自行分发 APK 的正常步骤。</li>
        <li>APP 为个人开发、免费无广告，不需要注册即可浏览；登录后才能云同步收藏。</li>
        <li>菜谱内容来自公开美食视频的整理，仅供家庭烹饪参考。</li>
      </ul>
    </div>
  );
}
