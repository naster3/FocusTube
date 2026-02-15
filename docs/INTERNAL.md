# Documentacion interna

## Objetivo

FocusTube Blocker es una extension MV3 para bloquear sitios web y contenidos por reglas manuales, horarios y listas personalizadas. Incluye UI de popup, pagina de opciones, dashboard, pagina de ayuda y pagina de bloqueo, mas un overlay flotante dentro de sitios objetivo.

## Arquitectura

- Background (service worker): `src/background/index.ts`.
- Content script: `src/content/index.ts` (inyecta el overlay y redirige a la pagina bloqueada).
- UI: `src/ui/popup`, `src/ui/options`, `src/ui/dashboard`, `src/ui/help`, `src/ui/blocked`.
- Domain: reglas, tipos y utilidades en `src/domain/*`.
- Infrastructure: storage y DB en `src/infrastructure/*`.
- Manifest base: `src/manifest/manifest.base.json` (se copia a `dist/manifest.json`).

## Flujo de bloqueo

1. El content script llama `CHECK_BLOCK` con la URL actual.
1. El background resuelve la decision con `evaluateBlock` y devuelve `blocked`.
1. Si esta bloqueado, el content script redirige a `blocked.html?url=...`.
1. El background registra intentos y tiempo segun actividad (tick cada 5s).

## Horarios y timeline

- `isWithinBlockedSchedule` evalua los rangos por dia (incluye cruce de medianoche).
- `computeScheduleTimeline` calcula estado actual, tiempo restante y proximo bloque.
- El popup y el overlay consultan el timeline via `GET_TIMELINE`.

## Overlay flotante

- Se crea en `src/content/index.ts`.
- Es draggable, minimizable y guarda posicion en `chrome.storage.local` (`overlayPos`).
- Se actualiza cada 1s con el timeline y la hora local.

## Datos y storage

- `settings` y `metrics` viven en `chrome.storage.local`.
- Valores por defecto en `src/domain/settings/defaults.ts`.
- `mergeSettings` y `mergeMetrics` mantienen compatibilidad.
- Modo estricto: requiere PIN (hash en `pinHash`) para desactivar.
- Metricas agregadas y eventos se persisten en IndexedDB (incluye SQLite local).

## Mensajes (runtime)

- `CHECK_BLOCK` (content -> background) evalua bloqueo.
- `GET_TIMELINE` (popup/overlay -> background) devuelve timeline.
- `PAGE_HELLO` y `VISIBILITY_CHANGED` actualizan estado de pestana.
- `BLOCKED_PAGE_TICK` suma tiempo bloqueado.
- `METRICS_GET` y `METRICS_RESET` exponen metricas.

## Permisos y dominios

- Al agregar un dominio bloqueado, Options solicita permisos dinamicos.
- El background registra el content script solo para los dominios actuales.

## Build y empaquetado

- Vite genera los bundles.
- `scripts/copy-manifest.js` copia manifest y renombra HTML a `popup.html`, `options.html`, `blocked.html`.
- Iconos se copian desde `public/icons`.

## Tests

- `vitest run` (ver `src/tests/schedule.test.ts`).
- `npm run encoding:check` valida UTF-8 sin BOM + NFC y detecta mojibake en archivos de texto.
- `npm run encoding:fix` normaliza automaticamente UTF-8/NFC en el repo.

## Puntos a vigilar

- El conteo de tiempo depende de visibilidad, foco de ventana y URL activa.
- Los horarios usan timezone local del navegador.
- Los caracteres con acentos en algunos UI strings parecen tener codificacion rota (mojibake).
