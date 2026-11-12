-- Rollback: 20261104120000_organization_logo_url

BEGIN;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS logo_url;

delete from storage.buckets where id = 'branding';

NOTIFY pgrst, 'reload schema';

COMMIT;
