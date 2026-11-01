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
