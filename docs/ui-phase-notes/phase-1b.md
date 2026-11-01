# Design Brief — Phase 1B: Foundations

## Scope & Decisions
- Font Integration: Self-host approved Pairing C (Nunito for UI/brand/body, Inter for numbers/tables/KPIs).
- Loading: `next/font/local` with `--font-nunito` and `--font-inter` variables + system fallbacks; offline precached in SW shell cache (`sw.js` bumped to `v3`).
- Type Tokens: `caption` (11px), `xs` (12px), `sm` (14px), `base` (16px), `lg` (18px), `xl` (20px), `2xl` (24px), `3xl` (28px).
- Radius Tokens (D3): Controls `xl` (12px), cards `2xl` (16px), mobile sheets `3xl` (24px), pills `full`, badges `lg` (8px).
- Brand Token (D4): Purple unified scale (`brand-50` to `brand-950`, default `#7c3aed`, hover `#6d28d9`).
- Form Controls: `.app-input`, `.app-select`, `.app-textarea` upgraded to 44px on mobile (touch-safe) and 36-38px on `md+`; text 16px on mobile (prevents iOS focus zoom) and 14px on `md+`.
- Tabular Numbers: `.tabular-nums` / `.font-num` mapped to Inter with OpenType `tnum` (never blanket-applied).
- Z-Index Scale (D7): `popover: 40`, `sheet: 50`, `modal: 60`, `toast: 70`.

## Layout & Anti-Generic Audit
- No page layout modified (visual layout is preserved 1:1, only typography, sizing tokens, and input touch targets upgraded).
- Contrast: Meaningful text >= slate-500 (contrast ratio >= 4.5:1 against slate-50 canvas).
- Clean flat surfaces: Border `1px solid #e2e8f0`, soft `shadow-sm`, no colored halos or heavy decorative glassmorphism.
- Headings: `line-height >= 1.35` to guarantee Vietnamese diacritic marks (`ệ`, `ẫ`, `ử`, `ỗ`) are never clipped.
