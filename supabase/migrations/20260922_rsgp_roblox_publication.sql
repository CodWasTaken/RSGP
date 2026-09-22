-- Roblox owner authorization and image publication; apply after generated_assets migration.
-- No plaintext OAuth tokens or API keys are stored in Postgres.
create table public.roblox_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  roblox_user_id text not null check (roblox_user_id ~ '^[1-9][0-9]{0,19}$'),
  roblox_username text,
  access_cipher text not null,
  refresh_cipher text not null,
  access_expires_at timestamptz not null,
  status text not null default 'connected' check (status in ('connected','refreshing','needs_reconnect')),
  refresh_claimed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.roblox_connections enable row level security;
-- Users see connection identity only via the owner-verified server endpoint.
create table public.roblox_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  verifier_cipher text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.roblox_oauth_states enable row level security;
create index roblox_oauth_state_expiry_idx on public.roblox_oauth_states(expires_at);

alter table public.generated_assets
  add column publication_status text not null default 'not_published'
    check (publication_status in (
      'not_published','uploading','submitted','pending_moderation',
      'approved','manual_unverified','failed','needs_reconciliation'
    )),
  add column upload_operation text,
  add column roblox_asset_id text check (roblox_asset_id is null or roblox_asset_id ~ '^[1-9][0-9]{0,19}$'),
  add column roblox_owner_id text check (roblox_owner_id is null or roblox_owner_id ~ '^[1-9][0-9]{0,19}$'),
  add column publication_requested_at timestamptz,
  add column publication_error_code text;
alter table public.commands drop constraint if exists commands_kind_check;
alter table public.commands add constraint commands_kind_check
  check (kind in ('create_part','create_script','create_gui','install_image','inspect_project'));
-- For an install_image command the server reads the source asset from the bound project.
alter table public.commands add column source_asset_id uuid references public.generated_assets(id) on delete set null;
create index commands_source_asset_idx on public.commands(source_asset_id) where source_asset_id is not null;
