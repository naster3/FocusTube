# Documentacion interna

## Objetivo
FocusTube Blocker es una extension MV3 que bloquea contenido de YouTube/YouTube Kids por reglas manuales, por horario, por Shorts, y por dominios configurables. Incluye UI de popup, pagina de opciones y una pagina de bloqueo, mas un overlay con temporizador dentro de YouTube.

## Arquitectura
- Background (service worker): `src/background/index.ts`.
- Content script: `src/content/index.ts` (inyecta el overlay y redirige a la pagina bloqueada).
- UI: `src/ui/popup`, `src/ui/options`, `src/ui/blocked`.
- Shared: reglas, storage, tipos y utilidades en `src/shared/*`.
- Manifest base: `src/manifest/manifest.base.json` (se copia a `dist/manifest.json`).

## Flujo de bloqueo
1) El content script llama `CHECK_BLOCK` con la URL actual.
2) El background resuelve la decision con `evaluateBlock` y devuelve `blocked`.
3) Si esta bloqueado, el content script redirige a `blocked.html?url=...`.
4) El background registra intentos y tiempo segun actividad (tick cada 5s).

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
- Valores por defecto en `src/shared/defaults.ts`.
- `mergeSettings` y `mergeMetrics` mantienen compatibilidad.
- Modo estricto: requiere PIN (hash en `pinHash`) para desactivar.

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
- `vitest run` (ver `src/shared/schedule.test.ts`).

## Puntos a vigilar
- El conteo de tiempo depende de visibilidad, foco de ventana y URL activa.
- Los horarios usan timezone local del navegador.
- Los caracteres con acentos en algunos UI strings parecen tener codificacion rota (mojibake).
