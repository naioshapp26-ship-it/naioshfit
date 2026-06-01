ALTER TABLE users
  DROP COLUMN IF EXISTS follow_up_type,
  DROP COLUMN IF EXISTS subscription_amount,
  DROP COLUMN IF EXISTS currency;
