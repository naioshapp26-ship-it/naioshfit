-- Keep legacy `name` and SaaS `company_name` columns in sync
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_name TEXT;

UPDATE tenants
SET name = company_name
WHERE name IS NULL AND company_name IS NOT NULL;

UPDATE tenants
SET company_name = name
WHERE company_name IS NULL AND name IS NOT NULL;
