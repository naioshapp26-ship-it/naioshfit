-- Create product clicks tracking table
CREATE TABLE IF NOT EXISTS "product_clicks" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "affiliate_product_id" INTEGER NOT NULL REFERENCES "affiliate_products"("id") ON DELETE CASCADE,
  "clicked_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "product_clicks_user_id_idx" ON "product_clicks"("user_id");
CREATE INDEX IF NOT EXISTS "product_clicks_product_id_idx" ON "product_clicks"("affiliate_product_id");
CREATE INDEX IF NOT EXISTS "product_clicks_clicked_at_idx" ON "product_clicks"("clicked_at");
