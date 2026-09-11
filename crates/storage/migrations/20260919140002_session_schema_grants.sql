CREATE SCHEMA IF NOT EXISTS tower_sessions;

CREATE TABLE IF NOT EXISTS tower_sessions.session (
    id TEXT PRIMARY KEY NOT NULL,
    data BYTEA NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL
);

GRANT USAGE ON SCHEMA tower_sessions TO epure_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tower_sessions.session TO epure_app;
REVOKE ALL ON SCHEMA tower_sessions FROM epure_ingest;
REVOKE ALL ON TABLE tower_sessions.session FROM epure_ingest;
