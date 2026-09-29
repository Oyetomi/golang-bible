CREATE TABLE accounts (
  id text PRIMARY KEY,
  currency text NOT NULL CHECK (length(currency) = 3),
  kind text NOT NULL CHECK (kind IN ('customer','system')),
  balance bigint NOT NULL DEFAULT 0,
  -- customers may not go below zero; system accounts (the money's source) may
  CONSTRAINT no_overdraft CHECK (kind = 'system' OR balance >= 0));

CREATE TABLE transactions (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  memo text NOT NULL DEFAULT '');

CREATE TABLE postings (
  id bigserial PRIMARY KEY,
  transaction_id bigint NOT NULL REFERENCES transactions,
  account_id text NOT NULL REFERENCES accounts,
  amount bigint NOT NULL);           -- credit positive, debit negative
CREATE INDEX ON postings (account_id);

CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,
  request_hash text NOT NULL,
  transaction_id bigint NOT NULL REFERENCES transactions);

CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz);
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;

-- the double-entry rule, enforced where no Go code can skip it
CREATE FUNCTION check_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s bigint;
BEGIN
  SELECT sum(amount) INTO s FROM postings WHERE transaction_id = NEW.transaction_id;
  IF s <> 0 THEN RAISE EXCEPTION 'transaction % does not balance (sum %)', NEW.transaction_id, s; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER postings_balanced AFTER INSERT ON postings
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_balanced();
