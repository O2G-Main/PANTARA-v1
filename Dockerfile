FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_DATA_MODE=api
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_DATA_MODE=${NEXT_PUBLIC_DATA_MODE}
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(async r=>{const h=await r.json();if(!r.ok||h.status!=='ok'||h.service!=='pantara-frontend')process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
