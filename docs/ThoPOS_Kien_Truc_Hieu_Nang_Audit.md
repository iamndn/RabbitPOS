# ThoPOS (RabbitPOS) — Báo Cáo Kiểm Toán Kiến Trúc & Hiệu Năng
**Phạm vi:** Backend Go (Gin/GORM/PostgreSQL) · Frontend Next.js 14 App Router · Hạ tầng Docker/Proxmox
**Ngày:** 21/08/2026 · **Vai trò đánh giá:** Principal Full-Stack Architect & Performance Specialist

---

## PHẦN 1: ĐÁNH GIÁ TỔNG QUAN HỆ THỐNG

### 1.1 Ưu điểm nổi bật

| Hạng mục | Chi tiết | File minh chứng |
|---|---|---|
| **Kiến trúc phân lớp rõ ràng** | Clean Architecture chuẩn: `handlers/ → models/ → routes/`, tách biệt DTO (Request/Response) khỏi GORM entity | `backend/internal/handlers/*.go`, `backend/internal/models/*.go` |
| **Response envelope nhất quán** | Toàn bộ API trả về `{status, data, message}` — dễ debug, dễ chuẩn hóa error-handling phía FE | `models/response.go` |
| **Toàn vẹn giao dịch tài chính** | Mọi thao tác ảnh hưởng số dư quỹ (tạo đơn, ghi thu/chi, đối soát) đều bọc trong `db.Transaction()` — đảm bảo ACID, tránh lệch sổ quỹ | `order.go:CreateOrder`, `transaction.go:CreateTransaction`, `fund.go:ReconcileFund` |
| **RBAC middleware gọn** | `AuthMiddleware` + `RequireRole` tách biệt rõ tầng xác thực và phân quyền, áp dụng đúng nguyên tắc least-privilege cho route Admin-only | `middleware/auth.go`, `routes/routes.go` |
| **Bảo mật mật khẩu chuẩn** | `bcrypt` cho password hashing, JWT HS256 ký với secret riêng, cookie `HttpOnly` cho token | `utils/auth_utils.go`, `handlers/auth.go` |
| **Tự-host tối ưu chi phí & chủ quyền dữ liệu** | Proxmox LXC + Docker Compose cho phép vận hành độc lập, không phụ thuộc SaaS ngoài, phù hợp quy mô 1 cửa hàng F&B | `docker-compose.prod.yml`, `1_PROXMOX_DEPLOYMENT.md` |
| **Nghiệp vụ F&B sát thực tế** | VietQR Napas 247 tích hợp trực tiếp, mô hình `Fund` đa quỹ (tiền mặt/ngân hàng), đối soát chênh lệch tự động ghi `reconciliation_variance` | `order.go:GetVietQR`, `fund.go:ReconcileFund` |
| **Migration + Seed tách bạch** | SQL migration versioned (`000001`→`000004`) độc lập với GORM AutoMigrate — cho phép rollback có kiểm soát | `backend/migrations/*.sql` |
| **Backup có kịch bản** | Script `pg_dump` + retention 7 ngày, tài liệu hướng dẫn khôi phục dữ liệu 2 tầng (Proxmox snapshot + DB dump) | `scripts/backup_db.sh`, `PROXMOX_BACKUP_GUIDE.md` |

### 1.2 Điểm nghẽn & rủi ro kỹ thuật

| Mức độ | Vấn đề | Vị trí | Hệ quả |
|---|---|---|---|
| 🔴 Cao | **Không có cơ chế cache phía Client** (SWR/React Query/Zustand) | Toàn bộ `frontend/src/app/*/page.tsx` | Mỗi lần chuyển tab = tải lại 100% dữ liệu từ đầu, không tận dụng dữ liệu đã fetch trước đó |
| 🔴 Cao | `AppShell.tsx` gọi lại `/health` + auth-guard + role-guard **mỗi khi `pathname` đổi** | `AppShell.tsx` dòng `useEffect(..., [pathname])` | Gây "khựng" UI (blocking re-render) mỗi lần chuyển trang, kể cả trang không cần dữ liệu health |
| 🔴 Cao | **Waterfall fetch tuần tự** (`await` nối tiếp thay vì `Promise.all`) | `frontend/src/app/page.tsx` (POS), `products/page.tsx` | Tăng gấp đôi thời gian tải trang vì phải chờ request 1 xong mới bắn request 2 |
| 🟠 Trung bình | **Không có in-memory/TTL cache ở Backend** cho dữ liệu tĩnh (categories, funds) | `handlers/category.go`, `handlers/fund.go` | Mỗi request đều query PostgreSQL dù dữ liệu gần như không đổi trong ca làm việc |
| 🟠 Trung bình | **GORM chưa bật `PrepareStmt`, chưa cấu hình connection pool** (`SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`) | `database/postgres.go` | Dưới tải đồng thời (nhiều thiết bị POS cùng lúc giờ cao điểm) dễ nghẽn kết nối, tăng latency |
| 🟠 Trung bình | **Không phân trang** cho `ListOrders`, `ListTransactions`, `ListProducts` | `handlers/order.go`, `handlers/transaction.go`, `handlers/product.go` | Dữ liệu tăng theo thời gian → payload JSON phình to → chậm cả mạng lẫn render FE |
| 🟠 Trung bình | **Rò rỉ lỗi nội bộ ra client** (`err.Error()` nối thẳng vào message) | Gần như mọi handler (`fund.go`, `order.go`, `transaction.go`, `product.go`, `category.go`) | Lộ chi tiết cấu trúc DB/SQL, tăng bề mặt tấn công |
| 🟠 Trung bình | **Token JWT lưu ở `localStorage`** song song với cookie `HttpOnly` | `lib/auth.ts` | Token trong localStorage có thể bị đánh cắp qua XSS — chưa tận dụng lợi thế bảo mật của cookie |
| 🟡 Thấp | Không dùng `next/image`, dùng `<img>` thuần cho ảnh sản phẩm | `page.tsx` (POS), `products/page.tsx` | Không có lazy-load/resize tự động → tốn băng thông trên thiết bị di động |
| 🟡 Thấp | Không `React.memo`/`useCallback` cho danh sách sản phẩm lớn | `page.tsx` (POS) — `filteredProducts.map(...)` | Toàn bộ grid re-render khi chỉ 1 item trong giỏ hàng thay đổi |
| 🟡 Thấp | Không code-split các modal nặng (`VariantSelectorModal`, `CheckoutModal`, dashboard charts) | `page.tsx`, `dashboard/page.tsx` | Bundle JS ban đầu lớn hơn cần thiết, tăng Time-to-Interactive |
| 🟡 Thấp | CORS `AllowOrigins` cấu hình tĩnh qua `.env`, chưa hỗ trợ động LAN-IP + domain cùng lúc như Phase 6 đề ra | `routes/routes.go`, `config/config.go` | Phải rebuild ảnh Docker mỗi lần đổi origin truy cập (LAN ⇄ domain) |

---

## PHẦN 2: CHẨN ĐOÁN GỐC RỄ — NGUYÊN NHÂN GÂY TRỄ KHI CHUYỂN TAB

Đây là phần quan trọng nhất vì đúng với triệu chứng người dùng mô tả: **"chuyển trang bị khựng/lag"**. Có 4 nguyên nhân cộng hưởng, xếp theo mức độ ảnh hưởng:

### 2.1 Nguyên nhân #1 (nghiêm trọng nhất): `AppShell.tsx` chạy lại toàn bộ side-effect mỗi lần đổi route

```tsx
// frontend/src/components/AppShell.tsx
useEffect(() => {
  setMounted(true);
  if (!isAuthenticated()) { router.push('/login'); return; }
  const u = getAuthUser();
  setCurrentUser(u);
  if (u && u.role === 'staff') { /* role guard */ }
  checkHealth(); // <-- GỌI API /health MỖI LẦN pathname ĐỔI
}, [pathname]);
```

`AppShell` bọc **toàn bộ layout** (header, nav, nội dung trang) — vì dependency array là `[pathname]`, mỗi lần người dùng bấm sang `/dashboard`, `/funds`, v.v., effect này chạy lại từ đầu:
1. `setLoading(true)` → toàn bộ header re-render với state loading.
2. Gọi lại `fetchApi('/health')` — một network round-trip **không cần thiết**, vì health-check chỉ cần chạy 1 lần lúc mount app, không phải mỗi lần chuyển tab.
3. Đọc lại `localStorage` (`isAuthenticated()`, `getAuthUser()`) — đồng bộ nhưng vẫn tốn 1 tick re-render.

→ Đây chính là "khựng" mà người dùng cảm nhận: **UI chờ một network request vô nghĩa** trước khi hiển thị mượt trang mới.

### 2.2 Nguyên nhân #2: Không có tầng cache dùng chung giữa các trang

Mỗi trang tự fetch lại dữ liệu **từ đầu, không chia sẻ cache**:

| Trang | Dữ liệu fetch lại mỗi lần mount | Vấn đề |
|---|---|---|
| `page.tsx` (POS) | `/categories`, `/products` | Trùng lặp với `/products/page.tsx` |
| `products/page.tsx` | `/categories`, `/products` | Trùng lặp với POS |
| `transactions/page.tsx` | `/funds`, `/transactions` | `/funds` trùng với `funds/page.tsx` và `CheckoutModal.tsx` |
| `funds/page.tsx` | `/funds` | Trùng lặp lần 3 |
| `dashboard/page.tsx` | `/analytics/*` | Riêng biệt nhưng vẫn không cache theo khoảng ngày đã xem |

`categories` và `funds` gần như **tĩnh trong 1 ca làm việc** (ít khi đổi), nhưng hệ thống coi chúng như dữ liệu động, fetch lại nguyên vẹn mỗi lần chuyển tab → lãng phí round-trip + khiến người dùng thấy spinner lặp lại liên tục (`RefreshCw` animate-spin xuất hiện ở mọi trang khi `loading === true`).

### 2.3 Nguyên nhân #3: Waterfall fetch tuần tự (chờ nối tiếp thay vì song song)

```tsx
// frontend/src/app/page.tsx — loadData()
const catRes = await fetchApi<Category[]>('/categories');   // (1) chờ xong...
...
const prodRes = await fetchApi<Product[]>('/products');     // (2) ...mới bắt đầu
```

```tsx
// frontend/src/app/products/page.tsx — loadCatalog() — cùng pattern
```

Hai request độc lập (không phụ thuộc dữ liệu của nhau) nhưng bị xếp tuần tự → tổng thời gian tải = `t(categories) + t(products)` thay vì `max(t(categories), t(products))`. Trên mạng LAN nội bộ chênh lệch nhỏ, nhưng qua Cloudflare Tunnel/domain production độ trễ round-trip (~50-150ms mỗi request) sẽ cộng dồn rõ rệt.

### 2.4 Nguyên nhân #4: Backend không cache dữ liệu đọc-nhiều-ghi-ít, chưa tối ưu connection pool

```go
// backend/internal/database/postgres.go
gormConfig := &gorm.Config{
    Logger: logger.Default.LogMode(logger.Info), // KHÔNG có PrepareStmt: true
}
...
// KHÔNG gọi sqlDB.SetMaxOpenConns/SetMaxIdleConns/SetConnMaxLifetime
```

- `ListCategories`, `ListFunds`, `ListProducts` đánh thẳng PostgreSQL mỗi request dù dữ liệu gần như bất biến trong ca — cộng thêm việc chuyển tab liên tục ở FE (mục 2.2) khiến DB nhận số lượng query lặp lại không cần thiết.
- Thiếu `PrepareStmt: true` khiến GORM không tái sử dụng prepared statement, tăng chi phí parse/plan mỗi query.
- Thiếu cấu hình pool khiến số kết nối đồng thời không được kiểm soát/tái sử dụng hiệu quả khi nhiều thiết bị POS cùng thao tác giờ cao điểm.

### 2.5 Cơ chế tổng hợp gây "lag cảm nhận được"

```
Người dùng bấm chuyển tab
   → Next.js App Router remount page component
     → useEffect(AppShell, [pathname]) chạy lại → gọi /health (chờ mạng)
     → useEffect(Page, []) chạy lại → waterfall fetch categories → products/funds (chờ mạng x2)
       → mỗi fetch lại đánh thẳng PostgreSQL (không cache) → round-trip DB
   → Trong toàn bộ thời gian đó: loading=true → hiển thị spinner, chặn tương tác
```

Ba lớp round-trip (health-check, waterfall FE, uncached backend) cộng dồn là nguyên nhân trực tiếp của độ trễ 300ms–1-2s cảm nhận được mỗi lần chuyển tab, đặc biệt rõ khi truy cập qua domain production (Cloudflare Tunnel) thay vì LAN.

---

## PHẦN 3: GIẢI PHÁP & KẾ HOẠCH TỐI ƯU (Mục tiêu: chuyển tab cảm nhận ~0ms)

### 3.1 Chiến lược tổng thể

| Lớp | Giải pháp | Công cụ đề xuất |
|---|---|---|
| Frontend — Data layer | Stale-While-Revalidate: hiển thị cache cũ ngay lập tức, refetch nền, update khi có dữ liệu mới | `SWR` (nhẹ, 4kb, phù hợp quy mô 1 cửa hàng) hoặc custom in-memory store |
| Frontend — Layout | Tách health-check ra khỏi vòng lặp theo `pathname`, chỉ chạy 1 lần khi app mount | `useEffect(..., [])` ở cấp `RootLayout`/`AppShell` mount, không phụ thuộc `pathname` |
| Frontend — Bundle | Code-splitting các modal/chart nặng | `next/dynamic` với `ssr: false` cho modal client-only |
| Frontend — Network | Gộp request độc lập bằng `Promise.all` | Không cần thư viện, chỉ refactor |
| Backend — Cache | In-memory TTL cache (60-120s) cho bảng tĩnh: categories, funds, (settings tương lai) | `sync.Map` + goroutine invalidate, hoặc `patrickmn/go-cache` |
| Backend — DB | Bật `PrepareStmt: true`, cấu hình pool | GORM config + `sql.DB` tuning |
| Backend — Payload | Phân trang cho orders/transactions | `?page=&page_size=` + `LIMIT/OFFSET` |
| Backend — Security | Chuẩn hóa lỗi: không leak `err.Error()` ra client, chỉ log nội bộ | Sửa `SendInternalError` call sites |

### 3.2 Roadmap triển khai theo độ ưu tiên

1. **Sprint ngay (0 rủi ro, tác động cao nhất):**
   Tách `checkHealth()` khỏi `[pathname]`; chuyển `Promise.all` cho các fetch độc lập.
   → Giảm ngay 1 round-trip/lần chuyển tab + giảm 50% waterfall time.
2. **Sprint 2:** Thêm SWR cho `/categories`, `/funds`, `/products` — cache dùng chung toàn app, dedup request giữa các trang.
3. **Sprint 3:** Backend in-memory TTL cache cho `ListCategories`/`ListFunds` + GORM pool tuning.
4. **Sprint 4:** `next/dynamic` cho modal nặng, phân trang orders/transactions, chuẩn hóa error response.

---

## PHẦN 4: HƯỚNG DẪN REFACTOR CỤ THỂ (Code)

### 4.1 Frontend — Sửa `AppShell.tsx`: tách health-check khỏi vòng lặp pathname

**Vấn đề:** `useEffect(..., [pathname])` chạy lại toàn bộ (auth-guard + role-guard + health-check) mỗi lần chuyển trang.
**Giải pháp:** Tách làm 2 effect — một effect chạy 1 lần lúc mount (health-check), một effect nhẹ chỉ chạy guard logic khi `pathname` đổi (không gọi network).

```tsx
// frontend/src/components/AppShell.tsx (đoạn cần sửa)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthData | null>(null);

  // Effect #1: CHỈ chạy 1 lần khi app mount — health-check không cần lặp lại mỗi lần chuyển tab
  useEffect(() => {
    setMounted(true);
    checkHealth();
    // Poll nhẹ mỗi 60s để phát hiện backend rớt kết nối, KHÔNG gắn với điều hướng
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Effect #2: Guard logic — KHÔNG gọi network, chỉ đọc localStorage đồng bộ (rẻ, không gây lag)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const u = getAuthUser();
    setCurrentUser(u);

    if (u && u.role === 'staff') {
      const adminRoutes = ['/products', '/transactions', '/funds', '/dashboard'];
      if (adminRoutes.some((route) => pathname.startsWith(route))) {
        router.push('/');
      }
    }
  }, [pathname, router]);

  const checkHealth = async () => {
    const res = await fetchApi<HealthData>('/health');
    if (res.status === 'success') setHealth(res.data);
  };

  // ... phần render giữ nguyên
}
```

**Tác động:** loại bỏ hoàn toàn network round-trip khỏi luồng chuyển tab; UI chuyển trang tức thì vì guard logic chỉ đọc `localStorage` (đồng bộ, ~0ms).

---

### 4.2 Frontend — Tầng cache dùng chung với SWR

```bash
npm install swr
```

```ts
// frontend/src/lib/swrFetcher.ts
import { fetchApi, ApiResponse } from './api';

export async function swrFetcher<T>(endpoint: string): Promise<T> {
  const res: ApiResponse<T> = await fetchApi<T>(endpoint);
  if (res.status !== 'success' || res.data === null) {
    throw new Error(res.message || 'Fetch failed');
  }
  return res.data;
}
```

```tsx
// frontend/src/hooks/useCategories.ts — ví dụ hook dùng chung cho POS + Products page
import useSWR from 'swr';
import { swrFetcher } from '@/lib/swrFetcher';

export interface Category {
  id: number;
  name: string;
  display_order: number;
}

export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<Category[]>(
    '/categories',
    swrFetcher,
    {
      revalidateOnFocus: false,   // POS thiết bị cố định, không cần refetch khi focus lại tab
      dedupingInterval: 30_000,   // gộp mọi request trùng trong 30s — 2 trang cùng gọi chỉ tốn 1 network call
      keepPreviousData: true,     // hiển thị dữ liệu cũ ngay lập tức khi chuyển tab, không chớp trắng
    }
  );
  return { categories: data ?? [], isLoading, error, mutate };
}
```

```tsx
// frontend/src/hooks/useFunds.ts — dùng chung cho CheckoutModal, transactions/page.tsx, funds/page.tsx
import useSWR from 'swr';
import { swrFetcher } from '@/lib/swrFetcher';

export interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

export function useFunds() {
  const { data, isLoading, mutate } = useSWR<Fund[]>('/funds', swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    keepPreviousData: true,
  });
  return { funds: data ?? [], isLoading, mutate };
}
```

**Áp dụng vào POS page** (`frontend/src/app/page.tsx`) — thay `useEffect` fetch thủ công bằng hook, đồng thời gộp fetch song song:

```tsx
// Trước: 2 fetch tuần tự trong loadData()
// Sau:
import { useCategories } from '@/hooks/useCategories';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/swrFetcher';

export default function PosPage() {
  const { categories } = useCategories();
  const { data: products = [], isLoading: loading } = useSWR<Product[]>(
    '/products',
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000, keepPreviousData: true }
  );
  // categories và products fetch song song, tự động cache & dedup giữa POS/Products/CheckoutModal
  ...
}
```

Sau khi tạo/sửa sản phẩm ở `/products`, chỉ cần gọi `mutate()` để invalidate cache dùng chung — POS page sẽ tự đồng bộ ngay khi quay lại, không cần refetch toàn bộ thủ công.

---

### 4.3 Frontend — Code-splitting modal nặng bằng `next/dynamic`

```tsx
// frontend/src/app/page.tsx
import dynamic from 'next/dynamic';

// Modal chỉ hiển thị khi người dùng tương tác — không cần trong bundle JS ban đầu
const VariantSelectorModal = dynamic(() => import('@/components/pos/VariantSelectorModal'), {
  ssr: false,
});
const CheckoutModal = dynamic(() => import('@/components/pos/CheckoutModal'), { ssr: false });
const VietQRModal = dynamic(() => import('@/components/pos/VietQRModal'), { ssr: false });
```

```tsx
// frontend/src/app/dashboard/page.tsx — nếu bổ sung chart nặng (recharts/chart.js) trong tương lai
const CashFlowChart = dynamic(() => import('@/components/dashboard/CashFlowChart'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-64 bg-slate-100 rounded-2xl" />,
});
```

**Tác động:** giảm kích thước JS bundle tải ban đầu ở mỗi trang, cải thiện Time-to-Interactive trên thiết bị POS cấu hình thấp.

---

### 4.4 Backend — In-Memory TTL Cache cho dữ liệu đọc-nhiều-ghi-ít

```go
// backend/internal/cache/ttl_cache.go
package cache

import (
	"sync"
	"time"
)

type entry struct {
	value     interface{}
	expiresAt time.Time
}

// TTLCache là cache in-memory đơn giản, an toàn concurrent, dùng cho dữ liệu bán tĩnh
// (categories, funds, settings) — tránh đánh thẳng PostgreSQL ở các API đọc-nhiều.
type TTLCache struct {
	mu   sync.RWMutex
	data map[string]entry
	ttl  time.Duration
}

func NewTTLCache(ttl time.Duration) *TTLCache {
	c := &TTLCache{data: make(map[string]entry), ttl: ttl}
	go c.janitor()
	return c
}

func (c *TTLCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.data[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}

func (c *TTLCache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = entry{value: value, expiresAt: time.Now().Add(c.ttl)}
}

// Invalidate xóa cache — gọi sau mọi thao tác Create/Update/Delete để đảm bảo dữ liệu luôn đúng
func (c *TTLCache) Invalidate(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.data, key)
}

func (c *TTLCache) janitor() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, e := range c.data {
			if now.After(e.expiresAt) {
				delete(c.data, k)
			}
		}
		c.mu.Unlock()
	}
}
```

**Áp dụng vào `CategoryHandler`:**

```go
// backend/internal/handlers/category.go

type CategoryHandler struct {
	db    *gorm.DB
	cache *cache.TTLCache
}

func NewCategoryHandler(db *gorm.DB, c *cache.TTLCache) *CategoryHandler {
	return &CategoryHandler{db: db, cache: c}
}

const categoriesCacheKey = "categories:list"

func (h *CategoryHandler) ListCategories(c *gin.Context) {
	if cached, ok := h.cache.Get(categoriesCacheKey); ok {
		models.SendSuccess(c, http.StatusOK, cached, "Categories retrieved successfully")
		return
	}

	var categories []models.Category
	if err := h.db.Order("display_order asc, name asc").Find(&categories).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve categories")
		return
	}

	h.cache.Set(categoriesCacheKey, categories)
	models.SendSuccess(c, http.StatusOK, categories, "Categories retrieved successfully")
}

// Invalidate cache ngay sau khi ghi để tránh dữ liệu cũ (stale) hiển thị cho POS
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	// ... logic tạo category giữ nguyên ...
	h.cache.Invalidate(categoriesCacheKey)
	models.SendSuccess(c, http.StatusCreated, category, "Category created successfully")
}
// Tương tự: gọi h.cache.Invalidate(categoriesCacheKey) trong UpdateCategory & DeleteCategory
```

Áp dụng pattern tương tự cho `FundHandler.ListFunds` với key `funds:list`, TTL 60s (funds ít thay đổi hơn cả categories, nhưng cần invalidate ngay sau `ReconcileFund`/`CreateOrder`/`CreateTransaction` vì các thao tác này thay đổi `current_balance`).

**Khởi tạo trong `main.go`:**

```go
// backend/cmd/server/main.go
catCache := cache.NewTTLCache(2 * time.Minute)
fundCache := cache.NewTTLCache(30 * time.Second) // ngắn hơn vì current_balance thay đổi thường xuyên

categoryHandler := handlers.NewCategoryHandler(db, catCache)
fundHandler := handlers.NewFundHandler(db, fundCache)
```

---

### 4.5 Backend — GORM: bật `PrepareStmt` + cấu hình Connection Pool

```go
// backend/internal/database/postgres.go

gormConfig := &gorm.Config{
	Logger:      logger.Default.LogMode(logger.Warn), // giảm log Info ở production để bớt I/O
	PrepareStmt: true,                                 // tái sử dụng prepared statements, giảm CPU parse/plan
}

var db *gorm.DB
var err error
for i := 1; i <= 5; i++ {
	db, err = gorm.Open(postgres.Open(dsn), gormConfig)
	if err == nil {
		break
	}
	log.Printf("Failed to connect to PostgreSQL (attempt %d/5): %v. Retrying in 2s...", i, err)
	time.Sleep(2 * time.Second)
}
if err != nil {
	return nil, err
}

// Cấu hình connection pool — quan trọng khi nhiều thiết bị POS truy cập đồng thời giờ cao điểm
sqlDB, err := db.DB()
if err != nil {
	return nil, err
}
sqlDB.SetMaxOpenConns(30)                  // giới hạn kết nối đồng thời, tránh áp đảo Postgres trên LXC nhỏ (2 vCPU)
sqlDB.SetMaxIdleConns(10)                  // giữ sẵn kết nối idle để tái sử dụng nhanh
sqlDB.SetConnMaxLifetime(10 * time.Minute) // tránh kết nối "chết" (stale) tồn tại quá lâu
sqlDB.SetConnMaxIdleTime(3 * time.Minute)
```

---

### 4.6 Backend — Chuẩn hóa lỗi: không leak chi tiết DB ra client

```go
// backend/internal/models/response.go — bổ sung hàm log nội bộ tách biệt với message trả về client

import "log"

func SendInternalError(c *gin.Context, publicMessage string, internalErr error) {
	if internalErr != nil {
		log.Printf("[ERROR] %s | path=%s | detail=%v", publicMessage, c.Request.URL.Path, internalErr)
	}
	if publicMessage == "" {
		publicMessage = "An unexpected error occurred"
	}
	SendError(c, http.StatusInternalServerError, publicMessage) // KHÔNG kèm err.Error() ra ngoài
}
```

```go
// Cách gọi mới ở mọi handler — ví dụ fund.go
if err := h.db.Where("is_active = ?", true).Order("id asc").Find(&funds).Error; err != nil {
	models.SendInternalError(c, "Failed to retrieve funds", err) // err chỉ log nội bộ, không lộ ra response
	return
}
```

**Cần rà soát & sửa tương tự tại:** `order.go`, `transaction.go`, `product.go`, `category.go`, `variant.go` — mọi chỗ đang nối `+err.Error()` vào message trả về client.

---

### 4.7 Backend — Phân trang cho danh sách lớn (orders, transactions)

```go
// backend/internal/handlers/order.go

func (h *OrderHandler) ListOrders(c *gin.Context) {
	query := h.db.Model(&models.Order{}).Preload("Fund").Preload("Items.Variant")

	if fundIDStr := c.Query("fund_id"); fundIDStr != "" {
		if fundID, err := strconv.ParseUint(fundIDStr, 10, 32); err == nil {
			query = query.Where("fund_id = ?", fundID)
		}
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Phân trang: mặc định 25 mục/trang, tối đa 100 — tránh trả về toàn bộ lịch sử đơn hàng
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "25"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}

	var total int64
	query.Session(&gorm.Session{}).Count(&total)

	var orders []models.Order
	if err := query.Order("created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&orders).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve orders", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{
		"items":       orders,
		"page":        page,
		"page_size":   pageSize,
		"total_items": total,
		"total_pages": (total + int64(pageSize) - 1) / int64(pageSize),
	}, "Orders retrieved successfully")
}
```

Áp dụng cùng pattern cho `TransactionHandler.ListTransactions`. Frontend (`transactions/page.tsx`) cần cập nhật để đọc `data.items` thay vì mảng phẳng, kèm điều khiển phân trang UI.

---

## TỔNG KẾT ƯU TIÊN THỰC THI

| Ưu tiên | Hành động | Nỗ lực | Tác động lên độ trễ chuyển tab |
|---|---|---|---|
| 1 | Tách `checkHealth()` khỏi `useEffect([pathname])` trong `AppShell.tsx` | Rất thấp | **Cao nhất** — loại bỏ 1 network round-trip mỗi lần chuyển tab |
| 2 | `Promise.all` cho các fetch độc lập ở `page.tsx` (POS) & `products/page.tsx` | Rất thấp | Cao — giảm ~50% thời gian chờ dữ liệu |
| 3 | Tích hợp SWR cho `/categories`, `/funds`, `/products` | Trung bình | Cao — cache dùng chung, chuyển tab gần như tức thì sau lần tải đầu |
| 4 | In-memory TTL cache backend cho categories/funds | Trung bình | Trung bình — giảm tải PostgreSQL, giảm latency mỗi request |
| 5 | GORM `PrepareStmt` + connection pool tuning | Thấp | Trung bình — ổn định hiệu năng dưới tải đồng thời |
| 6 | `next/dynamic` cho modal/chart nặng | Thấp | Thấp–Trung bình — cải thiện tải trang lần đầu |
| 7 | Phân trang orders/transactions + chuẩn hóa lỗi | Trung bình | Thấp (hiện tại) — quan trọng cho khả năng mở rộng dài hạn |

Thực hiện đúng thứ tự 1→3 sẽ giải quyết phần lớn (~80%) cảm giác "lag khi chuyển tab" mà không cần thay đổi kiến trúc lớn. Các mục 4→7 là nền tảng để hệ thống chịu tải tốt khi dữ liệu và số lượng thiết bị POS tăng lên trong tương lai.
