-- Asset-generation slice. Apply after the initial and lease-reconciliation migrations.
-- Storage stays private; browser gets short-lived signed URLs only after project ownership check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rsgp-generated', 'rsgp-generated', false, 12582912, array['image/png'])
on conflict (id) do nothing;

create table public.generated_assets (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null check (provider_id = 'openai-image'),
  kind text not null check (kind in ('icon','thumbnail','texture','gui')),
  prompt text not null check (char_length(prompt) between 8 and 900),
  status text not null check (status in ('reserved','generating','ready','failed','needs_reconciliation')),
  storage_path text unique,
  mime_type text check (mime_type is null or mime_type = 'image/png'),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 12582912),
  error_code text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (status <> 'ready' or (storage_path is not null and sha256 is not null and size_bytes is not null))
);
create index generated_assets_project_idx on public.generated_assets (project_id, created_at desc);
create index generated_assets_user_window_idx on public.generated_assets (owner_id, created_at desc);
alter table public.generated_assets enable row level security;
create policy generated_assets_owner_read on public.generated_assets
  for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())
  ));

-- Only the server (service_role) may call this reservation function; it checks ownership,
-- locks a per-user counter, and creates a unique request record before any billable call.
create or replace function public.rsgp_reserve_image_generation(
  p_project_id uuid, p_owner_id uuid, p_request_id uuid, p_kind text, p_prompt text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_kind not in ('icon','thumbnail','texture','gui')
    or p_prompt is null or char_length(p_prompt) not between 8 and 900 then
    raise exception 'Invalid generation request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projects p where p.id = p_project_id and p.owner_id = p_owner_id
  ) then
    raise exception 'Project ownership mismatch' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_owner_id::text));
  select a.id into existing_id from public.generated_assets a where a.id = p_request_id;
  if existing_id is not null then
    -- Do not allow a caller to reuse another request ID, project or prompt.
    if not exists (
      select 1 from public.generated_assets a
      where a.id = p_request_id and a.project_id = p_project_id
        and a.owner_id = p_owner_id and a.kind = p_kind and a.prompt = p_prompt
    ) then
      raise exception 'Generation request ID collision' using errcode = '23505';
    end if;
    -- Idempotent duplicate is returned; the API must atomically claim 'reserved'.
    return existing_id;
  end if;
  if (select count(*) from public.generated_assets a
      where a.owner_id = p_owner_id and a.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Daily generation limit reached' using errcode = 'P0001';
  end if;
  if (select count(*) from public.generated_assets a
      where a.owner_id = p_owner_id and a.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Hourly generation limit reached' using errcode = 'P0001';
  end if;
  insert into public.generated_assets (id, project_id, owner_id, provider_id, kind, prompt, status)
  values (p_request_id, p_project_id, p_owner_id, 'openai-image', p_kind, p_prompt, 'reserved');
  return p_request_id;
end;
$$;
revoke all on function public.rsgp_reserve_image_generation(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.rsgp_reserve_image_generation(uuid, uuid, uuid, text, text) to service_role;
