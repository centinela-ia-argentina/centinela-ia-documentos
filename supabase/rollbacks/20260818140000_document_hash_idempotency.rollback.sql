BEGIN; DROP INDEX IF EXISTS public.documents_unique_case_hash; DROP INDEX IF EXISTS public.documents_unique_general_hash; ALTER TABLE public.documents DROP COLUMN IF EXISTS file_hash; COMMIT; 
