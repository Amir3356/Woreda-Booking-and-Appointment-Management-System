# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/user-service ./cmd

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/user-service /user-service
ENV PORT=8082
EXPOSE 8082
USER nonroot:nonroot
ENTRYPOINT ["/user-service"]
