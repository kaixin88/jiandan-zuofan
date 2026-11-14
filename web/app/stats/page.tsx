import type { Metadata } from "next";
import StatsBoard from "@/components/StatsBoard";

export const metadata: Metadata = {
  title: "站点统计",
  description: "简单做饭站点访问与 APP 数据看板",
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return <StatsBoard />;
}
