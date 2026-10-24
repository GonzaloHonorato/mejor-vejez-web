#!/bin/sh
# La imagen oficial de nginx ejecuta /docker-entrypoint.d/*.sh antes de
# arrancar. Este script escribe env.js con las variables del contenedor, así
# la misma imagen sirve para cualquier entorno sin recompilar Angular.
set -e

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/env.js <<EOT
window.__env = {
  apiUrl: "$(json_escape "${API_URL:-}")",
  firebase: {
    apiKey: "$(json_escape "${FIREBASE_API_KEY:-}")",
    authDomain: "$(json_escape "${FIREBASE_AUTH_DOMAIN:-}")",
    projectId: "$(json_escape "${FIREBASE_PROJECT_ID:-}")",
    appId: "$(json_escape "${FIREBASE_APP_ID:-}")"
  }
};
EOT

echo "env.js generado (apiUrl=${API_URL:-<vacío>})"
