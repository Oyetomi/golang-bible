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
  balance bigint NOT NULL DEFAULT 0);
CREATE INDEX ON accounts (tenant_id);
CREATE INDEX ON accounts (owner_id);
CREATE TABLE grants (resource text NOT NULL, user_id text NOT NULL REFERENCES users, role text NOT NULL, PRIMARY KEY (resource, user_id));

INSERT INTO tenants VALUES ('acme','Acme Bank'),('globex','Globex Pay'),('initech','Initech FS');
INSERT INTO users SELECT t||'-u'||n, t, CASE WHEN n=1 THEN 'admin' WHEN n=2 THEN 'admin' ELSE 'viewer' END, 'h(pw)'
  FROM unnest(ARRAY['acme','globex','initech']) t, generate_series(1,4) n;
INSERT INTO accounts (tenant_id, owner_id, balance)
  SELECT u.tenant_id, u.id, (random()*90000)::bigint+1000 FROM users u, generate_series(1,250);
ALTER TABLE accounts OWNER TO meridian_owner;
GRANT USAGE ON SCHEMA public TO meridian_app, meridian_owner;
GRANT SELECT ON users, tenants TO meridian_owner;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO meridian_app;
