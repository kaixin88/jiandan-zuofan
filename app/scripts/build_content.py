# -*- coding: utf-8 -*-
"""
生成「简单做饭」APP 的同步数据 + 内置首屏快照。

数据源（唯一）：
  ../../data/recipes.json          全量菜谱（含村驴导入条目）
  ../../web/data/dish_covers.json  成品图清单
  ../config/categories.json       分类规则（可随时增改）
  ../config/nav.json              底部导航（可随时增改）
  ../config/site.json             同步源
  ../config/extra/*.md            以后新增的技巧/教程文章（可选）

输出：
  ../../web/public/app/*          线上同步数据（部署后 APP 自动更新）
  ../webapp/data/snapshot.js      APK 内置首屏快照（无网也能看）
"""
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
CFG = APP / "config"
WEBAPP = APP / "webapp"
OUT_ONLINE = ROOT / "web" / "public" / "app"
OUT_SNAPSHOT = WEBAPP / "data"

RECIPES = ROOT / "data" / "recipes.json"
COVERS = ROOT / "web" / "data" / "dish_covers.json"

CHUNK_SIZE = 100
SNAPSHOT_COUNT = 40


def read_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(p, obj, pretty=False):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def clean_markdown(raw: str) -> str:
    """把笔记里的 details/图片 整理成适合手机阅读的干净 Markdown。"""
    if not raw:
        return ""
    s = raw
    # 成品图已单独提供，正文里的旧插图一律移除
    s = re.sub(r"<img\b[^>]*>", "", s, flags=re.I)
    s = re.sub(r"<iframe\b[^>]*>.*?</iframe>", "", s, flags=re.I | re.S)
    # 食材折叠块展开成一个小标题 + 表格，手机上更好读
    s = re.sub(r"<details\b[^>]*>", "", s, flags=re.I)
    s = re.sub(r"</details>", "", s, flags=re.I)
    s = re.sub(
        r"<summary\b[^>]*>(.*?)</summary>",
        lambda m: "\n\n**" + re.sub(r"<[^>]+>", "", m.group(1)).strip() + "**\n\n",
        s,
        flags=re.I | re.S,
    )
    # 中文紧邻 ** 时 Markdown 解析器常不认，先转成原始 HTML 强调
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s, flags=re.S)
    # 去掉多余空行
    s = re.sub(r"\n{4,}", "\n\n\n", s)
    return s.strip()


def to_html(raw: str) -> str:
    md = clean_markdown(raw)
    if not md:
        return ""
    exts = ["tables", "sane_lists", "fenced_code", "attr_list"]
    # 成稿开头的一级标题与详情页标题重复，去掉（隋卞笔记没有一级标题，不受影响）
    md = re.sub(r"^\s*#\s+[^\n]+\n+", "", md, count=1)

    # 村驴成稿把逐字稿放在「## 原片文案」小节：单独渲染成折叠块，
    # 避免几千字口播稿铺满详情页；其导语引用块保持正常显示。
    if re.search(r"(?m)^##\s*原片文案\s*$", md):
        head, tail = re.split(r"(?m)^##\s*原片文案\s*$", md, maxsplit=1)
        head, tail = head.strip(), tail.strip()
        # clean_markdown 把 <summary> 转成了 **说明行**，折叠块自带标题，去掉避免重复
        tail = re.sub(r"^\*\*[^*\n]+\*\*\s*", "", tail, count=1)
        head_html = markdown.markdown(head, extensions=exts)
        tail_html = markdown.markdown(tail, extensions=exts)
        return (head_html +
                '<details class="orig"><summary>原片文案<span>点击展开</span></summary>' +
                tail_html + "</details>")

    html = markdown.markdown(md, extensions=exts)
    # 隋卞笔记：开头那段「原片文案」（引用块）默认折叠，点击展开
    html = re.sub(
        r"^\s*<blockquote>(.*?)</blockquote>",
        lambda m: '<details class="orig"><summary>原片文案<span>点击展开</span></summary>'
                  "<blockquote>" + m.group(1) + "</blockquote></details>",
        html, count=1, flags=re.S,
    )
    return html


def load_api_config():
    """从 web/.env.local 读取网站同款 Supabase 前端配置，写进 APK（网站侧文件不动）。"""
    env_file = ROOT / "web" / ".env.local"
    cfg = {}
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    return {
        "url": cfg.get("NEXT_PUBLIC_SUPABASE_URL", ""),
        "anon": cfg.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
    }


def parse_front_matter(text: str):
    """解析 config/extra/*.md 的极简 front matter。"""
    meta = {}
    body = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].strip().splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.strip()
            body = parts[2].strip()
    return meta, body


def load_extra():
    """以后加「做菜技巧 / 教程秘籍」：往 config/extra/ 放 .md 即可。"""
    items = []
    extra_dir = CFG / "extra"
    if not extra_dir.exists():
        return items
    for i, p in enumerate(sorted(extra_dir.glob("*.md")), 1):
        meta, body = parse_front_matter(p.read_text(encoding="utf-8"))
        ctype = meta.get("type", "tip")
        if ctype not in ("tip", "guide"):
            ctype = "tip"
        tags = [t.strip() for t in meta.get("tags", "").replace("，", ",").split(",") if t.strip()]
        items.append(
            {
                "id": "t%d" % i,
                "type": ctype,
                "title": meta.get("title", p.stem),
                "author": meta.get("author", "简单做饭"),
                "excerpt": meta.get("excerpt", body[:60].replace("\n", " ")),
                "minutes": int(meta.get("minutes", 0)) or None,
                "total": None,
                "tags": tags,
                "cover": 0,
                "video": "",
                "content": body,
            }
        )
    return items


def main():
    recipes = read_json(RECIPES)
    covers = set(read_json(COVERS))
    categories = read_json(CFG / "categories.json")
    nav = read_json(CFG / "nav.json")
    site = read_json(CFG / "site.json")

    entries = []
    for i, r in enumerate(recipes, 1):
        excerpt = (r.get("excerpt") or "").strip()
        # excerpt 常以作者名开头，去掉冗余前缀
        author = (r.get("author") or "").strip()
        if author and excerpt.startswith(author + "。"):
            excerpt = excerpt[len(author) + 1 :].strip()
        # 摘要在卡片里是纯文本，去掉 Markdown 强调符并压成一行
        excerpt = re.sub(r"\*\*(.+?)\*\*", r"\1", excerpt, flags=re.S)
        excerpt = re.sub(r"\s+", " ", excerpt).strip()
        entries.append(
            {
                "id": i,
                "type": "recipe",
                "title": (r.get("title") or "").strip(),
                "author": author,
                "excerpt": excerpt[:72],
                "minutes": r.get("minutes"),
                "total": r.get("total"),
                "tags": r.get("tags") or [],
                "cover": 1 if i in covers else 0,
                "video": r.get("video_url") or "",
                "bv": (re.search(r"(BV[0-9A-Za-z]+)", r.get("video_url") or "").group(1)
                       if re.search(r"(BV[0-9A-Za-z]+)", r.get("video_url") or "") else ""),
                "content": r.get("content") or "",
            }
        )

    extra = load_extra()
    entries.extend(extra)

    # 正文分片：APP 按需加载，避免一次解析全量菜谱
    chunks = {}
    for idx, e in enumerate(entries):
        part = idx // CHUNK_SIZE + 1
        e["p"] = part
        chunks.setdefault(part, {})[str(e["id"])] = to_html(e["content"])

    catalog = [
        {k: v for k, v in e.items() if k != "content"} for e in entries
    ]

    version = int(time.time())
    manifest = {
        "version": version,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "count": len(catalog),
        "recipe_count": sum(1 for e in catalog if e["type"] == "recipe"),
        "tip_count": sum(1 for e in catalog if e["type"] == "tip"),
        "guide_count": sum(1 for e in catalog if e["type"] == "guide"),
        "chunk_size": CHUNK_SIZE,
        "chunks": len(chunks),
        "categories_version": categories.get("version", 1),
        "nav_version": nav.get("version", 1),
        "builtin_images": int(site.get("builtinImages", 350)),
    }

    # ---- 线上同步数据 ----
    OUT_ONLINE.mkdir(parents=True, exist_ok=True)
    write_json(OUT_ONLINE / "manifest.json", manifest)
    write_json(OUT_ONLINE / "catalog.json", catalog)
    write_json(OUT_ONLINE / "categories.json", categories)
    write_json(OUT_ONLINE / "nav.json", nav)
    write_json(OUT_ONLINE / "site.json", site)
    shop_path = CFG / "shop.json"
    shop = read_json(shop_path) if shop_path.exists() else {"version": 1, "items": []}
    write_json(OUT_ONLINE / "shop.json", shop)
    for part, data in chunks.items():
        write_json(OUT_ONLINE / "content" / ("p%d.json" % part), data)

    # ---- APK 内置首屏快照（无网可看） ----
    snap_entries = catalog[:SNAPSHOT_COUNT]
    snap_content = {}
    for e in snap_entries:
        part = e["p"]
        key = str(e["id"])
        if part in chunks and key in chunks[part]:
            snap_content[key] = chunks[part][key]
    snapshot = {
        "manifest": manifest,
        "catalog": catalog,  # 全量索引：离线也能浏览全部菜名，只有正文需要联网
        "categories": categories,
        "nav": nav,
        "site": site,
        "shop": shop,
        "content": snap_content,
    }
    OUT_SNAPSHOT.mkdir(parents=True, exist_ok=True)
    (OUT_SNAPSHOT / "snapshot.js").write_text(
        "window.__SNAPSHOT__=" + json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + ";",
        encoding="utf-8",
    )

    # Supabase 评论配置只写进 APK，不复制到网站目录 —— 网站侧保持零改动
    api = load_api_config()
    (OUT_SNAPSHOT / "api.js").write_text(
        "window.__API__=" + json.dumps(api, ensure_ascii=False) + ";", encoding="utf-8"
    )
    print("Supabase 评论配置：%s" % ("已写入 APK" if api["url"] and api["anon"] else "缺失"))

    # 网站 /app/ 也能直接打开（与 APP 同一套前端）
    for name in ("index.html", "app.css", "app.js", "brand-icon.png"):
        src = WEBAPP / name
        if src.exists():
            (OUT_ONLINE / name).write_bytes(src.read_bytes())
    (OUT_ONLINE / "data").mkdir(parents=True, exist_ok=True)
    (OUT_ONLINE / "data" / "snapshot.js").write_bytes(
        (OUT_SNAPSHOT / "snapshot.js").read_bytes()
    )

    # APK 只内置前 builtinImages 张（首屏 + 常用），其余由 APP 后台单线程串行下载缓存；
    # 线上 /app/ 页面仍保留全部图片，供浏览器直接打开与 APP 下载回源使用。
    # 以后网站新增菜谱的图片也会自动进下载队列，无需改代码、无需重发 APK。
    builtin = int(site.get("builtinImages", 350))
    img_src = ROOT / "web" / "public" / "dishes" / "s"
    img_app = WEBAPP / "img" / "s"
    img_online = OUT_ONLINE / "img" / "s"
    img_app.mkdir(parents=True, exist_ok=True)
    img_online.mkdir(parents=True, exist_ok=True)
    # 增量同步，不做整目录删除（批量删除会被安全策略拦截，也会拖慢构建）
    src_files = sorted(img_src.glob("*.webp"))
    src_ids = {p.stem for p in src_files}
    for stale in img_online.glob("*.webp"):
        if stale.stem not in src_ids:
            stale.unlink()
    for stale in img_app.glob("*.webp"):
        if not (stale.stem.isdigit() and int(stale.stem) <= builtin):
            stale.unlink()
    n_builtin = n_online = 0
    for src in src_files:
        shutil.copyfile(src, img_online / src.name)
        n_online += 1
        if src.stem.isdigit() and int(src.stem) <= builtin:
            shutil.copyfile(src, img_app / src.name)
            n_builtin += 1
    builtin_bytes = sum(f.stat().st_size for f in img_app.glob("*.webp"))
    print("APK 内置成品图 %d 张（%.2f MB）；线上保留 %d 张；后台待补 %d 张"
          % (n_builtin, builtin_bytes / 1024 / 1024, n_online, n_online - n_builtin))

    # ---- 统计：确认每个分类都有内容 ----
    def match(e, rule):
        if not rule:
            return True
        if rule.get("type") and e["type"] != rule["type"]:
            return False
        if rule.get("author") and e.get("author") != rule["author"]:
            return False
        m = e.get("minutes")
        if rule.get("maxMinutes") is not None and (m is None or m > rule["maxMinutes"]):
            return False
        if rule.get("minMinutes") is not None and (m is None or m < rule["minMinutes"]):
            return False
        t = e.get("total")
        if rule.get("minTotal") is not None and (t is None or t < rule["minTotal"]):
            return False
        if rule.get("maxTotal") is not None and (t is None or t > rule["maxTotal"]):
            return False
        tags = set(e.get("tags") or [])
        if rule.get("tagsAny") and not (tags & set(rule["tagsAny"])):
            return False
        if rule.get("tagsAll") and not set(rule["tagsAll"]).issubset(tags):
            return False
        if rule.get("excludeTags") and (tags & set(rule["excludeTags"])):
            return False
        if rule.get("titleContains") and not any(w in e["title"] for w in rule["titleContains"]):
            return False
        return True

    print("生成完成：%d 条（菜谱 %d / 技巧 %d / 教程 %d），%d 个正文分片"
          % (len(catalog), manifest["recipe_count"], manifest["tip_count"],
             manifest["guide_count"], len(chunks)))
    print("分类命中数：")
    for c in categories["items"]:
        n = sum(1 for e in catalog if match(e, c.get("rule", {})))
        flag = "" if n else "   <-- 当前为空（以后加内容自动出现）"
        print("  %-10s %4d%s" % (c["name"], n, flag))
    print("线上数据：", OUT_ONLINE)
    print("快照体积：%.1f KB" % ((OUT_SNAPSHOT / "snapshot.js").stat().st_size / 1024))


if __name__ == "__main__":
    main()
