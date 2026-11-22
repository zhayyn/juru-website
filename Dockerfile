FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts
COPY index.html tsconfig.json vite.config.ts server.ts ./
COPY src ./src
COPY server ./server
RUN npm run build && npm prune --omit=dev --ignore-scripts --package-lock=false

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3097 \
    AUDIT_STORAGE_ENABLED=true \
    AUDIT_DB_PATH=/app/data/private/audits.sqlite \
    AI_PROVIDER=none \
    RANKING_PUBLISH_ENABLED=false
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
RUN mkdir -p /app/data/private && chmod 700 /app/data /app/data/private && chown -R node:node /app
USER node
EXPOSE 3097
CMD ["node", "--import", "tsx", "server.ts"]
