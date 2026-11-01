# Design Brief — Phase T1: Tahoe Tokens, Typography Cutover & Font Cleanup

## Scope & Token Decisions (`feat/ui-tahoe` in `/opt/RabbitPOS-tahoe`)
- **3-Layer CSS Variables (`globals.css`)**: Primitive -> Semantic -> Component tokens with dark-ready `html.dark` slots; canvas `#F2F4F8` (`bg-canvas`), recessed `#EAECEF` (`bg-surface-grouped`), opaque cards `#FFFFFF` (`bg-surface-card`).
- **Materials (`P1`, `A1`, `A2`)**: `glass-thin` (`74%` white, `12px` blur), `glass-regular` (`82%` white, `20px` blur), `glass-thick` (`88%` white, `28px` blur), `glass-scrim` (`40%` slate-950, `0px` blur), and solid opaque POS Cart Bar `--surface-cart-bar: #2E1065` (`0px` blur).
- **Blur Budget & Safety Valves (`A1`, `Q3`)**: `html[data-overlay-open="true"]` demotes shell/sticky glass tokens to opaque `#FFFFFF`/`#F8FAFC` (`<= 3` simultaneous blurs); `html.no-glass` (`rabbitpos_glass_effects` pre-paint sync), `prefers-reduced-transparency: reduce`, `prefers-contrast: more`, and `@supports not (...)` disable blur automatically.
- **Typography & Font Cleanup (`Q1`, `Item 2`)**: UI/headings use `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), system-ui, sans-serif`; `.font-num`/`.tabular-nums` use `var(--font-inter)` + OpenType `tnum` (`11px` caption floor, `>= 1.35` VN heading line-height, `16px` mobile inputs). Rewire `layout.tsx`, `globals.css`, `tailwind.config.ts`, `sw.js` (`v4`) in Commit 1A BEFORE deleting 26 unused `.woff2` files/dir in Commit 1B (retaining `48,256` B + `10,252` B = `58,508` B).
- **Concentric Radius & Z-Scale**: `xs:6px`, `sm-tahoe:8px`, `field:12px`, `card:16px`, `panel:20px`, `sheet:28px`, `capsule:9999px`; collision-free z-index `10, 20, 30, 35, 50, 60, 70, 75, 80, 90`.

## Material & Z-Layer Stack (No Page Layout Changes in T1)
```text
[z-90 Toast: glass-regular]  [z-75/80 Sheet/Alert: glass-thick]
[z-50/60 Modal: glass-thick; demotes when nested child opens]
[z-35 POS Cart Bar: SOLID #2E1065 (0px blur)]  [z-30 Shell Bars: glass-regular -> #FFF on overlay]
[z-0..10 Canvas #F2F4F8 + Opaque #FFFFFF Cards (0px blur)]
```

## Anti-Generic Critique & Pre-Build Revisions (`impeccable` + `design-system` + `ui-ux-pro-max`)
- **Removed uppercase eyebrow labels**: Revised `.app-label` from `uppercase tracking-wider text-caption` to sentence-case `text-subhead font-medium text-slate-700` (eyebrow labels are a banned generic AI habit).
- **Refused decorative glass & uniform radius/shadow**: Zero blur on content cards or POS cart bar; distinct concentric radii and directional offset shadows (`shadow-card` vs `shadow-glass-sm..xl`), zero colored glow halos.
- **No Tailwind v4 compatibility shim (`Item 5`)**: `shadow-2xs`, `shadow-xs`, and `backdrop-blur-xs` are NOT defined in `tailwind.config.ts`; they will be replaced per file in Phases T2–T5.
- **Themed browser surfaces**: Brand selection highlight, `focus-visible` ring, tabular figures, custom thin scrollbars, and `#F2F4F8` PWA `themeColor`.
