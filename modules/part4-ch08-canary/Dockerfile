FROM golang:1.27 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY app ./app
COPY cmd ./cmd
RUN CGO_ENABLED=0 go build -trimpath -o /ledger-api ./app && CGO_ENABLED=0 go build -trimpath -o /load ./cmd/load

FROM gcr.io/distroless/static-debian12
COPY --from=build /ledger-api /load /
ENTRYPOINT ["/ledger-api"]
