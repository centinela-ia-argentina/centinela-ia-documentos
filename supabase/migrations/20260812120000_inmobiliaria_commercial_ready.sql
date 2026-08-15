-- Migration: 20260812120000_inmobiliaria_commercial_ready

-- 1. Add location and publication fields to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS subzone text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publication_status text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publication_url_mercadolibre text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publication_url_zonaprop text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publication_url_argenprop text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publication_url_other text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS publication_notes text;

-- 2. Add location preference fields to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS desired_province text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS desired_city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS desired_neighborhood text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS desired_subzone text;

-- 3. Create property_comparables table
CREATE TABLE IF NOT EXISTS property_comparables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid null references properties(id) on delete cascade,
  property_type text,
  province text,
  city text,
  neighborhood text,
  subzone text,
  address text,
  surface_total_m2 numeric,
  surface_covered_m2 numeric,
  rooms numeric,
  price numeric not null,
  currency text not null,
  source_name text,
  source_url text,
  reference_date date,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);

-- 4. Enable RLS on property_comparables
ALTER TABLE property_comparables ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to be idempotent
DROP POLICY IF EXISTS "Admin and Employee can CRUD property_comparables in their organization" ON property_comparables;
DROP POLICY IF EXISTS "Auditor can read property_comparables in their organization" ON property_comparables;

CREATE POLICY "Admin and Employee can CRUD property_comparables in their organization"
ON property_comparables FOR ALL
USING (
  organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'employee') AND profiles.status = 'active')
)
WITH CHECK (
  organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'employee') AND profiles.status = 'active')
  AND (
    property_comparables.property_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM properties p
      WHERE p.id = property_comparables.property_id
        AND p.organization_id = property_comparables.organization_id
    )
  )
);

CREATE POLICY "Auditor can read property_comparables in their organization"
ON property_comparables FOR SELECT
USING (
  organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'auditor' AND profiles.status = 'active')
);

-- 5. Add indexes
CREATE INDEX IF NOT EXISTS property_comparables_organization_id_idx ON property_comparables (organization_id);
CREATE INDEX IF NOT EXISTS property_comparables_property_id_idx ON property_comparables (property_id);
