-- Staff no longer belong to one fixed branch: at sign-in the server matches the computer's public IP to a branch
-- (branches.ip, set by admin) and puts the person there. users.branch_id then means "branch they signed in at".
ALTER TABLE branches ADD COLUMN ip TEXT;
CREATE UNIQUE INDEX branches_ip_key ON branches (ip) WHERE ip IS NOT NULL;
ALTER TABLE users ADD COLUMN last_ip TEXT, ADD COLUMN last_login_at TIMESTAMPTZ;
-- New staff have no branch until their first sign-in. A NULL branch matches nothing in scope.js, so they see nothing meanwhile.
ALTER TABLE users DROP CONSTRAINT users_check;
