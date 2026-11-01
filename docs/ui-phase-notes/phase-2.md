# Design Brief — Phase 2: Shared UI Primitives

## Scope & Decisions
- Build 7 standalone, accessible primitives in `components/ui/` (Zero pages wired yet):
  1. `Button` & `IconButton`: 5 variants (primary, secondary, soft, ghost, danger), 3 sizes (sm, md, lg), mobile touch target >= 44px, active/focus/loading states.
  2. `FieldShell`: Accessible form wrapper (label + input slot + hint/error message).
  3. `Chip` & `FilterPill`: Filter tags with active state, count badge, remove action.
  4. `SegmentedControl`: Accessible `role="tablist"`, keyboard arrows, full-width support.
  5. `Badge`: 5 semantic variants (brand, success, warning, danger, neutral), minimum 11px text.
  6. `Card`: Surface container (header, title, description, content, footer) with `shadow-sm`.
  7. `ResponsiveSheet`: Portal-rendered; mobile = 85dvh bottom sheet with drag handle, scroll lock, pb-safe, Esc dismiss; md+ = anchored collision-flipping popover.

## 390px Mobile ResponsiveSheet Wireframe
```
+---------------------------------------+ [390px Viewport Frame]
|                                       |
| [Backdrop: slate-900/40 blur-sm]      | (Dismiss on tap outside)
|                                       |
|  +---------------------------------+  |
|  |             ====                |  | (Drag Handle: 40px x 4px)
|  | Title / Action Header           |  | (Sticky Header, border-b)
|  +---------------------------------+  |
|  | Content Body                    |  |
|  | - Scrollable options / filters  |  | (Max height ~85dvh)
|  | - Touch rows >= 48px            |  |
|  +---------------------------------+  |
|  | Sticky Action Footer (Apply/Esc)|  | (pb-safe bottom inset)
+---------------------------------------+
```

## Anti-Generic Audit (Impeccable & ui-ux-pro-max)
- NO identical rounded cards for everything: Radius hierarchy enforced (controls xl, cards 2xl, sheets 3xl, pills full).
- NO decorative animations or gradients: Transitions are strictly user-initiated (click/tap/hover), 150-200ms ease-out, respecting `prefers-reduced-motion`.
- High contrast states: Primary button is `#7c3aed` with white text (contrast ratio > 4.5:1), border `slate-200`, meaningful text >= `slate-500`.
