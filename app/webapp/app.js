/* 简单做饭 · APP 前端
 * 架构：内置首屏快照（无网可看） + 启动时同步网站 /app/ 数据（自动更新）
 * 分类、底部导航、内容类型、商品全部由线上 JSON 配置驱动，改网站即生效，不用发版。
 */
(function () {
  "use strict";

  var SNAP = window.__SNAPSHOT__ || {};
  var K = {
    manifest: "jdzf.manifest", catalog: "jdzf.catalog", categories: "jdzf.categories",
    nav: "jdzf.nav", shop: "jdzf.shop", site: "jdzf.site",
    fav: "jdzf.favorites", history: "jdzf.history", content: "jdzf.content.",
    view: "jdzf.view", syncedAt: "jdzf.syncedAt", nickname: "jdzf.nickname",
    myComments: "jdzf.mycomments"
  };

  var state = {
    manifest: null, catalog: [], categories: { items: [] }, nav: { items: [] },
    site: { site: "https://modianyu.top", appPrefix: "/app", imagePrefix: "/dishes" },
    shop: { items: [] },
    contentCache: {},
    category: "all", query: "", visible: 30, view: "grid", keepVisible: false,
    pickerScene: "any", lastPick: null,
    favorites: [], history: [],
    syncing: false, syncNote: "尚未同步"
  };

  /* 后台图片缓存：APK 只内置前 N 张，其余由 Java 层单线程串行下载到私有目录。
   * 网页版（无 AndroidBridge）自动降级为直接请求线上图片。 */
  var ImageCache = (function () {
    var has = {};
    var bridge = window.AndroidBridge;
    function reload() {
      if (!bridge || !bridge.getCachedIds) return;
      try {
        var arr = JSON.parse(bridge.getCachedIds() || "[]");
        for (var i = 0; i < arr.length; i++) has[String(arr[i])] = 1;
      } catch (e) {}
    }
    reload();
    return {
      reload: reload,
      has: function (id) { return !!has[String(id)]; },
      add: function (id) { has[String(id)] = 1; },
      size: function () { return Object.keys(has).length; },
      warm: function (ids) {
        if (!bridge || !bridge.warmImages || !ids.length) return;
        try { bridge.warmImages(JSON.stringify(ids)); } catch (e) {}
      }
    };
  })();

  // Java 下载完成后的回调：把页面上对应图片切到本地缓存
  window.__onImageReady = function (id) {
    ImageCache.add(String(id));
    var imgs = document.querySelectorAll('img[data-img-id="' + id + '"]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].style.display = "";
      imgs[i].style.opacity = "0";
      imgs[i].src = "https://img.local/" + id + ".webp";
    }
    if (!$("view-mine").hidden) renderSync();
  };

  // Java 层拉到 CNB 公开仓库的 update.json 后回调：只有真有新版本才出提示条
  window.__onUpdateCheck = function (json) {
    try {
      var info = JSON.parse(json);
      var cur = (window.AndroidBridge && window.AndroidBridge.getVersionCode)
        ? window.AndroidBridge.getVersionCode() : 0;
      if (!cur || !info || !info.versionCode || info.versionCode <= cur) return;
      var bar = $("updateBar");
      bar.innerHTML = '<span class="u-txt">发现新版本 v' + esc(info.versionName || "") +
        (info.notes ? " · " + esc(String(info.notes).slice(0, 24)) : "") + "</span>" +
        '<button id="uGo">更新</button><button class="u-close" id="uClose">×</button>';
      bar.hidden = false;
      bar._info = info;
    } catch (e) {}
  };

  var ICONS = {
    home: '<svg class="ico" viewBox="0 0 24 24"><path d="M3.5 10.5L12 3.5l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>',
    dice: '<svg class="ico" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/></svg>',
    user: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.7-3.8 3.6-5.8 7.5-5.8s6.8 2 7.5 5.8"/></svg>',
    bag: '<svg class="ico" viewBox="0 0 24 24"><path d="M4.5 8h15l-1 12h-13l-1-12z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
    heart: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0112 7.8a4.1 4.1 0 017.5 2.8C19.5 15.4 12 20 12 20z"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.3 2"/></svg>',
    chat: '<svg class="ico" viewBox="0 0 24 24"><path d="M20 12a7.5 7.5 0 01-7.5 7.5H8l-4 2 1-3.6A7.5 7.5 0 1120 12z"/></svg>',
    edit: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>',
    sync: '<svg class="ico" viewBox="0 0 24 24"><path d="M19.5 9A8 8 0 006 6.5L4 8.5"/><path d="M4.5 15A8 8 0 0018 17.5l2-2"/><path d="M4 4.5v4h4"/><path d="M20 19.5v-4h-4"/></svg>',
    trash: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/></svg>',
    info: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none"/></svg>',
    play: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M10.5 9l4.5 3-4.5 3V9z"/></svg>'
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  }); }
  function get(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function openExternal(url) {
    if (!url) return;
    if (window.AndroidBridge && window.AndroidBridge.openUrl) window.AndroidBridge.openUrl(url);
    else window.open(url, "_system");
  }

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1700);
  }

  /* ---------------- 数据 ---------------- */
  function loadLocal() {
    state.manifest = get(K.manifest, null) || SNAP.manifest || null;
    state.catalog = get(K.catalog, null) || SNAP.catalog || [];
    state.categories = get(K.categories, null) || SNAP.categories || { items: [] };
    state.nav = get(K.nav, null) || SNAP.nav || { items: [] };
    state.shop = get(K.shop, null) || SNAP.shop || { items: [] };
    state.site = get(K.site, null) || SNAP.site || state.site;
    state.favorites = get(K.fav, []);
    state.history = get(K.history, []);
    state.view = get(K.view, "grid");
    if (SNAP.content) {
      for (var id in SNAP.content) state.contentCache[id] = SNAP.content[id];
    }
  }

  function bases() {
    var list = [state.site.site].concat(state.site.fallbacks || []);
    var seen = {};
    return list.filter(function (s) {
      if (!s || seen[s]) return false; seen[s] = 1; return true;
    }).map(function (s) { return s.replace(/\/+$/, "") + (state.site.appPrefix || "/app"); });
  }
  function base() { return bases()[0]; }
  function fetchJSON(url) {
    // 国内链路偶发超时，12 秒兜底；三个源并行竞速，失败静默用本地内容
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; reject(new Error("timeout")); }
      }, 12000);
      fetch(url, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (j) {
        if (!done) { done = true; clearTimeout(timer); resolve(j); }
      }, function (e) {
        if (!done) { done = true; clearTimeout(timer); reject(e); }
      });
    });
  }

  // 多源并行竞速：主域、www、pages.dev 同时请求，谁先成功用谁
  function tryFetch(path) {
    var urls = bases().map(function (b) { return b + "/" + path; });
    return new Promise(function (resolve, reject) {
      var pending = urls.length, done = false;
      if (!pending) { reject(new Error("no source")); return; }
      urls.forEach(function (u) {
        fetchJSON(u).then(function (d) {
          if (!done) { done = true; resolve(d); }
        }, function () {
          if (--pending === 0 && !done) reject(new Error("all sources failed"));
        });
      });
    });
  }

  function sync(manual) {
    if (state.syncing) return;
    state.syncing = true;
    state.syncNote = "正在检查更新…";
    renderSync();
    var q = "?t=" + Date.now();
    tryFetch("manifest.json" + q).then(function (m) {
      if (state.manifest && m.version === state.manifest.version) {
        state.syncNote = "已是最新 · " + (get(K.syncedAt, "") || "刚刚");
        if (manual) toast("已经是最新内容");
        state.syncing = false; renderSync(); return;
      }
      return Promise.all([
        tryFetch("catalog.json" + q),
        tryFetch("categories.json" + q),
        tryFetch("nav.json" + q),
        tryFetch("shop.json" + q).catch(function () { return { items: [] }; }),
        tryFetch("site.json" + q).catch(function () { return null; })
      ]).then(function (res) {
        state.manifest = m; state.catalog = res[0]; state.categories = res[1];
        state.nav = res[2]; state.shop = res[3];
        if (res[4] && res[4].site) {
          // 合并而非替换：线上旧版 site.json 没有 builtinImages 时不能把内置图配置冲掉
          var merged = {}, k;
          for (k in state.site) if (Object.prototype.hasOwnProperty.call(state.site, k)) merged[k] = state.site[k];
          for (k in res[4]) if (Object.prototype.hasOwnProperty.call(res[4], k)) merged[k] = res[4][k];
          state.site = merged; set(K.site, merged);
        }
        set(K.manifest, m); set(K.catalog, res[0]); set(K.categories, res[1]);
        set(K.nav, res[2]); set(K.shop, res[3]);
        var stamp = new Date().toLocaleString("zh-CN", { hour12: false });
        set(K.syncedAt, stamp);
        // 内容版本变化，清掉旧正文缓存
        for (var i = 1; i <= (m.chunks || 8); i++) del(K.content + i);
        state.contentCache = {};
        // 内置快照的正文不能被同步清掉，否则前 40 篇离线就读不了
        if (SNAP.content) {
          for (var sid in SNAP.content) state.contentCache[sid] = SNAP.content[sid];
        }
        state.syncNote = "已同步 · " + stamp + " · " + m.count + " 条内容";
        renderNav(); renderChips(); renderAll();
        if (manual) toast("内容已更新");
        state.syncing = false; renderSync();
      });
    }).catch(function (err) {
      state.syncNote = "暂时无法连接，正在使用本地内容";
      state.syncing = false; renderSync();
      if (manual) toast("同步失败，已保留本地内容");
    }).then(function () { state.syncing = false; warmImages(); });
  }

  /* ---------------- 匹配 / 筛选 ---------------- */
  function matches(e, rule) {
    if (!rule) return true;
    if (rule.type && e.type !== rule.type) return false;
    if (rule.author && e.author !== rule.author) return false;
    var m = e.minutes;
    if (rule.maxMinutes != null && (m == null || m > rule.maxMinutes)) return false;
    if (rule.minMinutes != null && (m == null || m < rule.minMinutes)) return false;
    var t = e.total;
    if (rule.minTotal != null && (t == null || t < rule.minTotal)) return false;
    if (rule.maxTotal != null && (t == null || t > rule.maxTotal)) return false;
    var tags = e.tags || [];
    if (rule.tagsAny && !rule.tagsAny.some(function (x) { return tags.indexOf(x) >= 0; })) return false;
    if (rule.tagsAll && !rule.tagsAll.every(function (x) { return tags.indexOf(x) >= 0; })) return false;
    if (rule.excludeTags && rule.excludeTags.some(function (x) { return tags.indexOf(x) >= 0; })) return false;
    if (rule.titleContains && !rule.titleContains.some(function (x) { return (e.title || "").indexOf(x) >= 0; })) return false;
    return true;
  }

  function catById(id) {
    var items = state.categories.items || [];
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return { id: "all", name: "全部", rule: {} };
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    var rule = catById(state.category).rule || {};
    return state.catalog.filter(function (e) {
      if (!matches(e, rule)) return false;
      if (!q) return true;
      var hay = [e.title, e.author, e.excerpt, e.type, (e.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function localImageUrl(id) { return "https://img.local/" + id + ".webp"; }
  function remoteImageUrl(e) {
    var p = state.site.imagePrefix || "/dishes";
    var id = String(e.id);
    if (state.site.imageAbsolute) return p.replace(/\/+$/, "") + "/s/" + id + ".webp";
    return state.site.site.replace(/\/+$/, "") + p + "/s/" + id + ".webp";
  }

  function imageUrl(e, big) {
    if (!e.cover) return "";
    var id = String(e.id);
    var num = /^\d+$/.test(id) ? Number(id) : 0;
    var builtin = Number(state.site.builtinImages || 350);
    // 1) APK 内置 / 网站 /app/ 同目录：首屏与常用菜谱秒出
    if (num > 0 && num <= builtin) return "img/s/" + id + ".webp";
    // 2) 已后台缓存到私有目录：由 Java 拦截 img.local 返回本地文件
    if (ImageCache.has(id)) return localImageUrl(id);
    // 3) 尚未缓存（含以后新增菜谱）：先走线上，后台补齐后 __onImageReady 自动切换
    return remoteImageUrl(e);
  }

  function warmImages() {
    var ids = [], builtin = Number(state.site.builtinImages || 350);
    state.catalog.forEach(function (e) {
      if (!e.cover) return;
      var id = String(e.id);
      if (/^\d+$/.test(id) && Number(id) <= builtin) return;
      if (ImageCache.has(id)) return;
      ids.push(id);
    });
    ImageCache.warm(ids);
  }

  function picture(e, big) {
    var url = imageUrl(e, big);
    var ph = '<div class="ph">' + esc((e.title || "菜").charAt(0)) + "</div>";
    if (!url) return ph;
    return ph + '<img class="dish-img" src="' + esc(url) + '" data-img-id="' + esc(e.id) +
      '" alt="' + esc(e.title) + '" loading="lazy" style="opacity:0"' +
      ' onload="this.style.opacity=1" onerror="this.style.display=\'none\'">';
  }

  /* ---------------- 渲染 ---------------- */
  function renderNav() {
    var items = (state.nav.items || []).filter(function (x) { return x.enabled !== false; })
      .sort(function (a, b) { return (a.order || 9) - (b.order || 9); });
    $("tabbar").innerHTML = items.map(function (x) {
      return '<a href="#/' + esc(x.id === "picker" ? "pick" : x.id) + '" data-tab="' + esc(x.id) + '">' +
        (ICONS[x.icon] || ICONS.home) + "<span>" + esc(x.label) + "</span></a>";
    }).join("");
    markTab();
  }

  function markTab() {
    var h = location.hash || "#/home";
    var map = { home: "home", pick: "picker", mine: "mine", shop: "shop",
                fav: "mine", history: "mine", mycomments: "mine" };
    var part = h.split("/")[1] || "home";
    var target = h.indexOf("#/item/") === 0 ? "home" : (map[part] || "home");
    var links = $("tabbar").querySelectorAll("a");
    for (var i = 0; i < links.length; i++) links[i].classList.toggle("on", links[i].getAttribute("data-tab") === target);
  }

  function renderChips() {
    var items = state.categories.items || [];
    $("chips").innerHTML = items.map(function (c) {
      var n = state.catalog.filter(function (e) { return matches(e, c.rule || {}); }).length;
      return '<button class="chip' + (state.category === c.id ? " on" : "") + (!n ? " empty" : "") +
        '" data-cat="' + esc(c.id) + '">' + esc(c.name) + "</button>";
    }).join("");
    var on = $("chips").querySelector(".chip.on");
    if (on) $("chips").scrollLeft = Math.max(0, on.offsetLeft - 60);
  }

  function updateChipActive() {
    var all = $("chips").querySelectorAll(".chip");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i].getAttribute("data-cat") === state.category);
  }

  function cardHTML(e) {
    var meta = [];
    if (e.author) meta.push(esc(e.author));
    if (e.minutes) meta.push(e.minutes + " 分钟");
    if (e.type !== "recipe") meta.push(e.type === "tip" ? "技巧" : "教程");
    var badge = e.total != null && e.total >= 85 ? '<span class="badge">' + e.total + "分</span>" : "";
    return '<article class="card" data-id="' + esc(e.id) + '">' +
      '<div class="thumb">' + badge + picture(e, false) + "</div>" +
      '<div class="txt"><div class="title">' + esc(e.title) + "</div>" +
      '<div class="meta">' + meta.join("<i class=\"dot\"></i>") + "</div></div></article>";
  }

  function renderList(list, title, sub) {
    if (!state.keepVisible) state.visible = 30;   // 从详情返回时保留已加载条数
    $("listTitle").textContent = title;
    $("listCount").textContent = sub || (list.length + " 道");
    $("cards").className = "cards" + (state.view === "list" ? " list-view" : "");
    renderCards(list);
  }

  function renderCards(list) {
    var slice = list.slice(0, state.visible);
    $("cards").className = "cards" + (state.view === "list" ? " list-view" : "");
    $("cards").innerHTML = slice.length ? slice.map(cardHTML).join("")
      : '<div class="empty-state"><span class="big">○</span>这里还没有内容<br>换个分类或关键词试试</div>';
    $("more").hidden = state.visible >= list.length;
    $("endNote").textContent = state.visible >= list.length && slice.length ? "— 已经到底了 —" : "";
    $("cards")._list = list;
  }

  function renderHome() {
    var list = filtered();
    var c = catById(state.category);
    renderList(list, state.query ? "搜索结果" : c.name, list.length + " 道 · " + (state.manifest ? state.manifest.count : 0) + " 条内容已载入");
  }

  function renderPicker() {
    var scenes = [
      { id: "any", name: "随便", rule: {} },
      { id: "quick", name: "快点做", rule: { maxMinutes: 15 } },
      { id: "xiafan", name: "下饭", rule: { tagsAny: ["辣味", "红烧酱卤", "腌渍酱菜"] } },
      { id: "hard", name: "来点硬的", rule: { tagsAny: ["正午硬菜", "宴客硬菜", "海鲜水产"] } },
      { id: "veg", name: "清淡点", rule: { tagsAny: ["蔬菜", "豆制品"], excludeTags: ["肉类", "禽类", "海鲜水产"] } },
      { id: "breakfast", name: "早餐", rule: { tagsAny: ["早餐"] } },
      { id: "soup", name: "暖胃", rule: { tagsAny: ["汤羹", "晚餐暖胃"] } }
    ];
    $("pickerScene").innerHTML = scenes.map(function (s) {
      return '<button class="chip' + (state.pickerScene === s.id ? " on" : "") + '" data-scene="' + s.id + '">' + esc(s.name) + "</button>";
    }).join("");
    $("pickerScene")._scenes = scenes;
    pick();
  }

  function pick() {
    var scenes = $("pickerScene")._scenes || [];
    var rule = {};
    for (var i = 0; i < scenes.length; i++) if (scenes[i].id === state.pickerScene) rule = scenes[i].rule;
    var pool = state.catalog.filter(function (e) { return e.type === "recipe" && matches(e, rule); });
    if (!pool.length) pool = state.catalog.filter(function (e) { return e.type === "recipe"; });
    if (!pool.length) { $("pickCard").innerHTML = '<div class="loading">暂无内容</div>'; return; }
    var e = pool[Math.floor(Math.random() * pool.length)];
    if (state.lastPick === e.id && pool.length > 1) e = pool[(pool.indexOf(e) + 1) % pool.length];
    state.lastPick = e.id;
    var tags = (e.tags || []).slice(0, 3);
    // 线上旧版摘要可能还带 Markdown 强调符，客户端再兜一层
    var excerpt = (e.excerpt || "简单做，好好吃。")
      .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\s+/g, " ").slice(0, 72);
    $("pickCard").setAttribute("data-id", e.id);
    $("pickCard").innerHTML =
      '<div class="hero">' + picture(e, true) + "</div>" +
      '<div class="body"><div class="kicker">今天吃这个</div><h2>' + esc(e.title) + "</h2>" +
      "<p>" + esc(excerpt) + "</p>" +
      '<div class="pick-tags">' + (e.minutes ? "<span>" + e.minutes + " 分钟</span>" : "") +
      (e.author ? "<span>" + esc(e.author) + "</span>" : "") +
      tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div></div>";
  }

  function renderMine() {
    var favN = state.favorites.length, hisN = state.history.length;
    $("mineSub").textContent = state.manifest ? (state.manifest.count + " 条内容 · 联网自动更新") : "离线也能翻，联网自动更新";
    $("mineGroup1").innerHTML = [
      row("heart", "我的收藏", favN + " 道", "fav"),
      row("clock", "浏览历史", hisN + " 条", "history"),
      row("chat", "我的评论", get(K.myComments, []).length + " 条", "comments"),
      row("edit", "我的作品", "后续开放", "works")
    ].join("");
    $("mineGroup2").innerHTML = [
      row("trash", "清除本地缓存", "不影响收藏", "clear"),
      row("info", "关于简单做饭", "v1.3.0", "about")
    ].join("");
  }

  function row(icon, label, val, act) {
    return '<div class="row" data-act="' + act + '">' + (ICONS[icon] || ICONS.info) +
      '<span class="label">' + esc(label) + '</span><span class="val">' + esc(val) +
      '</span><span class="arrow">›</span></div>';
  }

  // 同步与后台补图全部静默进行，不在「我的」页展示状态（按用户要求）
  function renderSync() { }

  function renderShop() {
    var items = state.shop.items || [];
    if (!items.length) {
      $("shopList").innerHTML = '<div class="shop-empty"><span class="big">○</span>这里还在整理<br>以后会放做菜用得上的调料、锅具</div>';
      return;
    }
    $("shopList").innerHTML = items.map(function (x) {
      return '<div class="shop-item" data-url="' + esc(x.url) + '"><span class="name">' + esc(x.name) +
        "</span><span class=\"go\">去看看 ›</span></div>";
    }).join("");
  }

  function getContent(e) {
    var key = String(e.id);
    if (state.contentCache[key]) return Promise.resolve(state.contentCache[key]);
    var cached = get(K.content + e.p, null);
    if (cached && cached[key]) { state.contentCache[key] = cached[key]; return Promise.resolve(cached[key]); }
    return tryFetch("content/p" + e.p + ".json").then(function (data) {
      set(K.content + e.p, data);
      if (data[key]) state.contentCache[key] = data[key];
      return data[key] || "";
    }).catch(function () { return ""; });
  }

  /* 兼容网站侧尚未更新的 /app/ 数据：BV 号与折叠文案在客户端再兜一层 */
  function bvidOf(e) {
    if (e.bv) return e.bv;
    var m = /BV[0-9A-Za-z]+/.exec(e.video || "");
    return m ? m[0] : "";
  }
  function foldOriginal(html) {
    if (!html || html.indexOf('details class="orig"') >= 0) return html;
    return html.replace(/^\s*<blockquote>([\s\S]*?)<\/blockquote>/,
      '<details class="orig"><summary>原片文案<span>点击展开</span></summary>' +
      "<blockquote>$1</blockquote></details>");
  }

  /* ---------------- APP 内视频 ---------------- */
  function toggleVideo(bv, videoUrl) {
    var slot = $("videoSlot"), btn = $("videoBtn");
    if (!slot || !btn) return;
    if (slot.innerHTML) {
      slot.innerHTML = "";
      btn.classList.remove("on");
      btn.innerHTML = ICONS.play + "APP 内播放";
      return;
    }
    if (!bv) { openExternal(videoUrl); return; }
    var src = "https://player.bilibili.com/player.html?bvid=" + encodeURIComponent(bv) +
      "&page=1&high_quality=1&danmaku=0";
    slot.innerHTML = '<div class="video-box"><iframe src="' + esc(src) +
      '" allowfullscreen="true" frameborder="0" scrolling="no"></iframe></div>' +
      '<div class="video-fallback" id="videoExt" data-url="' + esc(videoUrl) +
      '">播放不顺畅？在 B 站打开 ↗</div>';
    btn.classList.add("on");
    btn.innerHTML = ICONS.play + "收起视频";
  }

  /* ---------------- 评论（与网站共用同一张 Supabase 表） ---------------- */
  function api() {
    var a = window.__API__ || {};
    return (a.url && a.anon) ? a : null;
  }
  function apiHeaders(cfg) {
    return { "apikey": cfg.anon, "Authorization": "Bearer " + cfg.anon,
             "Content-Type": "application/json" };
  }
  function loadComments(id) {
    var list = $("cList"), cfg = api();
    if (!list) return;
    if (!cfg) { list.innerHTML = '<div class="comments-empty">评论需在 APP 内联网使用</div>'; return; }
    var url = cfg.url.replace(/\/+$/, "") + "/rest/v1/comments?recipe_id=eq." +
      encodeURIComponent(id) + "&select=id,content,nickname,created_at&order=created_at.desc&limit=50";
    fetch(url, { headers: apiHeaders(cfg) }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (rows) {
      var c = $("cCount"); if (c) c.textContent = rows.length ? "· " + rows.length : "";
      list.innerHTML = rows.length ? rows.map(function (x) {
        var name = x.nickname || "用户";
        var date = (x.created_at || "").slice(0, 10);
        return '<div class="comment"><div class="cavatar">' + esc(name.charAt(0)) + "</div>" +
          '<div class="cbody"><div class="cname">' + esc(name) + " · " + esc(date) + "</div>" +
          '<div class="ctext">' + esc(x.content) + "</div></div></div>";
      }).join("") : '<div class="comments-empty">还没有评论，来占个沙发</div>';
    }).catch(function () {
      list.innerHTML = '<div class="comments-empty">评论暂时加载不了，联网后重试</div>';
    });
  }
  function submitComment(id, nick, text) {
    var cfg = api();
    if (!cfg) return Promise.reject(new Error("评论配置缺失"));
    var h = apiHeaders(cfg);
    h["Prefer"] = "return=representation";
    return fetch(cfg.url.replace(/\/+$/, "") + "/rest/v1/comments", {
      method: "POST", headers: h,
      body: JSON.stringify({ recipe_id: Number(id), nickname: nick, content: text })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); });
      return r.json();
    });
  }
  function renderComments(e) {
    var box = $("comments");
    if (!box) return;
    // 只有菜谱对应网站 recipes 表的数字 id；技巧/教程暂不开放评论
    if (!/^\d+$/.test(String(e.id))) { box.innerHTML = ""; return; }
    box.innerHTML = '<h3>评论 <span id="cCount"></span></h3>' +
      '<div id="cList"><div class="comments-empty">正在加载评论…</div></div>' +
      '<form class="comment-form" id="cForm">' +
        '<input id="cNick" placeholder="昵称（必填）" maxlength="20">' +
        '<textarea id="cText" placeholder="说说这道菜…" maxlength="500"></textarea>' +
        '<div class="crow"><button type="submit">发表</button><span class="cmsg" id="cMsg"></span></div>' +
      '</form>';
    var saved = get(K.nickname, "");
    if (saved) $("cNick").value = saved;
    loadComments(e.id);
    $("cForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nick = ($("cNick").value || "").trim();
      var text = ($("cText").value || "").trim();
      var msg = $("cMsg");
      if (!nick) { msg.textContent = "请先填个昵称"; return; }
      if (!text) { msg.textContent = "写点什么再发吧"; return; }
      msg.textContent = "正在发表…";
      submitComment(e.id, nick, text).then(function () {
        set(K.nickname, nick);
        var mine = get(K.myComments, []);
        mine.unshift({ recipe_id: Number(e.id), title: e.title, nickname: nick,
                       content: text, created_at: new Date().toISOString().slice(0, 10) });
        set(K.myComments, mine.slice(0, 50));
        $("cText").value = ""; msg.textContent = "已发表";
        loadComments(e.id); toast("评论已发表");
      }).catch(function (err) {
        msg.textContent = "发表失败：" + String(err.message || err).slice(0, 60);
      });
    });
  }

  function detailNavHTML(e) {
    var idx = -1;
    for (var i = 0; i < state.catalog.length; i++) {
      if (String(state.catalog[i].id) === String(e.id)) { idx = i; break; }
    }
    var prev = idx > 0 ? state.catalog[idx - 1] : null;
    var next = idx >= 0 && idx < state.catalog.length - 1 ? state.catalog[idx + 1] : null;
    return '<div class="detail-nav">' +
      (prev ? '<a href="#/item/' + esc(prev.id) + '"><span>上一道</span>' + esc(prev.title) + "</a>"
            : '<a href="#/home"><span>上一道</span>回到首页</a>') +
      (next ? '<a class="right" href="#/item/' + esc(next.id) + '"><span>下一道</span>' + esc(next.title) + "</a>"
            : '<a class="right" href="#/home"><span>下一道</span>回到首页</a>') +
      "</div>";
  }

  function renderDetail(id) {
    var e = null;
    for (var i = 0; i < state.catalog.length; i++) if (String(state.catalog[i].id) === String(id)) { e = state.catalog[i]; break; }
    if (!e) { $("detailBody").innerHTML = '<div class="loading">这道菜还没同步到本机，联网后再试</div>'; return; }
    $("detailBody").innerHTML =
      '<div class="detail-hero">' + picture(e, true) + "</div>" +
      '<div class="detail-head"><h1>' + esc(e.title) + "</h1>" +
      '<div class="detail-byline">' + esc(e.author || "简单做饭") + (e.type !== "recipe" ? " · " + (e.type === "tip" ? "做菜技巧" : "教程秘籍") : "") + "</div></div>" +
      '<div class="detail-facts">' +
      (e.minutes ? "<span>" + e.minutes + " 分钟</span>" : "") +
      (e.total != null ? "<span>综合 " + e.total + " 分</span>" : "") +
      (e.tags || []).slice(0, 3).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") +
      "</div>" +
      '<div class="detail-actions">' +
      '<button id="favBtn" class="' + (state.favorites.indexOf(e.id) >= 0 ? "on" : "") + '">' + ICONS.heart +
      (state.favorites.indexOf(e.id) >= 0 ? "已收藏" : "收藏") + "</button>" +
      (e.video ? '<button id="videoBtn" data-bv="' + esc(bvidOf(e)) + '" data-url="' + esc(e.video) + '">' +
        ICONS.play + "APP 内播放</button>" : "") +
      "</div>" +
      '<div id="videoSlot"></div>' +
      '<div class="prose" id="prose"><div class="loading">正在载入做法…</div></div>' +
      detailNavHTML(e) +
      '<div class="comments" id="comments"></div>';
    getContent(e).then(function (html) {
      var p = $("prose"); if (!p) return;
      p.innerHTML = html ? foldOriginal(html) : "这段内容需要联网加载，请联网后重新打开。";
    });
    renderComments(e);
    // 浏览历史
    state.history = [e.id].concat(state.history.filter(function (x) { return x !== e.id; })).slice(0, 30);
    set(K.history, state.history);
  }

  function renderMyComments() {
    var list = get(K.myComments, []);
    $("listTitle").textContent = "我的评论";
    $("listCount").textContent = list.length + " 条 · 保存在本机";
    var box = $("cards");
    box.className = "mycomments-list";
    box.innerHTML = list.length ? list.map(function (c) {
      return '<div class="comment"><div class="cavatar">' + esc((c.nickname || "我").charAt(0)) + "</div>" +
        '<div class="cbody"><div class="cname">' + esc(c.title || ("菜谱 " + c.recipe_id)) +
        " · " + esc(c.created_at || "") + "</div>" +
        '<div class="ctext">' + esc(c.content) + "</div></div></div>";
    }).join("") : '<div class="comments-empty">还没有发表过评论，去菜谱底下说两句吧</div>';
    box._list = [];
    $("more").hidden = true;
    $("endNote").textContent = "";
  }

  function renderAll() {
    var h = location.hash || "#/home";
    if (h.indexOf("#/item/") === 0) renderDetail(h.split("/")[2]);
    else if (h.indexOf("#/fav") === 0) renderList(state.catalog.filter(function (e) { return state.favorites.indexOf(e.id) >= 0; }), "我的收藏", state.favorites.length + " 道");
    else if (h.indexOf("#/history") === 0) renderList(state.history.map(function (id) { return state.catalog.filter(function (e) { return e.id === id; })[0]; }).filter(Boolean), "浏览历史", state.history.length + " 条");
    else if (h.indexOf("#/mycomments") === 0) renderMyComments();
    else renderHome();
  }

  /* ---------------- 路由 ---------------- */
  var listScroll = 0, prevActive = null;
  function route() {
    var h = location.hash || "#/home";
    var part = h.split("/")[1] || "home";
    var views = { home: "view-home", pick: "view-picker", mine: "view-mine", shop: "view-shop" };
    var isDetail = h.indexOf("#/item/") === 0;
    var isList = h.indexOf("#/fav") === 0 || h.indexOf("#/history") === 0 || h.indexOf("#/mycomments") === 0;
    var active = isDetail ? "view-detail" : (isList ? "view-home" : (views[part] || "view-home"));
    var backToList = (prevActive === "view-detail" && !isDetail);
    if (isDetail && prevActive === "view-home") listScroll = window.pageYOffset || 0;
    state.keepVisible = backToList;   // 返回时保留「加载更多」的条数
    ["view-home", "view-picker", "view-mine", "view-shop", "view-detail"].forEach(function (v) {
      $(v).hidden = v !== active;
    });
    $("topbar").querySelector(".chips").hidden = !(!isDetail && !isList && active === "view-home");
    markTab();
    if (active === "view-picker") renderPicker();
    if (active === "view-mine") renderMine();
    if (active === "view-shop") renderShop();
    if (isDetail) renderDetail(h.split("/")[2]);
    else renderAll();
    state.keepVisible = false;
    window.scrollTo(0, backToList ? listScroll : 0);
    prevActive = active;
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $("updateBar").addEventListener("click", function (ev) {
      if (ev.target.closest("#uClose")) { $("updateBar").hidden = true; return; }
      if (ev.target.closest("#uGo")) {
        var info = $("updateBar")._info;
        if (info && window.AndroidBridge && window.AndroidBridge.installUpdate) {
          window.AndroidBridge.installUpdate(info.url, info.sha256 || "");
          $("updateBar").hidden = true;
        } else toast("请在 APP 内更新");
      }
    });
    $("chips").addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip"); if (!b) return;
      state.category = b.getAttribute("data-cat"); state.query = ""; $("search").value = "";
      $("searchClear").style.display = "none";
      renderChips(); renderHome(); window.scrollTo(0, 0);
    });
    $("pickerScene").addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip"); if (!b) return;
      state.pickerScene = b.getAttribute("data-scene");
      var all = $("pickerScene").querySelectorAll(".chip");
      for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === b);
      pick();
    });
    $("pickCard").addEventListener("click", function () {
      var id = $("pickCard").getAttribute("data-id");
      if (id) location.hash = "#/item/" + id;   // 整张卡片（图片 + 文字区）都可点进详情
    });
    $("pickAgain").addEventListener("click", pick);
    $("cards").addEventListener("click", function (ev) {
      var c = ev.target.closest(".card"); if (c) location.hash = "#/item/" + c.getAttribute("data-id");
    });
    $("more").addEventListener("click", function () {
      state.visible += 30;
      renderCards($("cards")._list || filtered());
    });
    document.querySelectorAll(".view-switch button").forEach(function (b) {
      b.addEventListener("click", function () {
        state.view = b.getAttribute("data-view"); set(K.view, state.view);
        document.querySelectorAll(".view-switch button").forEach(function (x) { x.classList.toggle("on", x === b); });
        renderCards($("cards")._list || filtered());
      });
    });
    $("search").addEventListener("input", function () {
      state.query = this.value; state.category = "all";
      $("searchClear").style.display = this.value ? "block" : "none";
      updateChipActive(); renderHome(); window.scrollTo(0, 0);
    });
    $("searchClear").addEventListener("click", function () {
      $("search").value = ""; state.query = ""; this.style.display = "none";
      renderHome(); window.scrollTo(0, 0);
    });
    $("backBtn").addEventListener("click", function () {
      if (history.length > 1) history.back(); else location.hash = "#/home";
    });
    $("detailBody").addEventListener("click", function (ev) {
      var fav = ev.target.closest("#favBtn");
      if (fav) {
        var id = (location.hash.split("/")[2] || "");
        var e = state.catalog.filter(function (x) { return String(x.id) === String(id); })[0];
        var rid = e ? e.id : Number(id);
        var i = state.favorites.indexOf(rid);
        if (i >= 0) { state.favorites.splice(i, 1); toast("已取消收藏"); }
        else { state.favorites.push(rid); toast("已收藏"); }
        set(K.fav, state.favorites);
        fav.classList.toggle("on", i < 0);
        fav.innerHTML = ICONS.heart + (i < 0 ? "已收藏" : "收藏");
        return;
      }
      var v = ev.target.closest("#videoBtn");
      if (v) {
        toggleVideo(v.getAttribute("data-bv"), v.getAttribute("data-url"));
        return;
      }
      var ext = ev.target.closest("#videoExt");
      if (ext) openExternal(ext.getAttribute("data-url"));
    });
    $("mineGroup1").addEventListener("click", function (ev) {
      var r = ev.target.closest(".row"); if (!r) return;
      var a = r.getAttribute("data-act");
      if (a === "fav") location.hash = "#/fav";
      else if (a === "history") location.hash = "#/history";
      else if (a === "comments") location.hash = "#/mycomments";
      else if (a === "works") toast("我的作品：后续开放");
    });
    $("mineGroup2").addEventListener("click", function (ev) {
      var r = ev.target.closest(".row"); if (!r) return;
      var a = r.getAttribute("data-act");
      if (a === "clear") {
        for (var i = 1; i <= 12; i++) del(K.content + i);
        state.contentCache = {}; toast("已清除正文缓存");
      } else if (a === "about") toast("简单做饭 v1.3.0 · 内容来自网站同步");
    });
    $("shopList").addEventListener("click", function (ev) {
      var r = ev.target.closest("[data-url]"); if (r) openExternal(r.getAttribute("data-url"));
    });
    window.addEventListener("hashchange", route);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !state.syncing) sync(false);
    });
  }

  /* ---------------- 启动 ---------------- */
  loadLocal();
  ImageCache.reload();   // 部分 ROM 上 JS 桥注入稍晚，启动时再读一次已缓存列表
  renderNav(); renderChips(); bind();
  if (!location.hash) location.hash = "#/home";
  route();
  warmImages();   // 用内置目录先启动后台补图，不必等同步返回
  sync(false);
  if (window.AndroidBridge && window.AndroidBridge.checkUpdate && state.site.updateUrl) {
    window.AndroidBridge.checkUpdate(state.site.updateUrl);   // 静默检查 APK 新版本
  }
})();
