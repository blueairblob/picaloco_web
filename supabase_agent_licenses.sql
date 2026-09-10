-- rat_migration.agent_licenses -- picaloco_agent activation keys.
--
-- Lives in rat_migration (the internal/operational schema this project already uses for
-- non-archive, non-public data -- see filemaker_sync/CLAUDE.md), NOT rat. Unlike rat.sync_status
-- (deliberately anon-readable for the admin page), this table gets NO anon grant at all: it's only
-- ever queried by the server-side service_role client inside api/agent-auth.ts, never the browser.
--
-- Run this once against oci (session pooler, port 5432).

CREATE TABLE IF NOT EXISTS rat_migration.agent_licenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label         text,
  revoked       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);

-- Issue a new key for a volunteer/admin's install:
--   INSERT INTO rat_migration.agent_licenses (label) VALUES ('RAT desktop') RETURNING key;
--
-- Revoke one instantly (no software release needed):
--   UPDATE rat_migration.agent_licenses SET revoked = true WHERE label = 'RAT desktop';
--
-- See what's been used recently:
--   SELECT label, revoked, created_at, last_used_at FROM rat_migration.agent_licenses ORDER BY created_at DESC;
