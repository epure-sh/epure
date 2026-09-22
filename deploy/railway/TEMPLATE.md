# Railway template (maintainers)

Publish steps mirror [Syllogic’s Railway guide](https://github.com/syllogic-ai/syllogic/blob/main/deploy/railway/TEMPLATE.md): stand up a project from [`docker-compose.yml`](./docker-compose.yml), verify, then **Generate template from project** in Railway settings.

## Shared variables (single source of truth)

| Variable | Composer default | Notes |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` | Same value on `postgres` and in `DATABASE_URL`. |
| `EPURE_INGEST_PASSWORD` | `${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` | Role `epure_ingest`. |
| `EPURE_APP_PASSWORD` | `${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` | Role `epure_app`. |

Do **not** inline `${{secret()}}` on each service field — that creates mismatched passwords.

## Service topology

| Service | Public | Volume |
| --- | --- | --- |
| `postgres` | No | `/var/lib/postgresql/data` |
| `epure` | Yes (HTTP) | `/data/artifacts` |

Derived URLs on `epure` use `${{postgres.RAILWAY_PRIVATE_DOMAIN}}` and `${{epure.RAILWAY_STATIC_URL}}` as in the committed compose file.

## Verification before publish

- [ ] Fresh project, all shared defaults accepted.
- [ ] `epure` public URL loads; `/health` is OK.
- [ ] Sign-up and first project + DSN work.
- [ ] Redeploy `epure`; data persists (Postgres + artifacts volumes).

After publish, add the template deploy URL to the root `README.md` deploy section.
