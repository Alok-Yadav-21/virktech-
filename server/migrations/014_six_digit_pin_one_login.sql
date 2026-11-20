-- Staff PINs become 6 digits, and a staff member can only be signed in in one place at a time.
--
-- Existing 4-digit PINs get "00" added at the end (5195 becomes 519500) so nobody is locked out the day
-- this ships. Every PIN was unique and stays unique (same four digits, same suffix). The admin can read
-- and change any PIN in the staff list, so moving people to fresh random PINs is a later, optional step.
UPDATE users SET pin = pin || '00' WHERE pin ~ '^[0-9]{4}$';
ALTER TABLE users DROP CONSTRAINT users_pin_check;
ALTER TABLE users ADD CONSTRAINT users_pin_check CHECK (pin ~ '^[0-9]{6}$');

-- login_sid is the id of the sign-in that is live right now; NULL means nobody is signed in.
-- It is put in the sign-in cookie as well, and a cookie whose id is not the current one is refused, so
-- clearing this (log out, or an admin signing someone out) ends that login on every device at once.
-- Never sent to the browser.
ALTER TABLE users ADD COLUMN login_sid TEXT;
