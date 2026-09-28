-- a clean ledger with 20 customer accounts, each funded with $1,000.00 from the treasury
TRUNCATE outbox, idempotency_keys, postings, transactions, accounts RESTART IDENTITY CASCADE;
INSERT INTO accounts (id, currency, kind) VALUES ('treasury', 'USD', 'system');
INSERT INTO accounts (id, currency, kind) SELECT 'acct-' || g, 'USD', 'customer' FROM generate_series(1, 20) g;
DO $$
DECLARE t bigint; g int;
BEGIN
  FOR g IN 1..20 LOOP
    INSERT INTO transactions (memo) VALUES ('seed ' || g) RETURNING id INTO t;
    INSERT INTO postings (transaction_id, account_id, amount) VALUES (t, 'treasury', -100000), (t, 'acct-' || g, 100000);
    UPDATE accounts SET balance = balance - 100000 WHERE id = 'treasury';
    UPDATE accounts SET balance = balance + 100000 WHERE id = 'acct-' || g;
  END LOOP;
END $$;
