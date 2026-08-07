-- Add affiliate categories table for dynamic category management
CREATE TABLE IF NOT EXISTS affiliate_categories (
  id SERIAL PRIMARY KEY,
  name_en TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert default categories
INSERT INTO affiliate_categories (name_en, name_ar, slug, is_active, display_order)
VALUES
  ('Supplements', 'مكملات غذائية', 'supplements', true, 1),
  ('Equipment', 'معدات رياضية', 'equipment', true, 2),
  ('Clothing & Apparel', 'ملابس رياضية', 'clothing', true, 3),
  ('Nutrition & Snacks', 'تغذية ووجبات خفيفة', 'nutrition', true, 4),
  ('Accessories', 'إكسسوارات', 'accessories', true, 5),
  ('Books & Guides', 'كتب وأدلة', 'books', true, 6),
  ('Technology & Wearables', 'تكنولوجيا وأجهزة ذكية', 'technology', true, 7),
  ('Recovery & Wellness', 'استشفاء وعناية', 'recovery', true, 8),
  ('Other', 'أخرى', 'other', true, 9)
ON CONFLICT (slug) DO NOTHING;

-- Update existing affiliate products to use slugs instead of hardcoded category names
UPDATE affiliate_products 
SET category = 'general' 
WHERE category IS NULL OR category = '';
