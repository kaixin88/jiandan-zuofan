-- ============================================================
-- 简单做饭 · 站点统计表 / 聚合函数 / 权限
-- 在 Supabase SQL Editor 里整体执行一次（secret key 只能做 DML，不能建表）。
-- 设计：明细表只写不读；匿名侧只能调用聚合 RPC，拿不到访客明细。
-- 执行前请确认当前 schema 里没有同名对象。
-- ============================================================

create table if not exists public.site_events (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  kind         text not null check (kind in ('pv','app_download','app_install','app_open')),
  ip_hash      text,                 -- sha256(ip + SALT) 前 32 位，不存明文 IP
  visitor_id   text,                 -- 浏览器 localStorage 生成的匿名 id
  path         text,
  app_version  text,
  ua           text
);

create index if not exists site_events_ts_idx   on public.site_events (ts desc);
create index if not exists site_events_kind_idx on public.site_events (kind, ts desc);

alter table public.site_events enable row level security;
-- 不给 anon/authenticated 任何直接 SELECT/INSERT：写入只由 Pages Function 用 service key 完成。
-- 若之前建过宽松策略，先清理：
drop policy if exists "anon insert events" on public.site_events;
drop policy if exists "anon read events"   on public.site_events;

-- ── 聚合 RPC：统计页唯一的数据入口 ──────────────────────────────
create or replace function public.site_stats(days int default 30)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select generate_series(
      (current_date - (least(greatest(days,1),90) - 1)::int),
      current_date,
      '1 day'::interval
    )::date as day
  ),
  daily as (
    select
      dd.day,
      count(*) filter (where e.kind = 'pv')                         as pv,
      count(distinct e.visitor_id) filter (where e.kind = 'pv')      as uv,
      count(distinct e.ip_hash)    filter (where e.kind = 'pv')      as ip
    from d dd
    left join public.site_events e
      on e.ts >= dd.day::timestamp
     and e.ts <  (dd.day + 1)::timestamp
    group by dd.day
    order by dd.day
  ),
  agg as (
    select
      count(*) filter (where kind='pv' and ts >= current_date)                        as today_pv,
      count(distinct visitor_id) filter (where kind='pv' and ts >= current_date)      as today_uv,
      count(distinct ip_hash)    filter (where kind='pv' and ts >= current_date)      as today_ip,
      count(*) filter (where kind='pv' and ts >= current_date - 29)                  as d30_pv,
      count(distinct visitor_id) filter (where kind='pv' and ts >= current_date - 29) as d30_uv,
      count(distinct ip_hash)    filter (where kind='pv' and ts >= current_date - 29) as d30_ip,
      count(*) filter (where kind='app_download' and ts >= current_date)              as app_download,
      count(*) filter (where kind='app_install'  and ts >= current_date)              as app_install,
      count(*) filter (where kind='app_open'     and ts >= current_date)              as app_open,
      count(distinct ip_hash) filter (where kind like 'app_%' and ts >= current_date) as app_ip,
      count(*) filter (where kind='app_download')                                     as app_download_total,
      count(*) filter (where kind='app_install')                                      as app_install_total
    from public.site_events
    where ts >= current_date - greatest(days, 30)
  )
  select json_build_object(
    'today_pv',  a.today_pv,  'today_uv',  a.today_uv,  'today_ip', a.today_ip,
    'd30_pv',    a.d30_pv,    'd30_uv',    a.d30_uv,    'd30_ip',   a.d30_ip,
    'app_download',       a.app_download,
    'app_install',        a.app_install,
    'app_open',           a.app_open,
    'app_ip',             a.app_ip,
    'app_download_total', a.app_download_total,
    'app_install_total',  a.app_install_total,
    'has_data', (select count(*) from public.site_events) > 0,
    'updated_at', now(),
    'daily', (select json_agg(json_build_object('day',day,'pv',pv,'uv',uv,'ip',ip)) from daily)
  )
  from agg a;
$$;

revoke all on function public.site_stats(int) from public;
grant execute on function public.site_stats(int) to anon, authenticated, service_role;
