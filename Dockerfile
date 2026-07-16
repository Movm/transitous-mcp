FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production MCP_TRANSPORT=http PORT=3000
WORKDIR /app
LABEL org.opencontainers.image.title="Transitous MCP Server" \
      org.opencontainers.image.description="Complete MCP interface for the Transitous/MOTIS API" \
      org.opencontainers.image.source="https://github.com/Movm/transitous-mcp" \
      org.opencontainers.image.documentation="https://github.com/Movm/transitous-mcp#readme" \
      org.opencontainers.image.licenses="MIT" \
      mcp.discoverable="true" \
      mcp.transport="streamable-http" \
      mcp.endpoint="/mcp"
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]
