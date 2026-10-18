-- 同频 Together · 在新的 Supabase 项目 SQL Editor 中执行一次。
-- 时间存为 timestamptz；客户端按访问者设备时区显示。
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 30),
  friend_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  created_at timestamptz not null default now()
);
create table public.contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,contact_id),
  check(owner_id <> contact_id)
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 80),
  category text not null check(category in ('tennis','dance','fitness','social','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '' check(char_length(location)<=200),
  notes text not null default '' check(char_length(notes)<=2000),
  visibility text not null default 'private' check(visibility in ('private','selected','public')),
  created_at timestamptz not null default now(),
  check(ends_at>starts_at and ends_at<=starts_at+interval '7 days')
);
create table public.event_shares (
  event_id uuid not null references public.events(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  primary key(event_id,viewer_id)
);
create index events_owner_time on public.events(owner_id,starts_at);
create index events_time on public.events(starts_at);
create index shares_viewer on public.event_shares(viewer_id,event_id);
create index contacts_target on public.contacts(contact_id);

create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),30),''),'同频新朋友'));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_user();
-- 允许先注册过测试账号的项目接入。
insert into public.profiles(id,display_name)
select id,coalesce(nullif(left(trim(raw_user_meta_data->>'display_name'),30),''),'同频新朋友') from auth.users
on conflict(id) do nothing;

-- 辅助函数放在非公开 API schema，避免策略互相查询造成递归。
create function private.owns_event(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.events e where e.id=p_id and e.owner_id=auth.uid());
$$;
create function private.can_read_event(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.events e where e.id=p_id and (
      e.owner_id=auth.uid() or e.visibility='public' or
      (e.visibility='selected' and exists(select 1 from public.event_shares s where s.event_id=e.id and s.viewer_id=auth.uid()))
    )
  );
$$;
create function private.can_read_profile(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    p_id=auth.uid() or exists(select 1 from public.contacts c where c.owner_id=auth.uid() and c.contact_id=p_id) or
    exists(select 1 from public.events e where e.owner_id=p_id and private.can_read_event(e.id))
  );
$$;
revoke all on function private.new_user(),private.owns_event(uuid),private.can_read_event(uuid),private.can_read_profile(uuid) from public,anon;
grant execute on function private.owns_event(uuid),private.can_read_event(uuid),private.can_read_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.events enable row level security;
alter table public.event_shares enable row level security;
revoke all on public.profiles,public.contacts,public.events,public.event_shares from anon,authenticated;
grant select on public.profiles,public.contacts,public.events,public.event_shares to authenticated;
grant update(display_name) on public.profiles to authenticated;
-- 账号资料由触发器建立；联系人和分享仅通过事务 RPC 修改。
grant insert,update,delete on public.events to authenticated;

create policy profile_read on public.profiles for select to authenticated using(private.can_read_profile(id));
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy contacts_read on public.contacts for select to authenticated using(owner_id=(select auth.uid()));
create policy event_read on public.events for select to authenticated using(private.can_read_event(id));
create policy event_insert on public.events for insert to authenticated with check(owner_id=(select auth.uid()));
create policy event_update on public.events for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy event_delete on public.events for delete to authenticated using(owner_id=(select auth.uid()));
create policy shares_read on public.event_shares for select to authenticated using(viewer_id=(select auth.uid()) or private.owns_event(event_id));

create function public.add_contact(p_code text) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); target uuid;
begin
  if me is null then raise exception '请先登录'; end if;
  if char_length(trim(p_code))<>12 then raise exception '好友码应为 12 位'; end if;
  select id into target from public.profiles where friend_code=upper(trim(p_code));
  if target is null then raise exception '没有找到这个好友码，请检查后重试'; end if;
  if target=me then raise exception '这是你自己的好友码'; end if;
  -- 和保存/撤销分享共用每个发布者的事务锁，防止并发重新授权。
  perform pg_advisory_xact_lock(hashtextextended(me::text,0));
  insert into public.contacts(owner_id,contact_id) values(me,target) on conflict do nothing;
end; $$;

create function public.remove_contact(p_contact uuid) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
  if me is null then raise exception '请先登录'; end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text,0));
  delete from public.event_shares s using public.events e where s.event_id=e.id and e.owner_id=me and s.viewer_id=p_contact;
  delete from public.contacts where owner_id=me and contact_id=p_contact;
end; $$;

-- 日程内容和指定可见名单在同一事务内保存，避免部分更新/撤销失败。
create function public.save_event(
  p_id uuid, p_title text, p_category text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text, p_notes text, p_visibility text, p_viewers uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); v_event_id uuid; viewers uuid[]:=coalesce(p_viewers,'{}');
begin
  if me is null then raise exception '请先登录'; end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text,0));
  if p_visibility='selected' and cardinality(viewers)=0 then raise exception '请至少选择一位好友'; end if;
  if cardinality(viewers)>50 then raise exception '单个活动最多分享给 50 位好友'; end if;
  if exists(select 1 from unnest(viewers) v where v is null or not exists(select 1 from public.contacts c where c.owner_id=me and c.contact_id=v)) then
    raise exception '只能分享给已添加的好友';
  end if;
  if p_id is null then
    insert into public.events(owner_id,title,category,starts_at,ends_at,location,notes,visibility)
    values(me,trim(p_title),p_category,p_starts_at,p_ends_at,coalesce(p_location,''),coalesce(p_notes,''),p_visibility) returning id into v_event_id;
  else
    update public.events set title=trim(p_title),category=p_category,starts_at=p_starts_at,ends_at=p_ends_at,
      location=coalesce(p_location,''),notes=coalesce(p_notes,''),visibility=p_visibility where id=p_id and owner_id=me returning id into v_event_id;
    if v_event_id is null then raise exception '日程不存在或你无权修改'; end if;
  end if;
  delete from public.event_shares where event_id=v_event_id;
  if p_visibility='selected' then
    insert into public.event_shares(event_id,viewer_id) select v_event_id,v from (select distinct unnest(viewers) v) recipients;
  end if;
  return v_event_id;
end; $$;
revoke all on function public.add_contact(text),public.remove_contact(uuid),public.save_event(uuid,text,text,timestamptz,timestamptz,text,text,text,uuid[]) from public,anon;
grant execute on function public.add_contact(text),public.remove_contact(uuid),public.save_event(uuid,text,text,timestamptz,timestamptz,text,text,text,uuid[]) to authenticated;

commit;
