# RabbitPOS — Báo Cáo Kỹ Thuật Đo Đạc Font & Cổng Quyết Định (Phase 1A Refined)

Tài liệu này cung cấp **số liệu đo đạc thực tế (measured facts)** của các bộ font ứng viên cho giao diện RabbitPOS, tách biệt hoàn toàn giữa dữ liệu kỹ thuật đã kiểm chứng và các nhận định thẩm mỹ chưa thể kiểm chứng tự động (unverified impressions).

---

## 1. Số Liệu Đo Đạc Thực Tế Payload Production (Measured Facts)

### Quy chuẩn đo đạc:
- **Môi trường sử dụng thực tế:** Màn hình thu ngân POS tiếng Việt.
- **Subsets bắt buộc:** `latin` (chữ Latin cơ bản, chữ số 0-9, ký hiệu) + `vietnamese` (các ký tự có dấu thanh tiếng Việt). Ký tự tiền tệ `₫` (U+20AB) nằm trong subset tiếng Việt.
- **Định dạng:** WOFF2 nén tiêu chuẩn.
- **Cơ chế font:** 
  - Sử dụng **Variable Font (trục wght)** đối với các họ font có hỗ trợ trên upstream Fontsource.
  - **Xác nhận kỹ thuật:** **Be Vietnam Pro KHÔNG có bản Variable Font** trên Fontsource (gói `@fontsource-variable/be-vietnam-pro` trả về HTTP 404). Do đó, Be Vietnam Pro đo đạc dựa trên các file **Static WOFF2** tương ứng với các trọng số cần thiết (Headings 600-700, Body 400-500).

---

### Bảng Đo Đạc Dung Lượng Chi Tiết Từng File (Exact Measured Bytes)

| Họ Font (Family) | Dạng font (Format) | File Subsets Đo Đạc | Dung lượng từng file (Bytes / KB) | Tổng dung lượng họ font |
|---|---|---|---|---|
| **Inter** | **Variable** (`wght` 100-900) | • `inter-latin-wght-normal.woff2`<br>• `inter-vietnamese-wght-normal.woff2` | • 48,256 B (47.1 KB)<br>• 10,252 B (10.0 KB) | **58,508 B (57.1 KB)** |
| **Plus Jakarta Sans** | **Variable** (`wght` 200-800) | • `plus-jakarta-sans-latin-wght-normal.woff2`<br>• `plus-jakarta-sans-vietnamese-wght-normal.woff2` | • 27,348 B (26.7 KB)<br>• 8,352 B (8.2 KB) | **35,700 B (34.9 KB)** |
| **Be Vietnam Pro** | **Static Only** *(Không có variable)* | **Kịch bản A (2 weights: 400 + 600):**<br>• `be-vietnam-pro-latin-400-normal.woff2`<br>• `be-vietnam-pro-vietnamese-400-normal.woff2`<br>• `be-vietnam-pro-latin-600-normal.woff2`<br>• `be-vietnam-pro-vietnamese-600-normal.woff2`<br><br>*Kịch bản B (Bổ sung 500 + 700):*<br>• `bvp-latin-500-normal.woff2` + `vietnamese`<br>• `bvp-latin-700-normal.woff2` + `vietnamese` | • 21,168 B (20.7 KB)<br>• 11,532 B (11.3 KB)<br>• 22,032 B (21.5 KB)<br>• 12,176 B (11.9 KB)<br><br>• 21,892 B + 12,172 B (33.3 KB)<br>• 22,152 B + 12,468 B (33.8 KB) | **Kịch bản A (400 + 600):**<br>**66,908 B (65.3 KB)**<br><br>*Kịch bản B (400+500+600+700):*<br>**135,592 B (132.4 KB)** |
| **Nunito** | **Variable** (`wght` 200-1000) | • `nunito-latin-wght-normal.woff2`<br>• `nunito-vietnamese-wght-normal.woff2` | • 39,128 B (38.2 KB)<br>• 13,096 B (12.8 KB) | **52,224 B (51.0 KB)** |
| **Lexend** | **Variable** (`wght` 100-900) | • `lexend-latin-wght-normal.woff2`<br>• `lexend-vietnamese-wght-normal.woff2` | • 39,680 B (38.8 KB)<br>• 13,840 B (13.5 KB) | **53,520 B (52.3 KB)** |
| **Manrope** | **Variable** (`wght` 200-800) | • `manrope-latin-wght-normal.woff2`<br>• `manrope-vietnamese-wght-normal.woff2` | • 24,836 B (24.3 KB)<br>• 8,520 B (8.3 KB) | **33,356 B (32.6 KB)** |

---

### Bảng Tổng Hợp Dung Lượng Browser Tải Thực Tế Theo Pairing (Production Payload)

Ngân sách tối đa theo Design Rule D1: **~200 KB WOFF2**.

| Mã | Bộ Font (Pairing) | Thành phần font tải về | Tổng dung lượng tải thực tế (Measured Bytes) | Đạt ngân sách 200 KB? | Giấy phép (License) |
|---|---|---|---|---|---|
| **A** | **Plus Jakarta Sans + Inter** | PJS Variable (35,700 B) + Inter Variable (58,508 B) | **94,208 B (92.0 KB)** | **ĐẠT** (Còn dư 54%) | SIL OFL 1.1 |
| **B** | **Be Vietnam Pro (Static)** | BVP Static 400 + 600 (4 files: 66,908 B)<br>*(Nếu tải đủ 400, 500, 600, 700: 135,592 B)* | **66,908 B (65.3 KB)**<br>*(Đủ 4 weights: 132.4 KB)* | **ĐẠT** (Còn dư 67%) | SIL OFL 1.1 |
| **C** | **Nunito + Inter** | Nunito Variable (52,224 B) + Inter Variable (58,508 B) | **110,732 B (108.1 KB)** | **ĐẠT** (Còn dư 46%) | SIL OFL 1.1 |
| **D** | **Lexend + Inter** | Lexend Variable (53,520 B) + Inter Variable (58,508 B) | **112,028 B (109.4 KB)** | **ĐẠT** (Còn dư 45%) | SIL OFL 1.1 |
| **E** | **Manrope + Inter** | Manrope Variable (33,356 B) + Inter Variable (58,508 B) | **91,864 B (89.7 KB)** | **ĐẠT** (Còn dư 55%) | SIL OFL 1.1 |
| **F** | **Inter Variable Only (Control)** | Inter Variable (58,508 B) | **58,508 B (57.1 KB)** | **ĐẠT** (Nhẹ nhất khi dùng Variable, còn dư 71%) | SIL OFL 1.1 |

> [!IMPORTANT]
> **Kết luận ngân sách:** **Tất cả 6 kịch bản đều nằm trong ngân sách 200 KB.** Kịch bản nhẹ nhất là **F (Inter Variable: 57.1 KB)** và **B (Be Vietnam Pro 2 weights: 65.3 KB)**. Kịch bản nặng nhất là **D (Lexend + Inter: 109.4 KB)**, vẫn chỉ chiếm ~55% ngân sách cho phép.

---

## 2. Tính Năng Kỹ Thuật Đã Kiểm Chứng (Verified Technical Facts)

1. **Tabular Numerals (`tnum`):**
   - **Inter:** Có bảng OpenType `GSUB` với tính năng `tnum` được kích hoạt thông qua CSS `font-variant-numeric: tabular-nums` hoặc `font-feature-settings: 'tnum' 1`. Chiều rộng của 10 chữ số `0-9` đồng nhất tuyệt đối.
   - **Be Vietnam Pro:** Là font static, các chữ số mặc định có chiều rộng tỷ lệ (proportional). Ví dụ chữ số `1` hẹp hơn số `8`. Khi bật `tabular-nums`, trình duyệt áp dụng bảng tính năng thay thế nếu có trong font.
   - **Nunito:** Các chữ số mặc định có chiều rộng chênh lệch lớn (số 1 rất hẹp, số 0 tròn rộng). Do đó Nunito bắt buộc phải dùng số từ Inter trong bảng số liệu.
2. **Nguồn gốc & Bản quyền (OFL Metadata):**
   - Tất cả 6 font đều phát hành dưới giấy phép **SIL Open Font License 1.1** (miễn phí, mã nguồn mở, cho phép self-host thương mại).
   - *Ghi nhận bản quyền theo METADATA chính thức của Google Fonts / Fontsource:*
     - **Inter:** Bản quyền thuộc Rasmus Andersson (`github.com/rsms/inter`).
     - **Be Vietnam Pro:** Bản quyền thuộc Thảo Phạm và Gabriel Valdivia (`github.com/bettertype/BeVietnamPro`).
     - **Plus Jakarta Sans:** Bản quyền thuộc Gumpita Rahayu / Tokotype (`tokotype.com`).
     - **Nunito:** Thiết kế ban đầu bởi Vernon Adams, mở rộng bởi Manvel Shmavonyan.
     - **Lexend:** Thiết kế bởi Bonnie Shaver-Troup, Thomas Jockin (`lexend.com`).
     - **Manrope:** Thiết kế bởi Mikhail Sharanda (`gent.media`).

---

## 3. Nhận Định Thẩm Mỹ Chưa Kiểm Chứng Trên Môi Trường Thực (Unverified Impressions)

> [!WARNING]
> Vì Agent hoạt động trong môi trường dòng lệnh Linux (không có công cụ headless browser hoặc chụp ảnh màn hình), **tất cả các nhận xét thị giác dưới đây được đánh dấu là `[UNVERIFIED IN BROWSER]`**. Chủ dự án cần trực tiếp mở file `docs/font-specimen/index.html` để kiểm chứng bằng mắt trên thiết bị thật.

1. `[UNVERIFIED IN BROWSER]` **Va chạm dấu tiếng Việt khi co dòng (Line-height Clipping):**
   - Giả thuyết kỹ thuật: Khi bật toggle `Line Height: TIGHT (1.15-1.25)`, các nguyên âm có dấu kép như `ệ`, `ẫ`, `ử`, `ỗ` có thể chạm vào đuôi chữ cái của dòng trên (`p`, `q`, `y`) hoặc chạm mép container nếu container có `overflow: hidden`. Cần chủ dự án mở trên điện thoại để xác nhận xem dấu có bị cắt cụt hay không.
2. `[UNVERIFIED IN BROWSER]` **Độ rõ nét trên màn hình POS độ phân giải thấp (Low-DPI Legibility):**
   - Nunito có nét bo tròn (rounded terminal); trong môi trường màn hình thu ngân giá rẻ độ phân giải thấp, chữ nét tròn có thể trông mờ hơn font nét thẳng hình học như Inter hoặc Lexend.
3. `[UNVERIFIED IN BROWSER]` **Cảm giác thương hiệu F&B:**
   - Pairing A (Plus Jakarta Sans) và Pairing E (Manrope) mang lại cảm giác quán cafe hiện đại, trẻ trung.
   - Pairing B (Be Vietnam Pro) mang lại cảm giác thân thuộc, thuần Việt.
   - Pairing F (Inter Variable) mang lại cảm giác công cụ quản trị kỹ thuật số, trung tính, không cảm xúc nhưng tối đa hóa tính công năng.

---

## 4. Hướng Dẫn Thử Nghiệm

Mở trực tiếp file:
[`docs/font-specimen/index.html`](file:///opt/RabbitPOS/docs/font-specimen/index.html)

- Bấm nút **Tabular Numerals** để so sánh căn hàng số tiền giữa Inter và các font khác.
- Bấm nút **Line Height** để kiểm tra dấu tiếng Việt.
- Bấm nút **Pairing F (Inter Variable - Control)** để so sánh trực tiếp với 5 phương án A, B, C, D, E.
