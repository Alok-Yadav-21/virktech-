-- Staff are paid per day worked, not per hour. An hourly rate cannot be turned into a daily one, so the old
-- figures are dropped and admin types a daily wage for each person. Hours worked are still recorded on shifts.
ALTER TABLE users  ADD COLUMN daily_wage NUMERIC(8,2) CHECK (daily_wage >= 0), DROP COLUMN hourly_wage;
ALTER TABLE shifts ADD COLUMN daily_wage NUMERIC(8,2) CHECK (daily_wage >= 0), DROP COLUMN hourly_wage;
