BEGIN;

-- Remove the trigger and function created by this migration
DROP TRIGGER IF EXISTS trg_check_checklist_item_org_drift_repair ON public.checklist_items;
DROP FUNCTION IF EXISTS public.check_checklist_item_org_drift_repair();

-- Drop organization_id ONLY IF it was added by this migration
DO $$
DECLARE
  v_comment text;
BEGIN
  SELECT d.description INTO v_comment
  FROM pg_class c
  JOIN pg_attribute a ON c.oid = a.attrelid
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
  WHERE c.relname = 'checklist_items' 
    AND c.relnamespace = 'public'::regnamespace 
    AND a.attname = 'organization_id';

  IF v_comment = 'added_by_drift_repair' THEN
    ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_organization_id_fkey_drift;
    ALTER TABLE public.checklist_items DROP COLUMN organization_id;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
