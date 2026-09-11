-- rat.agent_licenses -- picaloco_agent activation keys.
--
-- Lives in `rat`, NOT `rat_migration` -- confirmed live (2026-09-11): this oci instance's
-- PostgREST only exposes schemas explicitly configured to serve the REST API, and `rat` is the
-- only one that's ever needed that (mobile_catalog_view). rat_migration has only ever been reached
-- via *direct* Postgres connections (psycopg2/pyodbc), never through supabase-js/PostgREST -- a
-- table created there was silently unreachable by api/agent-auth.ts's supabase-js client, with a
-- real, valid key failing exactly like a bad one. `rat` was the conceptually "wrong" choice at
-- first glance (it's meant for archive+operational data with narrow anon grants) but table grants
-- are per-table, not schema-wide: this table gets NO anon grant at all, same as it would have
-- anywhere else -- it's only ever queried by the server-side service_role client inside
-- api/agent-auth.ts, never the browser.
--
-- Run this once against oci (session pooler, port 5432).

CREATE TABLE IF NOT EXISTS rat.agent_licenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label         text,
  revoked       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);

-- Issue a new key for a volunteer/admin's install:
--   INSERT INTO rat.agent_licenses (label) VALUES ('RAT desktop') RETURNING key;
--
-- Revoke one instantly (no software release needed):
--   UPDATE rat.agent_licenses SET revoked = true WHERE label = 'RAT desktop';
--
-- See what's been used recently:
--   SELECT label, revoked, created_at, last_used_at FROM rat.agent_licenses ORDER BY created_at DESC;
