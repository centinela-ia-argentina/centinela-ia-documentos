BEGIN;

-- Add event_date safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'case_events' AND column_name = 'event_date') THEN
        ALTER TABLE public.case_events ADD COLUMN event_date date;
        
        -- Backfill existing rows
        UPDATE public.case_events SET event_date = created_at::date WHERE event_date IS NULL;
        
        -- Impose NOT NULL constraint
        ALTER TABLE public.case_events ALTER COLUMN event_date SET NOT NULL;
    END IF;
END $$;

-- Add title safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'case_events' AND column_name = 'title') THEN
        ALTER TABLE public.case_events ADD COLUMN title text;
        
        -- Backfill existing rows
        UPDATE public.case_events SET title = event_type WHERE title IS NULL;
        
        -- Impose NOT NULL constraint
        ALTER TABLE public.case_events ALTER COLUMN title SET NOT NULL;
    END IF;
END $$;

-- Add indices
CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON public.case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_organization_id ON public.case_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_events_event_date ON public.case_events(event_date);

NOTIFY pgrst, 'reload schema';

COMMIT;
