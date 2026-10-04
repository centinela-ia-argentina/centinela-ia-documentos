-- Anulus AI - Fase 1 B.1: estados value/label de expedientes.
-- Ejecutar una vez en Supabase SQL Editor.

-- Paso 0: diagnostico antes de normalizar.
select distinct status
from public.cases
order by status;

begin;

alter table public.cases
  alter column status set default 'active';

-- Normalizacion de datos que pudieron guardarse como labels visibles.
update public.cases
set status = 'active'
where status = 'Activo';

update public.cases
set status = 'archived'
where status = 'Archivado';

update public.cases
set status = 'in_review'
where status in ('En tramite', 'En trámite')
   or status like 'En tr%mite';

commit;

-- Verificacion posterior: deberian quedar codigos, no labels.
select distinct status
from public.cases
order by status;
