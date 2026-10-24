# Architecture

This document defines the core boundaries for AmiBase and the allowed dependency directions between them.

## Goals

- Keep feature work fast without coupling unrelated modules.
- Keep plugin and protocol contracts stable over time.
- Allow internals to evolve while preserving external behavior.

## Dependency rule

Dependencies flow in one direction only:

`UI Shell -> Core Services -> Infrastructure -> Plugins`

Lower layers must never import higher layers.

## 1) UI Shell boundary

**Purpose**
- Render desktop, windows, menus, notifications.
- Handle user interaction and visual state.

**Main modules**
- `_script/ui/*`
- Entry wiring in `_script/main.js`

**May depend on**
- Core Services only.

**Must not depend on**
- Infrastructure implementation details.
- Plugin internals.

## 2) Core Services boundary

**Purpose**
- App lifecycle orchestration.
- Stable business APIs for system actions.
- Message routing and capability checks.

**Main modules**
- `_script/system/system.js`
- `_script/system/network.js`
- `_script/user.js`
- `_script/applications.js`

**May depend on**
- Infrastructure adapters.
- Plugin contracts (not plugin internals).

**Must not depend on**
- UI implementation internals.
- Individual plugin source files directly.

## 3) Infrastructure boundary

**Purpose**
- Filesystem adapters, storage, transport, low-level helpers.
- Browser API integration and protocol mechanics.

**Main modules**
- `_script/system/filesystem.js`
- `_script/system/filesystems/*`
- `_script/storage.js`
- `_script/system/network/*`
- `_script/util/*`

**May depend on**
- Browser-native APIs.
- Other infrastructure utilities.

**Must not depend on**
- UI modules.
- Plugin UI or app logic.

## 4) Plugin boundary

**Purpose**
- End-user applications and optional feature extensions.

**Main modules**
- `plugins/*`

**May depend on**
- Public Core Services APIs.
- Declared plugin capabilities in `plugins/<name>/config.json`.

**Must not depend on**
- Private internals of `_script/system/*` or `_script/ui/*`.
- Other plugins unless declared as explicit plugin dependencies.

## Allowed dependency matrix

- UI Shell -> Core Services: allowed
- UI Shell -> Infrastructure: avoid direct imports (use Core Services)
- UI Shell -> Plugins: not allowed
- Core Services -> Infrastructure: allowed
- Core Services -> Plugins: allowed via contracts/runtime loading only
- Infrastructure -> Core Services: not allowed
- Infrastructure -> UI Shell: not allowed
- Plugins -> Core Services: allowed via public API only
- Plugins -> Infrastructure/UI internals: not allowed

## Contract notes

- Keep `export default` APIs stable for existing entry modules.
- Version external contracts that cross boundaries (`apiVersion`, protocol `v`).
- Prefer small adapter modules at boundary crossings.
- Plugin capability contract lives in `docs/plugin-capabilities.md`.

