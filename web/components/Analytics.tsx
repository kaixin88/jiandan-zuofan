"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/** 全站 PV 埋点：每次路由变化上报一次，不采集任何表单内容。 */
export default function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    track("pv", { path: pathname || window.location.pathname });
  }, [pathname]);
  return null;
}
