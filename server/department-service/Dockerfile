# syntax=docker/dockerfile:1
# Build context is server/ (see docker-compose.yml) so the shared proto module is available.
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off
COPY proto/ ./proto/
COPY department-service/go.mod department-service/go.sum ./department-service/
WORKDIR /src/department-service
RUN go mod download
COPY department-service/ ./
RUN go build -trimpath -ldflags="-s -w" -o /out/department-service ./cmd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/department-service /department-service
ENV PORT=8083
EXPOSE 8083 9083
USER nonroot:nonroot
ENTRYPOINT ["/department-service"]
