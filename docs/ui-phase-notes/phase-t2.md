# Design Brief — Phase T2: Tahoe Primitives, Overlays & Isolated `/ui-gallery`

## Decisions & Token Mapping (`2A -> 2B -> 2C -> 2D` + Isolated `G1-D3`)
- **2A Atomic Controls (`0` blur)**: `Button` & `IconButton` (`rounded-full` capsule, `sm:36/32px`, `md:44/36px`, `lg:48/44px`, `:active` `scale(0.97)`/`0.95`, `aria-busy` loading); `Card` (opaque `bg-surface-card`, `rounded-card` `16px`, `border-card`, `shadow-card`); `Badge` (`rounded-full`, `11px` `text-caption` floor); `Chip`/`FilterPill` (opaque capsules, `11px` count pills); `SegmentedControl` (`bg-surface-grouped` capsule track + white `shadow-glass-sm` thumb); `FieldShell` (sentence-case `text-subhead`); new `Switch` (`44x26px` track inside `44px` hit target, `role="switch"`) & `Divider` (`full`/`inset`/`vertical`/`labeled` hairline).
- **2B Layout & `ModalShell`**: `ListGroup`/`ListRow` (opaque `#FFFFFF` `rounded-card`, inset hairline, `min-h-[48px]` mobile); `EmptyState` & `Skeleton` (opaque); `ModalShell` (`z-50`/`z-60`, `glass-thick` platter over `0px`-blur `glass-scrim`, ref-counted `html[data-overlay-open="true"]` + parent `data-under-nested-overlay="true"` demotion `A1`).
- **2C Overlays & Pending Lock (`Q5`, `Q6`, `Item 5`)**: `ResponsiveSheet` (`z-75` sheet / `z-70` popover, `glass-thick`, `0px`-blur `glass-scrim`, opaque footer removing `backdrop-blur-sm`, `detent` presets + `48px` header/grabber-only pointer drag); `ModernSelect`, `ModernDateRangePicker`, `FilterBar`, `ToastContainer` (`z-90` `.glass-toast`), and `ConfirmModal` (`z-80`, dual synchronous `useRef` + `isLoading` lock blocking double click/Enter/Esc/backdrop while pending, removing all `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs`/`animate-in` in touched files).
- **2D `/ui-gallery` (`Q7`) + Isolated `G1-D3`**: `notFound()` unless `NODE_ENV !== 'production' && NEXT_PUBLIC_ENABLE_UI_GALLERY === 'true'`; `isAdmin()` guard; `0` nav links; `0` API calls (1-block `StoreContext.tsx` guard isolated in its own revertable commit); busy worst-case contrast backdrop, toggles (Glass, Reduced Transparency, High Contrast, Long VN), `Item 5` no-op diff, `Q8` `SF Pro` vs `Inter` `tnum` row/KPI comparison, and live `backdrop-filter` budget meter (`<= 3`).

## 390px Mobile ASCII Wireframes (`ResponsiveSheet`, `ConfirmModal`, `/ui-gallery`)
```text
[ResponsiveSheet z-75]            [ConfirmModal z-80 Pending]     [/ui-gallery 390px Specimen]
+-------------------------------+ +-----------------------------+ +-------------------------------+
| [glass-scrim 40% - 0px blur]  | | .-------------------------. | | [Busy Photo/Mesh Backdrop]    |
| .---------------------------. | | | [!] Xoa giao dich?      | | | [Glass|RedTrans|HiCon|LongVN] |
| |      ===== (48px drag) (X)| | | |     Khong the hoan tac. | | | [Blur Meter: 2/3 PASS]        |
| |---------------------------| | | |-------------------------| | | [Sec 0: No-Op vs Tahoe Diff]  |
| | [Opaque/List Body Rows]   | | | | ( Huy [lock] )( o Xoa..)| | | [Sec 1: Q8 SF vs Inter tnum]  |
| |---------------------------| | | '-------------------------' | | [Sec 2-4: All 7 States + A2]  |
| | [Opaque #FFF Footer 0blur]| | +-----------------------------+ +-------------------------------+
```

## Anti-Generic Critique & Pre-Build Revisions
- **Zero decorative blur**: Removed `backdrop-blur-sm` from `ResponsiveSheet` backdrop (`:193`) and sticky footer (`:250`); only the sheet platter itself carries `glass-thick` (`1` blur pass).
- **Killed uppercase eyebrows & micro-text**: Replaced `uppercase` `text-[10px]`/`text-[9px]` in `FieldShell`, `ModernSelect`, `ModernDateRangePicker`, and `ToastContainer` with sentence-case `text-subhead`/`text-footnote` and `11px` `text-caption` floor.
- **No ghost/glow shadows**: Replaced dead `shadow-2xs`/`shadow-xs` per context (`0px` on inline badges/nested boxes, `shadow-card` on cards, `shadow-glass-sm` on active thumbs).

