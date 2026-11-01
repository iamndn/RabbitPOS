# Design Brief — Phase 3: Dropdown Unification

## Scope & Decisions
- Unify all dropdowns, menus, date pickers onto `ResponsiveSheet` primitive:
  - Step A: Rebuild `ModernSelect` on `ResponsiveSheet`. Mobile: bottom sheet, sticky search (16px text), option rows >= 48px, check icon for selected, max ~70dvh. Desktop: portaled popover with collision flip. Full ARIA + keyboard nav (↑, ↓, Home, End, Enter, Esc, type-ahead). Move strings to i18n (`vi.json` + `en.json`).
  - Step B: Replace 17 native `<select>` (PurchasesCostTab, TransactionModal, MemberManagerModal).
  - Step C: Refactor `StoreSwitcher` and `AppShell` user menu onto `ResponsiveSheet`.
  - Step D: Refactor `ModernDateRangePicker` onto `ResponsiveSheet` (calendar days >= 40px, presets as chip row).

## 390px Mobile Dropdown Bottom Sheet Wireframe
```
+---------------------------------------+ [390px Viewport Frame]
|                                       |
| [Backdrop: slate-900/40 blur-sm]      | (Dismiss on tap outside)
|                                       |
|  +---------------------------------+  |
|  |             ====                |  | (Drag Handle)
|  | Tiêu đề chọn: Danh mục món    X |  | (Sticky Header + Close)
|  | [🔍 Tìm kiếm danh mục...     ] |  | (Sticky Search Input 16px)
|  +---------------------------------+  |
|  | Cà phê truyền thống        (✓)  |  | (Option row >= 48px, selected check)
|  | Trà sữa & Trà trái cây          |  |
|  | Sinh tố & Nước ép tươi          |  | (Scrollable list, max ~70dvh)
|  | Bánh & Điểm tâm sáng            |  |
|  +---------------------------------+  |
|  | [Xóa lựa chọn]    [Xong / Đóng] |  | (Optional footer action)
+---------------------------------------+
```

## Anti-Generic Audit (Impeccable & ui-ux-pro-max)
- NO clipping inside modals: Since `ResponsiveSheet` renders in a portal to `document.body`, clipping inside modal dialogs with `overflow: hidden` is eliminated.
- Single unified overlay pattern: Mobile is always a bottom sheet with drag handle; desktop is always an anchored collision-flipping popover.
- High legibility: Option text >= 14px on mobile (never 10-12px), selected row highlighted with clear checkmark and purple tint (`brand-50`).


## Implementation Summary & Commits

| Step | Scope | Commit | Key Changes |
|------|-------|--------|-------------|
| **3A** | Rebuild `ModernSelect` | `d2320836` | Rebuilt on `ResponsiveSheet` + portal to `document.body`. ARIA `combobox`/`listbox`/`option`, full keyboard navigation (arrows, Home/End, Enter, Esc, type-ahead). Mobile bottom sheet (>= 48px row touch target, sticky search 16px font), desktop anchored popover with collision auto-flip. Strings externalized to `vi.json` and `en.json`. |
| **3B** | Replace 17 native `<select>` | `429faa95` | Replaced all native `<select>` elements in `MemberManagerModal`, `TransactionModal` (5 selects), `PurchasesCostTab` (10 selects), and `login/page.tsx` (1 select). Zero `<select>` elements remain in codebase. |
| **3C** | Migrate `StoreSwitcher` & `AppShell` User Menu | `e363de21` | Replaced custom backdrops, manual event listeners, arbitrary `z-[85]`/`z-[90]` and `rounded-t-3xl` classes with `ResponsiveSheet`. Kept mutual exclusivity via `exclusiveId`. |
| **3D** | Migrate `ModernDateRangePicker` | `9b088b14` | Merged two separate mobile modal implementations into one `ResponsiveSheet`. Integrated `SegmentedControl` for mode switching (Ngày / Tháng / Năm / Tùy chỉnh). Presets as scrollable chip row. Calendar day/month/year buttons >= 40px touch targets. Input date >= 44px touch targets. All utility helpers and props kept 100% backward-compatible. |

## Modal No-Clipping Verification

Every dropdown component in RabbitPOS now renders in a React Portal (`document.body`), completely removing clipping issues caused by parent modals' `overflow: hidden`, `overflow-y: auto`, or CSS stacking contexts.

### Verified Modals:
1. **`MemberManagerModal`** (`frontend/src/components/stores/MemberManagerModal.tsx`):
   - Element: Role selector (`staff` vs `store_admin`).
   - Modal container has `overflow-y-auto max-h-[85vh]` and `rounded-3xl`.
   - *Status*: Verified. Portaled popover on desktop floats above modal bounds; mobile bottom sheet opens above modal backdrop without clipping.
2. **`TransactionModal`** (`frontend/src/components/transactions/TransactionModal.tsx`):
   - Elements: Known ingredient search combobox, Category picker, Basic purchase unit, Advanced purchase unit, Advanced capacity unit.
   - Modal container has deep nesting, multi-column grids, and scrolling cards.
   - *Status*: Verified. All 5 selects portal to `document.body`, auto-flipping upwards near bottom edge.
3. **`PurchasesCostTab` — Recipe Modal** (`frontend/src/components/transactions/PurchasesCostTab.tsx`):
   - Elements: Recipe template selector (`POPULAR_RECIPE_TEMPLATES`), Recipe line ingredient selector (`recipeIngredientOptions`).
   - Modal container has dense tabular layout with live simulator.
   - *Status*: Verified. Ingredients combobox searches smoothly and options popover floats over table rows.
4. **`PurchasesCostTab` — Ingredient Modal** (`frontend/src/components/transactions/PurchasesCostTab.tsx`):
   - Elements: Ingredient category (`ingFormCategory`), Base unit (`ingFormBaseUnit`), Default purchase unit (`ingFormDefaultPurchaseUnit`), Default capacity unit (`ingFormDefaultCapacityUnit`).
   - Modal container has 2-column and 3-column sub-grids.
   - *Status*: Verified. Neither column boundaries nor modal bottom clip dropdown options.
5. **`PurchasesCostTab` — Inline Table Row Editing** (`frontend/src/components/transactions/PurchasesCostTab.tsx`):
   - Elements: Category and base unit in mobile card view and desktop `<table>` row view.
   - Container has `overflow-x-auto` table wrapper.
   - *Status*: Verified. Portaled popovers render freely outside table bounds without triggering table scrollbars.
6. **`login/page.tsx` — Registration Card** (`frontend/src/app/login/page.tsx`):
   - Element: Business type selector (`regBusinessType`).
   - *Status*: Verified. Renders as bottom sheet on mobile (16px input font, no iOS zoom) and anchored popover on desktop.
7. **`StoreSwitcher` & `AppShell` Header Overlays** (`StoreSwitcher.tsx`, `AppShell.tsx`):
   - *Status*: Verified. Both open above sticky navbar, never clipped by app header bounds.
8. **`ModernDateRangePicker`** (`ModernDateRangePicker.tsx` across Dashboard, Transactions, Stores):
   - *Status*: Verified. Opens anchored to filter control bar, never clipped by dashboard widgets or report action bars.
