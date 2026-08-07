-- Add table for scraped products from affiliate category URLs
CREATE TABLE IF NOT EXISTS scraped_affiliate_products (
  id SERIAL PRIMARY KEY,
  affiliate_product_id INTEGER REFERENCES affiliate_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price TEXT,
  original_price TEXT,
  discount TEXT,
  rating REAL,
  review_count INTEGER,
  image_url TEXT,
  product_url TEXT NOT NULL,
  availability TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_scraped_products_affiliate_id ON scraped_affiliate_products(affiliate_product_id);

-- Add last_scraped_at to affiliate_products to track when we last fetched data
ALTER TABLE affiliate_products ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP;
ALTER TABLE affiliate_products ADD COLUMN IF NOT EXISTS scrape_enabled BOOLEAN DEFAULT true;
