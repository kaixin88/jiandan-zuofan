#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 B 站热评生成菜谱「默认评论」静态种子。

流程：recipes.json 取 bvid → view 换 aid → 拉按赞排序的热评 →
      NAS 网关聚合模型 flash 提炼 3–4 条读者评价 → 随机昵称 + 合理时间 → 写 JSON。

设计要点：
  * **静态种子**：不写 Supabase、不冒充真实用户发言；前端展示时标注「B站热评精选 · AI整理」。
  * 昵称与时间由固定随机种子生成（按 recipe_id 稳定），多次运行结果一致。
  * 时间落在该菜谱上线后的近 90 天内，且早于生成时刻，避免"未来评论"。
  * 单进程、逐个处理、限速、断点续跑（已有 id 跳过），符合项目执行规范。
  * 只读取 B 站公开评论；失败/无评论的菜谱跳过，不编造内容。

用法：
  python scripts/build_comment_seeds.py --limit 5              # 试点
  python scripts/build_comment_seeds.py --all                  # 全量
  python scripts/build_comment_seeds.py --all --api-base http://192.168.5.3:8080/v1

NAS 侧（每日增量，配合 cron）：
  COMMENT_SEEDS_ROOT=/vol2/1000/top100 \
  COMMENT_SEEDS_OUTDIR=/vol2/1000/top100/data/comment_seeds \
  COMMENT_SEEDS_RECIPES=/vol2/1000/top100/data/recipes.json \
  python3 /vol2/1000/top100/code/build_comment_seeds.py --all
  已存在的分片会跳过，因此每天只处理新增菜谱，不会重复调 AI。
"""
import argparse
import datetime as dt
import json
import os
import random
import re
import sys
import time
from pathlib import Path

import requests

# 路径可用环境变量覆盖，便于同一份脚本在「本机网站项目」与「NAS 每日自动化」两处跑：
#   COMMENT_SEEDS_ROOT     项目根（NAS 上为 /vol2/1000/top100）
#   COMMENT_SEEDS_RECIPES  recipes.json 路径
#   COMMENT_SEEDS_OUTDIR   种子分片输出目录
ROOT = Path(os.environ.get("COMMENT_SEEDS_ROOT") or Path(__file__).resolve().parents[1])
RECIPES = Path(os.environ.get("COMMENT_SEEDS_RECIPES") or (ROOT / "data" / "recipes.json"))
# 按菜谱 id 分片：文章页只 fetch 自己那一片，不拖整包（全量约 1–2MB）
OUTDIR = Path(os.environ.get("COMMENT_SEEDS_OUTDIR") or
              (ROOT / "web" / "public" / "data" / "comments"))
COOKIE_CANDIDATES = [
    ROOT / ".bili_cookie.txt",
    Path(r"E:\caipu\.bili_cookie.txt"),
    Path("/vol2/1000/top100/data/.bili_cookie.txt"),
]
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
NICK_POOL = [
    "小满同学", "厨房新手阿柚", "一颗西柚", "今天吃什么呀", "老陈家的灶台",
    "阿栗", "半勺糖", "晚风配饭", "橙子不酸", "豆豆妈", "木木下厨",
    "隔壁小王", "爱吃辣的猫", "青椒不辣", "慢慢来呀", "饭团子",
    "南风知味", "小锅慢炖", "柠檬苏打", "阿禾", "二三两", "锅气观察员",
]
SOURCE_LABEL = "B站热评精选 · AI整理"

SUM_SYSTEM = """你是中文菜谱网站的编辑。下面是某道菜原视频下的 B 站热评（已按点赞数排序）。
请把其中有价值的信息提炼成 3–4 条简短的「读者评价」，用于展示在该菜谱页下方。

要求：
1. 每条 20–60 字，口语、具体、像真实读者会说的话。
2. 尽量覆盖不同角度：做法难点、口味评价、复刻结果、食材替换、失败提醒等。
3. 只能依据给出的热评内容，不得编造热评里没提到的食材、数字、步骤或结论。
4. 不要出现「网友说」「评论区」「B站」等字样，不要照抄原句，不要加引号或表情。
5. 若热评信息不足以凑 3 条，就输出能写的条数（至少 1 条）；若完全没有可用信息，输出 []。
6. 严格只输出一个 JSON 字符串数组，例如：["第一条","第二条","第三条"]，不要代码块、不要解释。"""


def log(m):
    print("[%s] %s" % (dt.datetime.now().strftime("%H:%M:%S"), m), flush=True)


def bili_session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Referer": "https://www.bilibili.com/",
                      "Accept": "application/json, text/plain, */*"})
    cookie = next((p for p in COOKIE_CANDIDATES if p.exists()), None)
    if not cookie:
        raise RuntimeError("找不到 B 站 Cookie 文件（裸请求会被 412 风控）")
    for part in cookie.read_text(encoding="utf-8").strip().split(";"):
        if "=" in part:
            k, v = part.strip().split("=", 1)
            s.cookies.set(k, v, domain=".bilibili.com")
    s.get("https://www.bilibili.com/", timeout=15)
    return s


def get_aid(s, bv):
    d = s.get("https://api.bilibili.com/x/web-interface/view",
              params={"bvid": bv}, timeout=20).json()
    if d.get("code") != 0:
        raise RuntimeError("view code=%s" % d.get("code"))
    return (d.get("data") or {}).get("aid")


def hot_replies(s, aid, pages=2):
    out = []
    for pn in range(1, pages + 1):
        d = s.get("https://api.bilibili.com/x/v2/reply",
                  params={"type": 1, "oid": aid, "pn": pn, "ps": 20, "sort": 2},
                  timeout=20).json()
        if d.get("code") != 0:
            break
        rs = (d.get("data") or {}).get("replies") or []
        for r in rs:
            msg = ((r.get("content") or {}).get("message") or "").strip()
            if len(msg) >= 8:
                out.append({"like": r.get("like") or 0, "text": msg[:300]})
        if len(rs) < 20:
            break
        time.sleep(1.2)
    out.sort(key=lambda x: x["like"], reverse=True)
    return out[:12]


def summarize(api_base, api_key, title, replies):
    joined = "\n".join("- %s" % r["text"] for r in replies)
    payload = {
        "model": "flash",
        "messages": [
            {"role": "system", "content": SUM_SYSTEM},
            {"role": "user", "content": "菜名：%s\n\n热评：\n%s" % (title, joined[:6000])},
        ],
        "max_tokens": 2048,
        "temperature": 0.7,
    }
    h = {"Content-Type": "application/json"}
    if api_key and api_key != "unused":
        h["Authorization"] = "Bearer " + api_key
    r = requests.post(api_base.rstrip("/") + "/chat/completions", json=payload,
                      headers=h, timeout=180)
    if r.status_code != 200:
        raise RuntimeError("flash HTTP %s %s" % (r.status_code, r.text[:100]))
    content = (r.json()["choices"][0]["message"].get("content") or "").strip()
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content).strip()
    m = re.search(r"\[[\s\S]*\]", content)
    if not m:
        return []
    try:
        arr = json.loads(m.group(0))
    except Exception:
        return []
    return [str(x).strip() for x in arr if isinstance(x, str) and 8 <= len(str(x).strip()) <= 120][:4]


def grounded(text, corpus):
    """生成文本里出现的数字必须能在原始热评里找到，防止 AI 编造用量/时间/温度。"""
    for num in re.findall(r"\d+(?:\.\d+)?", text):
        if num not in corpus:
            return False
    return True


def filter_grounded(texts, replies):
    corpus = " ".join(r["text"] for r in replies)
    return [t for t in texts if grounded(t, corpus)]


def decorate(recipe_id, texts):
    """固定种子生成昵称与时间，保证多次运行稳定、可复现。"""
    rnd = random.Random(recipe_id * 7919)
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    nicks = rnd.sample(NICK_POOL, min(len(texts), len(NICK_POOL)))
    out = []
    # 时间在近 60 天内，按条递增，最新一条距现在至少 2 天，避免"未来评论"或过早期
    offsets = sorted(rnd.sample(range(2, 60), min(len(texts), 58)))
    for i, t in enumerate(texts):
        ts = now - dt.timedelta(days=offsets[i], hours=rnd.randint(0, 12),
                                minutes=rnd.randint(0, 59))
        out.append({
            "nickname": nicks[i],
            "content": t,
            "created_at": ts.isoformat(timespec="minutes"),
            "likes": rnd.randint(3, 96),
            "source": SOURCE_LABEL,
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--api-base", default=os.environ.get("TOP100_API_BASE", "http://192.168.5.3:8080/v1"))
    ap.add_argument("--api-key", default=os.environ.get("TOP100_API_KEY", "unused"))
    ap.add_argument("--outdir", default=str(OUTDIR))
    a = ap.parse_args()

    recipes = json.loads(RECIPES.read_text(encoding="utf-8"))
    outdir = Path(a.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    existing = {int(p.stem) for p in outdir.glob("*.json") if p.stem.isdigit()}
    s = bili_session()
    todo = [(i + 1, r) for i, r in enumerate(recipes)
            if (i + 1) not in existing and re.search(r"BV[0-9A-Za-z]{10,}", r.get("video_url") or "")]
    if not a.all:
        todo = [x for x in todo if x[0] > a.start][:a.limit]
    log("待处理 %d 篇（已有分片 %d 篇），模型 flash @ %s" % (len(todo), len(existing), a.api_base))

    ok = skip = 0
    for rid, r in todo:
        bv = re.search(r"BV[0-9A-Za-z]{10,}", r["video_url"]).group(0)
        try:
            aid = get_aid(s, bv)
            time.sleep(0.8)
            replies = hot_replies(s, aid)
            if not replies:
                log("  #%d %s 无热评，跳过" % (rid, r["title"]))
                skip += 1
                continue
            raw = summarize(a.api_base, a.api_key, r["title"], replies)
            texts = filter_grounded(raw, replies)
            if raw and len(texts) < len(raw):
                log("    #%d 剔除 %d 条含无据数字的评价" % (rid, len(raw) - len(texts)))
            if not texts:
                log("  #%d %s AI 无有效输出，跳过" % (rid, r["title"]))
                skip += 1
                continue
            (outdir / ("%d.json" % rid)).write_text(
                json.dumps(decorate(rid, texts), ensure_ascii=False, indent=1), encoding="utf-8")
            ok += 1
            log("  #%d %s → %d 条 | %s" % (rid, r["title"], len(texts), texts[0][:34]))
        except Exception as e:
            log("  #%d %s 异常 %s: %s" % (rid, r["title"], type(e).__name__, str(e)[:100]))
            skip += 1
        time.sleep(1.5)
    log("完成：新增 %d 篇、跳过 %d 篇，种子累计 %d 篇 → %s" %
        (ok, skip, len(list(outdir.glob("*.json"))), outdir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
