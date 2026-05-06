# ==============================================================================
# Stage 1: Build sandbox (Node.js/TypeScript backend services)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install sandbox dependencies first (layer cache optimization)
COPY sandbox/package.json sandbox/package-lock.json* ./sandbox/
RUN cd sandbox && npm ci --ignore-scripts

# Copy contract artifacts (needed at build time for ABI references)
COPY contracts/artifacts/ ./contracts/artifacts/

# Copy sandbox source and compile TypeScript
COPY sandbox/tsconfig.json ./sandbox/
COPY sandbox/src/ ./sandbox/src/
RUN cd sandbox && npm run build

# ==============================================================================
# Stage 2: Build frontend (Vite/React static files)
# ==============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install frontend dependencies first (layer cache optimization)
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci --ignore-scripts

# Copy frontend source
# Copy contract artifacts (needed for ABI imports)
COPY contracts/artifacts/ ./contracts/artifacts/

COPY frontend/tsconfig.json frontend/tsconfig*.json ./frontend/
COPY frontend/vite.config.* ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src/ ./frontend/src/
COPY frontend/public/ ./frontend/public/

# Build-time env vars for Vite (injected via --build-arg)
ARG VITE_AUDIT_RPC_URL
ARG VITE_AUDIT_REGISTRY_ADDRESS
ARG VITE_AUDIT_CHAIN_ID
ARG VITE_AUDIT_REPORT_GATEWAY_URL
ARG VITE_AUDIT_APPEAL_API_URL
ARG VITE_AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE
ARG VITE_AUDIT_ATTESTATION_EXPECTED_MEASUREMENT
ARG VITE_AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT
ARG VITE_AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING

RUN cd frontend && npm run build

# ==============================================================================
# Stage 3: Production runtime
# ==============================================================================
FROM node:20-alpine AS runtime

RUN apk add --no-cache tini docker-cli

WORKDIR /app

# Copy compiled sandbox output
COPY --from=builder /app/sandbox/dist ./sandbox/dist
COPY --from=builder /app/sandbox/node_modules ./sandbox/node_modules
COPY --from=builder /app/sandbox/package.json ./sandbox/package.json

# Copy contract artifacts (needed at runtime for ABI parsing)
COPY --from=builder /app/contracts/artifacts ./contracts/artifacts

# Copy frontend static build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user
RUN addgroup -S shenji && adduser -S shenji -G shenji
RUN mkdir -p /app/.runtime /app/.runtime/reports-store && chown -R shenji:shenji /app/.runtime

USER shenji

# Default entrypoint uses tini for proper signal handling
ENTRYPOINT ["tini", "--"]

# Default command (override per service in docker-compose)
CMD ["node", "sandbox/dist/src/cli/listener.js"]

# ==============================================================================
# Stage 4: Frontend nginx image (build with --target frontend)
# ==============================================================================
FROM nginx:1.27-alpine AS frontend

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy built frontend static files
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy custom nginx config
COPY infra/production/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
