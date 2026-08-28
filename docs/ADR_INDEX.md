# RabbitPOS - Architecture Decision Records (ADRs)

Tài liệu mục lục các quyết định kiến trúc kỹ thuật của hệ thống RabbitPOS:

| Mã ADR | Tiêu Đề | Trạng Thái | Ngày Duyệt | Tóm Tắt Quyết Định |
| :--- | :--- | :---: | :---: | :--- |
| [`ADR-001`](file:///opt/RabbitPOS/docs/adr/0001-backup-format-versioning.md) | **Backup Format Versioning** | Approved | 2026-08-28 | Nâng cấp payload sao lưu lên Version 2.0 bao quát đủ 16 bảng (gồm NVL & BOM), bổ sung Checksum SHA-256, Manifest stats và quy trình restore chuẩn Topo. |
| [`ADR-002`](file:///opt/RabbitPOS/docs/adr/0002-idempotency-strategy.md) | **Idempotency Strategy** | Approved | 2026-08-28 | Áp dụng Header `Idempotency-Key` (UUIDv4) và bảng `idempotency_keys` với TTL 24h để ngăn ngừa trùng lặp đơn hàng và cộng sai lệch số dư quỹ. |
| [`ADR-003`](file:///opt/RabbitPOS/docs/adr/0003-secret-encryption.md) | **Secret Encryption** | Approved | 2026-08-28 | Sử dụng mã hóa AES-256-GCM với `APP_ENCRYPTION_KEY` cho SMTP password & Google Service Account JSON; mask secret ở API và bảo vệ bản sao lưu. |
| [`ADR-004`](file:///opt/RabbitPOS/docs/adr/0004-offline-pos-conflict-resolution.md) | **Offline POS & Conflict Resolution** | Approved | 2026-08-28 | Kiến trúc Local-First trên IndexedDB, sinh mã đơn phân tán, hàng đợi Outbox sync tuần tự Idempotent, Server-Authoritative cho danh mục. |
