# Multi-stage build: compile rust/server to a static binary, then bake it
# together with the data directories into a self-contained image.
#
# Note: run `bun run build` first — it generates index/ (and erc7730/),
# which are copied into the image below.

FROM rust:1-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /build
COPY rust ./rust
RUN cargo build --release --manifest-path rust/Cargo.toml -p ethereum-data-server

FROM alpine:3.22
COPY --from=builder /build/rust/target/release/ethereum-data-server /usr/local/bin/ethereum-data-server

WORKDIR /app/data
COPY chains ./chains
COPY chainlogos ./chainlogos
COPY assets ./assets
COPY erc7730 ./erc7730
COPY index ./index
COPY index.html ./index.html

ENV PORT=3000 \
    DATA_DIR=/app/data
EXPOSE 3000
USER nobody
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
CMD ["ethereum-data-server"]
