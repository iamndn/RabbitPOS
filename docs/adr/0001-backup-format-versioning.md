# ADR-001: Versioning Định Dạng Sao Lưu Dữ Liệu (Backup Format Versioning)

## Trạng thái (Status)
Đã duyệt (Approved) - Baseline Phase 0

## Bối cảnh (Context)
RabbitPOS hiện tại cung cấp tính năng Export/Restore toàn bộ cơ sở dữ liệu qua file JSON (`/api/v1/backup/export` và `/api/v1/backup/restore`). Tuy nhiên, định dạng sao lưu hiện hành tồn tại các điểm yếu nghiêm trọng:
1. Trường version được gắn cứng (`"version": "1.0"`), không có cơ chế kiểm tra tính tương thích của lược đồ dữ liệu (Schema Compatibility).
2. Bản backup hiện tại chỉ bao gồm 13 bảng; bị bỏ sót 3 bảng mới phát sinh trong quá trình nâng cấp quản lý NVL & Định lượng món (`ingredients`, `purchase_items`, `recipe_items`).
3. Thiếu mã kiểm tra toàn vẹn (Checksum SHA-256) và bảng kiểm kê (Manifest stats) xác thực trước khi tiến hành xóa và khôi phục dữ liệu vào PostgreSQL.

## Quyết định Kiến trúc (Decision)
1. **Định nghĩa Schema Versioning tường minh**:
   - `schema_version`: Sử dụng chuẩn SemVer (ví dụ: `"2.0.0"`).
   - `compatible_min_version`: Chỉ định phiên bản tối thiểu tương thích ngược (ví dụ: `"1.0.0"`).
2. **Cấu trúc JSON Backup V2.0**:
   ```json
   {
     "app": "RabbitPOS",
     "schema_version": "2.0.0",
     "compatible_min_version": "1.0.0",
     "exported_at": "2026-08-28T22:45:00Z",
     "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "manifest": {
       "total_tables": 16,
       "counts": {
         "settings": 18,
         "categories": 5,
         "products": 24,
         "product_variants": 48,
         "variant_groups": 10,
         "toppings": 8,
         "funds": 3,
         "transaction_categories": 6,
         "transactions": 150,
         "promotions": 4,
         "orders": 120,
         "order_items": 340,
         "ingredients": 30,
         "purchase_items": 85,
         "recipe_items": 60,
         "users": 3
       }
     },
     "data": {
       "settings": [...],
       "users": [...],
       "funds": [...],
       "transaction_categories": [...],
       "categories": [...],
       "ingredients": [...],
       "products": [...],
       "toppings": [...],
       "product_variants": [...],
       "variant_groups": [...],
       "promotions": [...],
       "recipe_items": [...],
       "orders": [...],
       "order_items": [...],
       "transactions": [...],
       "purchase_items": [...]
     }
   }
   ```
3. **Quy trình Khôi phục (Restore Pipeline)**:
   - **Bước 1**: Xác thực tính hợp lệ của JSON, so khớp mã `checksum_sha256`, kiểm tra `schema_version`.
   - **Bước 2**: Chạy trong 1 Transaction cơ sở dữ liệu duy nhất (`db.Transaction`).
   - **Bước 3**: Xóa dữ liệu cũ theo đúng thứ tự nghịch đảo (Reverse Dependency Order).
   - **Bước 4**: Nạp dữ liệu mới theo đúng thứ tự Topo (Topological Order) của 16 bảng.
   - **Bước 5**: Tự động đồng bộ và reset lại giá trị Sequence ID của tất cả bảng (`setval(pg_get_serial_sequence(...))`).

## Hệ quả (Consequences)
- **Tích cực**: Bảo toàn 100% dữ liệu danh mục NVL, công thức định lượng món; ngăn chặn triệt để lỗi vi phạm khóa ngoại (FK constraints) khi restore; kiểm tra toàn vẹn trước khi ghi đè DB.
- **Cần xử lý**: Cần có migration adapter cho phép restore các file backup phiên bản 1.0 cũ vào schema 2.0 (tự động điền giá trị mặc định cho các bảng còn thiếu).
