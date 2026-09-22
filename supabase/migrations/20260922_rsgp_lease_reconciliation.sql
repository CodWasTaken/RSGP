-- Apply after 20260922_rsgp_initial.sql in a dedicated RSGP project.
-- A timed-out Studio operation is ambiguous: never put it back in the queue automatically.
alter table public.commands
  add column lease_id uuid;
alter table public.commands
  drop constraint if exists commands_status_check;
alter table public.commands
  add constraint commands_status_check check (
    status in ('pending_approval','queued','leased','needs_reconciliation','completed','failed')
  );
create index if not exists commands_expired_lease
  on public.commands (lease_expires_at)
  where status = 'leased';
