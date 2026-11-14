/** 站点统计埋点（浏览器 / APP WebView 通用）。失败静默，绝不影响页面。 */
export type HitKind = "pv" | "app_download" | "app_install" | "app_open";

const VISITOR_KEY = "visitor_id";
// APP 的 WebView 是 file://，必须用绝对地址；网站内用相对地址即可
const ENDPOINT = typeof window !== "undefined" && window.location.protocol === "file:"
  ? "https://modianyu.top/api/hit"
  : "/api/hit";

export function visitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function track(
  kind: HitKind,
  extra: { path?: string; app_version?: string } = {}
) {
  if (typeof window === "undefined") return;
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        visitor_id: visitorId(),
        path: extra.path ?? window.location.pathname,
        app_version: extra.app_version ?? "",
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 忽略 */
  }
}
