DROP SCHEMA public CASCADE; CREATE SCHEMA public;
CREATE TABLE accounts (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE payments (
  key text PRIMARY KEY,               -- the caller's idempotency key
  from_acct int NOT NULL REFERENCES accounts,
  to_acct int NOT NULL REFERENCES accounts,
  amount bigint NOT NULL CHECK (amount > 0),
  status text NOT NULL,
  ref text,                           -- set on a correction: the payment it corrects
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE entries (                -- double entry: two rows per payment, summing to zero
  id bigserial PRIMARY KEY,
  payment_key text NOT NULL REFERENCES payments,
  account_id int NOT NULL REFERENCES accounts,
  amount bigint NOT NULL);
CREATE INDEX ON entries (account_id);
INSERT INTO accounts SELECT g, 'acct-'||g FROM generate_series(1, 1000) g;
INSERT INTO accounts VALUES (999, 'suspense') ON CONFLICT DO NOTHING;
