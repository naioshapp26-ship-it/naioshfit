-- Create table for storing marketing tracking configuration
CREATE TABLE IF NOT EXISTS tracking_settings (
  id SERIAL PRIMARY KEY,
  meta_pixel_id TEXT,
  meta_pixel_access_token TEXT,
  meta_pixel_test_event_code TEXT,
  google_ads_conversion_id TEXT,
  google_ads_conversion_label TEXT,
  google_ads_send_to TEXT,
  google_analytics_measurement_id TEXT,
  google_analytics_api_secret TEXT,
  google_analytics_stream_id TEXT,
  google_analytics_property_id TEXT,
  updated_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed with a single empty row to simplify admin updates
INSERT INTO tracking_settings (
  meta_pixel_id,
  meta_pixel_access_token,
  meta_pixel_test_event_code,
  google_ads_conversion_id,
  google_ads_conversion_label,
  google_ads_send_to,
  google_analytics_measurement_id,
  google_analytics_api_secret,
  google_analytics_stream_id,
  google_analytics_property_id
)
SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM tracking_settings);
