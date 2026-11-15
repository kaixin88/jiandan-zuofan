# -*- coding: utf-8 -*-
"""
一键发布到 CNB 公开仓库，并刷新 APP 自动更新清单。

用法：
    python app/scripts/publish_cnb.py --notes "修复评论加载"
    python app/scripts/publish_cnb.py --apk app/dist/xxx.apk --notes "..."

令牌来源（按优先级，绝不写进仓库）：
    1. 环境变量 CNB_TOKEN
    2. 项目根 .env.cnb.local 中的 CNB_TOKEN=...
推送走 git.cnb.cool（CNB 写入专用域名），读取/下载走 cnb.cool 公开直链。
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
REPO = "kaixinla/jiandan-zuofan"
PUBLISH_DIR = ROOT / "cnb" / "jiandan-zuofan"
RAW_BASE = "https://cnb.cool/%s/-/git/raw/main" % REPO
APK_NAME = "jiandan-zuofan.apk"
MANIFEST = APP / "android" / "AndroidManifest.xml"


def read_token():
    t = os.environ.get("CNB_TOKEN", "").strip()
    if t:
        return t
    f = ROOT / ".env.cnb.local"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("CNB_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def read_version():
    s = MANIFEST.read_text(encoding="utf-8")
    code = int(re.search(r'android:versionCode="(\d+)"', s).group(1))
    name = re.search(r'android:versionName="([^"]+)"', s).group(1)
    return code, name


def find_apk(explicit):
    if explicit:
        p = Path(explicit)
        if not p.exists():
            raise SystemExit("找不到 APK：" + p)
        return p
    files = sorted((APP / "dist").glob("*.apk"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        raise SystemExit("app/dist 下没有 APK，请先运行 build_apk.py")
    return files[0]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 256), b""):
            h.update(chunk)
    return h.hexdigest()


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


README = """# 简单做饭，快乐生活

![快乐饭碗图标](https://modianyu.top/brand-icon.svg)

明黄色快乐厨房：原视频、食材用量、详细分步做法与火候顺序对照着学，把做饭变简单，把日子过快乐。

「简单做饭」菜谱 APP 的**公开分发仓库**。APP 免费无广告，自分发（不上应用商店），安装包和更新清单都放在这里。

## 公开直链（无需登录）

| 用途 | 地址 |
|---|---|
| 版本清单 | `%s/update.json` |
| 最新安装包 | `%s/dist/%s` |

CNB 的「发行版附件」下载需要登录（401），所以统一用仓库文件直链 `/-/git/raw/main/`。

## update.json 契约

```json
{
  "versionCode": 4,
  "versionName": "1.3.0",
  "url": "https://cnb.cool/kaixinla/jiandan-zuofan/-/git/raw/main/dist/jiandan-zuofan.apk",
  "size": 4300000,
  "sha256": "...",
  "notes": "本次更新说明",
  "force": false,
  "published_at": "2026-11-04 22:30:00"
}
```

APP 启动时由 Java 层（不受 file:// 跨域限制）静默拉取这个清单：
`versionCode` 大于当前已安装版本时，首页顶部出现一条轻量提示条；
点击「更新」后后台下载 APK、**校验 sha256**、再交给系统安装器。
检查失败或已是最新版本时完全静默，不打扰用户。

## 发布新版本

工程在本机 `app/`，发布只需一条命令：

```bash
# 1. 改 app/android/AndroidManifest.xml：versionCode +1、versionName 改新号
# 2. 重新打包
python app/scripts/build_apk.py
# 3. 一键推到本仓库（自动算 size / sha256 并刷新 update.json）
python app/scripts/publish_cnb.py --notes "这次改了什么"
```

令牌放环境变量 `CNB_TOKEN` 或项目根 `.env.cnb.local`，**不要提交进仓库**。
推送必须用 `git.cnb.cool`（写入域名），网页和下载用 `cnb.cool`。

## 安全

- 仓库是 public，**不放签名 keystore、Supabase 配置、任何访问令牌**
- APK 用固定证书签名；换证书会导致用户无法覆盖安装，必须卸载重装
""" % (RAW_BASE, RAW_BASE, APK_NAME)

GITIGNORE = """.env*
*.keystore
*.idsig
__pycache__/
*.pyc
app/build/
"""


def git(args, cwd):
    r = subprocess.run(["git"] + [str(a) for a in args], cwd=cwd,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, errors="replace")
    if r.returncode != 0:
        print(r.stdout[-2000:])
        raise SystemExit("git 命令失败：" + " ".join(str(a) for a in args[:3]))
    return r.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apk", default="", help="指定 APK 路径，默认取 app/dist 下最新的")
    ap.add_argument("--notes", default="功能优化与体验改进", help="本次更新说明")
    ap.add_argument("--force", action="store_true", help="是否强制更新（APP 端预留）")
    ap.add_argument("--dry-run", action="store_true", help="只生成文件，不推送")
    args = ap.parse_args()

    token = read_token()
    if not token and not args.dry_run:
        raise SystemExit("缺少 CNB_TOKEN：设置环境变量或写到项目根 .env.cnb.local")

    apk = find_apk(args.apk)
    code, name = read_version()
    size = apk.stat().st_size
    digest = sha256(apk)
    published = time.strftime("%Y-%m-%d %H:%M:%S")

    update = {
        "versionCode": code,
        "versionName": name,
        "url": RAW_BASE + "/dist/" + APK_NAME,
        "size": size,
        "sha256": digest,
        "notes": args.notes,
        "force": bool(args.force),
        "published_at": published,
    }

    PUBLISH_DIR.mkdir(parents=True, exist_ok=True)
    write(PUBLISH_DIR / "update.json", json.dumps(update, ensure_ascii=False, indent=2) + "\n")
    readme = re.sub(r"```json\n[\s\S]*?\n```", "```json\n" +
                    json.dumps(update, ensure_ascii=False, indent=2) + "\n```", README, count=1)
    write(PUBLISH_DIR / "README.md", readme)
    write(PUBLISH_DIR / ".gitignore", GITIGNORE)
    changelog = PUBLISH_DIR / "CHANGELOG.md"
    history = changelog.read_text(encoding="utf-8") if changelog.exists() else "# 更新记录\n"
    body = re.sub(r"\A# 更新记录\s*", "", history)
    # 同一版本再次发布仅更新该节，保留此前版本历史。
    body = re.sub(r"(?ms)^## v" + re.escape(name) + r"\b.*?(?=^## v|\Z)", "", body).strip()
    entry = "## v%s (%s)\n\n- %s\n- 安装包 %d 字节，sha256 `%s`\n" % (
        name, published[:10], args.notes, size, digest)
    write(changelog, "# 更新记录\n\n" + entry + ("\n" + body + "\n" if body else ""))
    dist = PUBLISH_DIR / "dist"
    dist.mkdir(exist_ok=True)
    shutil.copyfile(apk, dist / APK_NAME)

    print("APK：%s（%.2f MB）" % (apk.name, size / 1024 / 1024))
    print("版本：v%s / versionCode %d" % (name, code))
    print("sha256：%s" % digest)
    print("清单：%s" % (RAW_BASE + "/update.json"))
    print("下载：%s" % update["url"])

    if args.dry_run:
        print("dry-run：文件已生成，未推送")
        return

    if not (PUBLISH_DIR / ".git").exists():
        git(["init", "-b", "main"], PUBLISH_DIR)
        git(["config", "user.name", "cnb"], PUBLISH_DIR)
        git(["config", "user.email", "cnb@cnb.cool"], PUBLISH_DIR)
    git(["add", "-A"], PUBLISH_DIR)
    status = git(["status", "--porcelain"], PUBLISH_DIR)
    if status:
        git(["commit", "-m", "release: v%s" % name], PUBLISH_DIR)
    else:
        print("无文件变化，跳过提交")

    push_url = "https://cnb:%s@git.cnb.cool/%s.git" % (token, REPO)
    out = git(["push", push_url, "main"], PUBLISH_DIR)
    print("推送完成：", out[-300:] if out else "OK")
    print("\n已完成：APP 下次启动会读到 v%s 的更新清单（同版本不提示）。" % name)


if __name__ == "__main__":
    main()
