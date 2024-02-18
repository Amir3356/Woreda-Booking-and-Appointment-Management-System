# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/appointment-service ./cmd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/appointment-service /appointment-service
ENV PORT=8084
EXPOSE 8084
USER nonroot:nonroot
ENTRYPOINT ["/appointment-service"]
