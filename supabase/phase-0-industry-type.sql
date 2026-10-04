-- Anulus AI - Fase 0: rubro documental por organizacion.
-- Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.organizations
  add column if not exists industry_type text not null default 'general';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_industry_type_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_industry_type_check
      check (
        industry_type in (
          'general',
          'legal',
          'escribania',
          'gestoria',
          'inmobiliaria',
          'empresa',
          'contable',
          'drogueria',
          'farma',
          'industria',
          'compliance',
          'seguridad_documental'
        )
      );
  end if;
end $$;

-- Deja una organizacion de prueba en rubro legal si encuentra una demo/legal.
-- Si no encuentra ninguna, no modifica datos.
with legal_pilot as (
  select id
  from public.organizations
  where lower(name) like '%demo%'
     or lower(name) like '%legal%'
     or lower(name) like '%jurid%'
  order by created_at asc
  limit 1
)
update public.organizations
set industry_type = 'legal'
where id in (select id from legal_pilot);

commit;
