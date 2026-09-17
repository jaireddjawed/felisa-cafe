# syntax=docker/dockerfile:1

# ── builder ───────────────────────────────────────────────────────────────
FROM golang:1.27-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# modernc.org/sqlite is pure Go, so CGO_ENABLED=0 still produces a working binary.
RUN CGO_ENABLED=0 go build -o /felisa-backend .

# ── runner ────────────────────────────────────────────────────────────────
FROM alpine:3.20 AS runner
RUN apk add --no-cache ca-certificates \
  && addgroup -S pocketbase && adduser -S pocketbase -G pocketbase
WORKDIR /app
COPY --from=builder /felisa-backend ./felisa-backend
RUN mkdir -p ./pb_data && chown -R pocketbase:pocketbase /app

USER pocketbase
EXPOSE 8090
VOLUME ["/app/pb_data"]

ENTRYPOINT ["./felisa-backend", "serve", "--http=0.0.0.0:8090"]
