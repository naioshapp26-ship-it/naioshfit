-- Migration: Add cart support and payment metadata
-- Created: 2026-01-11
-- Description: Introduce cart_items table and track payment method/status on orders

-- Add payment columns to orders if they do not exist
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'card';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

-- Create cart_items table for per-user carts
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ensure each user has only one row per product
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_idx
  ON cart_items(user_id, product_id);

-- Optional helper indexes
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS cart_items_product_idx ON cart_items(product_id);
