/**
 * Cloudflare Pages Function：站点统计采集端点 POST /api/hit
 *
 * 为什么用 Pages Functions 而不是独立 Worker：
 *   项目里的 CF API Token 只有 Pages 编辑权限；Functions 随 `wrangler pages deploy out`
 *   一起发布，且在边缘运行时能读到 CF-Connecting-IP（真实访客 IP）。
 *
 * 需要的环境变量（CF Dashboard → Pages → caipu → Settings → Environment variables，
 * 或用 `npx wrangler pages secret put NAME --project-name=caipu`）：
 *   SUPABASE_URL           你的 Supabase 项目 URL
 *   SUPABASE_SERVICE_KEY   service_role key（只放服务端，绝不进前端）
 *   IP_SALT                任意随机串，用于 IP 脱敏哈希（设定后不要改，否则历史 IP 口径断裂）
 *
 * 隐私：不落明文 IP，只存 sha256(ip + salt) 前 32 位；ua 只保留前 180 字符。
 */
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  IP_SALT: string;
}

const KINDS = new Set(["pv", "app_download", "app_install", "app_open"]);
const ALLOW_ORIGIN = "https://modianyu.top";

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  // APP 是 file:// WebView，Origin 为 "null"，也要放行
  const allow = origin === ALLOW_ORIGIN || origin === "https://www.modianyu.top"
    ? origin
    : origin === "null" ? "null" : ALLOW_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode((ip || "unknown") + "|" + (salt || ""))
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export const onRequestOptions = async ({ request }: { request: Request }) =>
  new Response(null, { status: 204, headers: cors(request) });

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  const headers = cors(request);
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return new Response("server not configured", { status: 503, headers });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind || "pv");
    if (!KINDS.has(kind)) {
      return new Response("bad kind", { status: 400, headers });
    }
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ip_hash = await hashIp(ip, env.IP_SALT);
    const row = {
      kind,
      ip_hash,
      visitor_id: String(body.visitor_id || "").slice(0, 80) || null,
      path: String(body.path || "").slice(0, 200) || null,
      app_version: String(body.app_version || "").slice(0, 40) || null,
      ua: (request.headers.get("User-Agent") || "").slice(0, 180) || null,
    };
    const r = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/site_events", {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      return new Response("upstream " + r.status, { status: 502, headers });
    }
    return new Response("ok", {
      status: 200,
      headers: { ...headers, "Cache-Control": "no-store" },
    });
  } catch {
    // 采集失败绝不能影响页面本身
    return new Response("bad request", { status: 400, headers });
  }
};
