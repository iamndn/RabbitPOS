# Design Brief — Phase 1A: Font Specimen (Decision Gate)

## Scope & Decisions
- Isolated font specimen under `docs/font-specimen/index.html` + `fonts/`. Zero app code modified.
- Pairings displayed:
  - **A:** Plus Jakarta Sans + Inter (92.0 KB measured)
  - **B:** Be Vietnam Pro (Single Family, Static: 65.3 KB measured)
  - **C:** Nunito + Inter (108.1 KB measured)
  - **D:** Lexend + Inter (109.4 KB measured)
  - **E:** Manrope + Inter (89.7 KB measured)
  - **F:** Inter Variable Only (Control: 57.1 KB measured)
- Interactive controls: Tabular Numerals (`font-variant-numeric: tabular-nums`), Line-Height toggle (tight 1.15-1.25 vs normal 1.5).

## 390px Mobile Specimen Wireframe
```
+---------------------------------------+ [390px Viewport Frame]
| [A] [B] [C] [D] [E] [F - Control]     | Pairing selector tabs
| [Tabular: ON] [LineHeight: NORMAL]    | Global toggles
+---------------------------------------+
| 28px H1 Cà phê sữa đá & Trà ô long    | Headings / Brand
| Diacritics: ệ ẫ ử ỗ ặ ớ ữ ổ (stress)  | Clipping test line
| [Bán chạy] [Giảm 10%]  (11px Badges)  | Compact Badges
+---------------------------------------+
| [Doanh thu: 1.250.000₫] [Đơn: 42]     | 3x KPI Cards (14/20px)
+---------------------------------------+
| SẢN PHẨM / GD         SL     TIỀN     | Dense Ledger Table
| Cà phê muối           02    58.000₫   | Right-aligned money
+---------------------------------------+
| [Nhập mã giảm giá...       ] [Áp dụng]| Form Input (16px)
| [ + Thanh toán ngay (45.000đ) ]       | Primary (44px)
+---------------------------------------+
```

## Anti-Generic Audit (Impeccable & Taste-Skill)
- NO uppercase eyebrow labels above headings ("OVERVIEW", "ANALYTICS" banned).
- NO decorative gradient text, blurred glassmorphism, or cartoon drop shadows.
- Distinct elevations: flat clean border `1px solid #e2e8f0` with subtle functional tint.
- Real Vietnamese F&B content (not lorem ipsum) to evaluate diacritic collision.
