# 维护者说明（本仓库）

本仓库是**介绍与分发仓库**，用于 GitHub 引流，不含完整源码与菜谱数据。

| 项 | 值 |
|---|---|
| 仓库 | `kaixin88/jiandan-zuofan` |
| 介绍页 | `https://kaixin88.github.io/jiandan-zuofan/`（Pages 源：`main` 分支 `/docs`） |
| 主站 | `https://modianyu.top` |
| 站内下载页 | `https://modianyu.top/download/` |
| APK 主源 | CNB `https://cnb.cool/kaixinla/jiandan-zuofan/-/git/raw/main/dist/jiandan-zuofan.apk` |
| APK 备用源 | 本仓库 `Releases/latest` |

## 日常维护

1. **改介绍 / 落地页**：编辑 `README.md` 或 `docs/index.html`，推到 `main`，Pages 会自动重建（约 1 分钟）。
2. **发新版 APK**：
   - 主渠道仍走 CNB：`python app/scripts/publish_cnb.py --notes "改了什么"`（自动刷新 `update.json`，老用户 APP 会自己提示更新）。
   - GitHub 备用渠道：在本仓库新建 Release，tag 用 `v1.3.0` 这类版本号，把 APK 作为 asset 上传，文件名保持 `jiandan-zuofan-v<版本>.apk`。
   - 同步更新 `README.md`、`docs/index.html` 里的版本号与体积，以及站内 `web/app/download/page.tsx` 的版本信息。
3. **菜谱内容更新**：不需要动本仓库，网站数据更新后 APP 会自动同步。

## 安全

- GitHub 令牌、CNB 令牌、Supabase 密钥**一律不进仓库**。
- 推送用一次性令牌，用完即弃；`.gitignore` 已排除 `.env*` 与 `*.apk`。
- 若怀疑令牌泄露，立刻在 GitHub Settings 撤销并重新生成。

## 目录

```
README.md          项目介绍（GitHub 首页）
docs/index.html    GitHub Pages 落地页
LICENSE            代码 MIT 许可
.gitignore
PUSH.md            本文件
```
