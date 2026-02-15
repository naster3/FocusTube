# One Pager Tecnico

## Objetivo

Guia operativa de arquitectura, flujo de mensajes y release/versionado para FocusTube Blocker (MV3).

## Arquitectura por capas

- `src/domain/*`: reglas puras de negocio (bloqueo, horarios, metricas, tipos).
- `src/infrastructure/*`: persistencia y adaptadores (`chrome.storage`, IndexedDB/SQLite).
- `src/background/*`: orquestacion MV3 (service worker, tabs, metricas, mensajeria).
- `src/content/*`: integracion en paginas (handshake, visibilidad, chequeo de bloqueo, overlay).
- `src/ui/*`: vistas React (`popup`, `options`, `dashboard`, `help`, `blocked`).
- `src/shared/*`: utilidades transversales (i18n, mensajes, logging, helpers).

Regla practica:
- `ui` y `background` pueden depender de `domain` e `infrastructure`.
- `domain` no depende de `ui` ni de APIs de Chrome.

## Flujo de mensajes de extension

Contrato tipado central:
- `src/shared/messages.ts`

Listener principal:
- `src/background/messaging.ts`

Flujo normal de bloqueo:
1. `content` envia `CHECK_BLOCK` con URL actual.
1. `background` evalua con `evaluateBlock(...)`.
1. Si bloquea, registra intento y la pagina navega a `src/ui/blocked/index.html?url=...`.
1. `blocked` puede consultar `GET_LAST_ATTEMPT` (fallback de URL).
1. `blocked` envia `BLOCKED_PAGE_TICK` para tiempo bloqueado visible.

Flujo de estado/timeline:
1. `content` envia `PAGE_HELLO` al cargar.
1. `content` envia `VISIBILITY_CHANGED` en cambios de visibilidad.
1. `popup/overlay/blocked` consultan `GET_TIMELINE` para UI de estado.

Mensajes de soporte:
- `CLOSE_ACTIVE_TAB`, `METRICS_GET`, `METRICS_RESET`.

## Release y versionado (operativo)

Versiones de referencia:
- App: `package.json` -> `version`.
- Extension: `src/manifest/manifest.base.json` y `manifest.json` (sincronizadas automaticamente con scripts).

Esquema de datos (storage):
- `SETTINGS_SCHEMA_VERSION`: `src/domain/settings/defaults.ts`.
- `METRICS_SCHEMA_VERSION`: `src/domain/settings/defaults.ts`.
- Migraciones y merge: `src/infrastructure/storage.ts`.
- Tests de migracion: `src/tests/storageMigrations.test.ts`.

Regla SemVer:
- `patch`: fixes sin cambios de comportamiento publico.
- `minor`: features compatibles.
- `major`: cambios incompatibles o migraciones rompientes.

Checklist de release:
1. Subir version con script:

```bash
pnpm run version:patch
# o: pnpm run version:minor
# o: pnpm run version:major
```
1. Ejecutar calidad local:

```bash
npm run encoding:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

1. Si hubo cambios de UI/CSS, correr tambien:

```bash
npm run test:e2e:visual
```

1. Validar artefacto en `dist/` y cargar unpacked en Chrome.
1. Crear commit y tag de release (`vX.Y.Z`).
1. Publicar paquete de `dist/` en Chrome Web Store.

## CI minima esperada en PR

- `Lint, Typecheck, Test, Build` obligatorios.
- `E2E + Visual Snapshots` en PR hacia `main` cuando hay cambios UI/CSS.
