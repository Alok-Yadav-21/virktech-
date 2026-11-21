-- Staff roles (Shopkeeper, Manager, ...) are a label for telling people apart, and admin can now add new ones.
-- They used to be a fixed list in rules.js; they are a table instead, seeded with the four that existed, plus any
-- role name already on a staff member. Names are unique ignoring case ("biller" and "Biller" are one role).
CREATE TABLE staff_roles (
  name TEXT PRIMARY KEY CHECK (length(btrim(name)) BETWEEN 1 AND 40)
);
CREATE UNIQUE INDEX staff_roles_name_ci ON staff_roles (lower(name));
INSERT INTO staff_roles (name) VALUES ('Shopkeeper'), ('Manager'), ('Biller'), ('Repairer');
INSERT INTO staff_roles (name) SELECT DISTINCT staff_role FROM users WHERE staff_role IS NOT NULL ON CONFLICT DO NOTHING;
