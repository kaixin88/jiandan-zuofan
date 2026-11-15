# 简单做饭，快乐生活

> **把做饭变简单，把日子过快乐。** 家常菜谱站与安卓 APP，保留原视频，配上食材用量与**详细的手把手教程**——
> 分步做法、火候时间与先后顺序，还讲清为什么这么做、哪里容易翻车。
> 免费、无广告；APP 内置列表快照可离线浏览，完整教程与原视频需要联网。

[![访问网站](https://img.shields.io/badge/网站-modianyu.top-ffe100?style=for-the-badge)](https://modianyu.top)
[![下载 APP](https://img.shields.io/badge/下载-Android%20APK-ffe100?style=for-the-badge)](https://modianyu.top/download/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](#许可)

---

## 先去体验

**网站**：<https://modianyu.top> ｜ **APP 下载**：<https://modianyu.top/download/>

不用注册就能看全部菜谱；登录后可以云同步收藏、写评论。
本仓库是**开源介绍与前端源码**，引流到网站和 APP，内容以线上站点为准。

---

## 这是什么

很多做菜视频讲得很好，但想回看「放了几克盐、先炒什么、烤多久」时，得拖进度条一遍遍找。

所以这个站点的做法是：**保留原视频，另配一份能照着做的详细教程**。每道菜都能同时看到两样东西：

- **原视频**：手法、火候变化、成品状态，直接看最直观
- **手把手教程**：把视频里的关键信息拆成可以照着执行的文字

具体包含：

- **食材表**：主料、辅料、调料与用量一览，折叠展示不挡正文
- **分步做法**：按顺序还原每一步动作，保留原话里的克数、勺数、时间与火候
- **五维评分**：营养、成本、难度、耗时、综合分，快速挑出今天合适的菜
- **小贴士**：替代方案、避坑提醒，都是视频里明确讲过的
- **讲解要点**：为什么这么做、哪一步容易翻车，只解释视频给出的原因，不编科学原理
- **原视频入口**：想看手法随时跳回对应视频

菜谱按菜名、食材、标签都能搜；内容持续更新，站点上的数字永远是最新的。

---

## 核心特性

**简单做饭，快乐生活**：少一点来回找用量的麻烦，多一点做成一顿饭的成就感。

| | |
|---|---|
| 视频 + 手把手教程 | 保留原视频，食材用量、分步做法与火候顺序对照着学 |
| 明黄快乐厨房 | 明黄色浅色界面，黑字按钮与深棕文字链接，轻松找菜、安心阅读 |
| 能搜能筛 | 菜名、食材、标签、分类、难度多维筛选 |
| 离线列表快照 | 安卓 APP 内置首屏列表快照可离线浏览；完整教程与原视频需要联网 |
| 收藏同步 | 登录后收藏跨设备同步（Supabase） |
| 评论与热评 | 用户评论 + 由 B 站热评 AI 整理的「精选评价」，明确标注来源 |
| 内容自动更新 | 网站更新后 APP 自动同步新菜谱，**不用重装** |
| APK 自动更新 | 启动静默检查版本、SHA-256 校验、一键安装 |
| SEO 友好 | 全站静态导出、sitemap、逐页 metadata、Recipe 结构化数据 |

---

## 下载 APP

把做饭的快乐装进口袋：原视频、食材用量和手把手教程随手查，今天也好好吃饭。

| 渠道 | 链接 | 说明 |
|---|---|---|
| **CNB（推荐）** | [直接下载 APK](https://cnb.cool/kaixinla/jiandan-zuofan/-/git/raw/main/dist/jiandan-zuofan.apk) | 国内访问稳定，也是自动更新的版本源 |
| GitHub Releases | [Releases · Latest](https://github.com/kaixin88/jiandan-zuofan/releases/latest) | 备用下载入口 |
| 网站下载页 | <https://modianyu.top/download/> | 版本信息与安装说明 |

- 当前版本：**v1.4.0**（versionCode 5），**Android 8.0+**
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

`update.json` 与安装包托管在 [CNB 公开仓库](https://cnb.cool/kaixinla/jiandan-zuofan)，
国内可达性好；GitHub 提供项目介绍、源码与备用下载。

---

## 开源内容

本仓库开源**网站前端源码**，方便交流做法与二次开发：

```
web/
├── app/          页面与路由：首页、菜谱详情、下载页、统计页、sitemap、robots
├── components/   UI 组件：菜谱列表、评分条、评论、APP 下载提示、埋点
├── lib/          数据读取、静态资源、Supabase 客户端封装、埋点工具
└── functions/    Cloudflare Pages Function：统计采集端点
scripts/          统计建表 SQL、热评种子生成脚本
app/webapp/       APP 内嵌 Web App 的前端部分（HTML / JS / CSS）
```

**不包含**（安全与体积考虑）：菜谱正文数据、成品图、`web/out/` 构建产物、
`node_modules/`、APK 二进制、以及任何 `.env` 与密钥文件。

本地跑前端需要自备：

```bash
cd web
npm install
# 建 web/.env.local：
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev
```

线上站点是 `output: "export"` 的纯静态导出，部署在 Cloudflare Pages；
登录、评论、收藏、统计由 Supabase 提供，浏览器直连。

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
                                          Supabase：登录 / 收藏 / 评论 / 点赞 / 统计
```

内容同步与 APK 版本更新是**两条独立链路**：菜谱新增只需更新网站数据，APP 启动自动同步；
只有 APP 功能变更才需要发新版。

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
