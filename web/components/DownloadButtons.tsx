"use client";

import { track } from "@/lib/track";

/** CNB 是国内可达的主下载源；GitHub 作为项目介绍与备用入口。
 *  改地址只改这三个常量。 */
export const CNB_APK_URL =
  "https://cnb.cool/kaixinla/jiandan-zuofan/-/git/raw/main/dist/jiandan-zuofan.apk";
export const GITHUB_REPO_URL = "https://github.com/kaixin88/jiandan-zuofan";
export const GITHUB_RELEASE_URL = GITHUB_REPO_URL + "/releases/latest";

export default function DownloadButtons() {
  return (
    <div className="dl-actions">
      <a
        className="dl-btn primary"
        href={CNB_APK_URL}
        onClick={() => track("app_download", { path: "/download/cnb" })}
      >
        下载安卓 APK <span aria-hidden="true">↓</span>
      </a>
      <a
        className="dl-btn"
        href={GITHUB_RELEASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("app_download", { path: "/download/github" })}
      >
        GitHub Releases（备用）
      </a>
      <a className="dl-link" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
        项目介绍与源码 →
      </a>
    </div>
  );
}
