"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

function Icon({ name }: { name: "home" | "grid" | "heart" | "user" | "search" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "home")
    return (
      <svg {...common}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    );
  if (name === "grid")
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </svg>
    );
  if (name === "heart")
    return (
      <svg {...common}>
        <path d="M12 20s-7.5-4.6-7.5-9.5A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z" />
      </svg>
    );
  if (name === "search")
    return (
      <svg {...common}>
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="m15.5 15.5 4.2 4.2" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.6-3.6 3.5-5.6 7.2-5.6s6.6 2 7.2 5.6" />
    </svg>
  );
}

export default function TopNav() {
  const { user, supabase, loading } = useAuth();

  return (
    <>
      <nav className="topnav">
        <Link href="/">菜谱</Link>
        <Link href="/favorites">收藏</Link>
        <Link href="/submit">提菜谱</Link>
        {loading ? null : user ? (
          <>
            <Link href="/account">
              {(user.user_metadata?.nickname as string) ||
                (user.email ?? "我").split("@")[0]}
            </Link>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => supabase.auth.signOut()}
            >
              退出
            </button>
          </>
        ) : (
          <Link href="/login" className="btn primary sm">
            登录
          </Link>
        )}
      </nav>

      <Link href="/#search" className="mobile-search" aria-label="搜索菜谱">
        <Icon name="search" />
      </Link>
    </>
  );
}

/** 底部 Tab 必须挂在 header 之外：顶栏的 backdrop-filter 会让 fixed 定位以顶栏为基准 */
export function BottomTab() {
  const { user } = useAuth();
  const pathname = usePathname() || "/";

  const tabs = [
    { href: "/", label: "首页", icon: "home" as const, on: pathname === "/" },
    { href: "/#cats", label: "分类", icon: "grid" as const, on: false },
    { href: "/favorites", label: "收藏", icon: "heart" as const, on: pathname.startsWith("/favorites") },
    { href: user ? "/account" : "/login", label: "我的", icon: "user" as const, on: pathname.startsWith("/account") || pathname.startsWith("/login") },
  ];

  return (
    <nav className="apptab" aria-label="底部导航">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={t.on ? "on" : undefined}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
