-- Fifth additive RSGP migration: one-operation undo for newly tagged Studio roots.
-- Legacy RGPT tables and existing RSGP command rows remain untouched.
alter table public.commands drop constraint if exists commands_kind_check;
alter table public.commands add constraint commands_kind_check
 check (kind in ('create_part','create_script','create_gui','install_image','inspect_project','undo_command'));

alter table public.commands add column source_command_id uuid references public.commands(id) on delete set null;
create index commands_source_command_idx on public.commands(source_command_id) where source_command_id is not null;
-- Avoid duplicate unresolved undo proposals even under simultaneous API requests.
create unique index commands_one_unresolved_undo_idx on public.commands(source_command_id)
 where kind='undo_command' and status in ('pending_approval','queued','leased','needs_reconciliation');
