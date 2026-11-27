# syntax=docker/dockerfile:1
# Built from the repo root; WORKDIR mirrors the checkout so imports of ../shared and ../mcp-server resolve.

FROM node:24-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
# The hosted MCP endpoint runs mcp-server's code inside the backend process.
WORKDIR /app/mcp-server
COPY mcp-server/package.json mcp-server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY shared /app/shared
COPY --from=deps /app/mcp-server/node_modules /app/mcp-server/node_modules
COPY mcp-server/package.json /app/mcp-server/package.json
COPY mcp-server/src /app/mcp-server/src
USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
