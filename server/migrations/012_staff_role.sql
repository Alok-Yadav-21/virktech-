-- What each staff member does in the shop (shopkeeper, manager, biller, repairer), so admin can tell them apart.
-- Free text here; the allowed list lives in rules.js (STAFF_ROLES) and is checked by the users route.
ALTER TABLE users ADD COLUMN staff_role TEXT;
