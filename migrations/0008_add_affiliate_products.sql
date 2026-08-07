-- Add affiliate_products table
CREATE TABLE IF NOT EXISTS affiliate_products (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT,
  source TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert initial affiliate products from the provided links (only if table is empty)
INSERT INTO affiliate_products (title, url, description, source, category, is_active)
SELECT * FROM (VALUES
  ('Noon Product 1', 'https://s.noon.com/0Hvn2lWp3V8', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Noon Product 2', 'https://s.noon.com/ttanJfyoYxI', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Noon Product 3', 'https://s.noon.com/QBfKGfCc5cA', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Noon Product 4', 'https://s.noon.com/XvfIreZO8vo', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Amazon Product 1', 'https://amzn.to/3LxdRyj', 'Affiliate product from Amazon', 'amazon', 'general', true),
  ('Amazon Product 2', 'https://amzn.to/49Ie2Rg', 'Affiliate product from Amazon', 'amazon', 'general', true),
  ('Amazon Product 3', 'https://amzn.to/47PrWyI', 'Affiliate product from Amazon', 'amazon', 'general', true)
) AS v(title, url, description, source, category, is_active)
WHERE NOT EXISTS (SELECT 1 FROM affiliate_products LIMIT 1);
