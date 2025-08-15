# Multi-stage Dockerfile para BMW Service Manager
FROM node:18-alpine AS builder

# Instalar actualizaciones de seguridad
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Etapa de producción
FROM node:18-alpine AS production

# Instalar actualizaciones de seguridad y dumb-init
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Set working directory in container
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bmwservice -u 1001

# Copy dependencies from builder stage
COPY --from=builder --chown=bmwservice:nodejs /app/node_modules ./node_modules

# Copy application source code
COPY --chown=bmwservice:nodejs . .

# Create directory for SQLite database
RUN mkdir -p /app/data && chown bmwservice:nodejs /app/data

# Remover archivos innecesarios para reducir superficie de ataque
RUN rm -rf BMW-Service-Manager.zip bmw-service-manager-project.tar.gz *.md

# Configurar variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Expose port 3000
EXPOSE 3000

# Change to non-root user
USER bmwservice

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/login', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Usar dumb-init para manejo de señales
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# Labels para metadatos
LABEL maintainer="BMW Service Team" \
      version="1.0.0" \
      description="BMW Service Manager Application" \
      security.scan="trivy"