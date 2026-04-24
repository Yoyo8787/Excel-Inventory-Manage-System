# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server (ng serve)
npm run build      # production build
npm run watch      # watch mode (ng build --watch --configuration development)
npm test           # unit tests (ng test → Vitest)
```

## Architecture Overview

This is a **pure client-side Angular 21 SPA** for inventory and order management. There is no backend, no router, and no persistence — all data lives in memory and is saved/loaded via Excel workbooks.

### Page Navigation (No Angular Router)

Pages are switched via `LayoutService.page` signal. `app.html` uses `@switch (page())` control flow. Menu items in [src/app/components/sidenav/menu.ts](src/app/components/sidenav/menu.ts) define page names (not router links).

### State Management

`StoreService` holds a single `AppState` signal. All mutations go through it:

```typescript
// Read
const state = inject(StoreService).state;          // Signal<AppState>
const count = computed(() => state().products.length);

// Write
this.#store.applyOrderImport(result);
this.#store.markDirty('order-import');
```

Dirty state tracking: `markDirty(reason)` / `clearDirty()` / `markSaved()` — used to warn before page unload and to gate export.

### Data Flow (Order Import)

```
User drops Excel file (OrdersPage / Dropzone)
  → ExcelIoService.parseOrderWorkbook()       — raw XLSX rows
  → OrderImportService.importOrders()         — platform detection (A/B/C) + normalize
  → ValidationService (Zod schemas)           — validate each row
  → StoreService.applyOrderImport()           — write to AppState signal
  → Components re-render via computed()
```

### Platform Support

Three platforms identified by Excel column headers:
- **Platform A** — 好蒔光
- **Platform B** — 仙姑
- **Platform C** — 綠崎

Detection logic and column mappings are in [src/app/core/services/order-import.service.ts](src/app/core/services/order-import.service.ts).

### Excel Workbook Schema

System workbook (exported/loaded) uses sheets: `meta`, `products`, `mappings`, `orders`, `order_lines`, `inbounds`. See README.md for the full column definitions per sheet.

## Key Files

| File | Purpose |
|------|---------|
| [README.md](README.md) | Full spec — single source of truth for requirements |
| [src/app/core/models/index.ts](src/app/core/models/index.ts) | All domain interfaces (Product, Order, Mapping, etc.) |
| [src/app/core/services/store.service.ts](src/app/core/services/store.service.ts) | Central AppState via Angular Signals |
| [src/app/core/services/order-import.service.ts](src/app/core/services/order-import.service.ts) | Platform detection + row normalization |
| [src/app/core/services/excel-io.service.ts](src/app/core/services/excel-io.service.ts) | XLSX parse/generate + file-saver download |
| [src/app/core/services/validation.service.ts](src/app/core/services/validation.service.ts) | Zod schemas for order validation |
| [src/app/app.ts](src/app/app.ts) | Root component, page switch logic |

## Conventions

- **Standalone components** — no NgModule. Imports declared inline on each component.
- **Signals everywhere** — `signal()` / `computed()` / `inject()` pattern. Avoid RxJS for state.
- **Models are plain interfaces** — no classes. Factory functions like `createEmptyAppState()` for defaults.
- **Immutable updates** — `this.#state.update(s => ({ ...s, orders: [...s.orders, newOrder] }))`.
- **Validation via Zod** — use `safeParse()`, never throw. Return `{ success, data | errors }`.
- **Error display** — call `LayoutService.showError(msg)` for user-facing errors; `toErrorMessage()` utility for consistent string extraction from unknown errors.
- **i18n** — all user-facing labels and text must use i18n (not hardcoded strings).

## Tech Stack

| Technology | Role |
|-----------|------|
| Angular 21 (standalone) | UI framework |
| Angular Signals | State management |
| Angular Material 21 | UI component library |
| TailwindCSS 4 | Utility CSS |
| XLSX 0.18 | Excel read/write |
| Zod 4 | Schema validation |
| dayjs | Date parsing/formatting |
| nanoid | Unique ID generation |
| Vitest 4 | Unit tests |

## Implementation Status

Core models, services (store, excel-io, order-import, validation, layout), InitPage, DashboardPage, and OrdersPage are implemented. The following pages are placeholders (directories exist, not yet built): products, mappings, inbounds, manual-order, settings. Unit tests are not yet written.
