-- Staff sign in with a 4-digit PIN instead of email + password, and admin records an hourly wage.
-- The PIN is stored as typed (not hashed): admin must be able to read it back to hand it out, and a login
-- that sends only a PIN has to look it up directly. It is unique, and only staff accounts can use it.
ALTER TABLE users
  ADD COLUMN pin TEXT UNIQUE CHECK (pin ~ '^[0-9]{4}$'),
  ADD COLUMN hourly_wage NUMERIC(8,2) CHECK (hourly_wage >= 0),
  ALTER COLUMN email DROP NOT NULL,     -- staff have no email; UNIQUE still holds for everyone who does
  ALTER COLUMN password DROP NOT NULL;  -- staff have no password
