-- 1. FIX COMPOSITE FK ON DELETE SET NULL (Postgres 15+ supports column list for SET NULL)
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_property_fk;
ALTER TABLE public.cases ADD CONSTRAINT cases_property_fk
FOREIGN KEY (property_id, organization_id) REFERENCES public.properties(id, organization_id) ON DELETE SET NULL (property_id);

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_doc;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_org_match_doc
FOREIGN KEY (document_id, organization_id) REFERENCES public.documents(id, organization_id) ON DELETE SET NULL (document_id);

-- 2. ADD MISSING RELATIONS
-- case_events -> cases
ALTER TABLE public.case_events DROP CONSTRAINT IF EXISTS case_events_case_fk;
ALTER TABLE public.case_events ADD CONSTRAINT case_events_case_fk
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

-- reports -> cases
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_case_fk;
ALTER TABLE public.reports ADD CONSTRAINT reports_case_fk
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

-- 3. REVOKE DANGEROUS GRANTS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM public;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- Explicitly grant execute only to required routines for authenticated
GRANT EXECUTE ON FUNCTION public.get_user_profile TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_case_document_chunks TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_agenda_title TO authenticated, service_role;
-- Add any other specific routines here if needed

