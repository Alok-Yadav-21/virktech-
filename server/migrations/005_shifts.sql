-- Staff shifts: the server stamps start and end, so hours cannot be typed in or faked.
-- An open shift has no ended_at; the rate is copied at start so a later wage change never rewrites past pay.
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  branch_id INT NOT NULL REFERENCES branches(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  hourly_wage NUMERIC(8,2) CHECK (hourly_wage >= 0),
  CHECK (ended_at IS NULL OR ended_at > started_at)
);
-- One running shift per person, enforced here so a double click or a second tablet cannot start another.
CREATE UNIQUE INDEX shifts_one_open_idx ON shifts (user_id) WHERE ended_at IS NULL;
CREATE INDEX shifts_user_started_idx ON shifts (user_id, started_at DESC);
