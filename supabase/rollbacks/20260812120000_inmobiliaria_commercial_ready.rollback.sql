-- Rollback: 20260812120000_inmobiliaria_commercial_ready

-- 1. Drop property_comparables table and its policies
DROP TABLE IF EXISTS property_comparables CASCADE;

-- 2. Remove location preference fields from clients
ALTER TABLE clients DROP COLUMN IF EXISTS desired_province;
ALTER TABLE clients DROP COLUMN IF EXISTS desired_city;
ALTER TABLE clients DROP COLUMN IF EXISTS desired_neighborhood;
ALTER TABLE clients DROP COLUMN IF EXISTS desired_subzone;

-- 3. Remove location and publication fields from properties
ALTER TABLE properties DROP COLUMN IF EXISTS province;
ALTER TABLE properties DROP COLUMN IF EXISTS city;
ALTER TABLE properties DROP COLUMN IF EXISTS neighborhood;
ALTER TABLE properties DROP COLUMN IF EXISTS subzone;
ALTER TABLE properties DROP COLUMN IF EXISTS publication_status;
ALTER TABLE properties DROP COLUMN IF EXISTS publication_url_mercadolibre;
ALTER TABLE properties DROP COLUMN IF EXISTS publication_url_zonaprop;
ALTER TABLE properties DROP COLUMN IF EXISTS publication_url_argenprop;
ALTER TABLE properties DROP COLUMN IF EXISTS publication_url_other;
ALTER TABLE properties DROP COLUMN IF EXISTS publication_notes;
