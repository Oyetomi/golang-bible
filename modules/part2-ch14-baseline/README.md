# Part 2 chapter 14: application security baseline (defensive, local-only)

Each file is one defence, with a test that measures it against the leaky version on your own machine.
Payloads are harmless (`echo`, a wildcard). Nothing here contacts another host.

    createdb -h 127.0.0.1 -p 55432 baseline
    psql -h 127.0.0.1 -p 55432 -d baseline -c "CREATE TABLE users (id serial PRIMARY KEY, name text NOT NULL, email text NOT NULL, is_admin boolean NOT NULL DEFAULT false, note text NOT NULL DEFAULT ''); INSERT INTO users (name,email,is_admin) SELECT 'user'||g,'user'||g||'@example.com', g=1 FROM generate_series(1,1000) g"
    ./run_all.sh
