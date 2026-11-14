/**
 * 成品图的 CDN 前缀（静态导出时在 build 阶段内联，运行时零开销）。
 *
 * 默认 "" = 图片和页面同域，读 /dishes/...（Cloudflare Pages）。
 * 把图片迁到独立图床后，只需在构建环境里设置：
 *   NEXT_PUBLIC_DISH_CDN=https://img.modianyu.top
 * 图床里保持同样的目录结构 /dishes/s/{id}.webp 与 /dishes/{id}.webp 即可，
 * 无需改动任何组件代码，也无需把 47MB 图片继续打进 Pages 部署包。
 */
const RAW = (process.env.NEXT_PUBLIC_DISH_CDN || "").replace(/\/+$/, "");

/** 图片内容或尺寸变化时 +1，用来绕开 CDN 的 immutable 长缓存 */
const ASSET_VERSION = "v=3";

export const DISH_CDN = RAW;

/** 列表 / 卡片用的方形小图 */
export function dishThumb(id: number | string): string {
  return `${RAW}/dishes/s/${id}.webp?${ASSET_VERSION}`;
}

/** 详情页用的宽幅成品图 */
export function dishLarge(id: number | string): string {
  return `${RAW}/dishes/${id}.webp?${ASSET_VERSION}`;
}
