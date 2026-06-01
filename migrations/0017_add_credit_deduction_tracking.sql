-- Add last_deduction_date to credit_balances table to track when credits were last deducted
ALTER TABLE credit_balances ADD COLUMN IF NOT EXISTS last_deduction_date timestamp;

-- Set initial value to current timestamp for existing records
UPDATE credit_balances SET last_deduction_date = updated_at WHERE last_deduction_date IS NULL;
