-- Rollback: 20261104120000_organization_logo_url
-- Nota: el bucket 'branding' se conserva (la API de Storage no permite
-- delete directo desde SQL y no bloquea el revert de la columna).

BEGIN;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS logo_url;

NOTIFY pgrst, 'reload schema';

COMMIT;
