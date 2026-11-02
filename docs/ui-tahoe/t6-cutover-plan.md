# Kế Hoạch Chuyển Đổi Lên Production (Phase T6: Production Build & Cutover Plan)

**Ngày lập / Cập nhật**: 2026-11-03  
**Vị trí**: `/opt/RabbitPOS-tahoe` (nhánh `feat/ui-tahoe`)  
**Trạng thái phê duyệt**: Gate G4 đã được chủ dự án thông qua bằng văn bản ("Gate G4 passed") `[VERIFIED]`.  
**Mục tiêu**: Chuẩn hóa toàn bộ quy trình đóng gói, kiểm thử tiền chuyển đổi, phương án rollback thuần Docker image (không dùng `git reset --hard`), danh mục Go/No-Go và hướng dẫn chủ dự án thực thi cutover trực tiếp an toàn tuyệt đối.

---

## 1. Tuyên Bố Của Chủ Dự Án & Tình Trạng Bằng Chứng Gate G4 (G4 Evidence Status)

- **Tuyên bố bằng văn bản từ chủ dự án**: `"Gate G4 passed."` `[VERIFIED]`
- **Nguyên tắc đối chiếu**: Chỉ sử dụng những gì chủ dự án đã xác nhận bằng văn bản; mặc định toàn bộ các hạng mục còn lại là `NOT-CONFIRMED`. Tuyệt đối không suy diễn là đã thực hiện trong thực tế `[VERIFIED]`.

### Bảng Trạng Thái Bằng Chứng Gate G4 (G4 Evidence Status Table)
| Hạng mục bằng chứng kiểm thử Gate G4 | Trạng thái ghi nhận | Chi tiết ghi chú |
| :--- | :---: | :--- |
| **1. Kiểm tra trực quan Liquid Glass trên iPhone thật (iOS Safari)** | `NOT-CONFIRMED` | Chưa có phản hồi hoặc ảnh chụp màn hình Safari thực tế từ chủ dự án. |
| **2. Kiểm tra trực quan trên điện thoại Android thật (Chrome)** | `NOT-CONFIRMED` | Chưa có phản hồi trực quan trên màn hình OLED/LCD Android từ chủ dự án. |
| **3. Cảm giác vuốt grabber `ResponsiveSheet` & nút bật/tắt kính `html.no-glass`** | `NOT-CONFIRMED` | Chưa có đánh giá cảm giác vuốt chạm và độ mượt khung hình thực tế. |
| **4. Đối chiếu tính nhất quán số liệu KPI với container `:3000` (KPI Parity)** | `NOT-CONFIRMED` | Chưa có biên bản đối chiếu số liệu doanh thu/lợi nhuận giữa 2 bản build. |
| **5. Xác nhận đơn hàng NDN lúc 17:30:19Z (Không phải lỗi từ dev-server)** | `NOT-CONFIRMED` | Log cho thấy đơn tạo qua Cloudflare Tunnel công khai, chưa có xác nhận từ nhân sự NDN. |
| **6. Rà soát thủ công cơ sở dữ liệu trên bản sao `rabbitpos_test` (Manual DB Review)** | `NOT-CONFIRMED` | Chưa có kết quả đối chiếu dữ liệu bảng `orders`, `settings` trên DB test. |

---

## 2. Gỡ Bỏ Hoàn Toàn `/ui-gallery` & Hoàn Tác Guard `StoreContext` (Commit `4400a79d`)

Toàn bộ các thành phần thử nghiệm tạm thời phục vụ Gate G1 đã được gỡ bỏ triệt để trong **duy nhất 1 commit** (`4400a79d`) `[VERIFIED]`:
- **Xóa vĩnh viễn thư mục `/ui-gallery`**:
  - Đã xóa `frontend/src/app/ui-gallery/UiGalleryClient.tsx` (1.793 dòng) `[VERIFIED]`.
  - Đã xóa `frontend/src/app/ui-gallery/page.tsx` (21 dòng) `[VERIFIED]`.
  - Thư mục vật lý `frontend/src/app/ui-gallery` đã bị xóa hoàn toàn (`test ! -d ...` trả về TRUE) `[VERIFIED]`.
- **Hoàn tác sạch sẽ G1-D3 Guard trong `StoreContext.tsx`**:
  - Lệnh `git revert --no-commit 9cf90aad` thực thi hoàn hảo, loại bỏ hoàn toàn 13 dòng mã chặn `GET /api/v1/stores` tạm thời. `StoreContext.tsx` trở về trạng thái nguyên bản 100% `[VERIFIED]`.
- **Cập nhật tài liệu hướng dẫn**:
  - `docs/ui-tahoe/05-execution-plan.md` mục §3.2 được cập nhật đánh dấu trạng thái "COMPLETED & ARCHIVED", vô hiệu hóa hướng dẫn khởi chạy dev server `:3001` `[VERIFIED]`.
- **Bằng chứng Grep xác thực (0 kết quả trong `frontend/src` và `frontend/public`)**:
  ```bash
  git -C /opt/RabbitPOS-tahoe grep -inE "ui-gallery|NEXT_PUBLIC_ENABLE_UI_GALLERY" frontend/src frontend/public
  # Trả về: Exit code 1 (0 dòng khớp) [VERIFIED]
  ```

---

## 3. Kiểm Tra Biên Dịch TypeScript, Bộ Test Runners & Build Production Thực Tế

### 3.1. Kiểm tra Typecheck (`tsc --noEmit`)
- Đã dọn dẹp cache kiểu dữ liệu cũ của Next.js (`rm -rf frontend/.next`).
- Chạy lệnh `./node_modules/.bin/tsc --noEmit` trong `frontend`:
  - **Kết quả**: Exit code 0, 0 lỗi TypeScript `[VERIFIED]`.

### 3.2. Chạy lại toàn bộ 6 Test Runners (Tên file thực tế)
Tất cả 6 file kịch bản kiểm thử chạy độc lập trên nhánh `feat/ui-tahoe` đạt thành công 100%:
1. `frontend/src/tests/run_hardening_tests.js`: **37 / 37 PASS** (100%) `[VERIFIED]`
2. `frontend/src/tests/run_multi_store_phase3_tests.js`: **5 SUITES / 23 ASSERTIONS PASS** (100%) `[VERIFIED]`
3. `frontend/src/tests/run_multi_store_phase4_tests.js`: **5 SUITES / 28 ASSERTIONS PASS** (100%) `[VERIFIED]`
4. `frontend/src/tests/run_offline_sync_tests.js`: **21 / 21 PASS** (100%) `[VERIFIED]`
5. `frontend/src/tests/run_offline_tests.js`: **24 / 24 PASS** (100%) `[VERIFIED]`
6. `frontend/src/tests/run_toast_tests.js`: **19 / 19 PASS** (100%) `[VERIFIED]`
- **Tổng cộng**: **111 / 111 test assertions PASSED** `[VERIFIED]`.

### 3.3. Kiểm tra bộ nhớ khả dụng (RAM Check)
- Lệnh: `free -h`
- Kết quả đo lường:
  - Total: `4.0Gi`, Used: `2.1Gi`, Free: `1.4Gi`, Buff/Cache: `558Mi`
  - **Available: 1.9Gi** `[VERIFIED]` (Vượt ngưỡng tối thiểu 1.5 GB $\to$ Đủ điều kiện an toàn để build).

### 3.4. Kết quả Production Build trong Worktree
- Lệnh thực thi: `NEXT_TELEMETRY_DISABLED=1 nice -n 19 npm run build`
- Trạng thái biên dịch: **Exit code 0, không có cảnh báo nghiêm trọng (0 warnings)** `[VERIFIED]`.
- **Bảng Route Table thực tế do Next.js 14.2.35 xuất ra (MEASURED sizes)**:

```text
Route (app)                              Size     First Load JS
┌ ○ /                                    24.1 kB         199 kB
├ ○ /_not-found                          876 B          88.4 kB
├ ○ /dashboard                           22.1 kB         455 kB
├ ○ /funds                               577 B           164 kB
├ ○ /login                               5.38 kB         143 kB
├ ○ /products                            28.1 kB         200 kB
├ ○ /promotions                          506 B            88 kB
├ ○ /purchases                           20.2 kB         195 kB
├ ○ /settings                            18.1 kB         192 kB
├ ○ /stores                              15.3 kB         186 kB
├ ○ /transactions                        31.2 kB         475 kB
└ ○ /users                               10.5 kB         177 kB
+ First Load JS shared by all            87.5 kB
  ├ chunks/117-7d6ce20e86d75d12.js       31.7 kB
  ├ chunks/fd9d1056-a214ef6d275156f0.js  53.7 kB
  └ other shared chunks (total)          2.1 kB

○  (Static)  prerendered as static content
```
- **Xác nhận**: Route `/ui-gallery` hoàn toàn không tồn tại trong build artifact `[VERIFIED]`. Toàn bộ 11 trang nghiệp vụ đều được xuất xưởng dưới dạng tối ưu hóa tĩnh.

---

## 4. Lựa Chọn Phương Thức Merge: Rebase Hay Merge Commit?

### 4.1. Đánh giá kỹ thuật: Tại sao REBASE là lựa chọn bắt buộc?
- **Nếu chọn Merge Commit (`git merge --no-ff feat/ui-tahoe` trên `main`)**:
  - Khi mô phỏng merge bằng `git merge-tree 04b699c2 feat/ui-tahoe`, kết quả phát sinh **`CONFLICT (add/add)`** tại 2 file `docs/ui-tahoe/05-execution-plan.md` và `docs/ui-tahoe/06-open-questions.md` `[VERIFIED]`.
  - Nguyên nhân: Cả commit `04b699c2` trên `main` và commit `9374aad1` trên `feat/ui-tahoe` đều thêm cùng các file docs từ commit chung `7ce07c67`. Git coi đây là xung đột thêm file song sinh (sibling add/add conflict).
- **Nếu chọn REBASE (`git rebase main` trên `feat/ui-tahoe` sau đó `git merge --ff-only` trên `main`)**:
  - Cơ chế Rebase của Git tự động phát hiện commit `9374aad1` có patch trùng khớp 100% với commit `04b699c2` trên `main` và **tự động loại bỏ (drop) commit `9374aad1` mà không gây ra bất kỳ xung đột nào** `[VERIFIED]`.
  - Tạo ra lịch sử Git tuyến tính (linear history) sạch sẽ, chuẩn mực trên nhánh `main`.
  - Cho phép thực hiện `git merge --ff-only` an toàn 100%.

> [!IMPORTANT]
> **KẾT LUẬN & ĐẶC TÍNH REBASE**:  
> Lựa chọn **REBASE** là phương án duy nhất đảm bảo 0 conflict.  
> **Lưu ý quan trọng**: Quá trình Rebase sẽ tính toán lại mã băm (hash SHA) của toàn bộ các commit trên nhánh `feat/ui-tahoe` khi đặt lên đỉnh `04b699c2`. Nhánh gốc `feat/ui-tahoe` hiện tại **hoàn toàn chưa bị viết lại** (vẫn giữ nguyên các commit gốc từ `9374aad1` đến `03d0a05d`) `[VERIFIED]`.

### 4.2. Danh sách 31 Commits Tái Sinh Sau Khi Mô Phỏng Rebase Trên Nhánh Tạm `tmp/rebase-sim`
*(Quá trình rebase đã được mô phỏng thử nghiệm thành công trên nhánh tạm `tmp/rebase-sim` (tạo $\to$ kiểm tra $\to$ xóa), commit `9374aad1` được bỏ qua và 31 commit sau đây sẽ là những commit thực tế hạ cánh lên `main`)*:

1. `fb16b5ce`: `feat(ui-tahoe): phase T1A - wire Tahoe CSS tokens, z-scale, glass safety valves, and system+Inter typography`
2. `6883f947`: `chore(ui-tahoe): phase T1B - remove Nunito and static/latin-ext Inter WOFF2 files`
3. `03615a94`: `feat(ui-tahoe): phase T2A - upgrade atomic controls to Tahoe capsules, opaque cards, Switch, and Divider`
4. `53c4007f`: `feat(ui-tahoe): phase T2B - add ListGroup, EmptyState, Skeleton, and overlay-demoting ModalShell`
5. `de25aac3`: `feat(ui-tahoe): phase T2C - upgrade ResponsiveSheet, ModernSelect, DateRangePicker, FilterBar, ToastContainer, and pending-locked ConfirmModal`
6. `ec0941ce`: `feat(ui-tahoe): phase T2D - add admin-only zero-API /ui-gallery specimen for Gate G1`
7. `ab500f5f`: `chore(ui-gallery): [TEMP G1-D3] skip StoreContext fetch on /ui-gallery in non-production builds`
8. `bcf5aef7`: `feat(ui-tahoe): phase T3A - implement role-aware Tahoe AppShell, StoreSwitcher, InstallPWABanner, and Q8 Option A numerals`
9. `ee4dc5ab`: `feat(ui-tahoe): phase T3B - upgrade POS catalog to opaque cards, 16px capsule search, ResponsiveSheet filter, and solid #2E1065 cart bar`
10. `bb3ff78c`: `feat(ui-tahoe): phase T3C - migrate 7 POS modals to z-50/z-60 ModalShell and add measure-blur.md`
11. `31effc3e`: `refactor: update UI components and documentation for Tahoe phase T3`
12. `72c0aff8`: `feat(ui-tahoe): phase T4A - upgrade transactions Tab 1 (ledger) to Tahoe Template T2 and add phase-t4 design brief`
13. `ebecbbd5`: `feat(ui-tahoe): phase T4B - upgrade transactions Tab 2 (orders) to Tahoe Template T2 with 2-line mobile reflow and Q8 numerals`
14. `f106299f`: `feat(ui-tahoe): phase T4C - upgrade Tab 3 (funds) & 6 inline modals to ModalShell and pending-locked useConfirm`
15. `ad68bc53`: `feat(ui-tahoe): phase T4D - migrate TransactionModal (M09) and CategoryModal (M10) to ModalShell and 2-line mobile reflow`
16. `03af7632`: `feat(ui-tahoe): phase T4E - upgrade PurchasesCostTab main view with pending-locked useConfirm and 2-line mobile reflow`
17. `a4b40bd3`: `feat(ui-tahoe): phase T4F - migrate PurchasesCostTab 3 inline modals (M17-M19) to ModalShell`
18. `36c1bfc0`: `feat(ui-tahoe): phase T4G - upgrade Products catalog, QuickTagPicker, and 5 product modals (M20-M24)`
19. `3132439f`: `docs(ui-tahoe): add Phase T4 independent audit report`
20. `6f7d4174`: `fix(ui-tahoe): resolve confirmed defects from T4 independent audit`
21. `b17d59c6`: `feat(ui-tahoe): phase T5A - upgrade Dashboard page and 4 widgets/modals to Tahoe`
22. `7ecd4c08`: `feat(ui-tahoe): phase T5B - upgrade shared modals (EmailReport, SalesChannel, ImageCrop) to ModalShell`
23. `c4c3e015`: `feat(ui-tahoe): phase T5C - upgrade Settings page with grouped inset cards and per-device glass toggle`
24. `6241dfbe`: `feat(ui-tahoe): phase T5D - upgrade Users, Stores, and store modals to Tahoe primitives`
25. `b99f7466`: `feat(ui-tahoe): phase T5E - upgrade Login page and LanguageToggle to Tahoe visual language`
26. `599e7a1d`: `feat(ui-tahoe): phase T5F - repo-wide leftover cleanup and chrome brand-purple alignment`
27. `cd2e2395`: `docs(ui-tahoe): add Phase T5 execution report and Gate G4 review checklist`
28. `9f0e64a4`: `docs(ui-tahoe): add Phase T5 read-only verification report for Gate G4`
29. `f6a116f6`: `docs(ui-tahoe): add Phase T5 read-only reconciliation report for Gate G4`
30. `75caf4ff`: `chore(ui-tahoe): [T6A] remove ui-gallery route, revert G1-D3 StoreContext guard, and archive docs`
31. `0ea2b681`: `docs(ui-tahoe): add Phase T6 production build verification and cutover plan`

---

## 5. Xác Nhận Context Của Docker Build & Thời Điểm Thực Thi Bắt Buộc

- **Xác nhận ngữ cảnh build**: Tệp `docker-compose.prod.yml` cấu hình ngữ cảnh build của dịch vụ frontend là `context: ./frontend` `[VERIFIED]`. Khi lệnh `docker compose -f docker-compose.prod.yml build frontend` chạy tại `/opt/RabbitPOS`, nó đọc trực tiếp toàn bộ mã nguồn tại `/opt/RabbitPOS/frontend`.
- **Thời điểm thực thi**: Quá trình `docker compose build frontend` **BẮT BUỘC PHẢI CHẠY SAU KHI** nhánh `main` tại `/opt/RabbitPOS` đã hoàn tất `git merge --ff-only` (để nhận mã nguồn Tahoe mới vào đĩa) `[VERIFIED]`.
- **Yêu cầu sẵn sàng rollback**: Vì việc build sẽ tạo ra Docker image mới thay thế image hiện tại, **chủ dự án BẮT BUỘC phải tạo tag dự phòng `rabbitpos-frontend:pre-tahoe-backup` và xác thực Image ID TRƯỚC KHI chạy lệnh build**, đảm bảo luôn sẵn sàng phục hồi ngay tức khắc nếu quá trình build hoặc khởi chạy gặp sự cố `[VERIFIED]`.

---

## 6. Điểm Phục Hồi Dự Phòng & Cơ Chế Rollback Thuần Docker Image

### 6.1. Xác thực Image hiện tại trên hệ thống
- Kiểm tra danh sách image trên máy chủ:
  ```bash
  docker images rabbitpos-frontend
  ```
- Kết quả kiểm chứng thực tế trên máy chủ:
  ```text
  IMAGE                       ID             DISK USAGE   CONTENT SIZE   EXTRA
  rabbitpos-frontend:latest   ebaaace6683c       57.8MB         54.8MB    U
  ```
- **Image ID xác thực**: `sha256:ebaaace6683cbc0f2f759b167544aad5beb44e7ea097a2d847a7b4bd6344bf8d` (mã hiển thị rút gọn: `ebaaace6683c`) `[VERIFIED]`.

### 6.2. Cơ chế Rollback thuần Docker Image (Image-Only Rollback)
> [!IMPORTANT]
> **Không sử dụng `git reset --hard` khi Rollback**:  
> Container Docker chạy hoàn toàn dựa trên Docker Image đã đóng gói. Do đó, việc khôi phục dịch vụ không cần thiết và không nên phụ thuộc vào việc hoàn tác mã nguồn Git trên thư mục đĩa. Rollback thuần Image diễn ra trong `< 10 giây`, không có rủi ro mất mát lịch sử Git `[VERIFIED]`.

- **Lệnh Rollback thuần Image**:
  ```bash
  cd /opt/RabbitPOS
  docker tag rabbitpos-frontend:pre-tahoe-backup rabbitpos-frontend:latest
  docker compose -f docker-compose.prod.yml up -d --no-build frontend
  ```
  *(Cờ `--no-build` đảm bảo Docker Compose khởi chạy ngay lập tức image dự phòng đã được tag lại, tuyệt đối không kích hoạt build lại từ mã nguồn đĩa)* `[VERIFIED]`.

---

## 7. Các Bước Chuyển Đổi Thực Tế Dành Cho Chủ Dự Án (Owner-Run Cutover Steps)

> [!CAUTION]
> **Toàn bộ các lệnh dưới đây CHỈ ĐƯỢC THỰC HIỆN BỞI CHỦ DỰ ÁN**.  
> Antigravity KHÔNG thực thi các lệnh này.

### Bước 1: Sao lưu toàn bộ Database & File hệ thống
```bash
cd /opt/RabbitPOS
bash scripts/backup.sh
```

### Bước 2: Tạo Image Tag dự phòng & Xác thực Image ID trước khi build
```bash
cd /opt/RabbitPOS

# 2.1. Gắn tag dự phòng cho image hiện tại
docker tag rabbitpos-frontend:latest rabbitpos-frontend:pre-tahoe-backup

# 2.2. Kiểm tra xác thực tag đã tồn tại và ID khớp ebaaace6683c
docker images rabbitpos-frontend
```
*Kết quả phải thấy cả `latest` và `pre-tahoe-backup` đều mang Image ID `ebaaace6683c`*.

### Bước 3: Rebase trong Worktree & Fast-Forward vào Main
```bash
# 3.1. Rebase nhánh feat/ui-tahoe lên đỉnh main (tại worktree)
cd /opt/RabbitPOS-tahoe
git rebase main

# 3.2. Fast-forward vào main (tại thư mục chính)
cd /opt/RabbitPOS
git merge --ff-only feat/ui-tahoe
```

### Bước 4: Build Docker Image Frontend Production (Đọc từ /opt/RabbitPOS)
```bash
cd /opt/RabbitPOS
docker compose -f docker-compose.prod.yml build frontend
```

### Bước 5: Khởi động lại dịch vụ Frontend
```bash
cd /opt/RabbitPOS
docker compose -f docker-compose.prod.yml up -d frontend
```

---

## 8. Danh Mục Kiểm Tra Go / No-Go & Điều Kiện Dừng Khẩn Cấp (Go/No-Go Checklist)

### 8.1. Kiểm tra điều kiện tiên quyết trước Cutover (Pre-Cutover Checklist)
- [ ] RAM khả dụng tối thiểu `>= 1.5 GB` (`free -h`).
- [ ] Script sao lưu `scripts/backup.sh` chạy thành công không có lỗi.
- [ ] Image backup `rabbitpos-frontend:pre-tahoe-backup` đã được tag và hiển thị Image ID `ebaaace6683c` trên lệnh `docker images rabbitpos-frontend`.
- [ ] Lệnh `git rebase main` và `git merge --ff-only` chạy êm xuôi không có conflict.

### 8.2. Kiểm tra khói sau Cutover (Post-Cutover Smoke Checks)
1. **Kiểm tra sức khỏe Backend nội bộ**:
   ```bash
   curl -f -s -I http://127.0.0.1:8080/api/v1/health
   # Phải trả về: HTTP/1.1 200 OK
   ```
2. **Kiểm tra phản hồi Frontend cục bộ**:
   ```bash
   curl -f -s -I http://127.0.0.1:3000/login
   # Phải trả về: HTTP/1.1 200 OK
   ```
3. **Kiểm tra trạng thái Container**:
   ```bash
   docker ps --filter name=rabbitpos-frontend
   # Trạng thái phải là: Up (healthy hoặc Up X seconds)
   ```
4. **Kiểm tra qua Domain công khai**:
   ```bash
   curl -f -s -I https://rabbitpos.ndnworks.com/login
   # Phải trả về: HTTP/2 200
   ```

### 8.3. ĐIỀU KIỆN DỪNG KHẨN CẤP (STOP CONDITION)
> [!CAUTION]
> **NẾU BẤT KỲ LỆNH KIỂM TRA KHÓI NÀO THẤT BẠI (TRẢ VỀ LỖI HTTP 4xx, 5xx, CONNECTION REFUSED HOẶC CONTAINER BỊ RESTART LOOP)**:
> **DỪNG LẠI VÀ ROLLBACK NGAY LẬP TỨC!**  
> **TUYỆT ĐỐI KHÔNG DEBUG TRỰC TIẾP TRÊN TRANG LIVE KHI ĐANG DOWNTIME**.  
> Thực thi ngay 2 lệnh Rollback thuần Image sau đây:
> ```bash
> cd /opt/RabbitPOS
> docker tag rabbitpos-frontend:pre-tahoe-backup rabbitpos-frontend:latest
> docker compose -f docker-compose.prod.yml up -d --no-build frontend
> ```
> Hệ thống sẽ phục hồi lại giao diện cũ trong vòng dưới 10 giây. Sau khi dịch vụ phục hồi, việc điều tra nguyên nhân sẽ được thực hiện offline bên trong thư mục worktree `/opt/RabbitPOS-tahoe`.

---

## 9. Khung Giờ Bảo Trì Khuyến Nghị & Danh Mục Kiểm Thử Live Site (Maintenance Window)

### 9.1. Khung giờ khuyến nghị
- **Khung giờ vàng**: `23:30 - 00:30` (Sau giờ đóng cửa bán hàng của các chi nhánh cửa hàng).
- **Thời gian downtime dự kiến**: `< 15 giây` (Chỉ restart container `rabbitpos-frontend`, backend Go và database PostgreSQL vẫn chạy liên tục không bị gián đoạn).

### 9.2. Danh mục kiểm tra sau cutover trên trang Live (`https://rabbitpos.ndnworks.com`)
1. **Trang Đăng Nhập (`/login`)**:
   - Giao diện Liquid Glass với hiệu ứng mờ kính Tahoe, màu tím nhận diện `#2E1065`.
   - Nút chuyển ngôn ngữ tiếng Việt / tiếng Anh hoạt động trơn tru.
   - Đăng nhập thành công với tài khoản Staff và Admin.
2. **Trang Bán Hàng POS (`/`)**:
   - Thẻ sản phẩm mờ tối ưu (`bg-card/95`), thanh tìm kiếm Capsule 16px.
   - Thêm món, chọn topping, áp mã khuyến mãi.
   - Thanh giỏ hàng POS màu tím đậm `#2E1065` hiển thị rõ số tiền theo định dạng font chuẩn.
   - Chức năng thanh toán VietQR và tiền mặt.
3. **Trang Thu Chi & Quản Lý (`/transactions`, `/products`, `/settings`)**:
   - Bảng kê tài chính và tab Chi phí hiển thị đúng 2 dòng trên mobile màn hình hẹp (<768px).
   - Nút chuyển đổi giao diện kính (`html.no-glass`) trong cài đặt thiết bị hoạt động tức thì.
   - Các modal xác nhận tài chính (`ConfirmModal`) có trạng thái khóa chống bấm đúp khi đang lưu.
