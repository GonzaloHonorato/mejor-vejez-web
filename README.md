# mejor-vejez-web

Front de **Mejor Vejez** (marca de la app: **Cuida+**) — Angular 22 servido por nginx. Producción:
`https://mejor-vejez-app.adndigital.cl`.

Diseño: `../mejor-vejez-design` (tokens en `src/estilos/`).

## Rutas

Públicas:

| Ruta | Página |
| --- | --- |
| `/ingreso` | inicio de sesión con Google o correo y contraseña (Firebase Auth), y "¿Olvidaste tu contraseña?"; `?volver=` vuelve a la ruta pedida |
| `/restablecer-clave` | fijar una contraseña nueva desde el enlace del correo de recuperación (el código viaja en el fragmento `#codigo=`) |
| `/estado` | estado del servicio: API y base de datos (`GET /api/salud`, cada 30 s) |

Con sesión (`guardAutenticado` → `/ingreso` si no hay), dentro del marco de la app (barra lateral en escritorio, pestañas + "Más" en móvil):

| Ruta | Página | Historia |
| --- | --- | --- |
| `/` | Panel familiar: 5 secciones independientes, filtro por adulto, refresco cada 2 min con la pestaña visible | HU-10 |
| `/perfil` | Mi perfil y mis canales de notificación | HU-01, HU-08 |
| `/grupos` · `/grupos/:idGrupo` | Grupos e integrantes (incorporar, crear cuenta, cambiar rol, desactivar, salir, sucesión) | HU-02, HU-13 |
| `/grupos/:idGrupo/auditoria` | Auditoría del grupo (coordinador o administrador) | HU-12 |
| `/adultos` · `/adultos/:idAdulto` | Adultos mayores y su ficha con contactos de emergencia | HU-03 |
| `/planes` · `/planes/:idPlan` | Planes de medicamentos (modo simple y avanzado, responsable por medicamento) | HU-04 |
| `/tareas` · `/tareas/nueva` · `/tareas/:idTarea` | Agenda, tarea manual (compra/retiro, cita médica), detalle: confirmar, reasignar e historial | HU-05, HU-06, HU-07 |
| `/alertas` · `/alertas/:idAlerta` | Bandeja de alertas y cierre con observación | HU-08, HU-09 |
| `/relevos` · `/relevos/:idRelevo` | Registrar y consultar relevos, reasignar desde el relevo | HU-11, HU-06 |
| `/administracion/usuarios` | Gestión global de cuentas: crear, reenviar acceso, activar o desactivar (`guardAdministrador`) | HU-01 |
| `/administracion/auditoria` | Auditoría global (`guardAdministrador`) | HU-12 |

Cualquier otra ruta redirige a `/`.

## Estructura

```
src/app/
  app.routes.ts                 rutas (todas con carga diferida)
  nucleo/                       servicios y modelos por dominio, sin UI
    configuracion/              lee window.__env (env.js)
    autenticacion/              Firebase Auth, interceptor (Bearer SOLO al origen de la API), guards
    http/                       mensajes de error en español a partir del ProblemDetail de la API
    usuarios/ grupos/ adultos/ planificacion/ tareas/ alertas/
    panel/ relevos/ auditoria/ sucesion/ catalogos/ salud/
    fechas.ts, telefono.ts …    utilidades (hora de Santiago, teléfono chileno)
  compartido/                   marco de la app, marca, íconos y componentes reutilizables
  paginas/                      una carpeta por página (ver "Rutas")
src/estilos/                    capas de estilo (ver "Estilos y temas")
```

## Configuración en runtime

Nada se hornea en el build. `public/env.js` trae los valores de desarrollo; en el
contenedor, `docker/40-runtime-env.sh` lo reescribe al arrancar con estas variables:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `API_URL` | sí | URL pública de la API, sin barra final (se expone al front como `window.__env.urlApi`) |
| `FIREBASE_API_KEY` / `FIREBASE_AUTH_DOMAIN` / `FIREBASE_PROJECT_ID` / `FIREBASE_APP_ID` | no | config web de Firebase; vacías = sin sesión |

## Estilos y temas

Los estilos globales viven en `src/estilos/`, en capas:

1. **`_primitivos.scss`** — paleta y escalas crudas (`--mv-p-*`): colores, espaciados,
   radios, anchos de layout, familia tipográfica y escala de tamaños, sin ningún
   significado.
2. **`_tema.scss`** — tokens semánticos (`--mv-color-primario`, `--mv-color-texto`,
   `--mv-color-fondo`, `--mv-color-exito`, `--mv-color-error`, `--mv-color-alerta`,
   `--mv-color-foco`/`--mv-color-foco-contraste`, `--mv-color-navegacion-*`, `--mv-fuente-base`, `--mv-texto-*`, `--mv-espacio-*`,
   `--mv-radio-*`, etc.), que referencian SOLO primitivos. **Es el único archivo a
   editar para cambiar de diseño visual**: cambiar un valor acá cambia toda la app,
   sin tocar un solo componente.
3. **`_base.scss`** — reset y estilos de elementos base (`body`, `h1`–`h3`, enlaces,
   botones, foco visible), usando solo los tokens semánticos del paso 2.

`src/styles.scss` sólo hace `@use` de esas tres capas, en ese orden.

**Regla para componentes:** el SCSS de cualquier componente usa *únicamente*
`var(--mv-...)` semánticos — nunca colores literales (`#hex`, `rgb()`, `hsl()`,
nombres de color) ni `font-family`/`font-size` literal. Esto lo garantiza
`src/estilos/estilos-desacoplados.spec.ts` (Vitest), que recorre `src/app/**/*.scss`
y falla si encuentra un valor visual literal.

### Tema activo: Opción C

El tema activo hoy es la **Opción C** (decisión del usuario, 2026-10-24; de las 5
opciones evaluadas). Fuente de verdad visual: `mejor-vejez-design/mejor-vejez-layouts.fig`,
página `10 · C · Interfaces núcleo`.

- **Paleta:** azules (`#0B2545` texto/barra lateral, `#1D4E89` primario,
  `#DCE6F2`/`#EEF3F9` superficies suaves, `#C9D3DF` bordes), pizarra `#3C4A5A`
  (texto secundario), rojo `#A4262C`/`#FBE8E9` (error), ámbar `#8A5100`/
  `#FFF1DB`/`#FFD9A0` (alerta) y verde `#1E6B3C`/`#E3F1E8` (éxito). Ver
  `_primitivos.scss` para el detalle completo.
- **Tipografía:** [Public Sans](https://fonts.google.com/specimen/Public+Sans)
  (400 y 700), cargada desde Google Fonts en `src/index.html`. Escala 13–30px;
  `--mv-texto-base` (cuerpo) queda fijo en **16px** como piso de accesibilidad —
  nunca se baja de ahí aunque el diseño use 15px en algún texto secundario.
- **Radios y bordes:** radios pequeños (`--mv-radio-md` = 6px, igual que los
  `rounded={6}` del diseño) y bordes finos de 1px, como en el diseño.
- **Tokens de navegación (para la Tarea 9):** se agregaron ya al tema
  `--mv-color-navegacion-fondo/-texto/-activo/-activo-texto/-grupo-fondo/
  -grupo-texto/-insignia`, tomados 1:1 de la barra lateral de "Panel familiar ·
  Escritorio" de la fuente de verdad visual, para que la barra lateral oscura (escritorio) y la
  barra inferior (móvil) de la Tarea 9 no tengan que inventar valores nuevos.
- **Foco de teclado:** `--mv-color-foco` (azul `#1D4E89`, ≥ 3:1 sobre blanco y
  sobre `#EEF3F9`) como contorno, más un anillo interior claro
  (`--mv-color-foco-contraste`) para que se vea también sobre la barra lateral oscura.
- `--mv-color-primario-hover` usa el azul variante de la barra lateral
  (`#1D3A5F`) como estado "pressed"/hover del primario: el diseño no trae un
  tono de hover explícito para el primario, y esa variante es la más cercana
  en la paleta real.

Cambiar de tema (incluido volver a probar otra de las 5 opciones) sigue
significando editar solo `_primitivos.scss`/`_tema.scss` — ningún componente
necesitó tocarse para aplicar la Opción C.

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
