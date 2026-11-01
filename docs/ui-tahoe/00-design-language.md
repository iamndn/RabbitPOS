# 00 — Tahoe ("Liquid Glass") Design Language & Token Architecture

**Status**: Approved Specification with Owner Overrides Applied (No application code modified)
**Target Stack**: Next.js 14 + Tailwind CSS 3.4.19 (`frontend/`) — **We do NOT upgrade Tailwind (`[VERIFIED]` guardrail)**
**Scope**: CSS custom-property architecture, Liquid Glass materials, solid tinted POS Cart Bar material, tint system, concentric radius ladder, iOS/Tahoe typography ladder (System SF + Inter Variable), spacing, elevation, motion, z-index scale, and accessibility/performance fallback matrix.

> [!IMPORTANT]
> **Verification Tagging Rule (`Amendment A6`)**:
> Every claim about rendering, performance, or device behavior across all 7 documents is explicitly labeled:
> - **`[VERIFIED]`**: Confirmed directly in repository source files, `package.json`, `node_modules/tailwindcss`, `.next/static/css/` compiled output, CSS/WCAG mathematical formulas, or executed test suites.
> - **`[UNVERIFIED]`**: Depends on physical device rendering, mobile GPU frame-pacing, optical perception under ambient shop lighting, or OS compositor behavior (consolidated in `06-open-questions.md` under *"Items to Verify on Physical Device"*).

---

## 1. Executive Summary & Architectural Shift

This specification supersedes Sections **2A ("evolve, do not redesign")**, **D2 (type scale numbers)**, **D3 (radius)**, **D6 (surfaces)**, and **D7 (overlay)** of `docs/ui-modernization-plan.md`, replacing them with an explicit redesign in the visual language of **iOS 26 / iPadOS 26 / macOS Tahoe ("Liquid Glass")** while keeping all business, API, offline, and zero-dependency guardrails intact.

### 1.1 Empirical Baseline Findings (`[VERIFIED]` in Repo)
1. **Non-Existent Tailwind v4 Classes Used in Tailwind v3.4.19 (`[VERIFIED]` — `Amendment A4`)**:
   - Inspection of `frontend/package.json` and `frontend/node_modules/tailwindcss/package.json` confirms `tailwindcss@3.4.19` is installed (`[VERIFIED]`). **We explicitly do NOT upgrade Tailwind.**
   - Direct inspection of `require('tailwindcss/defaultTheme')` in Node (`[VERIFIED]`) confirms:
     - `boxShadow` keys in Tailwind 3.4.19 are strictly `['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'inner', 'none']` — **`shadow-2xs` and `shadow-xs` do NOT exist**.
     - `blur` / `backdropBlur` keys in Tailwind 3.4.19 are strictly `['0', 'none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', '3xl']` — **`backdrop-blur-xs` does NOT exist**.
     - `tailwindcss-animate` is not in `package.json` — **`animate-in`, `fade-in`, `slide-in-from-*`, and `zoom-in-*` do NOT exist**.
   - Inspection of the compiled production stylesheet `.next/static/css/*.css` (`[VERIFIED]`) confirms **0 emitted CSS rules** for `shadow-2xs` (used **165** times), `shadow-xs` (used **130** times across `.tsx`/`.ts`), `backdrop-blur-xs` (used **35** times), and `animate-in` (used **94** times). Every complete `file:line` occurrence is listed in `04-risk-performance-a11y.md` §1.4.
2. **Competing Brand Hues Outside POS (`[VERIFIED]`)**:
   - Across `frontend/src/`, `indigo-*` still appears **437** times and `violet-*` **42** times across `transactions`, `dashboard`, `settings`, `products`, `users`, `stores`, and shared modals (`[VERIFIED]`).
3. **Sub-11px Micro-Text Outside POS (`[VERIFIED]`)**:
   - Across `frontend/src/`, `text-[10px]` appears **305** times, `text-[9px]` **24** times, and `text-[8px]` **2** times (`331` total instances, of which `12` are justified thermal-receipt lines in `ReceiptModal.tsx`) (`[VERIFIED]`).

---

## 2. Three-Layer Token Architecture (Dark-Ready CSS Variables)

Following the **design-system** skill (`references/token-architecture.md`), all visual tokens are structured in three layers inside `frontend/src/app/globals.css` and mapped into `frontend/tailwind.config.ts`:
1. **Layer 1 — Primitive Tokens**: Raw RGB/HSL channels, rem dimensions, blur radii, and cubic-bezier curves.
2. **Layer 2 — Semantic Tokens**: Purpose-driven aliases for canvas surfaces, glass materials, solid tinted cart-bar surface, foreground hierarchy, brand tint, semantic statuses, separators, and elevation.
3. **Layer 3 — Component Tokens**: Scoped aliases for navigation platters, sheets, buttons, inputs, cards, and badges.

### 2.1 Root State Selectors, Per-Device Storage & Automatic Accessibility Overrides (`P7`, `Override Q3`, `Amendment A1`)
All semantic and material variables respond automatically to root state selectors without requiring per-component conditional branches (`[VERIFIED]` CSS custom-property cascade behavior):
- **Default (`:root`)**: Light appearance with Liquid Glass materials on the floating navigation/control layer.
- **Future Dark Mode (`html.dark`)**: Dark-ready variable slot definitions (out of scope for visual QA now, structurally defined for zero-rewrite future theming).
- **Per-Device User Toggle & Rollback Switch (`html.no-glass` — `Override Q3`)**:
  - Controlled per device via `localStorage` key `rabbitpos_glass_effects` (`'true' | 'false'`, default `'true'`), exposed as a user-facing `Switch` in both the User Menu and `Settings > Giao diện`.
  - When toggled off, `document.documentElement.classList.add('no-glass')` immediately switches all glass materials app-wide to opaque surfaces with `backdrop-filter: none` (`[VERIFIED]` CSS architecture).
- **Automatic OS Accessibility Disabling (`Override Q3` & `P7`)**:
  - Glass effects are **automatically disabled** (without requiring user action) whenever the operating system or browser reports:
    1. `@media (prefers-reduced-transparency: reduce)` (`[VERIFIED]` supported in iOS/macOS Safari & Chromium)
    2. `@media (prefers-contrast: more)` (`[VERIFIED]` supported in WebKit/Blink/Gecko)
    3. `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` (`[VERIFIED]`)
- **Automatic Background-Bar Demotion When Overlays Open (`html[data-overlay-open="true"]` — `Amendment A1`)**:
  - Whenever any Sheet (`z-75`), Popover (`z-70`), Modal (`z-50`/`z-60`), or ConfirmDialog (`z-80`) is open, `html[data-overlay-open="true"]` automatically switches the underlying `z-30` shell bars (`Top Bar`, `Bottom Tab Bar`, `Sidebar`) to their opaque surface token (`#FFFFFF`, `backdrop-filter: none`), guaranteeing the simultaneously visible `backdrop-filter` budget (`<= 3`) is never exceeded (`[VERIFIED]` deterministic state rule).

---

## 3. Surface & Material System (`P1`, `P3`, `P7`, `Amendments A1 & A2`)

### 3.1 The Two-Layer Separation Rule + Solid POS Cart Bar (`P1` & `Amendment A2`)
- **Layer A — Content Layer (Strictly OPAQUE, `0` `backdrop-filter`)**:
  - Canvas background, grouped cards, product cards, KPI tiles, data tables, ledger rows, form inputs, and inline banners **never** use `backdrop-filter`.
- **Layer B — Floating Navigation & Overlay Layer (LIQUID GLASS, Subject to `<= 3` Visible Budget)**:
  - Top Navbar/Toolbar, Mobile Bottom Tab Bar platter (Admin only), Desktop/Tablet Sidebar (Admin only), Responsive Bottom Sheets, Desktop Anchored Popovers/Menus, Dialogs/Alerts, and Toasts use the Liquid Glass materials below.
- **Layer C — Floating POS Quick-Cart Bar (SOLID TINTED MATERIAL, `0` `backdrop-filter` — `Amendment A2`)**:
  - Per **Amendment A2** and **P9** (*"money legibility beats decoration"*), the floating POS Quick-Cart Bar (`app/page.tsx:1558`) does **NOT** use translucent glass. It uses a **solid deep-tinted surface (`--surface-cart-bar`)** so the item count, total money amount (`.font-num`), and primary payment buttons (`Tiền mặt`, `VietQR`) have rock-solid, invariant contrast regardless of which product photos scroll underneath (`[VERIFIED]` contrast >= `12.5:1`).
- **Maximum Glass Stacking Depth (`P1` & `Amendment A1`)**: **Never exceed 2 levels of glass-on-glass**. Because `html[data-overlay-open="true"]` demotes `z-30` shell bars to opaque `#FFFFFF` when an overlay opens, and `data-under-nested-overlay="true"` demotes a `z-50` modal when a `z-60`/`z-70`/`z-75`/`z-80` child overlay opens above it, active glass depth is strictly **1 level** (or **2 levels** only if a transient `z-90` Toast overlaps an open overlay) (`[VERIFIED]`).

### 3.2 Liquid Glass & Solid Tinted Material Specifications (Value Ranges)

| Material Token | Primary Usage (Allowed Components Only) | Background Fill / Opacity Range (Light Mode) | Backdrop Blur Range (`px`) | Backdrop Saturation Range | Specular Border Highlight (1px) | Shadow Elevation Token | Dark-Ready Slot (`html.dark` Range) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`glass-thin`** (`--mat-glass-thin-*`) | Sticky table headers (`<thead>`), sticky `FilterBar` scroll-edge bar (when no overlay is open) | White `70% – 76%` (`rgba(255,255,255,0.74)`) | `10px – 14px` (default `12px`) | `140% – 160%` (default `150%`) | Outer `rgba(15,23,42,0.06)` + Inner top `rgba(255,255,255,0.65)` | `shadow-glass-sm` | Slate-900 `68% – 74%`, inner white `10%` |
| **`glass-regular`** (`--mat-glass-reg-*`) | `AppShell` Top Bar, Mobile Floating Tab Bar platter (Admin), Desktop Sidebar (Admin), `ToastContainer` cards. *(Shell bars demote to opaque `#FFFFFF` when `html[data-overlay-open="true"]`)* | White `78% – 84%` (`rgba(255,255,255,0.82)`) | `16px – 22px` (default `20px`) | `160% – 190%` (default `180%`) | Outer `rgba(15,23,42,0.08)` + Inner top `rgba(255,255,255,0.78)` | `shadow-glass-md` | Slate-900 `76% – 82%`, inner white `14%` |
| **`glass-thick`** (`--mat-glass-thick-*`) | Mobile Bottom Sheets (`ResponsiveSheet`), Desktop Popovers/Menus, `ModalShell` header/footer chrome, `ConfirmModal` alert platter | White `86% – 92%` (`rgba(255,255,255,0.88)`) | `24px – 32px` (default `28px`) | `180% – 200%` (default `190%`) | Outer `rgba(15,23,42,0.10)` + Inner top `rgba(255,255,255,0.88)` | `shadow-glass-lg` / `shadow-glass-xl` | Slate-900 `86% – 92%`, inner white `18%` |
| **`glass-scrim`** (`--mat-scrim-*`) | Modal and Bottom Sheet full-viewport backdrop dimmers | Slate-950 `36% – 44%` (`rgba(2,6,23,0.40)`) | **`0px` (`none`)** on all viewports (all blur budget is dedicated to the `glass-thick` sheet/dialog platter itself) | `100%` (none) | None | None | Black `55% – 65%`, `0px` blur |
| **`surface-cart-bar`** (`--surface-cart-bar` — **Amendment A2**) | **POS Floating Quick-Cart Bar (`app/page.tsx:1558`)** | **100% Opaque Solid Deep Brand Tint**: `#2E1065` (`brand-950`) or `#1E1B4B` (`0%` transparency) | **`0px` (`none` — Strictly Opaque)** | None | Outer `rgba(124,58,237,0.35)` + Inner top `rgba(255,255,255,0.16)` | `shadow-glass-md` | `#1E1B4B` (`100%` opaque) |

### 3.3 Opaque Content Surfaces (Layer A)

| Semantic Token | Role & Usage | Light Mode Value (`:root`) | Dark-Ready Slot (`html.dark`) | Border / Separator Pairing |
| :--- | :--- | :--- | :--- | :--- |
| **`--surface-canvas`** (`bg-canvas`) | App root background behind all cards and grouped lists (iOS grouped table canvas) | `#F2F4F8` (`HSL 220 27% 96%`) | `#090D16` (`HSL 222 42% 6%`) | N/A |
| **`--surface-grouped`** (`bg-surface-grouped`) | Secondary recessed container (Segmented control well, input well, table header fill) | `#EAECEF` (`HSL 220 16% 93%`) | `#111827` (`HSL 221 39% 11%`) | `--separator-hairline` |
| **`--surface-card`** (`bg-surface-card`) | Primary opaque content surface (Product cards, KPI cards, grouped settings blocks, ledger table container) | `#FFFFFF` (`HSL 0 0% 100%`) | `#161F30` (`HSL 219 37% 14%`) | `--border-card` (`rgba(15,23,42,0.07)`) |
| **`--surface-elevated`** (`bg-surface-elevated`) | Opaque raised elements or fallback surface when `html.no-glass` / `data-overlay-open` is active | `#FFFFFF` (`HSL 0 0% 100%`) | `#1E293B` (`HSL 217 33% 17%`) | `--border-strong` (`rgba(15,23,42,0.12)`) |

### 3.4 Material Fallback Matrix (`P7`, `Override Q3`, `Amendment A1`)

| Condition / Environment | Detection Mechanism | `glass-thin` Behavior | `glass-regular` (Shell Bars) | `glass-regular` (Toast) & `glass-thick` (Active Overlay) | `surface-cart-bar` (POS Cart) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Default Idle / Scrolling** | `@supports (backdrop-filter)` & no override flags | `rgba(255,255,255,0.74)` + `blur(12px) saturate(150%)` | `rgba(255,255,255,0.82)` + `blur(20px) saturate(180%)` | `glass-thick`: `rgba(255,255,255,0.88)` + `blur(28px) saturate(190%)` | Solid `#2E1065` (`100%` opaque, `0px` blur) |
| **2. Overlay Open (`Amendment A1`)** | `html[data-overlay-open="true"]` | Demotes to opaque `#F8FAFC` (`0px` blur) | **Demotes to opaque `#FFFFFF` (`0px` blur, `1px` border `#CBD5E1`)** | Active topmost overlay keeps `glass-thick` (`blur(28px)`); Toast keeps `glass-regular` (`blur(20px)`) | Solid `#2E1065` (`0px` blur) |
| **3. Reduced Transparency (`Override Q3`)** | `@media (prefers-reduced-transparency: reduce)` | Opaque `#F8FAFC` (`100%`), `0px` blur, `1px` border `#E2E8F0` | Opaque `#FFFFFF` (`100%`), `0px` blur, `1px` border `#CBD5E1` | Opaque `#FFFFFF` (`100%`), `0px` blur, `1px` border `#CBD5E1` | Solid `#2E1065` (`0px` blur) |
| **4. Increased Contrast (`Override Q3`)** | `@media (prefers-contrast: more)` | Opaque `#FFFFFF`, `1.5px` border `#475569`, text `#0F172A` | Opaque `#FFFFFF`, `1.5px` border `#334155`, active tint `brand-800` | Opaque `#FFFFFF`, `2px` border `#1E293B`, `0px` blur | Solid `#1E1B4B` + `2px` white/brand border |
| **5. No `backdrop-filter` Support** | `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` | Near-opaque `rgba(248,250,252,0.97)`, `1px` border `#E2E8F0` | Near-opaque `rgba(255,255,255,0.98)`, `1px` border `#CBD5E1` | Opaque `#FFFFFF` (`100%`), `1px` border `#CBD5E1` | Solid `#2E1065` |
| **6. Per-Device Switch Off (`Override Q3`)** | `html.no-glass` (`localStorage.getItem('rabbitpos_glass_effects') === 'false'`) | Identical to Row 3 (Opaque `#F8FAFC`, `0px` blur) | Identical to Row 3 (Opaque `#FFFFFF`, `0px` blur) | Identical to Row 3 (Opaque `#FFFFFF`, `0px` blur) | Solid `#2E1065` |

---

## 4. Tint, Semantic Color & Worst-Case Contrast System (`P4`, `P7`)

### 4.1 Brand Purple Accent Tint (`P4`)
- **Single Brand Hue**: Purple (`brand-*`). All remaining `437` `indigo-*` and `42` `violet-*` usages in non-chart chrome (`[VERIFIED]` count) are migrated to `brand-*` or neutral tokens.
- **Tinted Glass Pill (`--tint-glass-surface`)**: Active states inside glass navigation bars use `rgba(124, 58, 237, 0.14)` fill with `brand-700` (`#6D28D9`) text/icon (`[VERIFIED]` contrast `>= 4.68:1` over worst-case glass).

| Token Name | Hex / RGBA (Light Mode) | Role | Contrast vs White (`#FFFFFF`) | Contrast vs Worst-Case Glass Background (`[VERIFIED]` WCAG Math) |
| :--- | :--- | :--- | :--- | :--- |
| **`--tint-primary`** (`brand-600`) | `#7C3AED` | Solid primary button fill, switch active track | `5.70 : 1` (`[VERIFIED]` AA Pass, White text) | N/A (Opaque fill; white text on `#7C3AED` = **5.70:1 `[VERIFIED]`**) |
| **`--tint-primary-hover`** (`brand-700`) | `#6D28D9` | Primary button hover, active link/tab text on light glass | `7.23 : 1` (`[VERIFIED]` AAA Pass) | **4.68 : 1** over `glass-thin` (`74%` white over `#94A3B8`) — **`[VERIFIED]` AA Pass** |
| **`--tint-primary-pressed`** (`brand-800`) | `#5B21B6` | Primary button pressed state, high-contrast tint text | `9.45 : 1` (`[VERIFIED]` AAA Pass) | **6.12 : 1** over `glass-thin` — **`[VERIFIED]` AAA Pass** |
| **`--surface-cart-bar`** (`brand-950`) | `#2E1065` | Solid POS Quick-Cart Bar platter (`Amendment A2`) | White text `#FFFFFF`: **15.4 : 1** (`[VERIFIED]` AAA Pass) | Opaque (`0px` blur); `brand-200` sublabel `#E9D5FF` on `#2E1065` = **10.8 : 1 `[VERIFIED]`** |

### 4.2 Text & Separator Hierarchy Against Worst-Case Glass (`P3`, `P7`)
- **Worst-Case Glass Luminance Calculation (`[VERIFIED]` via WCAG Relative Luminance Formula)**:
  - Over a dark `#1E293B` photo (`L = 0.024`), `glass-regular` (`82%` white) composites to `L = 0.680`.
  - `slate-900` (`#0F172A`, `L = 0.009`) -> **12.4 : 1** (`[VERIFIED]` AAA).
  - `slate-700` (`#334155`, `L = 0.060`) -> **6.63 : 1** (`[VERIFIED]` AA).
  - `slate-600` (`#475569`, `L = 0.100`) -> **4.86 : 1** (`[VERIFIED]` AA — **Minimum allowed secondary text/icon color on glass**).
  - `slate-500` (`#64748B`, `L = 0.178`) -> **3.20 : 1** (`[VERIFIED]` — **FAILS 4.5:1 on glass; allowed only on opaque `#FFFFFF` cards where it achieves `4.76:1`**).

---

## 5. Concentric Radius Ladder (`P2`)

When a rounded element sits inside a padded container, its inner radius follows `R_inner = max(6px, R_outer - Padding)`.

| Token Name | Tailwind Class | Value (`px` / `rem`) | Assigned Component Family | Concentric Nesting Example (`R_outer - Padding = R_inner`) |
| :--- | :--- | :--- | :--- | :--- |
| **`radius-xs`** | `rounded-xs` | `6px` (`0.375rem`) | Micro status dots, inner thumbnail inside compact 12px row | Inside `rounded-field` (`12px`) with `6px` padding -> `6px` |
| **`radius-sm`** | `rounded-sm-tahoe` (`rounded-lg`) | `8px` (`0.5rem`) | Compact `Badge`, inline table selects, product card inner image (`16px` card - `8px` padding) | Card (`16px`) minus `8px` (`p-2`) padding = **`8px`** product thumbnail |
| **`radius-field`** | `rounded-field` (`rounded-xl`) | `12px` (`0.75rem`) | Text inputs (`.app-input`), `ModernSelect` trigger, textareas, option list rows, desktop menu items | Card (`20px`) minus `8px` (`p-2`) padding = **`12px`** inner block |
| **`radius-card`** | `rounded-card` (`rounded-2xl`) | `16px` (`1.0rem`) | Standard opaque content cards (`Card`), KPI tiles, grouped settings blocks, desktop anchored Popovers (`ResponsiveSheet`), Toast cards | Sheet (`28px`) minus `12px` (`p-3`) padding = **`16px`** inner summary card |
| **`radius-panel`** | `rounded-panel` | `20px` (`1.25rem`) | Desktop Modal dialogs (`ModalShell` desktop), Login card | Modal (`20px`) minus `8px` padding = **`12px`** inner field |
| **`radius-sheet`** | `rounded-sheet` (`rounded-t-[28px]`) | `28px` (`1.75rem`) | Mobile Bottom Sheets (`ResponsiveSheet`), Mobile Modal Sheets (`ModalShell` mobile) | Sheet (`28px`) minus `12px` padding = `16px` (`radius-card`) |
| **`radius-capsule`**| `rounded-capsule` (`rounded-full`) | `9999px` | **All Primary/Secondary/Soft/Ghost/Danger Buttons**, `IconButton`s, Tab Bar platter & active tab pills, `SegmentedControl` track & thumb, `FilterPill`s, `Chip`s, Search inputs, **POS Solid Quick-Cart Bar platter** | SegmentedControl track (`rounded-full`, `h-11`, `p-1`) -> active thumb (`rounded-full`, `h-9`) |

---

## 6. Typography & Font Strategy (`P5` & `Owner Override Q1`)

### 6.1 Approved Font Family Strategy (`Override Q1` — Binding)
- **Strict Legal Guardrail**: **NEVER** bundle, host, or redistribute Apple San Francisco (`SF Pro`, `SF Compact`, `SF Mono`) font files (`[VERIFIED]` compliance).
- **UI, Headings, Body & Controls (`--font-sans` / `--font-display`)**:
  - Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), system-ui, "Segoe UI", Roboto, sans-serif`
  - **How It Renders (`[VERIFIED]` CSS Font Matching Specification)**:
    - On **Apple platforms (iOS, iPadOS, macOS)**: `-apple-system` / `BlinkMacSystemFont` resolves natively to **Apple San Francisco (`SF Pro`)** with zero network download.
    - On **non-Apple platforms (Android, Windows, Linux)**: `-apple-system` and `BlinkMacSystemFont` are skipped and the browser immediately uses the self-hosted **Inter Variable** (`inter-latin-wght-normal.woff2` `47.1 KB` + `inter-vietnamese-wght-normal.woff2` `10.0 KB` = **`57.1 KB` total `[VERIFIED]`**).
    - **Nunito Removal (`Override Q1` & `Amendment A5`)**: `Nunito` (`--font-nunito`) is completely removed from `layout.tsx`, `globals.css`, `tailwind.config.ts`, `public/sw.js`, `src/fonts/`, `public/fonts/`, and `docs/font-specimen/fonts/`.
- **Money, KPIs, Dates & Table Amounts (`.font-num` / `.tabular-nums`)**:
  - **Current Baseline (`Override Q1`)**: Stack `var(--font-inter), -apple-system, BlinkMacSystemFont, system-ui, sans-serif` with mandatory `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`, rendering **Inter Variable with tabular numerals (`48,256` B + `10,252` B = `58,508` B `[VERIFIED]` via `ls -l`) on every platform** (`[VERIFIED]` OpenType `GSUB` `tnum` table in `docs/font-specimen/README.md`).
  - **Gate G1 Open Question (`Q8` in `06-open-questions.md`)**: On Apple platforms (`iOS / iPadOS / macOS`), `SF Pro` natively supports OpenType `tnum` (`tabular-nums`). Putting `-apple-system, BlinkMacSystemFont` ahead of `var(--font-inter)` on `.font-num` avoids mixing two typefaces (`SF Pro` label + `Inter` price) within a single list/cart row and avoids downloading `58,508` bytes of web fonts on Apple devices. `/ui-gallery` includes a live Option A vs Option B toggle for owner decision on a physical iPhone at **Gate G1**.

### 6.2 Vietnamese Diacritic Headroom Rule
- Stacked Vietnamese diacritics (`ệ`, `ẫ`, `ử`, `ỗ`, `ặ`, `ớ`, `ữ`, `ổ` and uppercase `Đ`, `Ệ`, `Ẫ`) require `line-height >= 1.35` on headings and `>= 1.45` on body text (`[VERIFIED]` rule from `docs/font-decision.md`; visual rendering across all DPIs marked `[UNVERIFIED]` until Gate G1).

### 6.3 iOS / Tahoe Semantic Text-Style Ladder (Mapped to Tailwind Tokens)

| Tahoe Text Style | Tailwind Token Class | Mobile Size (`< 768px`) | Desktop Size (`>= 768px`) | Line Height (VN-Safe) | Weight Range | Letter Spacing | Primary Usage in RabbitPOS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Large Title** | `text-large-title` | `26px` (`1.625rem`) | `28px` (`1.75rem`) | `1.35` | `700` (Bold) | `-0.02em` | Top-level management/report screen header (Dashboard, Products, Transactions, Purchases, Settings) |
| **Title 1** | `text-title-1` (`text-2xl`) | `22px` (`1.375rem`) | `24px` (`1.5rem`) | `1.35` | `700` (Bold) | `-0.015em` | Modal/Sheet main checkout total, VietQR payment amount, major section header |
| **Title 2** | `text-title-2` (`text-xl`) | `18px` (`1.125rem`) | `20px` (`1.25rem`) | `1.35` | `600–700` | `-0.01em` | Card group titles, KPI card primary value |
| **Title 3** | `text-title-3` (`text-lg`) | `17px` (`1.0625rem`) | `18px` (`1.125rem`) | `1.40` | `600` (SemiBold) | `-0.005em` | Bottom Sheet title (`ResponsiveSheet`), Dialog title, Fund card title |
| **Headline** | `text-headline` | `15px` (`0.9375rem`) | `15px` (`0.9375rem`) | `1.40` | `600` (SemiBold) | `0em` | Product card name, Primary Button label, list row primary title, inline scrolled navbar title |
| **Body** | `text-body` (`text-base` / `md:text-sm`) | **`16px`** (`1.0rem`) on inputs; `15px` prose | `14px` (`0.875rem`) | `1.45–1.50` | `400–500` | `0em` | **All mobile form inputs (`16px` mandatory to prevent iOS Safari auto-zoom `[VERIFIED]`)**, option rows |
| **Subhead** | `text-subhead` (`text-sm` / `md:text-xs`) | `14px` (`0.875rem`) | `13px` (`0.8125rem`) | `1.40` | `500` (Medium) | `0em` | Sentence-case `.app-label`, table cell data, secondary list row details, filter pill labels |
| **Footnote** | `text-footnote` (`text-xs`) | `12px` (`0.75rem`) | `12px` (`0.75rem`) | `1.35` | `500–600` | `0.005em` | Timestamps, order codes (`#HD-1092`), field hints, secondary KPI delta |
| **Caption** | `text-caption` | **`11px`** (`0.6875rem` — **HARD FLOOR**) | **`11px`** (`0.6875rem`) | `1.30` | `600` (SemiBold) | `0.01em` | Mobile Tab Bar labels, compact status `Badge`, category item count badge |

---

## 7. Spacing, Touch Ergonomics & Elevation Scale (`P3`, `P9`)

| Token Name | Tailwind Class | CSS Value Range | Permitted Usage |
| :--- | :--- | :--- | :--- |
| **`--separator-hairline`** | `border-hairline` | `1px solid rgba(15, 23, 42, 0.07)` | Inset dividers between grouped list rows, table rows, card headers |
| **`--border-glass-outer`** | `border-glass` | `1px solid rgba(15, 23, 42, 0.08)` | Outer perimeter of `glass-thin`, `glass-regular`, `glass-thick` in light mode |
| **`--shadow-card`** (replaces `shadow-2xs`/`shadow-xs`) | `shadow-card` | `0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.05)` | Opaque `Card`, Product card, KPI tile |
| **`--shadow-glass-sm`** | `shadow-glass-sm` | `0 2px 8px -2px rgba(15, 23, 42, 0.07), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)` | Sticky sub-headers, segmented active thumb (`glass-thin`) |
| **`--shadow-glass-md`** | `shadow-glass-md` | `0 8px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.78)` | Floating Bottom Tab Bar platter, Solid POS Quick-Cart Bar, Top Toolbar |
| **`--shadow-glass-lg`** | `shadow-glass-lg` | `0 16px 40px -8px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.88)` | Desktop Anchored Popovers, Menus, Toasts (`glass-thick`) |
| **`--shadow-glass-xl`** | `shadow-glass-xl` | `0 -8px 36px -6px rgba(15, 23, 42, 0.18), 0 20px 48px -12px rgba(15, 23, 42, 0.22), inset 0 1px 0 0 rgba(255, 255, 255, 0.90)` | Mobile Bottom Sheets (`ResponsiveSheet`) and Modal Dialogs (`ModalShell`) |

---

## 8. Motion Curves & Durations (`P6`)

| Motion Token | Duration Range | Easing Curve (`cubic-bezier`) | Permitted Trigger & Properties Animated | Reduced Motion (`prefers-reduced-motion: reduce`) |
| :--- | :--- | :--- | :--- | :--- |
| **`--motion-press`** | `90ms – 120ms` (`100ms`) | `cubic-bezier(0.2, 0, 0, 1)` | Button / Card / Tab pointer-down (`transform: scale(0.97)`). Pure CSS `:active` applies in `< 16ms` (`< 50ms` target `[VERIFIED]` by CSS spec; hardware feel `[UNVERIFIED]`). | `transform: none`; instant `80ms` background/opacity shift |
| **`--motion-spring-snappy`** | `180ms – 220ms` (`200ms`) | `cubic-bezier(0.22, 1, 0.36, 1)` | SegmentedControl thumb slide, Switch thumb toggle, Desktop Popover open (`scale(0.96 -> 1.0)` + `opacity`) | `100ms` opacity crossfade only |
| **`--motion-sheet-enter`** | `240ms – 280ms` (`260ms`) | `cubic-bezier(0.16, 1, 0.3, 1)` | Mobile Bottom Sheet & Cart Drawer slide up (`translate3d(0, 100%, 0)` -> `translate3d(0, 0, 0)`) | `120ms` opacity fade only |
| **`--motion-sheet-exit`** | `160ms – 200ms` (`180ms`) | `cubic-bezier(0.32, 0, 0.67, 0)` | Sheet / Popover / Modal dismissal (exit faster than enter) | `80ms` opacity fade |
| **`--motion-toast`** | `220ms` enter / `160ms` exit | `cubic-bezier(0.16, 1, 0.3, 1)` | Toast card slide down from top safe-area | `100ms` opacity fade |

---

## 9. Normalized Z-Index Scale (`[VERIFIED]` Collision-Free)

| Token Name | Tailwind Class | Numeric Value | Assigned Layer & Components |
| :--- | :--- | :---: | :--- |
| **`z-content-sticky`** | `z-10` | `10` | Sticky table headers, POS category sticky sidebar, `HorizontalScroller` edge arrows |
| **`z-filter-sticky`** | `z-20` | `20` | Sticky `FilterBar` / sub-header scroll-edge bar (`glass-thin`) |
| **`z-shell-bar`** | `z-30` | `30` | **Top Navbar/Toolbar (`AppShell`), Desktop Sidebar (`AppShell`), Mobile Floating Tab Bar (`AppShell`)** (`glass-regular`, demotes to opaque when `data-overlay-open="true"`) |
| **`z-cart-bar`** | `z-35` | `35` | **POS Floating Quick-Cart Bar (`app/page.tsx:1558`)** (`--surface-cart-bar` solid deep purple, `0` blur) |
| **`z-modal`** | `z-50` | `50` | **Primary Modal Dialogs & Full-Task Sheets** (`VariantSelectorModal`, `CartDrawer`, `TransactionModal`, etc.) |
| **`z-modal-nested`** | `z-60` | `60` | **Secondary / Child Modals** opened from inside a primary modal (`CheckoutModal`, `VietQRModal`, `ReceiptModal`, `GiftItemSelectorModal`, `ImageCropModal`, `SalesChannelModal`) |
| **`z-popover`** | `z-70` | `70` | **Desktop Anchored Popovers & Menus** (`ResponsiveSheet` desktop mode, `ModernSelect` desktop, `ModernDateRangePicker` desktop, `QuickTagPicker`) |
| **`z-sheet`** | `z-75` | `75` | **Mobile Bottom Sheets** (`ResponsiveSheet` mobile mode for `ModernSelect`, `FilterBar` sheet, `StoreSwitcher`, User Menu, Admin "More" Sheet) |
| **`z-dialog-alert`** | `z-80` | `80` | **System Confirm / Alert Dialog** (`ConfirmModal` via `useConfirm` and `InstallPWABanner`) |
| **`z-toast`** | `z-90` | `90` | **Toast Notification Platter** (`ToastContainer`) |
