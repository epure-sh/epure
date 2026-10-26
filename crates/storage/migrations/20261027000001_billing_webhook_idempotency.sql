-- Idempotent Polar webhook delivery (Standard Webhooks webhook-id).

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    webhook_id text PRIMARY KEY,
    event_type text NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, SELECT ON billing_webhook_events TO epure_app;
