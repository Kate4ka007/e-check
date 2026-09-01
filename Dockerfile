FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api

RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild prisma @prisma/client @prisma/engines sharp @swc/core esbuild unrs-resolver

RUN pnpm --filter @receipt-tracker/contracts build
RUN pnpm --filter @receipt-tracker/api exec prisma generate
RUN pnpm --filter @receipt-tracker/api build

FROM node:22-bookworm-slim AS production

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/scripts ./apps/api/scripts

WORKDIR /app/apps/api

ENV NODE_ENV=production

CMD ["node", "scripts/start-production.cjs"]
