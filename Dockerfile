FROM node:18-slim

WORKDIR /app

# ── Root dependencies ──────────────────────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm install

# ── Client: install deps (cached layer) then build ────────────────────────────
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm install

COPY client/ ./client/
# Builds React app to server/public/ (configured in client/vite.config.js)
RUN cd client && npm run build

# ── Server source ─────────────────────────────────────────────────────────────
COPY server/ ./server/

# Generate Prisma client (schema must be copied first)
RUN npx prisma generate --schema=server/prisma/schema.prisma

EXPOSE 3001

CMD ["node", "server/index.js"]
