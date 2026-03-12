# Contributor source build (`docker-compose.build.yml`). Release images are
# compiled on native GHA runners and packed with Dockerfile.runtime.
FROM node:22-bookworm AS web-build

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM rust:1-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY fixtures ./fixtures
COPY scripts ./scripts
COPY --from=web-build /app/web/dist ./web/dist
RUN cargo build --release --bin epure

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 65532 epure \
    && useradd --system --uid 65532 --gid epure --home /nonexistent --shell /usr/sbin/nologin epure \
    && mkdir -p /data/artifacts \
    && chown epure:epure /data/artifacts

COPY --from=builder --chown=epure:epure /app/target/release/epure /usr/local/bin/epure

USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["epure"]
CMD ["--mode=all"]
