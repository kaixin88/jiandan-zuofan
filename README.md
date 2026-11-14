# 简单做饭 · 家常菜谱站与安卓 APP

> 把美食博主的视频，整理成**能搜、能筛、能收藏**的结构化菜谱。
> 1077 道家常菜，免费、无广告、可离线使用。

[![访问网站](https://img.shields.io/badge/网站-modianyu.top-ff7043?style=for-the-badge)](https://modianyu.top)
[![下载 APP](https://img.shields.io/badge/下载-Android%20APK-4caf50?style=for-the-badge)](#-下载-app)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](#-许可)

---

## 在线体验

**网站**：<https://modianyu.top> · **下载页**：<https://modianyu.top/download/> · **项目介绍页**：<https://kaixin88.github.io/jiandan-zuofan/>

不用注册就能看全部菜谱；登录后可以云同步收藏、写评论。

---

## 这是什么

很多做菜视频讲得很好，但想回看「放了几克盐、先炒什么、烤多久」时，得拖进度条一遍遍找。
这个项目把公开美食视频的口播内容整理成**结构化菜谱**：

- **食材表**：主料、辅料、调料与用量，折叠展示不挡正文
- **步骤**：按顺序还原做法，保留原话里的克数、勺数、时间与火候
- **五维评分**：营养、成本、难度、耗时、综合分，方便快速挑菜
- **小贴士 / 讲解要点**：为什么这么做、哪里容易翻车
- **原视频链接**：想看手法随时跳转

目前收录 **1077 道**（含「村驴」391 篇、王刚等多位 UP 主的教程），全部支持按菜名、食材、标签搜索。

---

## 核心特性

| | |
|---|---|
| 能搜能筛 | 菜名、食材、标签、分类、难度多维筛选 |
| 离线可看 | 安卓 APP 内置首屏快照，没网也能翻菜谱 |
| 收藏同步 | 登录后收藏跨设备同步（Supabase） |
| 评论与热评 | 用户评论 + 由 B 站热评 AI 整理的「精选评价」，明确标注来源 |
| 内容自动更新 | 网站更新后 APP 自动同步新菜谱，**不用重装** |
| APK 自动更新 | 启动静默检查版本、SHA-256 校验、一键安装 |
| 图片缓存 | 内置 350 张成品图，新增菜谱图片自动后台缓存 |

---

## 下载 APP

| 渠道 | 链接 | 说明 |
|---|---|---|
| **CNB（推荐）** | [直接下载 APK](https://cnb.cool/kaixin88/jiandan-zuofan/-/git/raw/main/dist/jiandan-zuofan.apk) | 国内访问稳定，也是自动更新的版本源 |
| GitHub Releases | [Releases · Latest](https://github.com/kaixin88/jiandan-zuofan/releases/latest) | 备用下载入口 |
| 网站下载页 | <https://modianyu.top/download/> | 版本信息与安装说明 |

- 当前版本：**v1.3.0**（versionCode 4），约 **4.1 MB**，**Android 8.0+**
- 自行分发 APK，首次安装需允许「安装未知来源应用」
- 免费、无广告、不需要注册即可浏览

### 自动更新是怎么做的

```
APP 启动
  └─ Java 层请求 update.json（绕开 file:// 跨域）
       └─ versionCode > 已装版本 ? 首页顶部显示提示条 : 静默
            └─ 点「更新」→ 后台下载 → SHA-256 校验
                 └─ ApkProvider 以 content:// 唤起系统安装器
```

`update.json` 与安装包托管在 [CNB 公开仓库](https://cnb.cool/kaixin88/jiandan-zuofan)，
国内可达性好；GitHub 主要承担**项目介绍、源码展示与备用下载**。

---

## 技术架构

```
公开美食视频 ──► 口播字幕（faster-whisper）──► AI 整理成结构化 Markdown
                                                   │
                          ┌────────────────────────┼────────────────────────┐
                          ▼                        ▼                        ▼
                   recipes.json              Next.js 16 静态导出      内置快照 snapshot.js
                   （唯一数据源）            Cloudflare Pages            │
                                                  │                     ▼
                                          网站 /recipe/<id>/      Android WebView 壳
                                                  │                 （aapt2/d8 本机打包）
                                                  ▼
                                          Supabase：登录 / 收藏 / 评论 / 点赞
```

- **网站**：Next.js 16 App Router + TypeScript，`output: "export"` 纯静态，1077 篇预渲染 HTML；附带 sitemap、逐页 metadata、Recipe JSON-LD 结构化数据
- **APP**：原生 WebView 壳（无 Gradle / 无 AndroidX）+ 离线 Web App，本机 `aapt2 → javac → d8 → zipalign → apksigner` 一键出包
- **后端**：Supabase（Auth + PostgREST + RLS），静态页面浏览器直连
- **部署**：Cloudflare Pages（网站与 `/app/` 数据接口）、CNB（APK 与版本清单）

内容同步与 APK 版本更新是**两条独立链路**：菜谱新增只需更新网站数据，APP 启动自动同步；只有 APP 功能变更才需要发新版。

---

## 目录说明（本仓库）

```
jiandan-zuofan/
├── README.md              本文件：项目介绍与下载入口
├── docs/
│   └── index.html         GitHub Pages 落地页（开启 Pages 后即为介绍站）
├── LICENSE                代码 MIT 许可
└── PUSH.md                仓库初始化与发布说明（维护者用）
```

> 本仓库是**介绍与分发仓库**，不含完整源码与菜谱数据。菜谱正文与网站代码在私有工作区维护，
> 如需合作或反馈，欢迎提 Issue。

---

## 数据与版权

- 菜谱内容整理自公开美食视频的口播，仅用于**家庭烹饪学习参考**，不替代原视频；每篇都附原视频链接。
- 「精选评价」由 B 站公开热评经 AI 整理，页面已明确标注来源，昵称与时间为示例展示。
- 不收录、不转载视频画面与音频；成品图仅用于菜谱识别。
- 若原作者不希望被整理，请提 Issue，会第一时间移除对应条目。

---

## 反馈

- 问题与建议：[GitHub Issues](https://github.com/kaixin88/jiandan-zuofan/issues)
- 直接体验：<https://modianyu.top>

---

## 许可

代码部分采用 [MIT License](./LICENSE)。菜谱文字内容为整理作品，权利归原作者所有，请勿用于商业再分发。
