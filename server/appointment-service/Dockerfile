# syntax=docker/dockerfile:1
# Build context is server/ (see docker-compose.yml) so the shared proto module is available.
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off
COPY proto/ ./proto/
COPY appointment-service/go.mod appointment-service/go.sum ./appointment-service/
WORKDIR /src/appointment-service
RUN go mod download
COPY appointment-service/ ./
RUN go build -trimpath -ldflags="-s -w" -o /out/appointment-service ./cmd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/appointment-service /appointment-service
ENV PORT=8084
EXPOSE 8084
USER nonroot:nonroot
ENTRYPOINT ["/appointment-service"]
