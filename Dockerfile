FROM node:22-bookworm-slim

WORKDIR /app

# Install deps (include devDependencies for Vite/esbuild — see .npmrc)
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Railway injects git SHA at build time when available
ARG RAILWAY_GIT_COMMIT_SHA
ENV RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA

# Production client + server bundle
ENV VITE_BASE_PATH=/
ENV CLIENT_OUT_DIR=dist/public
RUN npm run build:railway

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "run", "start:prod"]
