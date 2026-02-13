# FocusTube Blocker

Extension MV3 para bloquear YouTube y otros dominios con horarios, whitelist y modo estricto.

## Caracteristicas

- Bloqueo por horarios (intervalos por dia).
- Bloqueo permanente + sesion semanal.
- Modo estricto con PIN.
- Whitelist para canales y videos de YouTube.
- Bloqueo de Shorts, Kids y Reels de Instagram.
- Bloqueos rapidos para redes sociales (TikTok, Instagram, Facebook, X).
- Dashboard con metricas y exportacion.

## Requisitos

- Node.js + npm

## Desarrollo (UI)

1) Instalar dependencias:

```
npm i
```

2) Servidor dev (solo UI):

```
npm run dev
```

## Build

```
npm run build
```

El bundle sale en `dist/`.

## Cargar extension (unpacked)

1) Abre la pagina de extensiones de Chrome/Brave.
2) Activa Developer mode.
3) Click en "Load unpacked" y selecciona la carpeta `dist/`.

## Scripts utiles

- `npm run dev`: UI en modo dev.
- `npm run build`: build completo + manifest.
- `npm run test`: tests (vitest).
- `npm run db:check`: diagnostico de DB (devtools del service worker).

## Estructura

- `src/` codigo fuente (background/content/ui/shared).
- `src/manifest/manifest.base.json` plantilla de manifest.
- `public/icons` iconos.
- `dist/` build para cargar unpacked.

## Rutas de la extension (UI)

Las paginas de la extension viven en `src/ui/` y se copian al build en `dist/src/ui/` con la misma ruta.

- Popup: `src/ui/popup/index.html` (referenciado en `manifest.json` como `action.default_popup`).
- Opciones: `src/ui/options/index.html` (referenciado en `manifest.json` como `options_page`).
- Dashboard: `src/ui/dashboard/index.html` (se navega desde Opciones).
- Ayuda: `src/ui/help/index.html` (se navega desde Opciones).
- Bloqueo: `src/ui/blocked/index.html` (listado en `web_accessible_resources` y usado para redirecciones).

## Datos y privacidad

- Settings y metricas viven en `chrome.storage.local`.
- Eventos y agregados diarios se guardan en IndexedDB y se persisten con SQLite (en IndexedDB).
- Exportacion/importacion de settings y metricas desde la UI.
- Archivos de datos (`focus-tube-settings.json`, `focus-tube-metrics.json`, `*.sqlite`, `*.db`, etc.) estan ignorados por git.

## Troubleshooting

- Si un bloqueo no aplica, recarga la extension y revisa permisos por dominio.
