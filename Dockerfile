# 多阶段构建:rust/server 编译为静态二进制 + 数据目录 → 自包含镜像
#
# 注意:镜像内置的 index/ 是仓库中已提交/CI 生成的产物,
# 构建镜像前请确保已运行 `bun run build`(生成 index/ 与 erc7730/)。

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
