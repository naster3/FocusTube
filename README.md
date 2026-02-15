# FocusTube Blocker

Extension MV3 para gestionar bloqueos y horarios de sitios web con listas personalizadas.

## Caracteristicas

- Bloqueo por horarios (intervalos por dia).
- Bloqueo permanente + sesion semanal.
- Modo estricto con PIN.
- Lista permitida (whitelist) para URLs o dominios.
- Bloqueos rapidos para sitios populares.
- Dashboard con metricas y exportacion.

## Autor

Manuel Adolfo Deño de los Santos

## Requisitos

- Node.js + npm

## Desarrollo (UI)

1. Instalar dependencias:

```bash
npm i
```

1. Servidor dev (solo UI):

```bash
npm run dev
```

## Build

```bash
npm run build
```

El bundle sale en `dist/`.

## Cargar extension (unpacked)

1. Abre la pagina de extensiones de Chrome/Brave.
1. Activa Developer mode.
1. Click en "Load unpacked" y selecciona la carpeta `dist/`.

## Scripts utiles

- `npm run dev`: UI en modo dev.
- `npm run build`: build completo + manifest.
- `npm run test`: tests (vitest).
- `npm run encoding:check`: valida UTF-8 (sin BOM) + normalizacion NFC + deteccion de mojibake.
- `npm run encoding:fix`: corrige automaticamente encoding/normalizacion en archivos de texto.
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
- Politica de privacidad: `docs/PRIVACY_POLICY.md` (publicala en una URL antes de subir a Chrome Web Store).

## Publicar en Chrome Web Store

- Checklist y texto sugerido: `docs/STORE_LISTING.md`.
- Guia tecnica corta (arquitectura, mensajes, release): `docs/TECHNICAL_ONE_PAGER.md`.

## Troubleshooting

- Si un bloqueo no aplica, recarga la extension y revisa permisos por dominio.
