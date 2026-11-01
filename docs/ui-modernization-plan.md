# RabbitPOS — UI Modernization Plan (Mobile-First)

> [!IMPORTANT]
> **SUPERSEDED BY TAHOE ("LIQUID GLASS") REDESIGN PLAN (`2026-11-01`)**:
> - **Phases 1B through 6**, Section **2A ("evolve, do not redesign")**, and tokens **D2 (type scale numbers)**, **D3 (radius)**, **D6 (surfaces)**, and **D7 (overlay)** in this document are **SUPERSEDED** by [`docs/ui-tahoe/05-execution-plan.md`](file:///opt/RabbitPOS/docs/ui-tahoe/05-execution-plan.md) and the full specification suite under [`docs/ui-tahoe/`](file:///opt/RabbitPOS/docs/ui-tahoe/) (`00` through `06`).
> - **STILL BINDING / ACTIVE REFERENCE**:
>   1. All **HARD GUARDRAILS** in Section 5.0 (presentation layer only; zero backend/API/DB/business-logic/auth/offline/cart-state changes; zero new npm dependencies; no global find-and-replace; all user-facing strings through `vi.json` + `en.json`; `src/tests/*` untouched; `AGENTS.md` compliance).
>   2. The **skill precedence order** in Section 2A (`owner decisions` -> `AGENTS.md + hard guardrails` -> `repo conventions` -> `skills`) and logging of rejected skill rules.
>   3. **Phase 1A measured font benchmark outputs** (`docs/font-specimen/README.md`), as updated by Owner Override **Q1** in [`docs/ui-tahoe/06-open-questions.md`](file:///opt/RabbitPOS/docs/ui-tahoe/06-open-questions.md) (system font stack on Apple platforms + self-hosted **Inter Variable** `latin` + `vietnamese` subsets as fallback on non-Apple platforms and for all tabular numerals; `Nunito` and static font files removed).

Scope: font, border/radius, buttons, layout, **all dropdown menus and filters**. Focus: phones (360–430px), then tablet/desktop.
Source of truth: live repo `github.com/iamndn/RabbitPOS` → `frontend/src` (audited; the older snapshot in project docs is outdated).
Mode: **planning document + scoped prompts for the Antigravity Agent.** No code in this file.

---

## 1. Audit Findings (verified in repo)

| # | Area | Finding | Impact |
|---|------|---------|--------|
| 1 | Font | Only a system font stack (`globals.css`); no webfont, no tabular numerals for money | Inconsistent look across iOS/Android/Windows; Vietnamese diacritics uneven; money columns do not align |
| 2 | Type scale | `text-[10px]` ×383, `text-[11px]` ×350, `text-[9px]` ×34, `text-[8px]` ×2; `text-xs` ×960 vs `text-sm` ×169 | Most UI is ≤12px; hard to read on phones in a busy shop |
| 3 | Brand color | `purple` (~380 text / ~359 bg) mixed with `indigo` (~240 / ~179) and `violet`; CSS var `--primary` is purple but components hard-code classes | Two competing brand hues, no single source of truth |
| 4 | Radius | `rounded-xl` ×646, `2xl` ×264, `lg` ×255, `full` ×197, `md` ×74, `3xl` ×52 | No rule per component type |
| 5 | Buttons | No shared Button. 10+ ad-hoc padding combos (e.g. `px-3 py-2`, `px-4 py-2.5`, `px-5 py-2.5`), nearly all `text-xs` | Inconsistent size/states; many below 44px touch target |
| 6 | Form controls | `.app-input` / `.app-select` are `h-9` (36px) with `text-xs` on mobile | Below touch target; <16px inputs trigger iOS focus-zoom (masked today only by `maximumScale=1`) |
| 7 | Dropdown (`ModernSelect`) | 25 usages / 15 files. On mobile it is an absolute popover with a faint backdrop; option and search text is 12px; no keyboard navigation or ARIA; per-instance `window` listeners; flip logic uses a hard-coded `+210px` guess; not portaled (clipping risk inside `overflow-hidden` modals); hard-coded Vietnamese defaults | Weakest mobile interaction in the app |
| 8 | Native `<select>` leftovers | `PurchasesCostTab` ×10, `TransactionModal` ×5, `MemberManagerModal` ×1, `login` ×1 | Looks and behaves differently from `ModernSelect` |
| 9 | Overlay duplication | `AppShell` user menu and `StoreSwitcher` copy the same bottom-sheet class string (`z-[85]`/`z-[90]`); `ModernDateRangePicker` has two mobile-sheet variants with different backdrops; `ModernSelect` uses a third pattern | Drift, inconsistent z-index and behavior |
| 10 | Filters | Each page hand-rolls its filter row; `HorizontalScroller` is used in `transactions` and `dashboard` | No standard mobile filter pattern |
| 11 | File size | `transactions/page.tsx` 3,875 lines; `settings` 2,199; `dashboard` 1,847; POS `page.tsx` 1,697; `products` 1,440; `users` 1,372 | Must be changed in slices, never one big pass |
| 12 | Dark mode | Tokens exist but only 4 `dark:` usages | **Out of scope** |

---

## 2. Design Decisions (defaults — override before execution if needed)

- **D1 Font (decision gate, not pre-decided):** the agent builds a specimen page with 3 candidate pairings rendered with real POS content; **the owner picks**; the choice is recorded in `docs/font-decision.md`. Candidates, in recommended order:
  - **A — Plus Jakarta Sans (headings, buttons, brand) + Inter (body, inputs, tables, money, KPIs).** Modern, friendly, still professional; Inter supplies tabular numerals so amounts align.
  - **B — Be Vietnam Pro (single family).** Designed for Vietnamese, best-looking diacritics, most "local" feel. Check tabular-numeral support and file weight before choosing.
  - **C — Nunito + Inter for numbers.** Rounded and warm, suits a juice/coffee brand; less "business-like" in dense tables.
  - Fallback if the owner wants zero risk: Inter only.
  Constraints for any choice: OFL license; full Vietnamese coverage (incl. stacked marks like ệ ẫ ử ỗ); self-hosted woff2 (no build-time network fetch); max 2 families and ≤ ~200 KB of woff2 total; `display: swap`; precached by the service worker (app must work offline); tabular numerals for currency/KPIs/table amounts; line-height tuned for Vietnamese diacritics (≥1.4 body, no clipped marks in `leading-tight` headings).
- **D2 Type scale:** controls and body 14px desktop; **inputs 16px on mobile**; secondary 12px; badges/captions **minimum 11px**. Ban `text-[8px]`, `text-[9px]`, `text-[10px]`. Add named tokens instead of arbitrary pixel values.
- **D3 Radius:** controls (button/input/select) `xl`; cards/panels `2xl`; mobile sheets `rounded-t-3xl`, desktop popovers/modals `2xl`; chips/pills `full`; small badges `lg`. Stop using `md`/`lg` on controls.
- **D4 Brand color:** one brand = purple. Indigo/violet remain only for data-viz or semantic meaning, never for chrome (primary buttons, focus rings, selected states, active tabs). Semantic colors unchanged (emerald/rose/amber).
- **D5 Touch targets:** below `md`, every tappable control ≥44px high, list/option rows ≥48px, icon-only buttons ≥40px hit area. Desktop keeps compact 36–40px.
- **D6 Surfaces:** default border `slate-200`; cards `shadow-sm`; heavy shadow only on overlays; visible `focus-visible` ring on all interactive elements; meaningful text no lighter than `slate-500` (contrast).
- **D7 Overlay system:** one primitive. **Mobile = bottom sheet, desktop = anchored popover.** One z-index scale (dropdown < sheet < modal < toast), inventoried first, then enforced.

---

## 2A. Leveraging the Agent's Frontend Skills (ui-ux-promax, taste-skill, others)

The agent has design/frontend skills installed. The plan uses them as **rule sources and critics**, not as a license to redesign. The skills' contents are not visible from this planning side, so the prompts make the agent read them at runtime and report what it applied.

**Precedence (highest wins):** owner decisions in this plan → `AGENTS.md` + hard guardrails → existing repo conventions and `docs/font-decision.md` → skills. Every skill rule that is rejected must be logged with a reason.

| Phase | ui-ux-promax (UX rules, patterns, checklists) | taste-skill (craft, hierarchy, anti-generic critique) |
|-------|-----------------------------------------------|--------------------------------------------------------|
| 0 Inventory | Audit against its UX checklists (touch targets, contrast, focus, forms, mobile nav) | Flag "generic AI design" tells already present (identical rounded cards, one radius everywhere) |
| 1A Font gate | Typography/pairing guidance for a Vietnamese F&B POS; may add up to 2 extra pairings (D, E) that satisfy the D1 constraints | Critique the specimen page; owner still decides |
| 1B Foundations | Contrast, spacing rhythm, token sanity; may refine shades of the **existing purple** (no hue change) | Radius/shadow/border hierarchy per component type |
| 2 Primitives | Component UX rules, accessibility states | State design (hover/active/focus/disabled/loading), motion only in response to user action |
| 3 Dropdowns | Select/sheet/combobox mobile patterns, keyboard and focus rules | Option-row density, selected-state clarity |
| 4 Filters | Mobile filter patterns, thumb-zone placement, apply/reset behavior | Calm hierarchy: one emphasized control per bar |
| 5 Sweep | Per-screen checklist | Per-screen critique: one memorable element, cut the rest ("remove one accessory") |
| 6 QA | Pre-delivery checklist, results included in the QA report | Final consistency critique |

**What skills must NOT do here:** add dependencies, UI kits, icon sets or animation libraries; introduce dark mode; change the brand hue; add gradients, hero sections, decorative illustration or entrance animations on lists; reorganize information architecture; rewrite copy beyond UI labels (all through i18n); run generators/scripts that need installs or network without asking.

**Mindset:** RabbitPOS is an operational tool used under time pressure. "Taste" here = clear hierarchy, consistent patterns, readable density, restraint. Evolve the existing UI; do not redesign it.

**Per-phase loop (from the design skills):** short design brief → review against generic defaults → revise → build → self-critique with 390px and 1024px screenshots if the agent has a browser tool (otherwise mark visual checks NOT VERIFIED).

---

## 3. Phased Plan

**Phase 0 — Inventory (no code changes).** Produce a checklist file listing every dropdown, filter row, popover, modal and fixed-position element with file + line, z-index values in use, and which pattern each follows. Output: `docs/ui-inventory.md`.

**Phase 1A — Font specimen (decision gate, no app changes).** Build one self-contained HTML file in `docs/font-specimen/` (local woff2 via `@font-face`, opens by double-click, no app code touched) that shows every candidate pairing side by side inside a 390px phone frame and a desktop frame, using real content: Vietnamese menu names and diacritic stress text, prices (`45.000đ`, `1.250.000 ₫`), KPI cards, a ledger table with right-aligned amounts, buttons, badges, form inputs, at 11/12/14/16/20/28px and weights 400/500/600/700. Include a toggle for tabular numerals and for `leading-tight` vs normal line-height.
Exit: owner opens the file on a real phone and desktop, picks one pairing; agent records it in `docs/font-decision.md` with file sizes.

**Phase 1B — Foundations.** Load the approved font, type-scale tokens, brand color token, radius/shadow tokens, z-index scale, base form-control classes upgraded (16px on mobile, 44px height on mobile), add font files to the service-worker shell cache. No page edits except root layout/CSS/Tailwind config/`public/sw.js`.
Exit: app renders identically in layout, only font/size tokens changed; offline load still shows the correct font; `typecheck` passes.

**Phase 2 — Shared primitives** (in `components/ui/`, reuse existing deps only: `lucide-react`, `clsx`, `tailwind-merge`):
`Button` / `IconButton` (primary, secondary, soft, ghost, danger; sm/md/lg; loading; disabled), `FieldShell` (label + control + hint/error), `Chip` / `FilterPill`, `SegmentedControl`, `Badge`, `Card`, and **`ResponsiveSheet`** (portaled; bottom sheet with drag handle, safe-area padding, body scroll lock, Esc/backdrop dismiss on mobile; anchored popover with collision flip on `md+`).
Exit: primitives documented in a short usage note; none wired into pages yet.

**Phase 3 — Dropdown unification (highest value).**
1. Rebuild `ModernSelect` on `ResponsiveSheet`, keeping its public props backward compatible. Mobile: bottom sheet, sticky search (16px), option rows ≥48px, clear selected state with check, max height ~70dvh. Desktop: portaled popover with flip. Add keyboard navigation (↑ ↓ Home End Enter Esc, type-ahead) and ARIA (combobox/listbox/option). Move hard-coded strings to i18n (vi + en).
2. Replace the 17 native `<select>` with `ModernSelect` (compact size inside table rows in `PurchasesCostTab`).
3. Move `AppShell` user menu and `StoreSwitcher` onto `ResponsiveSheet`; remove the duplicated class strings.
4. Move `ModernDateRangePicker` onto `ResponsiveSheet`, merging its two mobile variants; presets as scrollable chips; calendar day cells ≥40px.
Exit: one dropdown look/behavior app-wide; no native selects (except where justified in writing); no clipping inside modals.

**Phase 4 — Filter bars.** Create a standard `FilterBar` pattern: full-width search (44px) → horizontally scrollable chip row (existing `HorizontalScroller`, snap + edge fade) → **"Filters" button with active-count badge** opening a bottom sheet (stacked selects, date range, sticky Apply / Reset footer). Desktop shows everything inline. Apply to, in this order: `transactions` (ledger, orders, purchases-cost tabs), `dashboard`, `products`, `users`, `stores`, `promotions`/`purchases`, then modal-level filters (`DiscountedOrdersModal`, `AllProductsRankingModal`, `ProductSalesPerformanceSection`, `PromotionsModal`, `EmailReportModal`).
Exit: every list/report screen uses the same filter pattern on mobile.

**Phase 5 — Buttons, layout, modals sweep (per page, small slices).** Replace ad-hoc buttons with `Button`; standard page header (title + primary action, wraps on mobile); consistent page padding and gaps; modals become near-full-height sheets on mobile with sticky action footer and safe-area padding; cards/tabs/segmented controls use primitives; apply D2/D3/D4 token migration per file. Order: POS (`page.tsx` + `components/pos/*`) → `transactions` → `products` → `dashboard` → `funds` → `settings` → `users` → `stores` → `login`.
Exit: no `text-[8|9|10px]` left; no raw indigo/violet in chrome; no ad-hoc button class strings.

**Phase 6 — QA & hardening.** `npm run typecheck`; existing `src/tests/*` runners still pass untouched; one final CI build; manual matrix at 360, 390, 430, 768, 1024, 1440 widths; iOS Safari + Android Chrome + installed PWA; checks for safe-area, keyboard-open layouts, long Vietnamese labels, offline banner, bottom-nav overlap, POS cart bar overlap.

---

## 4. Risks and Mitigations
- **10px→11px migration (≈380 places)** will reflow dense rows → migrate per file with visual check; allow `leading-tight`/truncate fixes only where overflow appears.
- **Indigo→purple** can destroy intentional chart/KPI color variety → touch chrome only (see D4).
- **`transactions/page.tsx` size** → change by section/tab, commit per section.
- **Sheet vs popover inside modals** → portal + z-scale; test every modal that hosts a select.
- **Font download at Docker build** → use committed local font files, not a build-time network fetch.
- **`userScalable=false`** (accessibility) → *do not change*; flag in final report only.

---

## 5. Agent Prompts

### 5.0 Master Prompt (paste at the start of every phase)

```
You are working on RabbitPOS (github.com/iamndn/RabbitPOS), directory frontend/. Task family: UI modernization, mobile-first. Read AGENTS.md first and obey it (non-interactive commands only; typecheck with `npm run typecheck` or `npx --no-install tsc --noEmit`; do NOT run `npm run build` per step; one `CI=true NEXT_TELEMETRY_DISABLED=1 npm run build` only in the final phase; git commits need -m; network commands need timeout).

Language: all code, comments, identifiers, commit messages in English. User-facing strings go through the existing i18n (LanguageContext, vi.json + en.json) — add keys to BOTH files; never hard-code Vietnamese or English UI text.

HARD GUARDRAILS
- Presentation layer only. Do NOT change backend, API contracts, DB schema, business logic, auth, offline/sync, cart state, or localStorage keys (e.g. rabbitpos_active_cart).
- Do NOT add npm dependencies. Use lucide-react, clsx, tailwind-merge, Tailwind 3 only. If you believe a dependency is required, stop and ask.
- Keep public props of ModernSelect, ModernDateRangePicker, HorizontalScroller backward compatible. Existing call sites must keep working unchanged unless the phase says to migrate them.
- No global find-and-replace across the repo. Edit file by file, review each diff. Never mass-replace colors or sizes with sed.
- Preserve: viewport settings, safe-area utilities (pb-safe etc.), fixed bottom nav, POS cart bar offset, PWA behavior, sticky headers. Do not change userScalable/maximumScale.
- Do not touch src/tests/*. They must still pass.
- Do not introduce dark-mode work, new features, or the inventory/stock module (out of business scope per AGENTS.md).
- Do not commit build artifacts (.next/) or push without being asked.
- Change ONE file group at a time, keep diffs small, commit after each logical slice with a clear message.

DESIGN RULES (apply everywhere you touch)
- Font: use ONLY the pairing recorded in docs/font-decision.md (owner-approved). Self-hosted woff2 via next/font/local (latin + latin-ext + vietnamese, swap), system fallback; tabular numerals for money/KPIs/tables; Vietnamese-safe line-height. Do not pick or swap fonts on your own.
- Type: inputs 16px on mobile; body 14px; secondary 12px; badges/captions min 11px; never use 8/9/10px.
- Radius: controls xl; cards 2xl; mobile sheets rounded-t-3xl; chips full; badges lg.
- Brand: purple only for chrome (buttons, focus, selected, active tabs). Indigo/violet only for data-viz/semantic.
- Touch: below md, controls ≥44px high, option/list rows ≥48px, icon buttons ≥40px hit area.
- Mobile overlays = bottom sheet (safe-area padding, scroll lock, Esc/backdrop dismiss). md+ = anchored popover with collision flip.
- Visible focus-visible ring on all interactive elements; meaningful text not lighter than slate-500.

SKILLS (frontend / UI / UX)
- Before Phase 0 work, locate every installed design/frontend skill (look for: ui-ux-promax / ui-ux-pro-max, taste-skill, frontend-design, and any similar) in the workspace skills folder and the global skills folder. Read each SKILL.md fully, plus every file or script it references. Do not rely on memory of what a skill "usually" says. In Phase 0 write docs/ui-skills-digest.md: per skill — purpose, key rules, tools/scripts it offers, and conflicts with this prompt's guardrails.
- In every later phase, re-open the skill sections relevant to that phase before designing, and name the rules you applied in the phase report.
- Precedence when advice conflicts: (1) this prompt and the phase prompt, (2) AGENTS.md and HARD GUARDRAILS, (3) existing repo conventions and docs/font-decision.md, (4) skills. A skill never overrides owner decisions (font choice, purple brand, mobile-first). Log every rejected skill rule with the reason.
- Use skills for: UX rules and checklists (touch targets, contrast, focus, forms, mobile patterns), typography/spacing/hierarchy craft, component state design, restraint, and anti-generic critique.
- Skills are NOT license to: add dependencies, UI kits, icon sets or animation libraries; add dark mode; change the brand hue; add gradients, hero sections, decorative illustration or entrance animations on lists; reorganize information architecture; rewrite copy beyond UI labels (use i18n); redesign beyond the phase scope. If a skill script/generator needs installs or network access, do NOT run it — ask me. If a skill outputs a design-system file, store it in docs/design-system/; the D1–D7 tokens in this repo stay the source of truth.
- This is an operational POS used under time pressure. Good taste here = clear hierarchy, consistent patterns, readable density, restraint. Put visual emphasis in one place per screen (the primary action or the key number). Evolve the existing UI; do not redesign it.

PROCESS
1. State the phase, the files you will touch, and which skills/sections you will apply.
2. Write a mini design brief (max 40 lines) to docs/ui-phase-notes/<phase>.md: decisions/tokens for this phase; an ASCII wireframe of the 390px mobile layout wherever layout changes; and a review against generic AI-design defaults (identical rounded cards everywhere, decorative gradients, uppercase eyebrow labels, same shadow on everything). Revise anything generic BEFORE building. (Phases 0 and 6: no wireframe.)
3. Execute only that phase. Out-of-phase problems go in the report; do not fix them.
4. Run typecheck. Fix only errors you introduced. If you have a browser/screenshot tool, capture 390px and 1024px views of every changed screen and self-critique against the skills' checklists ("remove one accessory"); if not, mark all visual checks NOT VERIFIED.
5. Report: files changed; skills used and rules applied; skill rules rejected and why; verified vs NOT VERIFIED; open issues; proposed next step. Then STOP and wait for approval.
```

### 5.1 Phase 0 prompt
```
Execute Phase 0 (Inventory + skill digest) only. Make NO app code changes. First create docs/ui-skills-digest.md as defined in the SKILLS block. Then audit the app using the UX checklists of ui-ux-promax and the anti-generic tells listed by taste-skill, and create docs/ui-inventory.md containing: (a) every ModernSelect and native <select> with file:line and context (page/modal/table row); (b) every popover/sheet/modal/fixed-position element with its z-index class and mobile pattern; (c) every filter row/bar per page and what controls it contains; (d) counts of text-[8|9|10|11px], indigo/violet usage in non-chart chrome, and distinct button class patterns per file; (e) a ranked list of the 10 screens with the worst mobile ergonomics; (f) skill-checklist violations per screen (touch targets, contrast, focus visibility, form patterns, mobile nav) and generic-design tells found. Report and stop.
```

### 5.1A Phase 1A prompt (font specimen)
```
Execute Phase 1A (Font specimen) only. Do NOT modify any app code, package.json, or lockfile.
Goal: let the owner compare fonts visually and choose.
Skill hook: use ui-ux-promax typography/font-pairing guidance for a Vietnamese F&B POS to propose at most 2 extra pairings (label them D and E) that satisfy the font constraints in D1 and are supported by the skill's rationale; keep A/B/C. Use taste-skill to critique the specimen layout and the pairings' hierarchy. You advise; the owner chooses.
1. Obtain woff2 files (OFL-licensed, Vietnamese subset included) for these pairings: A) Plus Jakarta Sans (headings/buttons) + Inter (body/inputs/tables/numbers); B) Be Vietnam Pro only; C) Nunito (headings/body) + Inter (numbers). Allowed method: fetch the official fontsource npm packages into a temporary directory OUTSIDE frontend/ (e.g. /tmp), copy only the needed woff2 files into docs/font-specimen/fonts/, then delete the temp directory. Do not add any dependency to the project. If font files cannot be obtained, STOP and ask me; do not substitute other fonts.
2. Create docs/font-specimen/index.html (single self-contained file + the fonts folder). Show all pairings side by side, each in (a) a 390px-wide phone frame and (b) a desktop frame, with real RabbitPOS content: Vietnamese menu items (Cà phê sữa đá, Sinh tố bơ, Trà sữa trân châu, Nước ép cam), a diacritic stress line containing ệ ẫ ử ỗ ặ ớ ữ ổ, prices (45.000đ, 1.250.000 ₫), 3 KPI cards, a 6-row ledger table with right-aligned amounts, primary/secondary buttons, badges, a form input and a dropdown row. Sizes 11/12/14/16/20/28px; weights 400/500/600/700.
3. Add two toggles: tabular numerals on/off; tight vs normal line-height (to expose clipped diacritics).
4. Add docs/font-specimen/README.md: file sizes per pairing (woff2, total), license, whether each family has tabular numerals, and any Vietnamese glyph problems you actually observed.
Do not choose for me. Report and stop. After I choose, I will ask you to write docs/font-decision.md.
```

### 5.2 Phase 1B prompt (foundations)
```
Execute Phase 1B (Foundations) only. Precondition: docs/font-decision.md exists with an owner-approved pairing; if not, STOP. Touch only: app/layout.tsx, app/globals.css, tailwind.config.ts, public/sw.js, and a new src/fonts (or public/fonts) directory.
1. Self-host the approved fonts (woff2 committed to the repo via next/font/local; do not fetch fonts at build time). Provide a system-font fallback stack. Expose them as Tailwind font families (e.g. sans for UI, display for headings if the pairing has two).
1b. Add the font files to the service-worker shell cache so the app renders with the correct font offline. Follow the existing cache-version mechanism in sw.js; do not change its caching strategy.
2. Add named type tokens (e.g. a 11px caption token) and a brand color token mapped to the existing purple; add radius/shadow tokens and a z-index scale (dropdown < sheet < modal < toast) based on docs/ui-inventory.md.
3. Upgrade .app-input / .app-select / .app-textarea: height 44px on mobile and 36–40px on md+, 16px text on mobile, 14px on md+, focus-visible ring using the brand token. Keep class names unchanged so existing usages inherit the upgrade.
4. Add tabular-numeral utility and apply it to the base body only for numeric elements via a utility class (do not blanket-apply).
Skill hook: validate the palette scale, contrast ratios, spacing rhythm and radius/shadow/border hierarchy against ui-ux-promax and taste-skill. You may propose a refined shade scale OF THE EXISTING PURPLE; do not change the hue or introduce new brand colors.
Do not edit any page or component. Typecheck, report, stop.
```

### 5.3 Phase 2 prompt
```
Execute Phase 2 (Primitives) only. Create components/ui/: Button, IconButton, FieldShell, Chip/FilterPill, SegmentedControl, Badge, Card, ResponsiveSheet.
ResponsiveSheet requirements: rendered in a portal; below md a bottom sheet with drag-handle affordance, max-height ~85dvh, pb-safe, body scroll lock, Esc + backdrop dismiss, and exclusive-open behavior reusing the existing useExclusivePopover; md+ anchored popover with viewport-collision flip (no hard-coded pixel guesses); uses the z-index scale from Phase 1; accessible roles/labels; focus returns to the trigger on close.
Button: variants primary/secondary/soft/ghost/danger, sizes sm/md/lg (≥44px high on mobile for md/lg), loading + disabled states, icon slot, full-width option.
Skill hook: apply ui-ux-promax component/accessibility rules and taste-skill state design — every primitive defines default, hover, active, focus-visible, disabled and loading states; motion only as a response to a user action (open/close/press), short and respecting prefers-reduced-motion; no decorative animation.
Do NOT wire primitives into existing pages. Add a short docs/ui-primitives.md describing props and usage rules. Typecheck, report, stop.
```

### 5.4 Phase 3 prompt
```
Execute Phase 3 (Dropdown unification) only, in this order, committing after each step:
A) Rebuild components/common/ModernSelect.tsx on ResponsiveSheet. Keep every existing prop and option field working. Mobile: bottom sheet, sticky search input (16px), option rows ≥48px, selected row with check, max ~70dvh, clear button preserved. Desktop: portaled popover with flip. Add keyboard navigation (Arrow keys, Home/End, Enter, Esc, type-ahead) and ARIA (combobox/listbox/option, aria-expanded, aria-selected). Move hard-coded Vietnamese strings (placeholder, search placeholder, empty state, clear title) to i18n keys in vi.json and en.json. Remove per-instance window listeners.
B) Replace the 17 native <select> elements (PurchasesCostTab ×10 incl. in-table rows, TransactionModal ×5, MemberManagerModal ×1, login ×1) with ModernSelect. In table rows use the compact size. If any native select must stay (e.g. login, for a justified reason), keep it and explain in the report.
C) Move AppShell user menu and StoreSwitcher onto ResponsiveSheet; delete the duplicated class strings; behavior and content unchanged.
D) Move ModernDateRangePicker onto ResponsiveSheet, merging its two mobile variants; presets as a horizontally scrollable chip row; calendar day cells ≥40px; keep all props and output formats identical.
Skill hook: follow ui-ux-promax rules for select/combobox/bottom-sheet on mobile (thumb reach, keyboard-open behavior, focus management) and taste-skill for option-row density and selected-state clarity; list in the report which rules you applied.
Verify there is no clipping when a select opens inside any modal (list each modal checked). Typecheck, report, stop.
```

### 5.5 Phase 4 prompt
```
Execute Phase 4 (Filter bars) only. Create a reusable FilterBar pattern in components/ui/ (search slot, scrollable chip row using HorizontalScroller, a "Filters" button with active-count badge opening a bottom sheet with stacked controls and a sticky Apply/Reset footer; md+ renders everything inline). Add i18n keys for new labels in both locale files.
Apply to pages one per commit, in this order: transactions (ledger, orders, purchases-cost — work tab by tab, never the whole 3,800-line file at once), dashboard, products, users, stores, promotions, purchases; then modal-level filters (DiscountedOrdersModal, AllProductsRankingModal, ProductSalesPerformanceSection, PromotionsModal, EmailReportModal).
Skill hook: use ui-ux-promax mobile filter patterns (thumb-zone placement, clear active-filter indication, explicit Apply/Reset) and taste-skill restraint (one emphasized control per bar, no decorative chrome).
Do not change filter semantics, query params, API calls, or state shape — presentation only. Typecheck after each page. Report per page, then stop after the full phase.
```

### 5.6 Phase 5 prompt
```
Execute Phase 5 (Buttons/layout/modals sweep) for ONLY the screen group I name in this message: [POS | transactions | products | dashboard | funds | settings | users | stores | login].
Replace ad-hoc button class strings with Button/IconButton; standardize page header (title + primary action, wraps on mobile), page padding and gaps; convert modals in this group to near-full-height sheets on mobile with sticky action footer and pb-safe; migrate tokens per file (text-[8|9|10px] → scale tokens, indigo/violet in chrome → brand, radius per D3). Leave chart/KPI semantic colors alone. For dense rows, fix overflow with truncate/leading adjustments only where the larger text actually overflows.
Skill hook: before editing each screen, run its ui-ux-promax checklist and a taste-skill critique of the CURRENT screen at 390px; fix the findings within this phase's scope; give each screen exactly one visual emphasis (primary action or key number) and remove decoration that does not carry information.
POS group extra rules: do not change cart logic, product grid data flow, offline queue, or checkout flow; keep the fixed cart bar offset above the bottom nav.
Typecheck, list every file touched, report, stop.
```

### 5.7 Phase 6 prompt
```
Execute Phase 6 (QA & hardening). No new features. Run typecheck and the existing test runners under src/tests (do not modify them). Then run ONE CI build. Run the pre-delivery/quality checklist of ui-ux-promax and the final critique of taste-skill, and include their results. Produce docs/ui-qa-report.md: a width matrix (360/390/430/768/1024/1440) × screen checklist, with pass/fail/NOT VERIFIED for each (mark NOT VERIFIED honestly where you lack a real browser/device). Include: grep proof that text-[8|9|10px] and native <select> counts are zero (or justified), list of remaining raw indigo/violet in chrome, z-index scale compliance, keyboard-open layout checks for inputs inside sheets, long Vietnamese label overflow checks, bottom-nav/cart-bar overlap, and a note recommending (not changing) the userScalable setting. Report and stop.
```

---

## 6. Suggested Execution Cadence
1. Phase 0 → review inventory (short).
2. **Phase 1A → owner picks the font on a real phone** (decision gate), then Phases 1B–2 → one review each (low risk, no visible page change).
3. **Phase 3 → test on a real phone before continuing** (biggest UX change).
4. Phase 4 → per page.
5. Phase 5 → one screen group per run, POS first.
6. Phase 6 → release candidate, deploy to LAN `10.0.0.10` first, then production.
