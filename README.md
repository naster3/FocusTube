# FocusTube Blocker

## Dev

1) Install deps:

```
npm i
```

2) Run dev server (UI only):

```
npm run dev
```

## Build

```
npm run build
```

This outputs the extension bundle to `dist/`.

## Load unpacked

1) Open Chrome/Brave extension page.
2) Enable Developer mode.
3) Click "Load unpacked" and select the `dist/` folder.

## Structure

- `src/` source code (background/content/ui/shared)
- `src/manifest/manifest.base.json` template manifest
- `public/icons` extension icons
- `dist/` build output for load unpacked
