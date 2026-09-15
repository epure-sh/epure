FROM node:26-bookworm AS web-build

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
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/epure /usr/local/bin/epure

EXPOSE 8080
ENTRYPOINT ["epure"]
CMD ["--mode=all"]
