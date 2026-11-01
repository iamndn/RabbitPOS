# RabbitPOS — Tài Liệu Primitives Giao Diện (UI Primitives)

Tài liệu hướng dẫn sử dụng và thông số kỹ thuật của 7 thành phần nguyên tử (UI Primitives) được chuẩn hóa trong Phase 2 tại thư mục `src/components/ui/`. Các thành phần này tái sử dụng toàn bộ token nền tảng từ Phase 1B và tuân thủ các quy tắc thiết kế D1–D7.

---

## 1. Button & IconButton (`Button.tsx`)

### `Button`
Nút bấm chuẩn đa trạng thái (default, hover, active, focus-visible, disabled, loading).
- **Variants:**
  - `primary`: Nút hành động chính (tím `brand-600`, chữ trắng, shadow nhẹ).
  - `secondary`: Nút phụ (nền trắng, viền `slate-200`, chữ `slate-800`).
  - `soft`: Nút nhẹ nhàng (tím nhạt `brand-50`, viền `brand-200`, chữ `brand-700`).
  - `ghost`: Nút trong suốt (hover nền `slate-100`).
  - `danger`: Nút thao tác nguy hiểm/xóa (đỏ `rose-600`, chữ trắng).
- **Sizes:**
  - `sm`: Cao 32px (`h-8`), nhãn 12px (`text-xs`), bo góc `lg`.
  - `md`: **Cao 44px trên mobile** (`h-11`), **36px trên desktop** (`md:h-9`), nhãn 16px/14px, bo góc `xl`. Đáp ứng tiêu chuẩn chạm ngón tay D5.
  - `lg`: Cao 48px trên mobile (`h-12`), 44px trên desktop (`md:h-11`), nhãn 16px, bo góc `xl`.
- **Props chính:** `variant`, `size`, `isLoading`, `leftIcon`, `rightIcon`, `fullWidth`.

```tsx
import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';

<Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
  Tạo đơn hàng mới
</Button>
```

### `IconButton`
Nút bấm chỉ chứa icon, tỉ lệ 1:1, **bắt buộc có thuộc tính `aria-label`** để đảm bảo khả năng tiếp cận (Accessibility).
- **Sizes:** `sm` (32px), `md` (**44px mobile** / 36px desktop), `lg` (48px).

```tsx
import { IconButton } from '@/components/ui';
import { Trash2 } from 'lucide-react';

<IconButton variant="ghost" size="sm" aria-label="Xóa mặt hàng" onClick={handleDelete}>
  <Trash2 className="w-4 h-4 text-rose-500" />
</IconButton>
```

---

## 2. FieldShell (`FieldShell.tsx`)
Bao bọc các phần tử nhập liệu (`.app-input`, `.app-select`, combobox) để chuẩn hóa nhãn, dấu bắt buộc, gợi ý và thông báo lỗi.
- **Props chính:**
  - `id`: Kết nối nhãn `htmlFor` và `aria-describedby`.
  - `label`: Nhãn trường thông tin.
  - `required`: Hiển thị dấu sao đỏ `*` bắt buộc.
  - `hint`: Gợi ý phía dưới trường.
  - `error`: Lỗi xác thực (hiển thị kèm `role="alert"`).
  - `optionalText`: Chú thích phụ góc phải (ví dụ: *(không bắt buộc)*).

```tsx
import { FieldShell } from '@/components/ui';

<FieldShell id="customer-phone" label="Số điện thoại khách hàng" required error={phoneError}>
  <input id="customer-phone" className="app-input" placeholder="0901 234 567" />
</FieldShell>
```

---

## 3. Chip & FilterPill (`Chip.tsx`)

### `Chip`
Thẻ chọn/lọc nhỏ gọn với bo góc tròn hoàn toàn (`rounded-full`), hỗ trợ đếm số lượng và nút xóa nhanh.
- **Variants:** `brand`, `success`, `warning`, `danger`, `default`.
- **Sizes:** `sm` (28px), `md` (36px).
- **Props:** `active`, `count`, `leftIcon`, `onRemove`.

```tsx
import { Chip } from '@/components/ui';

<Chip active={activeTab === 'paid'} count={14} onClick={() => setActiveTab('paid')}>
  Đã thanh toán
</Chip>
```

### `FilterPill`
Dành riêng cho thanh lọc dữ liệu di động (Phase 4). Hiển thị cặp nhãn-giá trị, chevron mở bottom sheet và nút xóa trực tiếp.

```tsx
import { FilterPill } from '@/components/ui';

<FilterPill
  label="Chi nhánh"
  value="RabbitPOS Quận 1"
  active={true}
  onOpen={openBranchFilterSheet}
  onClear={clearBranchFilter}
/>
```

---

## 4. SegmentedControl (`SegmentedControl.tsx`)
Thanh chuyển đổi chế độ/tab ngang hỗ trợ chuẩn `role="tablist"` / `role="tab"` và phím mũi tên bàn phím.
- **Props:** `options`, `value`, `onChange`, `size` (`sm` | `md`), `fullWidth`.

```tsx
import { SegmentedControl } from '@/components/ui';

<SegmentedControl
  value={viewMode}
  onChange={setViewMode}
  fullWidth
  options={[
    { value: 'grid', label: 'Dạng lưới' },
    { value: 'list', label: 'Dạng bảng' },
  ]}
/>
```

---

## 5. Badge (`Badge.tsx`)
Nhãn trạng thái kích thước nhỏ với mức tối thiểu 11px font (`text-caption`), bo góc `lg` (8px).
- **Variants:** `brand` (tím), `success` (xanh ngọc), `warning` (vàng hổ phách), `danger` (đỏ hoa hồng), `neutral` (xám slate).
- **Sizes:** `sm` (11px, `text-caption`), `md` (12px, `text-xs`).
- **Props:** `variant`, `size`, `dot` (chấm trạng thái tròn).

```tsx
import { Badge } from '@/components/ui';

<Badge variant="success" size="sm" dot>
  Đang hoạt động
</Badge>
```

---

## 6. Card (`Card.tsx`)
Khung chứa thông tin bề mặt chuẩn hóa: bo góc `2xl` (16px), viền mờ `slate-200/90`, bóng đổ nhẹ `shadow-sm`.
- **Thành phần:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- **Tương tác:** Thuộc tính `interactive={true}` kích hoạt hover border & shadow nhẹ.

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Tổng quan doanh thu</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="font-num text-2xl font-bold">1.250.000 ₫</div>
  </CardContent>
</Card>
```

---

## 7. ResponsiveSheet (`ResponsiveSheet.tsx`)
**Thành phần overlay thích ứng quan trọng nhất của hệ thống (Adaptive Overlay Primitive):**
- **Hiển thị qua Portal:** Gắn trực tiếp vào `document.body` qua `createPortal`, loại bỏ triệt để lỗi bị cắt khung (clipping) do `overflow: hidden` của các modal cha.
- **Trên Mobile (`< md`):**
  - Hiển thị dưới dạng **Bottom Sheet** chiếm đáy màn hình.
  - Giới hạn chiều cao tối đa `max-h-[85dvh]` với thanh cuộn mỏng nội bộ.
  - Affordance kéo chạm: Thanh bo tròn ở đỉnh (40px x 4px).
  - Tự động đệm an toàn viền dưới thiết bị di động (`pb-safe`).
  - **Khóa cuộn trang nền (Body Scroll Lock)** tự động khi mở.
  - Đóng khi chạm nền mờ (Backdrop click) hoặc bấm phím Escape.
- **Trên Desktop (`md+`):**
  - Tự động chuyển thành **Anchored Popover** gắn liền với phần tử kích hoạt (`triggerRef`).
  - **Tự động lật hướng chống tràn (Collision Flip):** Tự động đo khoảng trống đáy viewport; nếu không đủ diện tích mở xuống sẽ tự động lật lên trên mà không cần đoán pixel cố định.
  - Đóng khi nhấp chuột ra ngoài (Click outside).
- **Thang đo Z-Index chuẩn (D7):** Áp dụng `z-sheet` (50) trên mobile và `z-popover` (40) trên desktop.
- **Quản lý tiêu điểm (Focus Management):** Tự động trả lại con trỏ tiêu điểm về nút kích hoạt khi đóng.
- **Tính năng độc quyền (Mutual Exclusivity):** Tích hợp sẵn `exclusiveId` kết nối trực tiếp với hệ thống sự kiện đóng popover đồng thời `rabbitpos:header-popover-open`.

```tsx
import { useState, useRef } from 'react';
import { ResponsiveSheet, Button } from '@/components/ui';

export function DemoSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button ref={triggerRef} onClick={() => setIsOpen(true)}>
        Chọn tuỳ chọn
      </Button>

      <ResponsiveSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        title="Chọn tuỳ chọn danh mục"
        exclusiveId="category-selector"
        footer={
          <Button variant="primary" fullWidth onClick={() => setIsOpen(false)}>
            Áp dụng
          </Button>
        }
      >
        <div className="space-y-2 py-2">
          {/* Danh sách các lựa chọn */}
        </div>
      </ResponsiveSheet>
    </>
  );
}
```
