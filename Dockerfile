FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_ULTIMATE_WEBSITE_GENERATOR_URL
ARG VITE_ENABLE_GTM
ARG VITE_GTM_ID
RUN npm run build

FROM caddy:2-alpine
WORKDIR /app
ENV FASTAPI_ORIGIN=http://backend:8000
COPY Caddyfile ./
COPY --from=build /app/dist/public ./dist/public
EXPOSE 5000
CMD ["caddy", "run", "--config", "/app/Caddyfile"]
