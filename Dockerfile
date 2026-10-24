# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# La config (API_URL, Firebase) NO se hornea acá: la escribe nginx en env.js
# al arrancar el contenedor (docker/40-runtime-env.sh).
RUN npm run build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
COPY --from=build /app/dist/mejor-vejez-web/browser /usr/share/nginx/html
EXPOSE 80
