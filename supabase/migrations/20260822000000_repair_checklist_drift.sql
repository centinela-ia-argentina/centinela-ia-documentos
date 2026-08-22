-- Migration: 20260822000000_repair_checklist_drift.sql
-- Repair remote drift where checklist_items.organization_id is missing

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'checklist_items' 
      AND column_name = 'organization_id'
  ) THEN
    -- 1. Add column as nullable initially
    ALTER TABLE public.checklist_items ADD COLUMN organization_id uuid;

    -- 2. Backfill from checklists
    UPDATE public.checklist_items ci
    SET organization_id = c.organization_id
    FROM public.checklists c
    WHERE ci.checklist_id = c.id;

    -- 3. Abort if any NULL remains (orphaned checklist_item without a valid checklist)
    IF EXISTS (SELECT 1 FROM public.checklist_items WHERE organization_id IS NULL) THEN
      RAISE EXCEPTION 'Cannot complete drift repair: orphaned checklist_items exist (NULL organization_id).';
    END IF;

    -- 4. Abort if cross-organization document links exist
    IF EXISTS (
      SELECT 1 FROM public.checklist_items ci
      JOIN public.documents d ON ci.document_id = d.id
      WHERE ci.organization_id != d.organization_id
    ) THEN
      RAISE EXCEPTION 'Cannot complete drift repair: cross-organization document links exist.';
    END IF;

    -- 5. Set NOT NULL
    ALTER TABLE public.checklist_items ALTER COLUMN organization_id SET NOT NULL;

    -- 6. Add direct foreign key
    ALTER TABLE public.checklist_items 
      ADD CONSTRAINT checklist_items_organization_id_fkey_drift 
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

    -- 7. Mark column with comment to make rollback state-aware
    COMMENT ON COLUMN public.checklist_items.organization_id IS 'added_by_drift_repair';
  END IF;
END $$;

-- 8. Add function and trigger to guarantee future INSERT/UPDATE consistency
CREATE FUNCTION public.check_checklist_item_org_drift_repair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chk_org uuid;
  v_doc_org uuid;
BEGIN
  SELECT organization_id INTO v_chk_org FROM public.checklists WHERE id = NEW.checklist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist % does not exist', NEW.checklist_id;
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_chk_org;
  ELSIF NEW.organization_id IS DISTINCT FROM v_chk_org THEN
    RAISE EXCEPTION 'Checklist item organization_id (%) must match checklist organization_id (%)', NEW.organization_id, v_chk_org;
  END IF;

  IF NEW.document_id IS NOT NULL THEN
    SELECT organization_id INTO v_doc_org FROM public.documents WHERE id = NEW.document_id;
    IF v_doc_org IS DISTINCT FROM v_chk_org THEN
      RAISE EXCEPTION 'Checklist item document organization_id (%) must match checklist organization_id (%)', v_doc_org, v_chk_org;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Revoke direct execution privileges
REVOKE EXECUTE ON FUNCTION public.check_checklist_item_org_drift_repair() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_check_checklist_item_org_drift_repair
  BEFORE INSERT OR UPDATE ON public.checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_checklist_item_org_drift_repair();

-- 9. Reload PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
