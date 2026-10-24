# mejor-vejez-web

Front de **Mejor Vejez** — Angular 22 servido por nginx. Producción:
`https://mejor-vejez-app.adndigital.cl`.

Hoy muestra la página **en construcción** con el estado de la API (`GET /api/health`,
cada 30 s). Diseño: `../mejor-vejez-design` (tokens en `src/styles.scss`).

## Estructura

```
src/app/
  core/config/runtime-config.ts   lee window.__env (env.js)
  core/auth/auth.service.ts       Firebase Auth (Google y correo); signals user/ready
  core/auth/auth.interceptor.ts   agrega Bearer <ID token> SÓLO a llamadas a la API
  core/health/health.service.ts   GET /api/health
  pages/en-construccion/          la página actual
```

## Configuración en runtime

Nada se hornea en el build. `public/env.js` trae los valores de desarrollo; en el
contenedor, `docker/40-runtime-env.sh` lo reescribe al arrancar con estas variables:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `API_URL` | sí | URL pública de la API, sin barra final |
| `FIREBASE_API_KEY` / `FIREBASE_AUTH_DOMAIN` / `FIREBASE_PROJECT_ID` / `FIREBASE_APP_ID` | no | config web de Firebase; vacías = sin sesión |

## Desarrollo

```sh
npm install
npm start          # http://localhost:4200 (API en http://localhost:8080 según public/env.js)
npm test
npm run build
```

## Despliegue en Dokploy

App de tipo **Compose** apuntando a este repo, archivo `docker-compose.yml`.

1. **Environment:** `API_URL=https://mejor-vejez-api.adndigital.cl` + las de Firebase.
2. **Domains:** servicio `mejor-vejez-web`, puerto `80`, host
   `mejor-vejez-app.adndigital.cl`, HTTPS (Let's Encrypt).
3. En Firebase → Authentication → Settings → **Authorized domains**, agregar
   `mejor-vejez-app.adndigital.cl`.
