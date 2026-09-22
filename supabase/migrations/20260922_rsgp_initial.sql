-- RSGP schema. The project owner approved repurposing RobloxGPT Community Dev on 2026-09-22.
-- Check table and migration inventory before applying; this SQL creates tables, never deletes old data.
create extension if not exists pgcrypto;
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(name) between 2 and 80),
 created_at timestamptz not null default now()
);
create index projects_owner on public.projects(owner_id,created_at desc);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('user','assistant')),
 content text not null check (length(content) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index messages_project on public.messages(project_id,created_at);
create table public.pairing_codes (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 code_hash text not null unique check (length(code_hash)=64),
 expires_at timestamptz not null,
 claimed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.studio_connections (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique check (length(token_hash)=64),
 studio_id text not null check (length(studio_id) between 1 and 100),
 label text not null check (length(label) between 1 and 80),
 active boolean not null default true,
 last_seen_at timestamptz,
 created_at timestamptz not null default now()
);
create index connections_project on public.studio_connections(project_id,active,last_seen_at desc);
create table public.commands (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid references public.studio_connections(id) on delete set null,
 kind text not null check (kind in ('create_part','create_script','create_gui')),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 status text not null default 'pending_approval' check (status in ('pending_approval','queued','leased','completed','failed')),
 result jsonb,
 lease_expires_at timestamptz,
 created_at timestamptz not null default now()
);
create index commands_connection on public.commands(connection_id,status,created_at);
create index commands_project on public.commands(project_id,created_at desc);
alter table public.projects enable row level security;
alter table public.messages enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.studio_connections enable row level security;
alter table public.commands enable row level security;
create policy projects_owner_read on public.projects for select to authenticated using (owner_id=(select auth.uid()));
create policy messages_owner_read on public.messages for select to authenticated using (owner_id=(select auth.uid()) and exists (select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy commands_owner_read on public.commands for select to authenticated using (owner_id=(select auth.uid()) and exists (select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy connections_owner_read on public.studio_connections for select to authenticated using (owner_id=(select auth.uid()) and exists (select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
-- No authenticated client writes; server verifies auth and ownership and uses service role.
