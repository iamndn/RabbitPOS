# 05 — Phased Execution Plan, Worktree Safety, Font Inventory, Gate G1 Procedure & Phase Prompts

**Status**: Pre-Flight Verified Specification with Owner Overrides Applied (No application code modified)
**Scope**: Isolated Git worktree strategy protecting deployed `/opt/RabbitPOS` (`Pre-Flight Item 3`), filesystem-verified WOFF2 byte inventory & dependency-safe cleanup order (`Pre-Flight Item 2`), admin-only `/ui-gallery` & real-phone Gate G1 review procedure (`Override Q7` & `Pre-Flight Item 4`), per-file Tailwind v4 no-op replacement workflow (`Pre-Flight Item 5`), shippable phase ordering (`Phases T1–T6`), and scoped execution prompts.

---

## 1. Working-Copy Safety & Isolated Git Worktree Strategy (`Pre-Flight Item 3` — Mandatory)

### 1.1 Why `/opt/RabbitPOS` Must Never Leave `main` (`[VERIFIED]`)
- `/opt/RabbitPOS` is the **live deployed production directory** on this host (`scripts/deploy.sh:19–20` runs `docker compose -f /opt/RabbitPOS/docker-compose.prod.yml`, mounting `./npm_data`, `./npm_letsencrypt`, `.env`, and `./backups` `[VERIFIED]`).
- Checking out a feature branch inside `/opt/RabbitPOS` would expose live operations to partial UI commits if `./scripts/deploy.sh` or `docker compose build` were triggered during maintenance.

### 1.2 Isolated Worktree Architecture (`/opt/RabbitPOS-tahoe` on `feat/ui-tahoe`)
1. **Keep `/opt/RabbitPOS` Pinned to `main`**:
   - `/opt/RabbitPOS` **stays checked out on `main` at all times** across Phases T1–T6 (`git -C /opt/RabbitPOS branch --show-current` must always equal `main`).
   - Before branching, commit the approved planning docs (`docs/ui-tahoe/*` and `docs/ui-modernization-plan.md`) on `main` and create an annotated baseline rollback tag per `AGENTS.md` §3 (`git -C /opt/RabbitPOS tag -a pre-ui-tahoe -m "Baseline on main before Tahoe UI redesign"`).
2. **Create Dedicated Git Worktree at `/opt/RabbitPOS-tahoe`**:
   - Command (executed at the start of Phase T1, **not during planning**):
     `git -C /opt/RabbitPOS worktree add -b feat/ui-tahoe /opt/RabbitPOS-tahoe main`
   - **Zero-Network, Zero-Disk-Overhead `node_modules` Provisioning (`[VERIFIED]`)**:
     - Both `/opt/RabbitPOS` and `/opt/RabbitPOS-tahoe` reside on the exact same ZFS filesystem (`ZFS/subvol-1000-disk-0`, `51.5 GiB` free `[VERIFIED]` via `df -P`).
     - Because `frontend/node_modules` is gitignored and Hard Guardrails forbid installing/mutating npm packages, populate `/opt/RabbitPOS-tahoe/frontend/node_modules` via a hardlink tree copy:
       `cp -al /opt/RabbitPOS/frontend/node_modules /opt/RabbitPOS-tahoe/frontend/node_modules`
     - Unlike a symlink (where Webpack/PostCSS `realpath` resolution can accidentally walk back into `/opt/RabbitPOS`), `cp -al` gives Next.js real directory paths inside `/opt/RabbitPOS-tahoe`, consumes **`0` additional data blocks on disk**, and performs **`0` network requests** (`[VERIFIED]` POSIX hardlink semantics).
3. **Hard Production Container Prohibition**:
   - **Production Docker containers (`rabbitpos-frontend`, `rabbitpos-backend`, `rabbitpos-postgres`, `rabbitpos-npm`, `rabbitpos-tunnel`) MUST NEVER be built, recreated, or restarted from `/opt/RabbitPOS-tahoe` or from branch `feat/ui-tahoe`.**
   - Note (`[VERIFIED]` in `docker-compose.yml:81` and `docker-compose.prod.yml:93`): Both compose files hardcode `container_name: rabbitpos-frontend` and `container_name: rabbitpos-backend`. Never execute `docker compose` or `./scripts/deploy.sh` inside `/opt/RabbitPOS-tahoe`.
4. **All Phase T1–T6 Commands Run Inside `/opt/RabbitPOS-tahoe`**:
   - Typechecks: `cd /opt/RabbitPOS-tahoe/frontend && npx --no-install tsc --noEmit`
   - Commits: `git -C /opt/RabbitPOS-tahoe commit -m "feat(ui-tahoe): ..."`

### 1.3 How to Merge Back to `main` & Deploy (After Phase T6 Passes)
Only after Owner Gate G3 is approved, `/ui-gallery` has been deleted (`test ! -d /opt/RabbitPOS-tahoe/frontend/src/app/ui-gallery`), all 6 test suites pass, and `CI=true NEXT_TELEMETRY_DISABLED=1 npm run build` succeeds inside `/opt/RabbitPOS-tahoe/frontend`:
1. Stop the port `3001` dev server running in `/opt/RabbitPOS-tahoe/frontend`.
2. Verify both worktrees are clean (`git -C /opt/RabbitPOS status --short` and `git -C /opt/RabbitPOS-tahoe status --short` both empty).
3. Record or verify the pre-merge tag on `main`: `git -C /opt/RabbitPOS tag -f -a pre-ui-tahoe -m "Pre-merge baseline on main"`.
4. Merge `feat/ui-tahoe` into `main` inside `/opt/RabbitPOS` non-interactively (`AGENTS.md` §3):
   `git -C /opt/RabbitPOS merge --no-edit feat/ui-tahoe`
5. Rebuild and hot-swap **only** the `frontend` container from `/opt/RabbitPOS` (`main`):
   `cd /opt/RabbitPOS && ./scripts/deploy.sh frontend`
   *(Creates pre-deploy DB dump, builds new `rabbitpos-frontend` image while current container keeps serving traffic, swaps container in `< 5s`, and verifies `rabbitpos-frontend` health `[VERIFIED]` in `scripts/deploy.sh:75–96`).*
6. Clean up the temporary worktree after production verification:
   `rm -rf /opt/RabbitPOS-tahoe/frontend/node_modules /opt/RabbitPOS-tahoe/frontend/.next && git -C /opt/RabbitPOS worktree remove /opt/RabbitPOS-tahoe`

### 1.4 Two-Tier Rollback Procedure
- **Tier A — Pre-Merge Rollback (Anytime During Phases T1–T6)**:
  - **Production Impact**: **`0`** (`/opt/RabbitPOS` and `rabbitpos-frontend` were never touched).
  - **Action**: Stop the `:3001` dev server; reset a single phase commit inside `/opt/RabbitPOS-tahoe` (`git -C /opt/RabbitPOS-tahoe reset --hard <sha>`), or discard the entire worktree cleanly (`rm -rf /opt/RabbitPOS-tahoe/frontend/node_modules /opt/RabbitPOS-tahoe/frontend/.next && git -C /opt/RabbitPOS worktree remove --force /opt/RabbitPOS-tahoe && git -C /opt/RabbitPOS branch -D feat/ui-tahoe`).
- **Tier B — Post-Merge Production Rollback (If Any Issue Appears After `./scripts/deploy.sh frontend`)**:
  - Because the Tahoe redesign touches **zero** database schema, backend code, or `localStorage` cart keys (`rabbitpos_active_cart_*`), rolling back `frontend` is 100% stateless and instantaneous:
  - **Fastest Runtime Mitigation (`< 1 second`, Per-Device)**: Toggle off `"Hiệu ứng kính (Liquid Glass)"` (`html.no-glass`, `Override Q3`) to disable all `backdrop-filter` translucency immediately without redeployment.
  - **Full Container Rollback (`~45 seconds`)**:
    - If `main` has **not** yet been pushed to `origin/main`: `git -C /opt/RabbitPOS reset --hard pre-ui-tahoe && cd /opt/RabbitPOS && ./scripts/deploy.sh frontend`.
    - If `main` **has** already been pushed to `origin/main`: `git -C /opt/RabbitPOS revert -m 1 --no-edit HEAD && cd /opt/RabbitPOS && ./scripts/deploy.sh frontend`.

---

## 2. Filesystem-Verified Font Inventory & Safe Cleanup Order (`Pre-Flight Item 2`, `Override Q1`, `Amendment A5`)

### 2.1 Filesystem Verification of Required Inter Variable WOFF2 Files (`[VERIFIED]`)
Direct inspection via `ls -la`, `sha256sum`, and `git ls-files` confirms:
1. **Both required Inter Variable `.woff2` files ALREADY EXIST today and are tracked in Git (`git ls-files` = `84` font files across `3` directories)** in:
   - `/opt/RabbitPOS/docs/font-specimen/fonts/`
   - `/opt/RabbitPOS/frontend/src/fonts/` *(compiled by `next/font/local` in `src/app/layout.tsx:29–45`)*
   - `/opt/RabbitPOS/frontend/public/fonts/` *(precached by Offline PWA Service Worker in `public/sw.js:23–24`)*
2. **Exact Measured Byte Sizes (`ls -l`) & SHA-256 Checksums (`[VERIFIED]` — Identical Across All 3 Directories)**:
   - `inter-latin-wght-normal.woff2`: **`48,256` bytes** (`SHA-256: 3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`)
   - `inter-vietnamese-wght-normal.woff2`: **`10,252` bytes** (`SHA-256: 5c66f9e07e90c6d4ac4922cc68d60de26c17b1858e677fb5e603fce3952b3ff2`)
   - **Combined Retained Size per Directory**: **`58,508` bytes** (`57.14 KiB`).
   - *(Note: `@fontsource*` is not installed in `frontend/node_modules` `[VERIFIED]`; the self-hosted `.woff2` files in git are the sole source of truth, so **nothing is deleted before verifying their presence**).*

### 2.2 Complete `ls -l` Inventory of All 28 Files Existing Today in Each of the 3 Font Directories (`[VERIFIED]`)

Every one of the three directories (`docs/font-specimen/fonts/`, `frontend/src/fonts/`, and `frontend/public/fonts/`) contains the exact same **28 `.woff2` files** (`554,048` bytes per directory; `1,662,144` bytes total across all 3 directories; **nothing deleted during Pre-Flight**):

| # | Filename (Present Today in `docs/font-specimen/fonts`, `frontend/src/fonts`, and `frontend/public/fonts`) | Measured `ls -l` Size (Bytes) (`[VERIFIED]`) | Subset & Weight Type | Phase T1 Disposition (`Override Q1` & `Amendment A5`) |
| :---: | :--- | ---: | :--- | :--- |
| 1 | **`inter-latin-wght-normal.woff2`** | **`48,256`** | Inter Variable (`100–900`, Latin) | **KEEP** in `src/fonts/`, `public/fonts/`, and `docs/font-specimen/fonts/` |
| 2 | **`inter-vietnamese-wght-normal.woff2`** | **`10,252`** | Inter Variable (`100–900`, Vietnamese) | **KEEP** in `src/fonts/`, `public/fonts/`, and `docs/font-specimen/fonts/` |
| 3 | `inter-latin-400-normal.woff2` | `23,664` | Inter Static `400` (Latin) | **DELETE in Commit 1B** *(after Commit 1A)* |
| 4 | `inter-latin-500-normal.woff2` | `24,272` | Inter Static `500` (Latin) | **DELETE in Commit 1B** |
| 5 | `inter-latin-600-normal.woff2` | `24,452` | Inter Static `600` (Latin) | **DELETE in Commit 1B** |
| 6 | `inter-latin-700-normal.woff2` | `24,356` | Inter Static `700` (Latin) | **DELETE in Commit 1B** |
| 7 | `inter-latin-ext-400-normal.woff2` | `35,000` | Inter Static `400` (Latin-Ext) | **DELETE in Commit 1B** |
| 8 | `inter-latin-ext-500-normal.woff2` | `36,024` | Inter Static `500` (Latin-Ext) | **DELETE in Commit 1B** |
| 9 | `inter-latin-ext-600-normal.woff2` | `36,260` | Inter Static `600` (Latin-Ext) | **DELETE in Commit 1B** |
| 10 | `inter-latin-ext-700-normal.woff2` | `36,244` | Inter Static `700` (Latin-Ext) | **DELETE in Commit 1B** |
| 11 | `inter-vietnamese-400-normal.woff2` | `4,972` | Inter Static `400` (Vietnamese) | **DELETE in Commit 1B** |
| 12 | `inter-vietnamese-500-normal.woff2` | `5,112` | Inter Static `500` (Vietnamese) | **DELETE in Commit 1B** |
| 13 | `inter-vietnamese-600-normal.woff2` | `5,100` | Inter Static `600` (Vietnamese) | **DELETE in Commit 1B** |
| 14 | `inter-vietnamese-700-normal.woff2` | `5,104` | Inter Static `700` (Vietnamese) | **DELETE in Commit 1B** |
| 15 | `nunito-latin-400-normal.woff2` | `16,316` | Nunito Static `400` (Latin) | **DELETE in Commit 1B** |
| 16 | `nunito-latin-500-normal.woff2` | `16,428` | Nunito Static `500` (Latin) | **DELETE in Commit 1B** |
| 17 | `nunito-latin-600-normal.woff2` | `16,556` | Nunito Static `600` (Latin) | **DELETE in Commit 1B** |
| 18 | `nunito-latin-700-normal.woff2` | `16,228` | Nunito Static `700` (Latin) | **DELETE in Commit 1B** |
| 19 | `nunito-latin-ext-400-normal.woff2` | `15,888` | Nunito Static `400` (Latin-Ext) | **DELETE in Commit 1B** |
| 20 | `nunito-latin-ext-500-normal.woff2` | `15,976` | Nunito Static `500` (Latin-Ext) | **DELETE in Commit 1B** |
| 21 | `nunito-latin-ext-600-normal.woff2` | `16,088` | Nunito Static `600` (Latin-Ext) | **DELETE in Commit 1B** |
| 22 | `nunito-latin-ext-700-normal.woff2` | `15,820` | Nunito Static `700` (Latin-Ext) | **DELETE in Commit 1B** |
| 23 | `nunito-latin-wght-normal.woff2` | `39,128` | Nunito Variable (`200–1000`, Latin) | **DELETE in Commit 1B** *(referenced by `layout.tsx:14` & `sw.js:21` until Commit 1A!)* |
| 24 | `nunito-vietnamese-400-normal.woff2` | `6,120` | Nunito Static `400` (Vietnamese) | **DELETE in Commit 1B** |
| 25 | `nunito-vietnamese-500-normal.woff2` | `6,148` | Nunito Static `500` (Vietnamese) | **DELETE in Commit 1B** |
| 26 | `nunito-vietnamese-600-normal.woff2` | `6,196` | Nunito Static `600` (Vietnamese) | **DELETE in Commit 1B** |
| 27 | `nunito-vietnamese-700-normal.woff2` | `5,960` | Nunito Static `700` (Vietnamese) | **DELETE in Commit 1B** |
| 28 | `nunito-vietnamese-wght-normal.woff2` | `13,096` | Nunito Variable (`200–1000`, Vietnamese) | **DELETE in Commit 1B** *(referenced by `layout.tsx:19` & `sw.js:22` until Commit 1A!)* |
| — | **TOTAL PER DIRECTORY (28 files)** | **`554,048`** | **Kept (2 files): `58,508` B** | **Deleted (26 files): `495,540` B per dir (`1,486,620` B across 3 dirs)** |

### 2.3 Mandatory Dependency Order (Why Font Wiring Cutover MUST Precede Font File Deletion)
Auditing live references (`[VERIFIED]`) proved that **deleting `nunito-*.woff2` first would break the build and PWA install**:
1. `frontend/src/app/layout.tsx:11–27` currently loads `../fonts/nunito-latin-wght-normal.woff2` and `../fonts/nunito-vietnamese-wght-normal.woff2` via `next/font/local`. Deleting those files before updating `layout.tsx` breaks Next.js compilation immediately.
2. `frontend/public/sw.js:21–24, 32` lists `'/fonts/nunito-latin-wght-normal.woff2'` and `'/fonts/nunito-vietnamese-wght-normal.woff2'` inside `PRECACHE_URLS` (`cache.addAll(PRECACHE_URLS)`). Because `cache.addAll()` is atomic, deleting those two files from `public/fonts/` before removing lines `21–22` from `public/sw.js` causes `cache.addAll()` to fail on HTTP 404 and aborts Service Worker installation.

**Enforced Phase T1 Execution Sequence**:
- **Step 0 (Defensive Pre-Flight Assertion in `/opt/RabbitPOS-tahoe`)**: Before modifying or deleting anything, assert `inter-latin-wght-normal.woff2` (`48,256` B) and `inter-vietnamese-wght-normal.woff2` (`10,252` B) exist and match SHA-256 in `frontend/src/fonts/`, `frontend/public/fonts/`, and `docs/font-specimen/fonts/` (if either target copy were ever missing, copy it from `docs/font-specimen/fonts/` and re-verify `ls -l` byte count before proceeding).
- **Commit 1A (Token Architecture & Typography Cutover — Runs FIRST)**: Update `layout.tsx`, `globals.css`, `tailwind.config.ts`, `public/sw.js` (remove the 2 Nunito `PRECACHE_URLS` lines while preserving the 2 Inter Variable `PRECACHE_URLS` lines), `featureFlags.ts`, and `vi.json`/`en.json`. Verify `npx --no-install tsc --noEmit` passes and `grep -rn "nunito" frontend/src/ frontend/public/` returns `0`.
- **Commit 1B (Unused Font File Deletion — STRICTLY DEPENDS ON COMMIT 1A)**: Run `git rm` on the `26` unused `.woff2` files across `docs/font-specimen/fonts/`, `frontend/src/fonts/`, and `frontend/public/fonts/`, update `docs/font-decision.md`, and verify only the `2` Inter Variable files (`48,256` B + `10,252` B = `58,508` B) remain in each directory.

---

## 3. Admin-Only `/ui-gallery` & Gate G1 Real-Phone Review Procedure (`Override Q7` & `Pre-Flight Item 4`)

### 3.1 `/ui-gallery` Isolation Contract (`Override Q7`)
1. **Admin-Only (`isAdmin()`)**: `src/app/ui-gallery/page.tsx` synchronously checks `isAuthenticated() && isAdmin()` (`src/lib/auth.ts:50, 72`) on mount and calls `router.replace('/login')` (if unauthenticated) or `router.replace('/')` (if `staff`).
2. **Absent from Navigation**: Zero links to `/ui-gallery` exist anywhere in `AppShell`, `StoreSwitcher`, `More` Sheet, Sidebar, or User Menu.
3. **Zero Backend Calls**: `/ui-gallery` does **not** render `<AppShell>` (avoiding `/health` polling) and does **not** import `fetchApi`. *(See Owner Decision Flag `G1-D3` below regarding `RootLayout`'s `<StoreProvider>` mount fetch).*
4. **Excluded from Production Builds**: Guarded by `notFound()` unless `process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ALLOW_UI_GALLERY === 'true'` (noting Next.js inlines `NEXT_PUBLIC_*` at `next build` time `[VERIFIED]`), and **physically deleted (`git rm -rf frontend/src/app/ui-gallery`) in Phase T6** before running the final production build.

### 3.2 Step-by-Step Procedure to Review `/ui-gallery` on a Real Phone at Gate G1 (`Pre-Flight Item 4`)

Because `/ui-gallery` only exists inside `/opt/RabbitPOS-tahoe` and is excluded from the production container running on port `3000`, the owner reviews `/ui-gallery` on a physical iPhone / Android phone via a dedicated Next.js dev server on **port `3001`**:

1. **Start a Dedicated TEST Backend (Recommended Port `8081`) — Never Mutate Production CORS**:
   - Start a non-production Go backend instance on port `8081` against a test database (`DB_NAME=rabbitpos_test`), with `ENABLE_DAILY_EMAIL_REPORT=false` (so it never sends scheduled emails) and explicit **non-wildcard** CORS origins:
   - **CRITICAL `[VERIFIED]` Config Precedence (`backend/internal/config/config.go:104`)**:
     Line 104 reads `corsRaw := getEnv("CORS_ORIGIN", getEnv("CORS_ALLOWED_ORIGINS", ...))`. Because `CORS_ORIGIN` takes precedence over `CORS_ALLOWED_ORIGINS` whenever `CORS_ORIGIN` is set in the environment, **BOTH variables MUST be set explicitly (and NEVER to `*`)** on the TEST backend:
     - `PORT=8081`
     - `APP_ENV=production` *(tests strict CORS enforcement rather than `APP_ENV=development` which bypasses origin checks at `cors.go:14`)*
     - `CORS_ALLOWED_ORIGINS=http://<HOST_LAN_OR_TAILSCALE_IP>:3001,http://localhost:3001`
     - `CORS_ORIGIN=http://<HOST_LAN_OR_TAILSCALE_IP>:3001,http://localhost:3001`
     *(Replace `<HOST_LAN_OR_TAILSCALE_IP>` with the exact private IP the phone dials, e.g., `10.0.0.10` on Wi-Fi LAN or `100.x.y.z` on Tailscale — **no `*` wildcard**).*
   - *(Note `[VERIFIED]` in `backend/internal/middleware/cors.go:27–38`: `isAllowedOrigin` has built-in prefix matching for RFC1918 LAN IPs `10.*`, `192.168.*`, `172.16–31.*`, whereas Tailscale CGNAT `100.64.0.0/10` or custom `.local` hostnames rely strictly on the explicit `CORS_ALLOWED_ORIGINS` / `CORS_ORIGIN` entry above).*
2. **Start the Worktree Dev Server on Port `3001`**:
   - Working directory: `/opt/RabbitPOS-tahoe/frontend`
   - Command:
     `INTERNAL_BACKEND_URL=http://127.0.0.1:8081 NEXT_PUBLIC_ALLOW_UI_GALLERY=true npx --no-install next dev -H 0.0.0.0 -p 3001`
   - Binds `0.0.0.0:3001` so it is reachable over LAN/VPN without colliding with live `rabbitpos-frontend` on `:3000`.
3. **Firewall / LAN Network Access Needed (`[UNVERIFIED]` Host Firewall State)**:
   - The phone and the RabbitPOS host must share the same private Wi-Fi LAN subnet (e.g., `10.0.0.0/24`) or Tailscale/WireGuard mesh.
   - Host firewall (`ufw` / `iptables` / Proxmox LXC firewall, `[UNVERIFIED]` from repo files) must allow **inbound `TCP 3001`** from the phone's private subnet/IP only (do **not** expose port `3001` or `8081` on Cloudflare Tunnel or public WAN). Note: Because the Next.js rewrite proxies `/api/v1/*` server-side from `:3001` to `127.0.0.1:8081`, port `8081` does **not** need to be opened to the LAN!
4. **How Login, `localStorage` Origin Isolation & `api.ts` Base URL Behave on `:3001` (`[VERIFIED]`)**:
   - **Different-Origin `localStorage` Isolation**: Auth state (`rabbitpos_jwt_token` and `rabbitpos_user` in `src/lib/auth.ts:19–20`) lives in browser `localStorage`, which is strictly partitioned by `(scheme, host, port)`. An existing login session on `https://rabbitpos.ndnworks.com` is **not** shared with `http://<HOST_IP>:3001`.
   - **Same-Origin Next.js Rewrite Proxy (`0` Cross-Origin Preflight on Normal Path)**: In the browser, `getApiBaseUrl()` (`src/lib/api.ts:25–26`) always returns relative `'/api/v1'`. When the phone submits login on `http://<HOST_IP>:3001/login`, it posts to `http://<HOST_IP>:3001/api/v1/auth/login`, and `next.config.mjs:18–33` proxies that request server-side to `INTERNAL_BACKEND_URL` (`http://127.0.0.1:8081/api/v1/auth/login`).
   - **Direct `:8080` Fallback Caveat (`[VERIFIED]` in `src/lib/api.ts:132, 145`)**: If `INTERNAL_BACKEND_URL` is down or returns HTTP `404`/`5xx`, `api.ts:132, 145` automatically retries against `http://${window.location.hostname}:8080/api/v1`! Keeping the TEST backend healthy on `INTERNAL_BACKEND_URL` ensures `api.ts` never falls back to port `:8080`.
   - **Phone Review Flow**:
     1. On the phone (iOS Safari / Android Chrome), open `http://<HOST_IP>:3001/login` and sign in once with an `admin` / `master` account on the TEST backend.
     2. Navigate to `http://<HOST_IP>:3001/ui-gallery`. `isAdmin()` reads `rabbitpos_user` synchronously from `:3001` `localStorage` and renders the full Tahoe specimen gallery:
        - **Section 0**: Side-by-side comparison of Tailwind 3.4.19 no-op (`shadow-2xs`/`shadow-xs`/`backdrop-blur-xs`) vs Tahoe target tokens (`Pre-Flight Item 5`).
        - **Section 1**: Live typography toggle for **Open Question `Q8`** (`SF Pro tabular-nums` vs forced `Inter Variable tabular-nums` on Apple devices).
        - **Section 2–5**: All Liquid Glass materials, solid `#2E1065` POS Cart Bar swatch, capsule controls, `ResponsiveSheet` grabber drag, `ModernDateRangePicker`, pending-locked `ConfirmModal`, and `html.no-glass` per-device switch.
5. **Teardown After Gate G1**: Stop the `:3001` dev server (`Ctrl+C` / kill background task) and stop the `:8081` TEST backend.

### 3.3 Items Flagged for Owner Decision Before/At Gate G1 (`Pre-Flight Item 4 & Item 6`)

> [!IMPORTANT]
> **Owner Decisions / Confirmations Flagged for Gate G1**:
> 1. **`G1-D1` (Phone Network Path & Host IP)**: Confirm the exact private IP/interface your phone uses to reach this host (e.g., LAN `10.0.0.10` vs Tailscale `100.x.y.z`) and confirm inbound `TCP 3001` is permitted on that private interface (`[UNVERIFIED]` Proxmox/LXC firewall outside repo).
> 2. **`G1-D2` (TEST Backend Target for `:3001/login`)**: Confirm whether you want a temporary TEST backend process started on `127.0.0.1:8081` (against a test DB copy) for the 1-time `/login` token minting on `:3001`, or if you prefer pointing `:3001`'s `INTERNAL_BACKEND_URL` at an existing staging/local backend.
> 3. **`G1-D3` (`RootLayout` `<StoreProvider>` `GET /api/v1/stores` Skip on `/ui-gallery`)**: In `src/app/layout.tsx:116` (`[VERIFIED]`), `RootLayout` wraps every route in `<StoreProvider>`, which automatically calls `GET /api/v1/stores` on mount whenever `isAuthenticated()` is `true` (`src/lib/StoreContext.tsx:33–41, 147`). To make `/ui-gallery` fire **strictly `0` backend requests** even on full page reload (`Override Q7`), approve a temporary 1-line guard in `StoreContext.tsx` (`if (typeof window !== 'undefined' && window.location.pathname === '/ui-gallery') return;`) that is removed alongside `/ui-gallery` in Phase T6.
> 4. **`Q8` (Apple Tabular Numerals — `SF Pro tnum` vs `Inter Variable tnum`)**: Decide visually on your iPhone in `/ui-gallery` at Gate G1 (see `06-open-questions.md` §2 for full analysis and recommendation).

---

## 4. Phase Overview, Shippable Coexistence & Owner Hardware Gates

| Phase | Name & Goal | Entry Criteria | Files Touched (Inside `/opt/RabbitPOS-tahoe`) | Commit Slices & Order | Exit Criteria & Owner Review Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase T1** | **Worktree Setup, Typography Cutover, Font Cleanup (`Q1`/`A5`), CSS Variables & Z-Scale** | Pre-Flight approved; `/opt/RabbitPOS` stays on `main`; worktree `/opt/RabbitPOS-tahoe` created on `feat/ui-tahoe`. | `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `public/sw.js`, `src/lib/featureFlags.ts`, `src/lib/i18n/locales/{vi,en}.json`, `docs/font-decision.md`, `docs/font-specimen/fonts/*`, `src/fonts/*`, `public/fonts/*` | **2 commits (Strict Order `Item 2`)**:<br>1. **Commit 1A (Runs FIRST)**: Verify `inter-{latin,vietnamese}-wght-normal.woff2` (`48,256` B + `10,252` B); remove `nunito` from `layout.tsx`, `globals.css`, `tailwind.config.ts`, and `public/sw.js:21-22`; wire Tahoe CSS variables, `glass-*`, solid `--surface-cart-bar` (`A2`), `html[data-overlay-open="true"]` (`A1`), `html.no-glass` + media queries (`Q3`), z-scale (`10..90`). **Do NOT alias `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs` (`Item 5`)**.<br>2. **Commit 1B (Depends on 1A)**: `git rm` the `26` unused `.woff2` files across all `3` font directories (`495,540` B/dir removed); update `docs/font-decision.md`. | `tsc --noEmit` = 0 errors. `grep -rn "nunito" src/ public/` = 0. Exactly 2 WOFF2 files (`48,256` B + `10,252` B = `58,508` B) remain per font folder (`[VERIFIED]`). |
| **Phase T2** | **Tahoe Primitives, Overlays & Isolated `/ui-gallery`** | Phase T1 complete. | `src/components/ui/{Button,Card,Badge,Chip,SegmentedControl,FieldShell,ResponsiveSheet,FilterBar,Switch,Divider,ListGroup,ModalShell,EmptyState,Skeleton,index}.tsx`, `src/components/common/{ModernSelect,ModernDateRangePicker,ConfirmModal,ToastContainer}.tsx`, `src/context/ConfirmContext.tsx`, `src/types/confirm.ts`, `src/app/ui-gallery/page.tsx` (+ 1-line `/ui-gallery` skip in `StoreContext.tsx` if `G1-D3` approved) | **4 commits**:<br>1. Atomic controls (`Button` capsule, `Card`, `Badge`, `Chip`, `SegmentedControl`, `Switch`, `Divider`, `FieldShell`).<br>2. Layout/state primitives (`ListGroup`, `EmptyState`, `Skeleton`, `ModalShell` with `data-overlay-open` & `data-under-nested-overlay` demotion).<br>3. Overlays (`ResponsiveSheet` header-only drag, `ModernSelect`, `ModernDateRangePicker`, `FilterBar`, `ConfirmModal` `z-80` with dual `useRef` + `disabled` pending lock `Q5`, `ToastContainer` `z-90`).<br>4. Admin-only `/ui-gallery` (`Q7`) including Tailwind no-op diff (`Item 5`) and `Q8` font toggle (`Item 6`). | **🛑 GATE G1 (Real Phone Review on `:3001` per §3.2)**: Owner verifies materials, solid cart bar, 330-class replacement visual diff (`Item 5`), `html.no-glass`, and decides **`Q8`**. |
| **Phase T3** | **Role-Aware `AppShell` (`A3` + Reachability Fix) & POS Workspace (`/`, `A2`)** | Gate G1 approved (`Q8` applied if Option A chosen). | `src/components/AppShell.tsx`, `src/components/StoreSwitcher.tsx`, `src/components/common/InstallPWABanner.tsx`, `src/app/page.tsx`, `src/components/pos/{VariantSelectorModal,CartDrawer,CheckoutModal,VietQRModal,ReceiptModal,OfflineQueueModal,GiftItemSelectorModal}.tsx` | **3 commits**:<br>1. Role-aware `AppShell` (`staff` gets Compact Top Header with **`POS \| Thu chi`** 2-pill capsule, `0` Tab Bar, `0` Sidebar; `admin`/`SuperAdmin` get Top Bar + `< 768px` 5-item Tab Bar [`POS`, `Thu chi`, `Nhập hàng`, `Báo cáo`, `Thêm` with `Thực đơn`, `Khuyến mãi`, `Nhân sự`, `Cài đặt`, `Chuỗi cửa hàng` (SuperAdmin)] + `>= 768px` collapsible Sidebar).<br>2. POS main catalog (`app/page.tsx`: opaque cards, **Solid `#2E1065` Cart Bar at `z-35` (`A2`)**, per-file replacement of `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs`).<br>3. POS 7 modals (`M01–M07`). | **🛑 GATE G2 (POS Hardware Gate on `:3001`)**: Owner tests POS + `staff` `POS \| Thu chi` reachability and `admin` shell on phone and tablet. |
| **Phase T4** | **Core Financial & Catalog Screens (`Transactions`, `Purchases/BOM`, `Products`)** | Gate G2 approved. | `src/app/transactions/page.tsx`, `src/app/funds/page.tsx`, `src/components/transactions/{TransactionModal,TransactionCategoryModal,PurchasesCostTab,PurchaseVoucher}.tsx`, `src/app/purchases/page.tsx`, `src/app/products/page.tsx`, `src/components/products/{QuickTagPicker,CategoryManagerModal,ToppingManagerModal,TagManagerModal,AutoTaggingModal,PromotionsModal}.tsx`, `src/types/sales_channel.ts` | **7 commits**:<br>1. `transactions/page.tsx` Tab 1 (`ledger`).<br>2. `transactions/page.tsx` Tab 2 (`orders`).<br>3. `transactions/page.tsx` Tab 3 (`funds`, 6 inline modals, replace 2 `window.confirm` at `:711, :804` with pending-locked `useConfirm` per `Q5`).<br>4. `TransactionModal` + `TransactionCategoryModal`.<br>5. `PurchasesCostTab` main view + replace 2 `window.confirm` at `:541, :812` with pending-locked `useConfirm` (`Q5`).<br>6. `PurchasesCostTab` 3 inline modals.<br>7. `products/page.tsx` + `QuickTagPicker` + 5 product modals (`M20–M24`) + `sales_channel.ts`. | `tsc --noEmit` = 0 errors after every commit. Zero `window.confirm`, zero `text-[8|9|10px]`, and zero `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs` left in financial or catalog modules. |
| **Phase T5** | **Dashboard, Settings, Users, Stores & Login Sweep** | Phase T4 complete. | `src/app/dashboard/page.tsx`, `src/components/dashboard/{WaterfallReconciliationWidget,ProductSalesPerformanceSection,DiscountedOrdersModal,AllProductsRankingModal}.tsx`, `src/components/common/{EmailReportModal,SalesChannelModal,ImageCropModal}.tsx`, `src/app/settings/page.tsx`, `src/app/users/page.tsx`, `src/app/stores/page.tsx`, `src/components/stores/{StoreFormModal,MemberManagerModal}.tsx`, `src/app/login/page.tsx`, `src/components/LanguageToggle.tsx` | **5 commits**:<br>1. `dashboard/page.tsx` + 4 dashboard widgets/modals.<br>2. Shared modals (`EmailReportModal`, `SalesChannelModal`, `ImageCropModal`).<br>3. `settings/page.tsx` (grouped inset cards, `Switch` rows, per-device Glass toggle `Q3`).<br>4. `users/page.tsx` + `stores/page.tsx` + store modals.<br>5. `login/page.tsx` + `LanguageToggle.tsx` (vector `Globe` + capsule control). | **🛑 GATE G3 (Full App Review on `:3001`)**: All 11 routes and 27 modals migrated; every cell of `02-layout-and-shell.md` §2.4 Reachability Matrix verified. |
| **Phase T6** | **Delete `/ui-gallery` (`Q7`), Test Suites, CI Build, QA Report & Merge Readiness** | Gate G3 approved. | Delete `src/app/ui-gallery/` (and remove 1-line `/ui-gallery` guard in `StoreContext.tsx` if added); write `docs/ui-tahoe/07-qa-verification-report.md`. | **1 commit**: `git rm -rf frontend/src/app/ui-gallery`, run grep gates, run all 6 test suites, run `CI=true NEXT_TELEMETRY_DISABLED=1 npm run build` inside `/opt/RabbitPOS-tahoe/frontend`, write QA report. | **Explicit Exit Criterion (`Q7`)**: `src/app/ui-gallery/` deleted & absent from `.next/` manifest. Ready for §1.3 merge into `/opt/RabbitPOS` (`main`). |

---

## 5. Scoped, Guarded Execution Prompts per Phase

### 5.0 Master Guardrail Block (Prepend to Every Phase Prompt)

> **Master Guardrail Preamble for Phases T1–T6**:
> You are executing the approved Tahoe ("Liquid Glass") redesign on RabbitPOS (`frontend/`, Next.js 14 + Tailwind 3.4.19).
> 1. **Worktree Isolation (`Pre-Flight Item 3`)**: **ALL work MUST happen inside `/opt/RabbitPOS-tahoe` on branch `feat/ui-tahoe`**. `/opt/RabbitPOS` is the live deployed production directory and MUST remain untouched on `main`. NEVER run `docker compose` or `./scripts/deploy.sh` from `/opt/RabbitPOS-tahoe`.
> 2. **Read First**: `AGENTS.md`, `docs/ui-tahoe/00-design-language.md` through `06-open-questions.md`.
> 3. **Non-Interactive Commands Only (`AGENTS.md`)**: Validate types with `cd /opt/RabbitPOS-tahoe/frontend && npx --no-install tsc --noEmit`. Do NOT run `npm run build` until Phase T6 (except optional font-wiring smoke test if requested). Always pass `-m` to `git commit`.
> 4. **Hard Guardrails**: Presentation layer only. **We do NOT upgrade Tailwind CSS (`3.4.19` stays pinned)** and do NOT add any npm dependencies. Do NOT alias `shadow-2xs`, `shadow-xs`, or `backdrop-blur-xs` in `tailwind.config.ts` — replace them per file with Tahoe tokens (`04-risk-performance-a11y.md` §2.5). Do NOT modify backend files, API contracts, DB schema, business/BOM math (`unitConversion.ts`), auth logic, offline IndexedDB/sync logic, cart formulas, `localStorage` cart keys (`rabbitpos_active_cart_*`), or `src/tests/*`. No global `sed`/regex mass-replace — edit file by file and inspect every diff. Every user-facing string must exist in `vi.json` and `en.json`.

---

### 5.1 Phase T1 Prompt — Worktree Setup, Typography Cutover, Font Cleanup (`Item 2`), CSS Variables & Z-Scale

> **Prompt for Phase T1**:
> Execute **Phase T1** strictly inside `/opt/RabbitPOS-tahoe` (`feat/ui-tahoe`):
> 0. **Worktree & Font Pre-Check**:
>    - Ensure `/opt/RabbitPOS` is on `main`. If `/opt/RabbitPOS-tahoe` does not exist yet, create it (`git -C /opt/RabbitPOS worktree add -b feat/ui-tahoe /opt/RabbitPOS-tahoe main`) and hardlink `node_modules` (`cp -al /opt/RabbitPOS/frontend/node_modules /opt/RabbitPOS-tahoe/frontend/node_modules`).
>    - Verify with `ls -l` and `sha256sum` inside `/opt/RabbitPOS-tahoe` that `inter-latin-wght-normal.woff2` (`48,256` bytes) and `inter-vietnamese-wght-normal.woff2` (`10,252` bytes) exist in `docs/font-specimen/fonts/`, `frontend/src/fonts/`, and `frontend/public/fonts/` (if missing in `src/fonts` or `public/fonts`, copy from `docs/font-specimen/fonts/` BEFORE proceeding).
> 1. **Commit 1A (Typography Cutover, CSS Variables, Materials & Z-Scale — MUST RUN BEFORE FONT DELETION)**:
>    - Update `frontend/src/app/layout.tsx`: remove `nunito` `localFont`, keep `inter` `localFont` (`--font-inter`), set `themeColor: "#F2F4F8"`.
>    - Update `frontend/public/sw.js`: remove the 2 `/fonts/nunito-*-wght-normal.woff2` lines (`21–22`) from `PRECACHE_URLS` while keeping the 2 `/fonts/inter-*-wght-normal.woff2` lines (`23–24`) intact so atomic `cache.addAll()` succeeds.
>    - In `frontend/src/app/globals.css`, implement `:root`, `html.dark` slots, `html.no-glass` per-device switch + `@media (prefers-reduced-transparency: reduce)` + `@media (prefers-contrast: more)` + `@supports not (...)` (`Override Q3`), `html[data-overlay-open="true"]` shell-bar demotion (`Amendment A1`), `glass-thin`/`glass-regular`/`glass-thick`/`glass-scrim`, solid `--surface-cart-bar: #2E1065` (`Amendment A2`), brand purple tints, hairlines, and `--shadow-card` / `--shadow-glass-*`.
>    - In `frontend/tailwind.config.ts`, wire `fontFamily.sans`/`display`/`num`, Tahoe radius ladder, text-style ladder, and z-index scale (`10..90`). **Do NOT define `shadow-2xs`, `shadow-xs`, or `backdrop-blur-xs` (`Pre-Flight Item 5`)**.
>    - Add `rabbitpos_glass_effects` helpers in `frontend/src/lib/featureFlags.ts` and i18n keys in `vi.json` + `en.json`.
>    - Verify `npx --no-install tsc --noEmit` passes and `grep -rn "nunito" frontend/src/ frontend/public/` = `0`, then commit Commit 1A.
> 2. **Commit 1B (Delete Unused WOFF2 Font Files — DEPENDS ON COMMIT 1A)**:
>    - `git rm` the `26` unused `.woff2` files (`14` `nunito-*` + `12` static/latin-ext `inter-*`) from `docs/font-specimen/fonts/`, `frontend/src/fonts/`, and `frontend/public/fonts/`, keeping **ONLY** `inter-latin-wght-normal.woff2` (`48,256` B) and `inter-vietnamese-wght-normal.woff2` (`10,252` B) in each folder (`58,508` B/folder).
>    - Update `docs/font-decision.md` header to record `Override Q1`.
>    - Verify `npx --no-install tsc --noEmit` passes, commit Commit 1B, report `ls -l` of all 3 font folders, and STOP.

---

### 5.2 Phase T2 Prompt — Tahoe Primitives, Overlays & Admin-Only `/ui-gallery`

> **Prompt for Phase T2**:
> Execute **Phase T2** inside `/opt/RabbitPOS-tahoe` in 4 commits:
> 1. **Commit 2A (Atomic Controls)**: Upgrade `Button` & `IconButton` (capsule `rounded-full`), `Card`, `Badge` (`11px` floor), `Chip`, `SegmentedControl`, `FieldShell`. Create `Switch.tsx` and `Divider.tsx`.
> 2. **Commit 2B (Layout & Modal Shell Primitives)**: Create `ListGroup.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, and `ModalShell.tsx` (ref-counted `html[data-overlay-open="true"]` and `data-under-nested-overlay="true"` demotion per `Amendment A1`).
> 3. **Commit 2C (Overlays & Pending-Safe ConfirmDialog)**: Upgrade `ResponsiveSheet.tsx` (`glass-thick`, `z-75`/`z-70`, unblurred `glass-scrim`, header/grabber-only pointer drag `Q6`), `ModernSelect.tsx`, `ModernDateRangePicker.tsx`, `FilterBar.tsx`, `ToastContainer.tsx` (`z-90`), and `ConfirmModal.tsx` (`z-80`, dual synchronous `useRef` + `disabled` pending lock `Q5`). Replace all `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs` in these files per `04-risk-performance-a11y.md` §2.5.
> 4. **Commit 2D (Isolated `/ui-gallery` per `Override Q7`, `Item 4`, `Item 5`, `Item 6`)**: Create `src/app/ui-gallery/page.tsx`:
>    - Guard with `notFound()` when `process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ALLOW_UI_GALLERY !== 'true'`.
>    - Enforce client-side `isAdmin()` check; add **zero** navigation links; make **zero** API calls (apply 1-line `/ui-gallery` pathname skip in `StoreContext.tsx` if `G1-D3` approved).
>    - Include **Section 0** (4 side-by-side Tailwind 3.4.19 no-op vs Tahoe token visual diffs per `Item 5`), **Section 1** (live toggle comparing Option A `SF Pro tabular-nums` vs Option B `Inter Variable tabular-nums` on Apple devices for `Q8` per `Item 6`), and all Tahoe component/material specimens.
> 5. Run `npx --no-install tsc --noEmit`, report instructions to launch `:3001` per `05-execution-plan.md` §3.2, and STOP for **Owner Review Gate G1**.

---

### 5.3 Phase T3 Prompt — Role-Aware `AppShell` (`A3` + Reachability Fix) & POS Workspace (`/`, `A2`)

> **Prompt for Phase T3**:
> Execute **Phase T3** inside `/opt/RabbitPOS-tahoe` in 3 commits (applying the owner's Gate G1 decision on `Q8` first if Option A was selected):
> 1. **Commit 3A (Role-Aware `AppShell` + `StoreSwitcher` + `InstallPWABanner` per `02-layout-and-shell.md` §2.4)**:
>    - For role `staff` (`!canManageStore`): Render ONLY the Compact `glass-regular` Top Header (`52px` mobile / `56px` desktop, `z-30`) containing Logo/`StoreSwitcher`, the **2-pill inline `POS` (`/`) | `Thu chi` (`/transactions`) capsule**, Online/Offline status pill, and Cashier User Menu (`VI/EN`, `Hiệu ứng kính` `Switch`, `Đăng xuất`). Render **no Bottom Tab Bar and no Left Sidebar**.
>    - For role `admin` & `SuperAdmin` (`canManageStore`): Render Sticky `glass-regular` Top Bar + `< 768px` Floating 5-Item Tab Bar (`POS` `/`, `Thu chi` `/transactions`, `Nhập hàng` `/purchases`, `Báo cáo` `/dashboard`, and `Thêm` Sheet containing `Thực đơn` `/products`, `Khuyến mãi` `/products?open=promotions`, `Quản lý nhân sự` `/users`, `Cài đặt hệ thống` `/settings`, `Chuỗi cửa hàng` `/stores` [SuperAdmin only], `Ngôn ngữ`, `Hiệu ứng kính`, `Đăng xuất`) + `>= 768px` Collapsible Left Sidebar (`68px` tablet / `240px` desktop with all 8 `admin` / 9 `SuperAdmin` items).
> 2. **Commit 3B (POS Catalog `app/page.tsx`)**: Opaque product card badge (`:272`), `ResponsiveSheet` sort/tag filter (`:1295`), **Solid `#2E1065` Cart Bar (`--surface-cart-bar`, `0px` blur, `z-35`)** (`Amendment A2`) with role-aware bottom offset, and per-file replacement of all 14 legacy `shadow-2xs`/`shadow-xs`/`backdrop-blur-xs` occurrences.
> 3. **Commit 3C (POS Modals `M01–M07`)**: Migrate all 7 POS modals to `ModalShell` (`z-50`/`z-60`).
> 4. Run `npx --no-install tsc --noEmit`, report, and STOP for **Owner Review Gate G2**.

---

### 5.4 Phase T4 Prompt — Financial (`Transactions`, `Purchases/BOM`) & Catalog (`Products`)

> **Prompt for Phase T4**:
> Execute **Phase T4** inside `/opt/RabbitPOS-tahoe` in 7 isolated commits (`4A–4G` per `03-screen-mapping.md`):
> - Replace all 4 `window.confirm()` calls (`PurchasesCostTab.tsx:541`, `PurchasesCostTab.tsx:812`, `app/transactions/page.tsx:711`, `app/transactions/page.tsx:804`) with `useConfirm()` following `06-open-questions.md` `Q5` (adding `deletingIngredientId` and `deletingReconcileFundId` + synchronous `useRef` locks so buttons cannot double-fire, and preserving `showToast('error', ...)` failure handling).
> - Replace all `backdrop-blur-xs`, `shadow-2xs`, `shadow-xs`, `animate-in`, `text-[8|9|10px]`, and non-chart `indigo`/`violet` occurrences per file (`04-risk-performance-a11y.md` §2.5).
> - Run `npx --no-install tsc --noEmit` after every commit, report, and STOP.

---

### 5.5 Phase T5 Prompt — Dashboard, Settings, Users, Stores & Login

> **Prompt for Phase T5**:
> Execute **Phase T5** inside `/opt/RabbitPOS-tahoe` in 5 isolated commits (`5A–5E` per `03-screen-mapping.md`):
> - Expose per-device `"Hiệu ứng kính (Liquid Glass)"` `Switch` (`rabbitpos_glass_effects`) in `Settings` (`Override Q3`).
> - Replace all remaining `backdrop-blur-xs`, `shadow-2xs`, `shadow-xs`, `animate-in`, `text-[8|9|10px]`, and non-chart `indigo`/`violet` occurrences per file.
> - Verify every cell of the `02-layout-and-shell.md` §2.4 Reachability Matrix, run `npx --no-install tsc --noEmit`, report, and STOP for **Owner Review Gate G3**.

---

### 5.6 Phase T6 Prompt — Delete `/ui-gallery` (`Q7`), Test Suites, CI Build & QA Report

> **Prompt for Phase T6**:
> Execute **Phase T6** inside `/opt/RabbitPOS-tahoe` only (do NOT touch `/opt/RabbitPOS` or Docker containers):
> 1. **Explicit Exit Criterion (`Override Q7`)**: `git rm -rf frontend/src/app/ui-gallery` (and revert the 1-line `/ui-gallery` guard in `StoreContext.tsx` if added in T2) and verify `test ! -d frontend/src/app/ui-gallery`.
> 2. Run empirical grep gates across `frontend/src/`:
>    - `grep -rn "<select" src/` -> `0`
>    - `grep -rnE "text-\[(8|9|10)px\]" src/` -> `0` outside the 12 thermal-receipt lines in `ReceiptModal.tsx`
>    - `grep -rnE "window\.(confirm|alert|prompt)" src/` -> `0` outside `src/tests/`
>    - `grep -rnE "\b(shadow-2xs|shadow-xs|backdrop-blur-xs|animate-in)\b" src/` -> `0` (`Amendment A4` & `Pre-Flight Item 5`)
>    - `grep -rn "nunito" src/ public/` -> `0` (`Override Q1` & `Pre-Flight Item 2`)
> 3. Run `npx --no-install tsc --noEmit` and all 6 automated test suites (`src/tests/run_*.js`).
> 4. Run **one** production build inside `/opt/RabbitPOS-tahoe/frontend`: `CI=true NEXT_TELEMETRY_DISABLED=1 npm run build`, confirming `0` `/ui-gallery` artifacts in `.next/`.
> 5. Write `docs/ui-tahoe/07-qa-verification-report.md`, commit on `feat/ui-tahoe`, and STOP for Owner merge authorization (§1.3).
