# ---- build stage ----
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o gateway .

# ---- runtime stage ----
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/gateway .
EXPOSE 5555
CMD ["./gateway"]
