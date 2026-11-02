# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/audit-service ./cmd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/audit-service /audit-service
ENV PORT=8087
EXPOSE 8087
USER nonroot:nonroot
ENTRYPOINT ["/audit-service"]
