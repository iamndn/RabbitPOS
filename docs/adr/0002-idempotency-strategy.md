# ADR-002: Chiến Lược Idempotency Cho Giao Dịch POS & Đồng Bộ (Idempotency Strategy)

## Trạng thái (Status)
Đã duyệt (Approved) - Baseline Phase 0

## Bối cảnh (Context)
Tại các quầy bán hàng thực tế (POS), mạng chập chờn hoặc người dùng bấm nút "Thanh toán" nhiều lần có thể gây ra hiện tượng gửi trùng lặp request `POST /api/v1/orders`. Ngoài ra, khi triển khai tính năng Offline POS, cơ chế đồng bộ hàng đợi (Sync Queue) có thể gửi lại đơn hàng nhiều lần khi mạng vừa kết nối trở lại.
Nếu không có cơ chế Idempotency:
1. Đơn hàng bị nhân đôi (`order_code` hoặc dòng đơn trùng lặp).
2. Số dư quỹ tiền mặt/ngân hàng (`funds.current_balance`) bị cộng thừa nhiều lần.
3. Sổ cái giao dịch (`transactions`) bị duplicate các bút toán doanh thu.

## Quyết định Kiến trúc (Decision)
1. **Sử dụng Header `Idempotency-Key` chuẩn hóa**:
   - Client (POS Frontend hoặc Offline Sync Worker) bắt buộc sinh một mã khóa định danh duy nhất (UUIDv4) hoặc sử dụng trực tiếp `client_order_id` / `order_code` cho mỗi phiên giao dịch:
     `Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`
2. **Bảng lưu trữ `idempotency_keys` trên PostgreSQL**:
   ```sql
   CREATE TABLE IF NOT EXISTS idempotency_keys (
       key VARCHAR(128) PRIMARY KEY,
       resource_type VARCHAR(50) NOT NULL, -- 'order', 'transaction', 'reconciliation'
       resource_id BIGINT NULL,
       status VARCHAR(20) NOT NULL,        -- 'processing', 'completed', 'failed'
       response_code INT NULL,
       response_body JSONB NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMPTZ NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
   ```
3. **Quy trình Xử lý (Idempotency Flow)**:
   - Khi nhận request có `Idempotency-Key`:
     - **Trường hợp 1 (Key mới)**: Tạo bản ghi với trạng thái `processing`, tiếp tục xử lý nghiệp vụ tạo đơn/giao dịch trong DB Transaction. Khi hoàn tất thành công, cập nhật `status = 'completed'`, lưu `response_body` và trả về kết quả (HTTP 201).
     - **Trường hợp 2 (Key đã hoàn thành `completed`)**: Trả về ngay lập tức `response_body` đã lưu trước đó cùng mã HTTP ban đầu (HTTP 200/201) kèm Header `X-Cache-Lookup: HIT-IDEMPOTENT`, **không thực hiện lại bất kỳ tác vụ DB nào**.
     - **Trường hợp 3 (Key đang `processing`)**: Trả về mã lỗi HTTP 409 Conflict (`REQUEST_IN_PROGRESS`), yêu cầu client đợi.
4. **Thời gian lưu trữ (TTL)**: Tự động hết hạn và dọn dẹp sau **24 giờ**.

## Hệ quả (Consequences)
- **Tích cực**: Ngăn chặn 100% rủi ro tạo đơn nhân đôi và sai lệch số dư sổ quỹ tiền mặt khi mạng giật lag hoặc khi đồng bộ Offline; an toàn cho thao tác retry tự động của client.
- **Cần xử lý**: Bổ sung middleware `IdempotencyMiddleware` ở phase tiếp theo; frontend sinh `Idempotency-Key` khi khởi tạo đơn hàng trong giỏ.
