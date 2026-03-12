-- Webhook signing secrets for HMAC-SHA256 payload verification.

ALTER TABLE webhooks
    ADD COLUMN signing_secret BYTEA,
    ADD COLUMN secret_prefix TEXT;

UPDATE webhooks
SET signing_secret = gen_random_bytes(32)
WHERE signing_secret IS NULL;

UPDATE webhooks
SET secret_prefix = 'whsec_' || left(encode(signing_secret, 'hex'), 8)
WHERE secret_prefix IS NULL;

ALTER TABLE webhooks
    ALTER COLUMN signing_secret SET NOT NULL,
    ALTER COLUMN secret_prefix SET NOT NULL;
