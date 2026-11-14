# 维护者说明（本仓库）

本仓库用于 **GitHub 开源介绍与引流**，把访问者导到网站和 APP，不托管站点页面、不启用 GitHub Pages。

| 项 | 值 |
|---|---|
| 仓库 | `kaixin88/jiandan-zuofan`（public） |
| Website 字段 | `https://modianyu.top` |
| 主站 | <https://modianyu.top> |
| 站内下载页 | <https://modianyu.top/download/> |
| APK 主源 | CNB `https://cnb.cool/kaixinla/jiandan-zuofan/-/git/raw/main/dist/jiandan-zuofan.apk` |
| APK 备用源 | 本仓库 `Releases/latest` |

> 账号别混：GitHub 是 **`kaixin88`**，CNB 分发是 **`kaixinla`**。

## 仓库内容

```
README.md            开源项目介绍、特性、下载与技术架构（引流主入口）
LICENSE              MIT（代码部分）
.gitignore
PUSH.md              本文件
web/app/             Next.js 页面与路由
web/components/      UI 组件
web/lib/             数据与工具
web/functions/       Pages Function 采集端点
scripts/             统计 SQL、热评种子脚本
app/webapp/          APP 内嵌 Web App 前端
```

**不入库**：菜谱正文数据、成品图、构建产物、APK、`.env` 及任何密钥。

## 日常维护

1. **改介绍**：编辑 `README.md` 推到 `main` 即可，GitHub 首页会直接渲染。
2. **同步前端源码**：网站代码有变更后，把 `web/app`、`web/components`、`web/lib`、`web/functions`、
   `scripts`、`app/webapp` 的改动同步过来；同步前检查不含密钥与数据文件。
3. **发新版 APK**：
   - 主渠道走 CNB：`python app/scripts/publish_cnb.py --notes "改了什么"`，自动刷新 `update.json`，老用户 APP 会自己提示更新。
   - GitHub 备用：新建 Release，tag 用 `v1.3.0` 这类版本号，上传 `jiandan-zuofan-v<版本>.apk`。
   - 同步更新 `README.md`、`web/app/download/page.tsx` 里的版本号与体积。
4. **菜谱内容更新**：不用动本仓库，网站数据更新后 APP 自动同步。

## 安全

- GitHub / CNB / Supabase / Cloudflare 的令牌与密钥**一律不进仓库**。
- 推送用一次性令牌，用完即弃；`.gitignore` 已排除 `.env*`、`*.apk`、`dist/`。
- 若怀疑令牌泄露，立刻在对应平台撤销并重新生成。
