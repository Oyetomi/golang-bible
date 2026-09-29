DROP SCHEMA public CASCADE; CREATE SCHEMA public;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='meridian_app') THEN CREATE ROLE meridian_app LOGIN PASSWORD 'app'; END IF;
END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='meridian_owner') THEN CREATE ROLE meridian_owner LOGIN PASSWORD 'owner'; END IF; END $$;
CREATE TABLE tenants (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants, role text NOT NULL CHECK (role IN ('admin','initiator','viewer')),
  password_hash text NOT NULL);
CREATE TABLE accounts (
  id bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001) PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants, owner_id text NOT NULL REFERENCES users,
  balance bigint NOT NULL DEFAULT 0,
  memo text NOT NULL DEFAULT '');
CREATE INDEX ON accounts (tenant_id);
CREATE INDEX ON accounts (owner_id);
CREATE TABLE profiles (
  user_id text PRIMARY KEY REFERENCES users, first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '');
-- which profile fields other users of a tenant may edit; the admin changes these at runtime
CREATE TABLE field_rules (field text PRIMARY KEY, editable boolean NOT NULL, version bigint NOT NULL DEFAULT 1);
INSERT INTO field_rules VALUES ('first_name', true, 1), ('last_name', true, 1), ('email', false, 1), ('address', false, 1);
CREATE TABLE grants (resource text NOT NULL, user_id text NOT NULL REFERENCES users, role text NOT NULL, PRIMARY KEY (resource, user_id));

INSERT INTO tenants VALUES ('acme','Acme Bank'),('globex','Globex Pay'),('initech','Initech FS');
INSERT INTO users SELECT t||'-u'||n, t, CASE WHEN n=1 THEN 'admin' WHEN n=2 THEN 'admin' ELSE 'viewer' END, 'h(pw)'
  FROM unnest(ARRAY['acme','globex','initech']) t, generate_series(1,4) n;
SELECT setseed(0.5); -- the same balances on every run, so the numbers in the chapter reproduce
INSERT INTO accounts (tenant_id, owner_id, balance)
  SELECT u.tenant_id, u.id, (random()*90000)::bigint+1000 FROM users u, generate_series(1,250);
INSERT INTO profiles (user_id, first_name, last_name, email, address)
  SELECT id, 'First-'||id, 'Last-'||id, id||'@example.com', '1 Meridian Way' FROM users;
ALTER TABLE accounts OWNER TO meridian_owner;
GRANT USAGE ON SCHEMA public TO meridian_app, meridian_owner;
GRANT SELECT ON users, tenants TO meridian_owner;
GRANT SELECT, UPDATE ON profiles, field_rules TO meridian_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO meridian_app;
