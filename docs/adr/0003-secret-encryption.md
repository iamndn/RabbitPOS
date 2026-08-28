# ADR-003: Mã Hóa & Bảo Vệ Secret Trong Cấu Hình và Bản Sao Lưu (Secret Encryption)

## Trạng thái (Status)
Đã duyệt (Approved) - Baseline Phase 0

## Bối cảnh (Context)
RabbitPOS lưu trữ một số cấu hình nhạy cảm (sensitive secrets) trong bảng `settings`:
1. `smtp_password`: Mật khẩu ứng dụng Gmail gửi báo cáo tài chính hàng ngày.
2. `google_sheets_service_account_json`: Khóa bí mật (Private Key) của Google Cloud Service Account dùng để đồng bộ bảng tính Google Sheets.
3. `jwt_secret`: Khóa bí mật ký JWT token người dùng.

Hiện tại, các giá trị này được lưu dưới dạng văn bản thuần (plain-text) trong cơ sở dữ liệu và bị xuất nguyên trạng ra file JSON khi thực hiện tính năng Backup. Nếu file backup bị lộ lọt, kẻ xấu có thể đánh cắp Private Key và truy cập tài khoản của cửa hàng.

## Quyết định Kiến trúc (Decision)
1. **Thuật toán Mã hóa Đối xứng**:
   - Sử dụng **AES-256-GCM** (Galois/Counter Mode) với chuẩn mã hóa chứng thực (Authenticated Encryption with Associated Data - AEAD).
   - Khóa mã hóa chính (`APP_ENCRYPTION_KEY`) được cấp thông qua biến môi trường (32-byte Base64), tuyệt đối **không commit vào Git repository**.
2. **Cơ chế Lưu trữ Cơ sở Dữ liệu (Database At-Rest)**:
   - Các key nhạy cảm trong bảng `settings` khi lưu vào DB sẽ có tiền tố nhận diện `$enc$aes256gcm$` kèm vector khởi tạo (IV/Nonce 12-byte) và ciphertext:
     `$enc$aes256gcm$v1$<IV_BASE64>$<CIPHERTEXT_TAG_BASE64>`
   - Service trong backend tự động giải mã khi cần kết nối SMTP hoặc Google API, và tự động mã hóa trước khi ghi vào DB.
3. **Quy tắc Trả về API (Frontend Protection)**:
   - Khi API `GET /api/v1/settings` trả về dữ liệu cho Client, các trường nhạy cảm luôn bị che giấu (Masking):
     `"smtp_password": "********"`
     `"google_sheets_service_account_json": "{\"type\":\"service_account\",\"private_key\":\"[ENCRYPTED/CONFIGURED]\"}"`
4. **Quy tắc Xuất Bản Sao Lưu (Backup Protection)**:
   - **Mặc định**: File backup JSON xuất ra giữ nguyên ciphertext đã mã hóa (an toàn khi lưu trữ tại máy POS hoặc cloud drive).
   - Khi khôi phục sang máy chủ mới, bắt buộc máy chủ đích phải có cùng `APP_ENCRYPTION_KEY` để giải mã được các cấu hình tích hợp.

## Hệ quả (Consequences)
- **Tích cực**: Bảo vệ tuyệt đối bí mật hệ thống và tài khoản tích hợp; ngăn chặn rò rỉ credential từ file backup.
- **Cần xử lý**: Bổ sung `APP_ENCRYPTION_KEY` vào `.env.example` và tài liệu hướng dẫn triển khai Docker/Proxmox.
