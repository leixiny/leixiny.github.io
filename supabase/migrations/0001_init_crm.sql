-- 客户关系与任务管理系统初始化脚本
-- 在 Supabase Dashboard 的 SQL Editor 中一次性执行。
-- 覆盖：Auth 同步、组织/角色、客户/联系人/标签/任务/附件、活动日志、FTS、视图、RPC、RLS、Storage、Realtime。

create extension if not exists pgcrypto;

-- =========================
-- 1. 核心业务表
-- =========================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  email text not null,
  full_name text not null check (btrim(full_name) <> ''),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null check (btrim(company_name) <> ''),
  industry text,
  website text,
  status text not null default 'lead' check (status in ('lead', 'active', 'paused', 'churned')),
  expected_value numeric(14, 2) not null default 0 check (expected_value >= 0),
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(industry, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  color text not null default '#4f46e5' check (btrim(color) <> ''),
  created_at timestamptz not null default now()
);

-- 标签名在组织内唯一（按 lower 比较）；表达式唯一约束必须用唯一索引实现。
create unique index if not exists tags_org_name_unique on public.tags (organization_id, lower(name));

create table if not exists public.customer_tags (
  customer_id uuid not null references public.customers(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (btrim(title) <> ''),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_type text not null check (entity_type in ('customer', 'task')),
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- 2. 索引：对应列表搜索、筛选、关系跳转和实时高频查询
-- =========================
create index if not exists idx_profiles_organization on public.profiles(organization_id);
create index if not exists idx_members_profile on public.organization_members(profile_id);
create index if not exists idx_customers_org_status on public.customers(organization_id, status);
create index if not exists idx_customers_owner on public.customers(owner_id);
create index if not exists idx_customers_search on public.customers using gin(search_vector);
create index if not exists idx_contacts_customer on public.contacts(customer_id);
create unique index if not exists one_primary_contact_per_customer
  on public.contacts(customer_id)
  where is_primary;
create index if not exists idx_tags_organization on public.tags(organization_id);
create index if not exists idx_customer_tags_tag on public.customer_tags(tag_id);
create index if not exists idx_tasks_org_status_due on public.tasks(organization_id, status, due_at);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_customer on public.tasks(customer_id);
create index if not exists idx_documents_customer on public.customer_documents(customer_id);
create index if not exists idx_activity_org_created on public.activity_logs(organization_id, created_at desc);
create index if not exists idx_activity_customer on public.activity_logs(customer_id);

-- =========================
-- 3. 通用函数与业务 RPC
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.has_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and profile_id = auth.uid()
      and role = any(p_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_updated_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    full_name = coalesce(profiles.full_name, new.raw_user_meta_data ->> 'full_name'),
    avatar_url = coalesce(profiles.avatar_url, new.raw_user_meta_data ->> 'avatar_url')
  where id = new.id;

  return new;
end;
$$;

-- 兼容迁移前已经存在的 Auth 用户。
insert into public.profiles (id, email, full_name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

create or replace function public.set_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.log_entity_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := coalesce(auth.uid(), new.created_by);
  v_customer_id uuid;
  v_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'customers' then
    -- customers 表自身没有 customer_id 字段，活动关联的客户就是当前行
    v_customer_id := new.id;
    v_metadata := jsonb_build_object(
      'company_name', new.company_name,
      'status', new.status,
      'expected_value', new.expected_value
    );
  elsif tg_table_name = 'tasks' then
    v_customer_id := new.customer_id;
    v_metadata := jsonb_build_object(
      'title', new.title,
      'status', new.status,
      'priority', new.priority,
      'due_at', new.due_at
    );
  end if;

  insert into public.activity_logs (
    organization_id,
    customer_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new.organization_id,
    v_customer_id,
    v_actor_id,
    lower(tg_op),
    tg_argv[0],
    new.id,
    v_metadata
  );

  return new;
end;
$$;

create or replace function public.remove_document_storage()
returns trigger
language plpgsql
security definer
set search_path = storage, public
as $$
begin
  delete from storage.objects
  where bucket_id = 'customer-files'
    and name = old.storage_path;

  return old;
end;
$$;

-- 新注册用户创建并加入自己的组织。SECURITY DEFINER 保证组织、成员、资料更新在一个事务内完成。
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_org public.organizations;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '必须先登录';
  end if;

  if v_name = '' then
    raise exception '组织名称不能为空';
  end if;

  if exists (
    select 1 from public.organization_members where profile_id = v_user_id
  ) then
    raise exception '当前用户已经属于一个组织';
  end if;

  insert into public.organizations (name)
  values (v_name)
  returning * into v_org;

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org.id, v_user_id, 'owner');

  update public.profiles
  set organization_id = v_org.id
  where id = v_user_id;

  return v_org;
end;
$$;

create or replace function public.change_member_role(
  p_profile_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_old_role text;
  v_owner_count integer;
begin
  if auth.uid() is null then
    raise exception '必须先登录';
  end if;

  if p_role not in ('owner', 'admin', 'member') then
    raise exception '非法角色';
  end if;

  select organization_id, role
  into v_org_id, v_old_role
  from public.organization_members
  where profile_id = p_profile_id;

  if v_org_id is null then
    raise exception '成员不存在';
  end if;

  if not public.has_role(v_org_id, array['owner']) then
    raise exception '只有组织所有者可以调整角色';
  end if;

  if v_old_role = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count
    from public.organization_members
    where organization_id = v_org_id
      and role = 'owner';

    if v_owner_count <= 1 then
      raise exception '组织至少需要保留一个所有者';
    end if;
  end if;

  update public.organization_members
  set role = p_role
  where organization_id = v_org_id
    and profile_id = p_profile_id;
end;
$$;

create or replace function public.get_dashboard_stats()
returns table (
  customers_total bigint,
  active_customers bigint,
  open_tasks bigint,
  due_today bigint,
  overdue_tasks bigint,
  documents_total bigint,
  team_members_total bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.current_org_id();
begin
  if v_org_id is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select
    (select count(*) from public.customers where organization_id = v_org_id),
    (select count(*) from public.customers where organization_id = v_org_id and status = 'active'),
    (select count(*) from public.tasks where organization_id = v_org_id and status <> 'done'),
    (select count(*) from public.tasks
      where organization_id = v_org_id
        and status <> 'done'
        and due_at::date = current_date),
    (select count(*) from public.tasks
      where organization_id = v_org_id
        and status <> 'done'
        and due_at < now()),
    (select count(*) from public.customer_documents where organization_id = v_org_id),
    (select count(*) from public.organization_members where organization_id = v_org_id);
end;
$$;

-- =========================
-- 4. 触发器
-- =========================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_updated_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_completion on public.tasks;
create trigger trg_tasks_completion
  before insert or update on public.tasks
  for each row execute function public.set_task_completion();

drop trigger if exists trg_remove_document_storage on public.customer_documents;
create trigger trg_remove_document_storage
  before delete on public.customer_documents
  for each row execute function public.remove_document_storage();

drop trigger if exists trg_log_customer_activity on public.customers;
create trigger trg_log_customer_activity
  after insert or update on public.customers
  for each row execute function public.log_entity_activity('customer');

drop trigger if exists trg_log_task_activity on public.tasks;
create trigger trg_log_task_activity
  after insert or update on public.tasks
  for each row execute function public.log_entity_activity('task');

-- =========================
-- 5. 视图：客户详情页/客户列表聚合数据
-- =========================
create or replace view public.v_customer_summary
with (security_invoker = on)
as
select
  c.id,
  c.organization_id,
  c.company_name,
  c.industry,
  c.website,
  c.status,
  c.expected_value,
  c.notes,
  c.owner_id,
  c.created_by,
  c.created_at,
  c.updated_at,
  p.full_name as owner_name,
  count(distinct ct.id) as contact_count,
  count(distinct t.id) filter (where t.status <> 'done') as open_task_count,
  count(distinct cd.id) as document_count,
  max(al.created_at) as last_activity_at
from public.customers c
left join public.profiles p on p.id = c.owner_id
left join public.contacts ct on ct.customer_id = c.id
left join public.tasks t on t.customer_id = c.id
left join public.customer_documents cd on cd.customer_id = c.id
left join public.activity_logs al on al.customer_id = c.id
group by c.id, p.full_name;

-- =========================
-- 6. RLS：所有业务数据按 organization_id 隔离
-- =========================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.contacts enable row level security;
alter table public.tags enable row level security;
alter table public.customer_tags enable row level security;
alter table public.tasks enable row level security;
alter table public.customer_documents enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "organizations_select_member" on public.organizations;
drop policy if exists "organizations_update_manager" on public.organizations;
drop policy if exists "organizations_delete_owner" on public.organizations;
drop policy if exists "profiles_select_self_or_same_org" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "members_select_same_org" on public.organization_members;
drop policy if exists "customers_select_same_org" on public.customers;
drop policy if exists "customers_insert_same_org" on public.customers;
drop policy if exists "customers_update_same_org" on public.customers;
drop policy if exists "customers_delete_manager" on public.customers;
drop policy if exists "contacts_select_same_org" on public.contacts;
drop policy if exists "contacts_insert_same_org" on public.contacts;
drop policy if exists "contacts_update_same_org" on public.contacts;
drop policy if exists "contacts_delete_same_org" on public.contacts;
drop policy if exists "tags_select_same_org" on public.tags;
drop policy if exists "tags_insert_same_org" on public.tags;
drop policy if exists "tags_update_manager" on public.tags;
drop policy if exists "tags_delete_manager" on public.tags;
drop policy if exists "customer_tags_select_same_org" on public.customer_tags;
drop policy if exists "customer_tags_insert_same_org" on public.customer_tags;
drop policy if exists "customer_tags_delete_same_org" on public.customer_tags;
drop policy if exists "tasks_select_same_org" on public.tasks;
drop policy if exists "tasks_insert_same_org" on public.tasks;
drop policy if exists "tasks_update_same_org" on public.tasks;
drop policy if exists "tasks_delete_same_org" on public.tasks;
drop policy if exists "documents_select_same_org" on public.customer_documents;
drop policy if exists "documents_insert_same_org" on public.customer_documents;
drop policy if exists "documents_delete_owner_or_manager" on public.customer_documents;
drop policy if exists "activity_select_same_org" on public.activity_logs;
drop policy if exists "activity_insert_actor" on public.activity_logs;

create policy "organizations_select_member" on public.organizations
  for select to authenticated
  using (public.has_role(id, array['owner', 'admin', 'member']));

create policy "organizations_update_manager" on public.organizations
  for update to authenticated
  using (public.has_role(id, array['owner', 'admin']))
  with check (public.has_role(id, array['owner', 'admin']));

create policy "organizations_delete_owner" on public.organizations
  for delete to authenticated
  using (public.has_role(id, array['owner']));

create policy "profiles_select_self_or_same_org" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or organization_id = public.current_org_id()
  );

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      organization_id is null
      or organization_id = public.current_org_id()
    )
  );

create policy "members_select_same_org" on public.organization_members
  for select to authenticated
  using (public.has_role(organization_id, array['owner', 'admin', 'member']));

create policy "customers_select_same_org" on public.customers
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "customers_insert_same_org" on public.customers
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
  );

create policy "customers_update_same_org" on public.customers
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "customers_delete_manager" on public.customers
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']));

create policy "contacts_select_same_org" on public.contacts
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "contacts_insert_same_org" on public.contacts
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy "contacts_update_same_org" on public.contacts
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "contacts_delete_same_org" on public.contacts
  for delete to authenticated
  using (organization_id = public.current_org_id());

create policy "tags_select_same_org" on public.tags
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "tags_insert_same_org" on public.tags
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy "tags_update_manager" on public.tags
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']))
  with check (organization_id = public.current_org_id());

create policy "tags_delete_manager" on public.tags
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']));

create policy "customer_tags_select_same_org" on public.customer_tags
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_tags.customer_id
        and c.organization_id = public.current_org_id()
    )
  );

create policy "customer_tags_insert_same_org" on public.customer_tags
  for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_tags.customer_id
        and c.organization_id = public.current_org_id()
    )
    and exists (
      select 1 from public.tags t
      where t.id = customer_tags.tag_id
        and t.organization_id = public.current_org_id()
    )
  );

create policy "customer_tags_delete_same_org" on public.customer_tags
  for delete to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_tags.customer_id
        and c.organization_id = public.current_org_id()
    )
  );

create policy "tasks_select_same_org" on public.tasks
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "tasks_insert_same_org" on public.tasks
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
  );

create policy "tasks_update_same_org" on public.tasks
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "tasks_delete_same_org" on public.tasks
  for delete to authenticated
  using (organization_id = public.current_org_id());

create policy "documents_select_same_org" on public.customer_documents
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "documents_insert_same_org" on public.customer_documents
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and uploaded_by = auth.uid()
  );

create policy "documents_delete_owner_or_manager" on public.customer_documents
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.has_role(organization_id, array['owner', 'admin'])
  );

create policy "activity_select_same_org" on public.activity_logs
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "activity_insert_actor" on public.activity_logs
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and actor_id = auth.uid()
  );

-- =========================
-- 7. Storage：客户附件私有 Bucket
-- 对象路径：organization_id/customer_id/document_id-file_name
-- =========================
insert into storage.buckets (id, name, public, file_size_limit)
values ('customer-files', 'customer-files', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = 10485760;

drop policy if exists "customer_files_read_org_member" on storage.objects;
create policy "customer_files_read_org_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'customer-files'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'member'])
  );

drop policy if exists "customer_files_insert_org_member" on storage.objects;
create policy "customer_files_insert_org_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-files'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'member'])
    and exists (
      select 1
      from public.customers c
      where c.id = ((storage.foldername(name))[2])::uuid
        and c.organization_id = ((storage.foldername(name))[1])::uuid
    )
  );

drop policy if exists "customer_files_update_owner_or_manager" on storage.objects;
create policy "customer_files_update_owner_or_manager" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'customer-files'
    and (
      owner = auth.uid()
      or public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin'])
    )
  );

drop policy if exists "customer_files_delete_owner_or_manager" on storage.objects;
create policy "customer_files_delete_owner_or_manager" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'customer-files'
    and (
      owner = auth.uid()
      or public.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin'])
    )
  );

-- =========================
-- 8. Realtime：前端订阅这些表的变更
-- =========================
do $$ begin alter publication supabase_realtime add table public.customers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.activity_logs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.organization_members; exception when duplicate_object then null; end $$;

-- =========================
-- 9. 权限
-- =========================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.customer_tags to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, delete on public.customer_documents to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select on public.v_customer_summary to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.change_member_role(uuid, text) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
