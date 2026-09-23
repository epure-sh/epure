# Deploy overlays

Optional Compose files and env templates. The documented path stays at the repo root:

```bash
docker compose up -d
```

## Files

| Path | Use |
|---|---|
| [docker-compose.build.yml](./docker-compose.build.yml) | Build the image from source instead of GHCR |
| [docker-compose.prod.yml](./docker-compose.prod.yml) | Production: HTTPS session cookies, no Postgres host port |
| [env.production.example](./env.production.example) | Copy → repo-root `.env` for production |
| [env.dev.example](./env.dev.example) | Copy → repo-root `.env.dev` for host `cargo` / tests |
| [env.test.example](./env.test.example) | Minimal `DATABASE_URL` for tests |

## Commands

```bash
# Source build
docker compose -f docker-compose.yml -f deploy/docker-compose.build.yml up --build

# Production (after ./configure --prod or copying env.production.example → .env)
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d

# Cargo against Compose Postgres
cp deploy/env.dev.example .env.dev
```

Or use `./configure --prod` / `./configure --dev` from the repo root.
