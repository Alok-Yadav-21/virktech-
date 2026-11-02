-- Till (counter) sales are ordinary paid orders that are handed over on the spot, so revenue, profit and stock
-- reports need no changes. sold_by is set only for till sales (the staff member who rang it up).
ALTER TABLE orders ADD COLUMN sold_by INT REFERENCES users(id);
ALTER TABLE vape_orders ADD COLUMN sold_by INT REFERENCES users(id);

-- Every walk-in sale belongs to this one account (orders need a customer). It has no password and is
-- inactive, so nobody can log in as it; the admin customer list hides it.
INSERT INTO users (name, email, role, active) VALUES ('Walk-in customer', 'walk-in@till.local', 'customer', false);
