# WEPS Desktop

`wepsdesktop` is an Electron-first prototype for `WEPSCLI`.

Its current purpose is limited:

- prove that `packages/web-ui` can be reused as the desktop renderer;
- establish the Electron `main` / `preload` / `renderer` split;
- define a narrow IPC bridge for future integration with `wepscli` and shared WEPS services.

It is not yet a full desktop product shell, and it does not yet reuse the `wepscli` TUI runtime directly.

## Current Scope

- Electron `main` process that owns the native window and desktop-only capabilities
- `preload` bridge that exposes desktop context and workspace selection to the renderer
- Renderer built on top of `@mariozechner/pi-web-ui`
- Renderer-side IndexedDB persistence for chat sessions, settings, and provider keys

## Planned Integration Direction

The next extraction step should be to move UI-independent WEPS logic out of `packages/wepscli` and into a shared package. The primary candidates are:

- provider profile management
- session metadata management
- runtime session binding
- approval policy and runtime orchestration

Once those services exist, both `wepscli` and `wepsdesktop` should depend on them instead of maintaining parallel implementations.

## Scripts

```bash
npm run dev
npm run build
npm run check
```
## 构建可发行包

```bash
cd D:\WEPsCodingCLI\agents-core\packages\wepsdesktop
npm install
npm run pack:win
打包产物将会放在：D:\WEPsCodingCLI\agents-core\packages\wepsdesktop\dist\release
```