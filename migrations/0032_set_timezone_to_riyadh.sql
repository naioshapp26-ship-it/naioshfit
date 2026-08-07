-- Migration 0032: Align timezones with Riyadh (GMT+3)
-- Set defaults to Asia/Riyadh and update existing UTC/null values for consistency.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'ad_campaigns' AND column_name = 'timezone'
	) THEN
		UPDATE ad_campaigns
		SET timezone = 'Asia/Riyadh'
		WHERE timezone IS NULL OR timezone = 'UTC';

		ALTER TABLE ad_campaigns
		ALTER COLUMN timezone SET DEFAULT 'Asia/Riyadh';
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'timezone'
	) THEN
		UPDATE tenants
		SET timezone = 'Asia/Riyadh'
		WHERE timezone IS NULL OR timezone = 'UTC';

		ALTER TABLE tenants
		ALTER COLUMN timezone SET DEFAULT 'Asia/Riyadh';
	END IF;
END $$;
