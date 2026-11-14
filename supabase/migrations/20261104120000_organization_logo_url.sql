-- Migration: 20261104120000_organization_logo_url
-- Fuentes: bloque AJ-T04 (logo de organizacion en el shell, bloque de cuenta)
-- Restaura la columna logo_url en organizations y el bucket publico branding,
-- perdidos junto con las fuentes de la segunda ronda (candidato unificado).

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text;

-- El bucket es publico: el logo se muestra en el shell sin sesion.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- El bucket se aloja por carpeta de organizacion (org_id/logo.png),
-- sin policies de fila: es publico de lectura.
-- La escritura se realiza con la service role desde la server action,
-- como el resto de las acciones administrativas.

NOTIFY pgrst, 'reload schema';

COMMIT;
