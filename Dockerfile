FROM node:22-alpine AS client
WORKDIR /build
COPY package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY src/client ./src/client
RUN npm ci && npm run build

FROM golang:1.24-alpine AS server
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY src ./src
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /lumina ./src

FROM alpine:3.22
RUN addgroup -S lumina && adduser -S lumina -G lumina && mkdir -p /app/uploads && chown -R lumina:lumina /app
WORKDIR /app
COPY --from=server /lumina ./lumina
COPY --from=client /build/dist ./dist
USER lumina
EXPOSE 8080
CMD ["./lumina"]
