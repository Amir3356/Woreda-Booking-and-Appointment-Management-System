# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/department-service ./cmd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/department-service /department-service
ENV PORT=8083
EXPOSE 8083
USER nonroot:nonroot
ENTRYPOINT ["/department-service"]
