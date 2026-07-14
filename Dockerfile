FROM node:20-alpine AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .
EXPOSE 3000
CMD ["node", "src/app.js"]

FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM caddy:2-alpine
COPY --from=backend /app /app/backend
COPY --from=frontend /app/dist /app/frontend/dist
COPY Caddyfile /etc/caddy/Caddyfile
WORKDIR /app
EXPOSE 443 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
