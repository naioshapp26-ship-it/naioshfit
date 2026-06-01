-- Migration: Add Orders and Order Items tables
-- Created: 2026-01-11
-- Description: Complete purchase flow for products

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_country TEXT,
  shipping_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_price REAL NOT NULL,
  product_image_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Comments for documentation
COMMENT ON TABLE orders IS 'Customer orders for products';
COMMENT ON TABLE order_items IS 'Line items for each order';
COMMENT ON COLUMN orders.status IS 'Order status: pending, processing, shipped, delivered, cancelled';
COMMENT ON COLUMN orders.currency IS 'Currency code (e.g., EGP, USD, EUR)';
