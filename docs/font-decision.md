# Quyết Định Font Chữ Chính Thức (Font Decision Gate) — RabbitPOS

> [!IMPORTANT]
> **CẬP NHẬT THEO TAHOE ("LIQUID GLASS") REDESIGN — OWNER OVERRIDE Q1 (`2026-11-02`, Phase T1) & GATE G1 LOCKED DECISION Q8 (`2026-11-02`, Phase T3)**:
> - **Quyết định mới có hiệu lực (Supersedes Pairing C Nunito):**
>   1. **Giao diện, Tiêu đề, Nhãn nút & Nội dung (`--font-sans` / `--font-display`):** Sử dụng **System Font Stack** (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"`) để hiển thị native **San Francisco (`SF Pro`)** trên thiết bị Apple (iOS / iPadOS / macOS, `0` byte tải mạng), kết hợp **self-hosted Inter Variable** (`latin` + `vietnamese` subsets) làm fallback đồng nhất trên các nền tảng không phải Apple (Android / Windows / Linux). **Loại bỏ hoàn toàn `Nunito`.**
>   2. **Số tiền, KPI, Bảng kê & Ngày giờ (`.font-num` / `.tabular-nums` / `fontFamily.num` — Gate G1 Locked Decision `Q8 = Option A`):** Sử dụng **System Font Stack (`SF Pro`) với `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1` trên thiết bị Apple**, và tự động fallback sang **Inter Variable (`tabular-nums`, `"tnum" 1`) trên các thiết bị không phải Apple** (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), system-ui, "Segoe UI", Roboto, sans-serif`). Quyết định này đảm bảo trên cùng một dòng dữ liệu không bao giờ trộn 2 họ font khác nhau, giữ thẳng hàng tuyệt đối các cột số tiền `0–9` trên mọi nền tảng, và tiết kiệm `58,508` bytes tải font trên iPhone / iPad / Mac.
>   3. **Dung lượng file WOFF2 đo đạc thực tế còn giữ lại (`ls -l` — `[VERIFIED]`):**
>      - `inter-latin-wght-normal.woff2`: **`48,256` bytes** (`47.12 KiB`)
>      - `inter-vietnamese-wght-normal.woff2`: **`10,252` bytes** (`10.01 KiB`)
>      - **Tổng dung lượng giữ lại mỗi thư mục:** **`58,508` bytes** (`57.14 KiB` — giảm từ `525,016` bytes/thư mục, giải phóng `466,508` bytes/thư mục và `1,399,524` bytes trên cả 3 thư mục `docs/font-specimen/fonts/`, `frontend/src/fonts/`, `frontend/public/fonts/`).
>   4. **Quy tắc vẫn giữ nguyên hiệu lực:** Mục 5 (Tabular Numerals) và Mục 6 (Quy tắc `line-height >= 1.35` cho tiêu đề / `>= 1.45` cho nội dung chống cắt dấu tiếng Việt) bên dưới vẫn là quy chuẩn bắt buộc.

*(Nội dung lịch sử Phase 1A bên dưới được lưu giữ để đối chiếu số liệu đo đạc ban đầu.)*

Tài liệu này ghi nhận quyết định lựa chọn font chính thức của chủ sở hữu dự án (Owner) sau khi thẩm định trực quan trên file thử nghiệm `docs/font-specimen/index.html`. Đây là điều kiện tiên quyết (Precondition) bắt buộc để mở khóa và thực thi **Phase 1B (Foundations)**.

---

## 1. Bộ Font Được Phê Duyệt (Approved Pairing)

- **Lựa chọn:** **Pairing C — Nunito + Inter**
- **Giấy phép bản quyền:** SIL Open Font License 1.1 (Cả hai họ font đều là nguồn mở, cho phép self-host thương mại và lưu trữ trực tiếp trong repository).

---

## 2. Phân Vai Chi Tiết Từng Họ Font (Role of Each Family)

### 2.1. Nunito (Display, Brand, UI & Body)
- **Vai trò:**
  - Tiêu đề trang (Page Headings, H1/H2/H3), tên màn hình.
  - Tên thương hiệu, logo RabbitPOS.
  - Nhãn nút bấm (Buttons: Primary, Secondary, Ghost, Danger).
  - Tên món ăn / đồ uống tiếng Việt trên menu (VD: *Cà phê sữa đá, Sinh tố bơ dừa*).
  - Nhãn form (Form labels), placeholder, badge / tag trạng thái.
  - Văn bản nội dung thông thường (Body text, hướng dẫn, thông báo).
- **Mục tiêu UX:** Tạo cảm giác thân thiện, ấm áp, mềm mại, đặc trưng của ngành dịch vụ F&B (quán cafe, trà sữa, nước ép), giúp giảm bớt sự khô khan và căng thẳng khi vận hành.

### 2.2. Inter (Numbers, KPIs, Tables & Dense Data)
- **Vai trò:**
  - Toàn bộ các con số tài chính: giá tiền, tổng tiền, tiền thối, chiết khấu (`45.000đ`, `1.250.000 ₫`).
  - Số liệu trên các thẻ KPI (Doanh thu, số lượng đơn, tiền két).
  - Bảng kê giao dịch (Ledger / Order tables), cột số lượng (SL), mã hoá đơn (`#HD-1092`).
  - Ngày tháng và mốc thời gian (`14:20:15`, `01/11/2026`).
  - Dữ liệu trong các ô nhập số tiền / máy tính tiền (POS numpad, cash input).
- **Mục tiêu UX:** Đảm bảo độ sắc nét, chính xác tuyệt đối, không nhầm lẫn con số trong môi trường thanh toán áp lực cao.

---

## 3. Trọng Số Sử Dụng Thực Tế (Weights Actually Used)

Hệ thống áp dụng 4 mức trọng số tiêu chuẩn cho cả hai họ font (hoặc dải liên tục thông qua Variable Font):
1. **Regular (400):** Văn bản thông thường, mô tả phụ, placeholder, chi tiết ghi chú.
2. **Medium (500):** Nhãn điều khiển, tiêu đề phụ, văn bản bảng kê dày đặc, chip filter.
3. **SemiBold (600):** Nhãn nút bấm (Buttons), thẻ trạng thái (Badges), tiêu đề thẻ (Card titles), tiêu đề cột bảng.
4. **Bold (700):** Tiêu đề chính trang (H1), tổng giá trị thanh toán, con số KPI nổi bật.

---

## 4. File Lưu Trữ & Dung Lượng Đo Đạc Thực Tế (Files & Measured Sizes)

Hệ thống self-host 100% bằng định dạng WOFF2 nén, tải theo hai subset bắt buộc: `latin` và `vietnamese` (kèm ký tự `₫` U+20AB).

### 4.1. Kịch bản Production Variable Font (Khuyến nghị ưu tiên)
| Họ font | File WOFF2 | Dung lượng đo đạc | Ghi chú kỹ thuật |
|---|---|---|---|
| **Nunito** | `nunito-latin-wght-normal.woff2`<br>`nunito-vietnamese-wght-normal.woff2` | 39,128 B (38.2 KB)<br>13,096 B (12.8 KB) | Variable trục `wght` (200–1000). Bao quát toàn bộ độ đậm nhạt tiêu đề và giao diện. |
| **Inter** | `inter-latin-wght-normal.woff2`<br>`inter-vietnamese-wght-normal.woff2` | 48,256 B (47.1 KB)<br>10,252 B (10.0 KB) | Variable trục `wght` (100–900). Chứa OpenType `tnum` cho số liệu. |
| **TỔNG CỘNG** | **4 files WOFF2** | **110,732 B (108.1 KB)** | **ĐẠT NGÂN SÁCH (108.1 KB / ~200 KB, còn dư 46%)** |

### 4.2. Kịch bản Static Fallback (Nếu dùng discrete weights 400 + 600)
- `nunito-latin-400-normal.woff2` (16.3 KB) + `nunito-vietnamese-400-normal.woff2` (6.1 KB)
- `nunito-latin-600-normal.woff2` (16.6 KB) + `nunito-vietnamese-600-normal.woff2` (6.2 KB)
- `inter-latin-400-normal.woff2` (23.7 KB) + `inter-vietnamese-400-normal.woff2` (5.0 KB)
- `inter-latin-600-normal.woff2` (24.5 KB) + `inter-vietnamese-600-normal.woff2` (5.1 KB)
- *Tổng dung lượng 8 files static 400+600:* **~103.5 KB**.

---

## 5. Quy Chuẩn Tabular Numerals (Căn Cột Số Tiền)

1. **Vấn đề của Nunito:** Chữ số gốc của Nunito là chữ số tỷ lệ (proportional digits). Chiều rộng của số `1` rất hẹp so với số `0` hoặc số `8`, dẫn đến tình trạng các hàng số tiền (VD: `111.000 ₫` và `888.000 ₫`) bị thụt thò, lệch hàng khi xếp dọc.
2. **Giải pháp bắt buộc:**
   - **Tất cả thành phần chứa số tiền, bảng kê tài chính, ngày giờ và KPI BẮT BUỘC dùng font Inter.**
   - Áp dụng tiện ích CSS `tabular-nums` (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`).
   - Mọi chữ số từ `0` đến `9` trong Inter có cùng một bề ngang chính xác, đảm bảo các cột tiền căn phải (`text-right`) thẳng tắp hàng dọc.

---

## 6. Quy Tắc Line-Height Chống Cắt Dấu Tiếng Việt (Vietnamese Diacritics Rule)

Tiếng Việt có nhiều nguyên âm mang dấu thanh kép xếp chồng (circumflex + acute/grave/hook/tilde như `ệ`, `ẫ`, `ử`, `ỗ`, `ặ`, `ớ`, `ữ`, `ổ`) và chữ hoa có dấu (`Đ`, `Ệ`, `Ẫ`, `Ứ`, `Ỗ`, `Ặ`, `Ợ`).

### Quy tắc bắt buộc khi thiết kế giao diện (Design Rule):
1. **Tiêu đề (Headings):**
   - **Tuyệt đối KHÔNG dùng** `leading-none` (line-height: 1) hoặc `leading-tight` (line-height: 1.25) cho các thẻ tiêu đề tiếng Việt.
   - **Quy định:** `line-height` tối thiểu cho Headings là **`1.35`** (khuyến nghị Tailwind class `leading-normal` = 1.5 hoặc utility tùy biến `leading-[1.35]`).
2. **Nội dung văn bản (Body text):**
   - Giữ `line-height ≥ 1.5` (Tailwind `leading-normal` hoặc `leading-relaxed`).
3. **Container có `overflow: hidden`:**
   - Trong các nút bấm, thẻ tóm tắt, ô input hoặc bảng có thuộc tính `overflow-hidden` hoặc `truncate`, **bắt buộc phải có padding dọc tối thiểu 4px** (`py-1` hoặc `py-1.5`) để ngăn trình duyệt xén mất đỉnh dấu hỏi, dấu ngã hoặc dấu mũ của chữ hoa.

---

## 7. Trạng Thái Phê Duyệt & Bước Tiếp Theo

- **Trạng thái:** **APPROVED BY OWNER**
- **Thư mục font đã tinh giản:** `docs/font-specimen/fonts/` đã loại bỏ các họ font không được chọn (Plus Jakarta Sans, Be Vietnam Pro, Lexend, Manrope), chỉ giữ lại **Nunito** và **Inter**.
- **Bước tiếp theo:** Chờ lệnh rõ ràng `"Proceed to Phase 1B"` từ Owner để bắt đầu cài đặt nền tảng font, token kích thước và cấu hình service-worker shell cache.
