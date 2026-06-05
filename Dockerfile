# Stage 1: Build React Frontend
FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY src/client/package.json ./src/client/
RUN cd src/client && bun install
COPY src/client/ ./src/client/
RUN cd src/client && bun run build

# Stage 2: Production Server
FROM oven/bun:1.1-slim
WORKDIR /app
COPY package.json tsconfig.json ./
RUN bun install --production
COPY src/ ./src/
COPY --from=builder /app/src/client/dist ./src/client/dist
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
