-- Anulus AI - Fase 1: campos y estados del expediente por rubro.
-- Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.cases
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.cases
set metadata = '{}'::jsonb
where metadata is null;

alter table public.cases
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.cases
  alter column status set default 'Activo';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cases_status_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases drop constraint cases_status_check;
  end if;
end $$;

alter table public.cases
  add constraint cases_status_check
  check (
    status in (
      'Activo',
      'En trámite',
      'Con observaciones',
      'Archivado',
      'new',
      'in_review',
      'incomplete',
      'waiting_client',
      'complete',
      'completed',
      'archived'
    )
  );

commit;
