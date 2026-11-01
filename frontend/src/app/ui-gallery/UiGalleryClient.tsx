'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Check,
  Coffee,
  Eye,
  Flame,
  Layers,
  Lock,
  Monitor,
  Package,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Type,
  Wallet,
} from 'lucide-react';
import { isAdmin, isAuthenticated } from '@/lib/auth';
import {
  GLASS_EFFECTS_CHANGE_EVENT,
  isGlassEffectsEnabled,
  isSystemGlassForcedOff,
  setGlassEffectsEnabled,
} from '@/lib/featureFlags';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Chip,
  Divider,
  EmptyState,
  FieldShell,
  FilterBar,
  FilterPill,
  IconButton,
  ListGroup,
  ListRow,
  ModalShell,
  ResponsiveSheet,
  SegmentedControl,
  SkeletonCard,
  SkeletonListGroup,
  Switch,
  getActiveOverlayCount,
  subscribeOverlayStack,
} from '@/components/ui';
import ModernSelect, { ModernSelectOption } from '@/components/common/ModernSelect';
import ModernDateRangePicker, {
  DateRangeChangeParams,
} from '@/components/common/ModernDateRangePicker';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { cn } from '@/lib/cn';

type ViewportMode = 'auto' | 'mobile390' | 'desktop';
type Q8Mode = 'compare' | 'sf-pro' | 'inter';

const SF_TNUM_STYLE: React.CSSProperties = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
};

const INTER_TNUM_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
};

const SELECT_OPTIONS_SHORT: ModernSelectOption[] = [
  {
    value: 'arabica',
    label: 'Hạt Arabica Cầu Đất rang vừa',
    subLabel: 'Quy đổi: 1 Bao = 10 Túi = 10.000 g',
    badge: 'Chuẩn BOM',
    badgeColor: 'purple',
  },
  {
    value: 'milk',
    label: 'Sữa tươi thanh trùng Dalatmilk',
    subLabel: 'Quy đổi: 1 Thùng = 12 Hộp = 12.000 ml',
    badge: 'Lạnh',
    badgeColor: 'blue',
  },
  {
    value: 'orange',
    label: 'Cam vàng Navel Úc (Hao hụt vỏ 38%)',
    subLabel: 'Tỷ lệ thu hồi thịt quả: 62%',
    badge: 'Hao hụt',
    badgeColor: 'amber',
  },
  {
    value: 'archived',
    label: 'Nguyên liệu ngừng kinh doanh',
    subLabel: 'Đã khóa định lượng',
    badge: 'Ngừng',
    badgeColor: 'slate',
    disabled: true,
  },
];

const SELECT_OPTIONS_LONG_VI: ModernSelectOption[] = [
  {
    value: 'arabica',
    label: 'Hạt cà phê Arabica Cầu Đất sơ chế ướt rang mộc đặc biệt thượng hạng',
    subLabel: 'Quy đổi đa cấp: 1 Bao tải lớn = 20 Túi zip bạc = 20.000 gam tinh',
    badge: 'Định lượng chuẩn',
    badgeColor: 'purple',
  },
  {
    value: 'milk',
    label: 'Sữa tươi tiệt trùng nguyên kem không đường nhập khẩu nguyên hộp',
    subLabel: 'Quy đổi đa cấp: 1 Thùng carton = 12 Hộp giấy = 12.000 ml',
    badge: 'Bảo quản lạnh',
    badgeColor: 'blue',
  },
  {
    value: 'orange',
    label: 'Cam sành Vĩnh Long tuyển chọn ép nước tươi (Tỷ lệ hao hụt gọt vỏ 42,5%)',
    subLabel: 'Khối lượng tịnh sau sơ chế: 575 g trên mỗi 1.000 g nhập thô',
    badge: 'Hao hụt 42,5%',
    badgeColor: 'amber',
  },
  {
    value: 'archived',
    label: 'Bột kem béo thực vật thế hệ cũ đã ngừng sử dụng trong công thức',
    subLabel: 'Không cho phép chọn mới',
    badge: 'Đã khóa',
    badgeColor: 'slate',
    disabled: true,
  },
];

const Q8_LEDGER_ROWS = [
  {
    id: 'ORD-261102-018',
    itemShort: 'Cà phê sữa đá Sài Gòn (Size M)',
    itemLong: 'Sữa tươi trân châu đường đen kem trứng nướng đặc biệt (Size XL)',
    qty: '12',
    unitPrice: '45.000 ₫',
    amount: '540.000 ₫',
    delta: '+18,4%',
    positive: true,
  },
  {
    id: 'ORD-261102-019',
    itemShort: 'Trà đào cam sả tươi (Size L)',
    itemLong: 'Trà ô long nhài kem phô mai muối biển ít ngọt (Size L)',
    qty: '28',
    unitPrice: '55.000 ₫',
    amount: '1.540.000 ₫',
    delta: '+24,0%',
    positive: true,
  },
  {
    id: 'FEE-SHOPEE-20',
    itemShort: 'Chiết khấu sàn ShopeeFood (-20%)',
    itemLong: 'Khấu trừ phí chiết khấu đối tác giao hàng ShopeeFood ca tối (-20%)',
    qty: '1',
    unitPrice: '-1.089.012 ₫',
    amount: '-1.089.012 ₫',
    delta: '-20,0%',
    positive: false,
  },
  {
    id: 'ALIGN-111',
    itemShort: 'Kiểm chứng độ rộng chữ số 1 (111.111)',
    itemLong: 'Kiểm chứng thẳng hàng chữ số hẹp (111.111 ₫) với chữ số rộng (888.888 ₫)',
    qty: '11',
    unitPrice: '111.111 ₫',
    amount: '1.111.111 ₫',
    delta: '+11,1%',
    positive: true,
  },
  {
    id: 'ALIGN-888',
    itemShort: 'Kiểm chứng độ rộng chữ số 8 (888.888)',
    itemLong: 'Đối chiếu cột hàng trăm nghìn & ký hiệu tiền tệ ₫ ở cùng cỡ chữ',
    qty: '88',
    unitPrice: '888.888 ₫',
    amount: '8.888.888 ₫',
    delta: '+88,8%',
    positive: true,
  },
];

const TEMPLATE_BUDGET_ROWS = [
  {
    id: 'T1-staff',
    template: 'T1 POS Bán hàng — Vai trò Staff (A2 + A3)',
    layers: 'Top Header Compact (1) + Tab Bar (0) + Solid #2E1065 Cart Bar (0)',
    resting: 1,
    withOverlayAndToast: 2,
  },
  {
    id: 'T1-admin',
    template: 'T1 POS Bán hàng — Vai trò Admin (A1 + A2)',
    layers: 'Top Bar (1) + Bottom Tab Bar/Sidebar (1) + Solid #2E1065 Cart Bar (0)',
    resting: 2,
    withOverlayAndToast: 2,
  },
  {
    id: 'T2-list',
    template: 'T2 Danh sách Thu chi / Thực đơn + Sticky FilterBar',
    layers: 'Top Bar (1) + Tab Bar/Sidebar (1) + Sticky glass-thin Header (1)',
    resting: 3,
    withOverlayAndToast: 2,
  },
  {
    id: 'T3-bom',
    template: 'T3 Nhập hàng & Định lượng BOM (PurchasesCostTab)',
    layers: 'Top Bar (1) + Tab Bar/Sidebar (1) + Sticky Table Header (1)',
    resting: 3,
    withOverlayAndToast: 2,
  },
  {
    id: 'T5-nested',
    template: 'T5 Modal tác vụ (z-50) + Hộp xác nhận (z-80) + Toast (z-90)',
    layers: 'Shell Demoted (0) + Modal z-50 Demoted (0) + Confirm z-80 (1) + Toast z-90 (1)',
    resting: 1,
    withOverlayAndToast: 2,
  },
];

export default function UiGalleryClient() {
  const router = useRouter();
  const { showToast, clearAll } = useToast();
  const { confirm } = useConfirm();

  const [authorized, setAuthorized] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('auto');
  const [glassEnabled, setGlassEnabled] = useState(true);
  const [systemForcedOff, setSystemForcedOff] = useState(false);
  const [simReducedTransparency, setSimReducedTransparency] = useState(false);
  const [simHighContrast, setSimHighContrast] = useState(false);
  const [longViLabels, setLongViLabels] = useState(false);

  // Q8 Font Toggle State
  const [q8Mode, setQ8Mode] = useState<Q8Mode>('compare');

  // Interactive Component States
  const [segVal, setSegVal] = useState('ledger');
  const [switchDemoA, setSwitchDemoA] = useState(true);
  const [switchDemoB, setSwitchDemoB] = useState(false);
  const [activeChip, setActiveChip] = useState('all');
  const [selectedCard, setSelectedCard] = useState<'cash' | 'vietqr'>('vietqr');
  const [selectVal, setSelectVal] = useState<string>('arabica');
  const [compactSelectVal, setCompactSelectVal] = useState<string>('milk');
  const [filterSearch, setFilterSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateRangeChangeParams>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { period: 'today', from: today, to: today };
  });

  // Overlay & Pending Lock Demo States
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isNestedModalOpen, setIsNestedModalOpen] = useState(false);
  const [confirmExecutionCount, setConfirmExecutionCount] = useState(0);
  const [activeOverlayCount, setActiveOverlayCount] = useState(0);
  const [measuredActiveBlurNodes, setMeasuredActiveBlurNodes] = useState(0);

  const sheetTriggerRef = useRef<HTMLButtonElement>(null);
  const galleryRootRef = useRef<HTMLDivElement>(null);

  // Admin-only synchronous localStorage guard (0 backend requests — Override Q7)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (!isAdmin()) {
      router.replace('/');
      return;
    }
    setAuthorized(true);
    setGlassEnabled(isGlassEffectsEnabled());
    setSystemForcedOff(isSystemGlassForcedOff());

    const handleGlassSync = () => {
      setGlassEnabled(isGlassEffectsEnabled());
      setSystemForcedOff(isSystemGlassForcedOff());
    };
    window.addEventListener(GLASS_EFFECTS_CHANGE_EVENT, handleGlassSync);
    return () => window.removeEventListener(GLASS_EFFECTS_CHANGE_EVENT, handleGlassSync);
  }, [router]);

  // Subscribe to overlayStack & measure live computed backdrop-filter count in DOM
  useEffect(() => {
    if (!authorized) return;

    const measureDomBlurs = () => {
      setActiveOverlayCount(getActiveOverlayCount());
      if (typeof document === 'undefined') return;

      const candidates = document.querySelectorAll(
        '[data-gallery-shell-bar="true"], [role="dialog"], [role="alertdialog"], [data-toast="true"]'
      );
      let activeBlurs = 0;
      candidates.forEach((node) => {
        const style = window.getComputedStyle(node);
        const bf =
          style.backdropFilter ||
          (style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter ||
          'none';
        if (bf && bf !== 'none') {
          activeBlurs += 1;
        }
      });
      setMeasuredActiveBlurNodes(activeBlurs);
    };

    measureDomBlurs();
    const unsub = subscribeOverlayStack(() => {
      requestAnimationFrame(measureDomBlurs);
    });
    const observer = new MutationObserver(() => {
      requestAnimationFrame(measureDomBlurs);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-overlay-open'],
    });

    return () => {
      unsub();
      observer.disconnect();
    };
  }, [authorized, glassEnabled, simReducedTransparency, simHighContrast]);

  if (!authorized) {
    return null;
  }

  const handleToggleGlass = (next: boolean) => {
    setGlassEffectsEnabled(next);
    setGlassEnabled(next);
  };

  // Simulated scoped CSS variable overrides for 1-tap accessibility testing on device
  const simulatedA11yStyle: React.CSSProperties = {
    ...(simReducedTransparency
      ? ({
          '--mat-glass-thin-bg': '#F8FAFC',
          '--mat-glass-thin-border': '#E2E8F0',
          '--mat-glass-thin-filter': 'none',
          '--mat-glass-reg-bg': '#FFFFFF',
          '--mat-glass-reg-border': '#CBD5E1',
          '--mat-glass-reg-filter': 'none',
          '--mat-glass-thick-bg': '#FFFFFF',
          '--mat-glass-thick-border': '#CBD5E1',
          '--mat-glass-thick-filter': 'none',
          '--shell-glass-bg': '#FFFFFF',
          '--shell-glass-border': '#CBD5E1',
          '--shell-glass-filter': 'none',
          '--sticky-glass-bg': '#F8FAFC',
          '--sticky-glass-border': '#E2E8F0',
          '--sticky-glass-filter': 'none',
        } as React.CSSProperties)
      : {}),
    ...(simHighContrast
      ? ({
          '--mat-glass-thin-bg': '#FFFFFF',
          '--mat-glass-thin-border': '#475569',
          '--mat-glass-reg-bg': '#FFFFFF',
          '--mat-glass-reg-border': '#334155',
          '--mat-glass-reg-filter': 'none',
          '--mat-glass-thick-bg': '#FFFFFF',
          '--mat-glass-thick-border': '#1E293B',
          '--mat-glass-thick-filter': 'none',
          '--shell-glass-bg': '#FFFFFF',
          '--shell-glass-border': '#334155',
          '--shell-glass-filter': 'none',
          '--sticky-glass-bg': '#FFFFFF',
          '--sticky-glass-border': '#475569',
          '--sticky-glass-filter': 'none',
          '--surface-cart-bar': '#1E1B4B',
          '--border-cart-bar': '#FFFFFF',
          '--border-card': '#64748B',
          '--separator-hairline': '#94A3B8',
          '--tint-primary': '#5B21B6',
        } as React.CSSProperties)
      : {}),
  };

  const label = (shortText: string, longViText: string) =>
    longViLabels ? longViText : shortText;

  const activeQ8NumStyle = q8Mode === 'sf-pro' ? SF_TNUM_STYLE : INTER_TNUM_STYLE;

  const triggerFinancialConfirmSuccess = async () => {
    const ok = await confirm({
      type: 'danger',
      title: label(
        'Hủy đơn hàng #ORD-261102-018?',
        'Xác nhận hủy đơn hàng đã thanh toán #ORD-261102-018 và hoàn quỹ tiền mặt ca tối?'
      ),
      message: label(
        'Thao tác này sẽ hoàn trả 1.485.000 ₫ khỏi doanh thu ca hiện tại. Nút xác nhận sẽ khóa cứng trong 1,5 giây để chống bấm đúp.',
        'Hệ thống sẽ ghi nhận bút toán đảo 1.485.000 ₫ vào sổ quỹ chi nhánh Quận 1. Hãy thử bấm liên tiếp nhiều lần hoặc nhấn Enter lặp lại để kiểm chứng khóa đồng bộ Override Q5.'
      ),
      confirmText: label('Xác nhận hủy đơn', 'Xác nhận hủy & hoàn 1.485.000 ₫'),
      cancelText: 'Giữ lại đơn',
      onConfirmAsync: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setConfirmExecutionCount((c) => c + 1);
      },
    });

    if (ok) {
      showToast('success', 'Đã hủy đơn #ORD-261102-018 (Thực thi đúng 1 lần duy nhất)', {
        title: 'Khóa chống bấm đúp Q5 đạt chuẩn',
      });
    }
  };

  const triggerFinancialConfirmFailure = async () => {
    await confirm({
      type: 'warning',
      title: 'Xóa phiếu chi tiền mặt #TX-9082?',
      message:
        'Mô phỏng lỗi kết nối mạng sau 1,2 giây: hộp thoại sẽ nhả khóa an toàn, giữ nguyên trạng thái và bật Toast báo lỗi (Override Q5).',
      confirmText: 'Thử xóa (Mô phỏng lỗi)',
      cancelText: 'Đóng',
      onConfirmAsync: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        showToast(
          'error',
          'Mất kết nối máy chủ khi xóa phiếu #TX-9082. Chưa có dữ liệu nào bị thay đổi.',
          { title: 'Không thể xóa phiếu chi' }
        );
        throw new Error('Simulated network failure');
      },
    });
  };

  const fireStackedToasts = () => {
    clearAll();
    setTimeout(() => {
      showToast('info', 'Toast #1 (Cũ hơn -> Tự động chuyển sang nền đặc Opaque 0px blur)', {
        title: 'Bước 1/3: Đã lưu nháp',
        duration: 8000,
      });
    }, 20);
    setTimeout(() => {
      showToast('warning', 'Toast #2 (Cũ hơn -> Nền đặc Opaque 0px blur)', {
        title: 'Bước 2/3: Cảnh báo chênh lệch quỹ',
        duration: 8000,
      });
    }, 90);
    setTimeout(() => {
      showToast(
        'success',
        'Toast #3 Mới nhất -> Duy nhất giữ lớp kính glass-toast (Tổng Toast blur = 1)',
        {
          title: 'Bước 3/3: Đối soát hoàn tất',
          duration: 8000,
          action: {
            label: 'Xem chi tiết',
            onClick: () => {},
          },
        }
      );
    }, 160);
  };

  const selectOptions = longViLabels ? SELECT_OPTIONS_LONG_VI : SELECT_OPTIONS_SHORT;

  return (
    <div
      ref={galleryRootRef}
      style={simulatedA11yStyle}
      className="min-h-screen bg-canvas text-slate-900 font-sans pb-24"
    >
      {/* ─── Sticky Gallery Shell Bar (glass-regular, z-shell-bar: 30 — Demotes when overlay opens!) ─── */}
      <header
        data-gallery-shell-bar="true"
        className="sticky top-0 z-shell-bar glass-regular border-b border-glass px-3.5 md:px-6 py-2.5 pt-safe transition-colors"
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-field bg-brand-600 text-white flex items-center justify-center shadow-glass-sm shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-headline md:text-title-3 font-bold text-slate-900 truncate">
                    Tahoe Liquid Glass Gallery — Gate G1
                  </h1>
                  <Badge variant="warning" size="sm">
                    UNVERIFIED ON DEVICE
                  </Badge>
                  <Badge variant="brand" size="sm">
                    0 API Calls
                  </Badge>
                </div>
                <p className="text-footnote text-slate-500 truncate">
                  Admin-only · Không có trong menu · Sẽ xóa hoàn toàn ở Phase T6 (Override Q7)
                </p>
              </div>
            </div>

            {/* Live Active Blur Layer Meter (<= 3 Budget) */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={cn(
                  'px-3 py-1.5 rounded-full border text-footnote font-semibold flex items-center gap-1.5',
                  measuredActiveBlurNodes <= 3
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Blur đang bật (DOM):</span>
                <span className="font-num font-bold">{measuredActiveBlurNodes} / 3</span>
              </div>
              {activeOverlayCount > 0 && (
                <Badge variant="info" size="md">
                  Overlay mở ({activeOverlayCount}) → Shell Bar đặc #FFF
                </Badge>
              )}
            </div>
          </div>

          {/* Interactive Gallery Stress & Viewport Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-hairline">
            <SegmentedControl
              size="sm"
              value={viewportMode}
              onChange={(v) => setViewportMode(v as ViewportMode)}
              options={[
                { value: 'auto', label: 'Tự động', icon: <Eye className="w-3.5 h-3.5" /> },
                {
                  value: 'mobile390',
                  label: 'Khung 390px',
                  icon: <Smartphone className="w-3.5 h-3.5" />,
                },
                {
                  value: 'desktop',
                  label: 'Desktop rộng',
                  icon: <Monitor className="w-3.5 h-3.5" />,
                },
              ]}
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip
                active={glassEnabled && !simReducedTransparency && !simHighContrast}
                onClick={() => handleToggleGlass(!glassEnabled)}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Kính Q3: {glassEnabled ? 'Bật' : 'Tắt (html.no-glass)'}
              </Chip>
              <Chip
                active={simReducedTransparency}
                onClick={() => setSimReducedTransparency((v) => !v)}
              >
                Giả lập Giảm trong suốt
              </Chip>
              <Chip
                active={simHighContrast}
                onClick={() => setSimHighContrast((v) => !v)}
              >
                Giả lập Tương phản cao
              </Chip>
              <Chip
                active={longViLabels}
                onClick={() => setLongViLabels((v) => !v)}
                leftIcon={<Type className="w-3.5 h-3.5" />}
              >
                Nhãn tiếng Việt dài
              </Chip>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Framed Specimen Container (390px Mobile Simulation or Full Desktop) ─── */}
      <div
        className={cn(
          'mx-auto px-3.5 md:px-6 pt-5 space-y-8 transition-all',
          viewportMode === 'mobile390'
            ? 'max-w-[390px] border-x-2 border-dashed border-brand-300/80 bg-canvas px-3.5 shadow-card'
            : 'max-w-6xl'
        )}
      >
        {systemForcedOff && (
          <Card className="p-3.5 border-amber-300 bg-amber-50">
            <div className="flex items-center gap-2.5 text-footnote text-amber-900 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Thiết bị của bạn đang bật chế độ Giảm độ trong suốt hoặc Tăng tương phản của hệ điều hành — hiệu ứng kính tự động chuyển sang nền đặc an toàn (Override Q3).
              </span>
            </div>
          </Card>
        )}

        {/* =====================================================================
            SECTION 0: TAILWIND 3.4.19 NO-OP BASELINE VS TAHOE TOKEN DIFF (ITEM 5)
            ===================================================================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <Badge variant="brand" size="sm" className="mb-1">
                Section 0 · Pre-Flight Item 5
              </Badge>
              <h2 className="text-title-2 font-bold text-slate-900">
                Đối chiếu 330 lớp Tailwind 3.4.19 bị rỗng (0px) vs Token Tahoe mới
              </h2>
              <p className="text-subhead text-slate-600">
                Trong Tailwind 3.4.19 hiện tại, các lớp <code>shadow (2xs / xs)</code> và{' '}
                <code>backdrop-blur (xs)</code> của v4 không tồn tại nên trình duyệt vẽ 0px. Hãy kiểm tra độ nổi mới trên màn hình thật:
              </p>
            </div>
          </div>

          <div
            className={cn(
              'grid gap-3.5',
              viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
            )}
          >
            {/* 0A: SegmentedControl Thumb */}
            <Card>
              <CardHeader>
                <CardTitle>0A. SegmentedControl & Tab Pill đang chọn</CardTitle>
                <CardDescription>
                  Trước: lớp v4 không tồn tại = 0px phẳng lì · Sau: <code>shadow-glass-sm</code> + viền sáng trong
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-caption text-slate-500 mb-1">
                    Trước (Tailwind 3.4.19 No-Op — 0px shadow)
                  </div>
                  <div className="inline-flex p-1 rounded-full bg-surface-grouped gap-1 w-full">
                    <span className="flex-1 text-center py-1.5 px-3 rounded-full bg-white text-brand-700 text-xs font-semibold">
                      Sổ thu chi
                    </span>
                    <span className="flex-1 text-center py-1.5 px-3 rounded-full text-slate-600 text-xs font-medium">
                      Đơn hàng
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-caption text-brand-700 mb-1">
                    Sau (Tahoe Token — shadow-glass-sm)
                  </div>
                  <SegmentedControl
                    fullWidth
                    size="sm"
                    value={segVal}
                    onChange={setSegVal}
                    options={[
                      { value: 'ledger', label: label('Sổ thu chi', 'Sổ thu chi tổng hợp') },
                      { value: 'orders', label: label('Đơn hàng', 'Lịch sử đơn bán') },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 0B: Opaque Content Card & KPI Tile */}
            <Card>
              <CardHeader>
                <CardTitle>0B. Thẻ nội dung Opaque Card & Ô chỉ số KPI</CardTitle>
                <CardDescription>
                  Trước: <code>border-slate-200</code> + 0px shadow · Sau: <code>border-card</code> + <code>shadow-card</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-white border border-slate-200 p-3">
                  <div className="text-caption text-slate-500">Trước (0px shadow)</div>
                  <div className="font-num text-title-3 font-bold text-slate-900 mt-1">
                    12.450.000 ₫
                  </div>
                  <div className="text-footnote text-slate-500 mt-0.5">Viền đặc, phẳng</div>
                </div>
                <div className="rounded-card bg-surface-card border border-card shadow-card p-3">
                  <div className="text-caption text-brand-700">Sau (shadow-card)</div>
                  <div className="font-num text-title-3 font-bold text-slate-900 mt-1">
                    12.450.000 ₫
                  </div>
                  <div className="text-footnote text-slate-500 mt-0.5">Bóng hướng sáng nhẹ</div>
                </div>
              </CardContent>
            </Card>

            {/* 0C: Nested Summary Box & Pill */}
            <Card>
              <CardHeader>
                <CardTitle>0C. Ô tóm tắt lồng bên trong Card / Modal</CardTitle>
                <CardDescription>
                  Giữ nguyên 0px shadow, phân tách bằng nền <code>bg-surface-grouped</code> sạch sẽ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-field bg-surface-grouped border border-hairline p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-footnote font-semibold text-slate-700">
                      Giá vốn định lượng (COGS)
                    </div>
                    <div className="text-caption text-slate-500">
                      Không đổ bóng chồng lên nhau
                    </div>
                  </div>
                  <span className="font-num text-headline font-bold text-brand-700">
                    14.250 ₫ / ly
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 0D: Backdrop Scrim & Platter Blur */}
            <Card>
              <CardHeader>
                <CardTitle>0D. Màn mờ nền Scrim vs Mặt kính Platter</CardTitle>
                <CardDescription>
                  Trước: lớp blur v4 trên scrim = 0px · Sau: Scrim giữ 0px blur, dồn <code>28px</code> blur vào <code>glass-thick</code> platter
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setIsParentModalOpen(true)}
                >
                  Mở ModalShell (glass-thick)
                </Button>
                <Button
                  ref={sheetTriggerRef}
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSheetOpen(true)}
                >
                  Mở ResponsiveSheet (Kéo thanh đầu)
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* =====================================================================
            SECTION 1: OPEN QUESTION Q8 — APPLE SF PRO TNUM VS INTER TNUM (ITEM 6)
            ===================================================================== */}
        <section className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <Badge variant="brand" size="sm" className="mb-1">
                Section 1 · Quyết định Q8 trên iPhone / iPad
              </Badge>
              <h2 className="text-title-2 font-bold text-slate-900">
                So sánh số tiền Tabular Numerals: SF Pro (Option A) vs Inter Variable (Option B)
              </h2>
              <p className="text-subhead text-slate-600">
                Trên thiết bị Apple, nhãn tiếng Việt dùng <strong>SF Pro</strong>. Hãy xem trên cùng một dòng khi cột tiền dùng{' '}
                <strong>SF Pro tabular-nums</strong> so với <strong>Inter Variable tabular-nums</strong>:
              </p>
            </div>

            <SegmentedControl
              size="sm"
              value={q8Mode}
              onChange={(v) => setQ8Mode(v as Q8Mode)}
              options={[
                { value: 'compare', label: 'Cùng dòng (A vs B)' },
                { value: 'sf-pro', label: 'Option A: SF Pro' },
                { value: 'inter', label: 'Option B: Inter' },
              ]}
            />
          </div>

          {/* 3-up KPI Row switching live between Option A & Option B */}
          <div
            className={cn(
              'grid gap-3',
              viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'
            )}
          >
            {[
              {
                title: label('Doanh thu thuần hôm nay', 'Tổng doanh thu thuần sau chiết khấu khuyến mãi'),
                val: '18.450.000 ₫',
                sub: '+14,8% so với hôm qua',
                tone: 'text-slate-900',
              },
              {
                title: label('Tiền vốn nguyên liệu (COGS)', 'Tổng giá vốn nguyên liệu định lượng BOM tiêu hao'),
                val: '6.120.500 ₫',
                sub: 'Tỷ trọng vốn: 33,17%',
                tone: 'text-slate-900',
              },
              {
                title: label('Lợi nhuận gộp thu hồi', 'Lợi nhuận gộp thực thu sau trừ hao hụt sơ chế'),
                val: '12.329.500 ₫',
                sub: 'Biên gộp: +66,83%',
                tone: 'text-brand-700',
              },
            ].map((kpi, idx) => (
              <Card key={idx} className="p-4">
                <div className="text-footnote font-medium text-slate-500">{kpi.title}</div>
                <div
                  style={q8Mode === 'compare' ? SF_TNUM_STYLE : activeQ8NumStyle}
                  className={cn('text-title-1 font-bold mt-1 tracking-tight', kpi.tone)}
                >
                  {kpi.val}
                </div>
                {q8Mode === 'compare' && (
                  <div className="mt-1 pt-1 border-t border-hairline flex items-center justify-between text-footnote">
                    <span className="text-slate-400">Option B (Inter):</span>
                    <span style={INTER_TNUM_STYLE} className="font-bold text-slate-700">
                      {kpi.val}
                    </span>
                  </div>
                )}
                <div
                  style={q8Mode === 'sf-pro' ? SF_TNUM_STYLE : INTER_TNUM_STYLE}
                  className="text-footnote text-emerald-700 font-medium mt-1"
                >
                  {kpi.sub}
                </div>
              </Card>
            ))}
          </div>

          {/* Same-Row Comparison Table */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-hairline flex items-center justify-between gap-2 bg-surface-grouped/50">
              <span className="text-subhead font-semibold text-slate-800">
                Bảng đối chiếu trực tiếp trên cùng dòng (Nhãn món SF Pro + Cột số tiền)
              </span>
              <Badge variant="neutral" size="sm">
                {q8Mode === 'compare'
                  ? 'Đang hiện cả 2 cột A & B'
                  : q8Mode === 'sf-pro'
                    ? 'Đang áp dụng Option A (SF Pro tnum)'
                    : 'Đang áp dụng Option B (Inter tnum)'}
              </Badge>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-caption text-slate-500 bg-surface-card">
                    <th className="py-2.5 px-3.5 font-semibold">Khoản mục (SF Pro UI)</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right">SL</th>
                    {(q8Mode === 'compare' || q8Mode === 'sf-pro') && (
                      <th className="py-2.5 px-3.5 font-semibold text-right text-brand-700">
                        Option A · SF Pro tnum
                      </th>
                    )}
                    {(q8Mode === 'compare' || q8Mode === 'inter') && (
                      <th className="py-2.5 px-3.5 font-semibold text-right text-slate-700">
                        Option B · Inter tnum
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline text-subhead">
                  {Q8_LEDGER_ROWS.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3.5 max-w-[220px]">
                        <div className="font-medium text-slate-900 truncate">
                          {label(row.itemShort, row.itemLong)}
                        </div>
                        <div className="text-caption text-slate-400">{row.id}</div>
                      </td>
                      <td
                        style={q8Mode === 'sf-pro' ? SF_TNUM_STYLE : INTER_TNUM_STYLE}
                        className="py-2.5 px-2.5 text-right text-slate-600 font-medium whitespace-nowrap"
                      >
                        {row.qty}
                      </td>
                      {(q8Mode === 'compare' || q8Mode === 'sf-pro') && (
                        <td
                          style={SF_TNUM_STYLE}
                          className={cn(
                            'py-2.5 px-3.5 text-right font-semibold whitespace-nowrap',
                            row.positive ? 'text-slate-900' : 'text-rose-600'
                          )}
                        >
                          <div>{row.amount}</div>
                          <div className="text-caption text-slate-400">{row.unitPrice}</div>
                        </td>
                      )}
                      {(q8Mode === 'compare' || q8Mode === 'inter') && (
                        <td
                          style={INTER_TNUM_STYLE}
                          className={cn(
                            'py-2.5 px-3.5 text-right font-semibold whitespace-nowrap',
                            row.positive ? 'text-slate-900' : 'text-rose-600'
                          )}
                        >
                          <div>{row.amount}</div>
                          <div className="text-caption text-slate-400">{row.unitPrice}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* =====================================================================
            SECTION 2: MATERIALS OVER BUSY BACKDROP + SOLID #2E1065 CART BAR (A2)
            ===================================================================== */}
        <section className="space-y-3">
          <div>
            <Badge variant="brand" size="sm" className="mb-1">
              Section 2 · Vật liệu Liquid Glass & Thanh Giỏ Hàng Đặc (A1, A2, Q3)
            </Badge>
            <h2 className="text-title-2 font-bold text-slate-900">
              Kiểm tra độ tương phản trên nền ảnh bận & Thanh POS Cart Bar đặc #2E1065
            </h2>
            <p className="text-subhead text-slate-600">
              Nền bên dưới kết hợp dải tối Espresso <code>#0F172A</code>, mảng trắng sáng <code>#FFFFFF</code>, tím đậm và cam rực để thử thách độ đọc chữ ở tình huống xấu nhất.
            </p>
          </div>

          {/* Busy Multi-Contrast Photographic/Mesh Simulation Arena */}
          <div
            className="relative rounded-panel overflow-hidden p-4 md:p-6 border border-strong space-y-4"
            style={{
              backgroundImage: [
                'radial-gradient(circle at 16% 22%, rgba(124, 58, 237, 0.92) 0%, transparent 42%)',
                'radial-gradient(circle at 84% 20%, rgba(245, 158, 11, 0.92) 0%, transparent 38%)',
                'radial-gradient(circle at 52% 82%, rgba(16, 185, 129, 0.85) 0%, transparent 44%)',
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 14px, rgba(15,23,42,0.82) 14px, rgba(15,23,42,0.82) 28px)',
              ].join(', '),
              backgroundColor: '#0F172A',
            }}
          >
            <div
              className={cn(
                'grid gap-3',
                viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              )}
            >
              {/* Glass Thin */}
              <div className="glass-thin rounded-card border p-3.5 space-y-1">
                <Badge variant="brand" size="sm">
                  glass-thin · 12px
                </Badge>
                <div className="text-headline font-semibold text-slate-900">
                  Sticky Filter / Bảng
                </div>
                <p className="text-footnote text-slate-700">
                  74% trắng · Tự động chuyển đặc <code>#F8FAFC</code> khi mở Modal/Sheet.
                </p>
              </div>

              {/* Glass Regular */}
              <div className="glass-regular rounded-card border p-3.5 space-y-1">
                <Badge variant="brand" size="sm">
                  glass-regular · 20px
                </Badge>
                <div className="text-headline font-semibold text-slate-900">
                  Top Bar / Tab Bar / Sidebar
                </div>
                <p className="text-footnote text-slate-700">
                  82% trắng · Tự động chuyển đặc <code>#FFFFFF</code> khi mở Overlay.
                </p>
              </div>

              {/* Glass Thick */}
              <div className="glass-thick rounded-card border p-3.5 space-y-1">
                <Badge variant="brand" size="sm">
                  glass-thick · 28px
                </Badge>
                <div className="text-headline font-semibold text-slate-900">
                  Sheet / Popover / Modal
                </div>
                <p className="text-footnote text-slate-700">
                  88% trắng · Giữ lớp kính duy nhất cho bề mặt tác vụ đang hoạt động.
                </p>
              </div>

              {/* Layer A Opaque Card */}
              <div className="bg-surface-card rounded-card border border-card shadow-card p-3.5 space-y-1">
                <Badge variant="success" size="sm">
                  Layer A · Opaque 0px
                </Badge>
                <div className="text-headline font-semibold text-slate-900">
                  Thẻ sản phẩm & Bảng số
                </div>
                <p className="text-footnote text-slate-600">
                  100% đặc <code>#FFFFFF</code> · Tương phản tuyệt đối, tốn 0 GPU blur.
                </p>
              </div>
            </div>

            {/* Amendment A2: Solid Tinted #2E1065 POS Quick-Cart Bar Specimen */}
            <div className="pt-2">
              <div className="surface-cart-bar rounded-full min-h-[56px] px-3 py-1.5 flex items-center justify-between gap-2 text-white">
                <div className="flex items-center gap-2.5 min-w-0 pl-1">
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 relative">
                    <ShoppingBag className="w-4 h-4 text-white" />
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-brand-400 text-slate-950 text-caption font-num font-bold">
                      4
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-caption text-brand-200 truncate">
                      {label('Tạm tính (Solid #2E1065 · 0px blur)', 'Tổng thanh toán giỏ hàng tạm tính (15.4:1 contrast)')}
                    </div>
                    <div className="font-num text-title-3 font-bold text-white leading-tight truncate">
                      1.485.000 ₫
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      showToast('success', 'Thanh toán Tiền mặt 1.485.000 ₫ (Mẫu thử)')
                    }
                    className="h-10 px-3.5 rounded-full bg-white/14 hover:bg-white/22 active:bg-white/28 border border-white/20 text-white text-footnote font-semibold transition-all active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Tiền mặt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      showToast('info', 'Mở mã VietQR 1.485.000 ₫ (Mẫu thử)')
                    }
                    className="h-10 px-4 rounded-full bg-white text-brand-950 hover:bg-brand-50 text-footnote font-bold shadow-glass-sm transition-all active:scale-[0.98] flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-brand-700" />
                    <span>VietQR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Template Backdrop-Filter Budget Table (Amendment A1) */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-hairline bg-surface-grouped/50 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-subhead font-semibold text-slate-800">
                Bảng kiểm kê ngân sách ≤ 3 lớp backdrop-filter đồng thời (Amendment A1)
              </span>
              <Badge variant="success" size="sm">
                Mọi mẫu màn hình ≤ 3/3
              </Badge>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-footnote">
                <thead>
                  <tr className="border-b border-hairline text-caption text-slate-500">
                    <th className="py-2 px-3.5 font-semibold">Mẫu màn hình</th>
                    <th className="py-2 px-3.5 font-semibold">Cấu trúc lớp kính</th>
                    <th className="py-2 px-3 font-semibold text-right">Trạng thái nghỉ</th>
                    <th className="py-2 px-3.5 font-semibold text-right">Mở Overlay + Toast</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {TEMPLATE_BUDGET_ROWS.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{r.template}</td>
                      <td className="py-2.5 px-3.5 text-slate-600">{r.layers}</td>
                      <td className="py-2.5 px-3 text-right font-num font-bold text-emerald-700">
                        {glassEnabled && !simReducedTransparency && !simHighContrast
                          ? `${r.resting} / 3`
                          : '0 / 3'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-num font-bold text-brand-700">
                        {glassEnabled && !simReducedTransparency && !simHighContrast
                          ? `${r.withOverlayAndToast} / 3`
                          : '0 / 3'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* =====================================================================
            SECTION 3: ATOMIC PRIMITIVES IN ALL 7 STATES
            ===================================================================== */}
        <section className="space-y-4">
          <div>
            <Badge variant="brand" size="sm" className="mb-1">
              Section 3 · Toàn bộ Primitives & 7 trạng thái tương tác
            </Badge>
            <h2 className="text-title-2 font-bold text-slate-900">
              Buttons, Switch, SegmentedControl, Badges, Chips, Inputs, ListGroup, Empty & Skeleton
            </h2>
          </div>

          {/* 3.1 Capsule Buttons & IconButtons */}
          <Card className="space-y-4">
            <CardHeader>
              <CardTitle>3.1 Button & IconButton (Capsule rounded-full · 44px mobile / 36px desktop)</CardTitle>
              <CardDescription>
                5 biến thể × 3 kích cỡ × đầy đủ 7 trạng thái (Default, Hover, Pressed, Focus-visible, Selected, Loading, Disabled)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Variants */}
              <div>
                <div className="text-caption text-slate-500 mb-2">5 biến thể (Variants)</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">
                    <Plus className="w-4 h-4" />
                    <span>{label('Tạo đơn mới', 'Tạo đơn bán hàng tại quầy mới')}</span>
                  </Button>
                  <Button variant="secondary">
                    {label('Xuất báo cáo', 'Xuất tệp đối soát doanh thu tháng')}
                  </Button>
                  <Button variant="soft">
                    <Tag className="w-4 h-4" />
                    <span>{label('Áp khuyến mãi', 'Áp dụng chương trình giảm giá')}</span>
                  </Button>
                  <Button variant="ghost">
                    {label('Xem chi tiết', 'Xem lịch sử chỉnh sửa công thức')}
                  </Button>
                  <Button variant="danger">
                    <Trash2 className="w-4 h-4" />
                    <span>{label('Hủy hóa đơn', 'Hủy hóa đơn & hoàn quỹ tiền mặt')}</span>
                  </Button>
                </div>
              </div>

              <Divider />

              {/* 7 States Matrix */}
              <div>
                <div className="text-caption text-slate-500 mb-2">
                  7 trạng thái bắt buộc (Default · Hover · Pressed · Focus-visible · Selected · Loading · Disabled)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">1. Mặc định</Button>
                  <Button variant="primary" className="bg-brand-700 border-brand-800">
                    2. Hover
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-brand-800 scale-[0.98] shadow-none"
                  >
                    3. Đang nhấn (Pressed)
                  </Button>
                  <Button
                    variant="secondary"
                    className="ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas"
                  >
                    4. Focus-visible
                  </Button>
                  <Button variant="secondary" selected>
                    <Check className="w-4 h-4" />
                    <span>5. Đã chọn (Selected)</span>
                  </Button>
                  <Button variant="primary" isLoading>
                    6. Đang xử lý
                  </Button>
                  <Button variant="primary" disabled>
                    7. Vô hiệu (Disabled)
                  </Button>
                </div>
              </div>

              <Divider />

              {/* Sizes & IconButtons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary">
                    Cỡ nhỏ (sm)
                  </Button>
                  <Button size="md" variant="secondary">
                    Cỡ chuẩn (md · 44px)
                  </Button>
                  <Button size="lg" variant="primary">
                    Cỡ lớn CTA (lg · 48px)
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <IconButton size="sm" variant="secondary" aria-label="Thông báo nhỏ">
                    <Bell className="w-3.5 h-3.5" />
                  </IconButton>
                  <IconButton size="md" variant="soft" selected aria-label="Bộ lọc đã chọn">
                    <SlidersHorizontal className="w-4 h-4" />
                  </IconButton>
                  <IconButton size="md" variant="secondary" isLoading aria-label="Đang tải">
                    <RefreshCw className="w-4 h-4" />
                  </IconButton>
                  <IconButton size="lg" variant="danger" disabled aria-label="Xóa bị khóa">
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3.2 Switch, Badges, Chips & Dividers */}
          <div
            className={cn(
              'grid gap-3.5',
              viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
            )}
          >
            {/* Switch States */}
            <Card className="space-y-3">
              <CardHeader>
                <CardTitle>3.2 Switch (Opaque Capsule 44×26px · Vùng chạm ≥ 44px)</CardTitle>
                <CardDescription>
                  Dùng cho Cài đặt hệ thống & công tắc Hiệu ứng kính trên từng thiết bị (Q3)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Switch
                  checked={glassEnabled}
                  onCheckedChange={handleToggleGlass}
                  label={label(
                    'Hiệu ứng kính (Liquid Glass)',
                    'Bật hiệu ứng kính mờ Liquid Glass trên thanh điều hướng thiết bị này'
                  )}
                  description="Lưu riêng trên thiết bị này qua localStorage (Override Q3)"
                />
                <Divider />
                <Switch
                  checked={switchDemoA}
                  onCheckedChange={setSwitchDemoA}
                  label={label('Tự động in hóa đơn nhiệt', 'Tự động mở hộp thoại in hóa đơn khổ 80mm sau khi thanh toán')}
                />
                <Switch
                  checked={switchDemoB}
                  onCheckedChange={setSwitchDemoB}
                  isLoading
                  label="Đang đồng bộ cấu hình (Loading)"
                />
                <div className="flex items-center gap-4 pt-1">
                  <Switch
                    checked={false}
                    onCheckedChange={() => {}}
                    disabled
                    aria-label="Tắt bị khóa"
                  />
                  <Switch
                    checked={true}
                    onCheckedChange={() => {}}
                    disabled
                    aria-label="Bật bị khóa"
                  />
                  <span className="text-footnote text-slate-500">Trạng thái Disabled (Off / On)</span>
                </div>
              </CardContent>
            </Card>

            {/* Badges, Chips & Dividers */}
            <Card>
              <CardHeader>
                <CardTitle>3.3 Badge (Sàn cứng ≥ 11px), Chip & Divider</CardTitle>
                <CardDescription>
                  Không còn chữ siêu nhỏ 9px / 10px; mọi huy hiệu đều đặc (0px blur)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="neutral">Trung tính</Badge>
                  <Badge variant="brand">Thương hiệu</Badge>
                  <Badge variant="success">Đã thu tiền</Badge>
                  <Badge variant="warning">Chờ đối soát</Badge>
                  <Badge variant="danger">Đã hủy</Badge>
                  <Badge variant="info">Chuyển khoản</Badge>
                  <Badge variant="brand" dot>
                    Đang mở ca
                  </Badge>
                </div>

                <Divider label="Bộ lọc Chip & FilterPill" />

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', text: label('Tất cả', 'Tất cả nhóm thực đơn'), count: 42 },
                    { id: 'coffee', text: label('Cà phê máy', 'Cà phê Espresso & Phin truyền thống'), count: 14 },
                    { id: 'tea', text: label('Trà trái cây', 'Trà trái cây tươi nhiệt đới'), count: 18 },
                  ].map((c) => (
                    <Chip
                      key={c.id}
                      active={activeChip === c.id}
                      count={c.count}
                      onClick={() => setActiveChip(c.id)}
                    >
                      {c.text}
                    </Chip>
                  ))}
                  <FilterPill
                    label="Kênh bán"
                    value="Tại quầy"
                    active
                    count={2}
                    onOpen={() => showToast('info', 'Đã bấm mở FilterPill mẫu')}
                    onClear={() => showToast('info', 'Đã xóa FilterPill mẫu')}
                  />
                  <Chip active onRemove={() => showToast('info', 'Đã gỡ thẻ lọc mẫu')}>
                    Có thể gỡ
                  </Chip>
                  <Chip disabled>Chip khóa</Chip>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3.4 Selectable Cards, Inputs & Proposed Compact Modifier */}
          <div
            className={cn(
              'grid gap-3.5',
              viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
            )}
          >
            {/* Interactive / Selected Card */}
            <div className="space-y-2.5">
              <div className="text-subhead font-semibold text-slate-700 px-1">
                3.4 Card tương tác (Default vs Selected vs Muted)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Card
                  interactive
                  selected={selectedCard === 'vietqr'}
                  onClick={() => setSelectedCard('vietqr')}
                  className="p-4"
                >
                  <div className="flex items-center justify-between">
                    <QrCode className="w-5 h-5 text-brand-600" />
                    <Badge variant={selectedCard === 'vietqr' ? 'brand' : 'neutral'} size="sm">
                      {selectedCard === 'vietqr' ? 'Đang chọn' : 'Chạm để chọn'}
                    </Badge>
                  </div>
                  <div className="text-headline font-semibold text-slate-900 mt-2">
                    Chuyển khoản VietQR
                  </div>
                  <div className="font-num text-footnote text-slate-500 mt-0.5">
                    0% phí · Tự động khớp mã
                  </div>
                </Card>

                <Card
                  interactive
                  selected={selectedCard === 'cash'}
                  onClick={() => setSelectedCard('cash')}
                  className="p-4"
                >
                  <div className="flex items-center justify-between">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <Badge variant={selectedCard === 'cash' ? 'brand' : 'neutral'} size="sm">
                      {selectedCard === 'cash' ? 'Đang chọn' : 'Chạm để chọn'}
                    </Badge>
                  </div>
                  <div className="text-headline font-semibold text-slate-900 mt-2">
                    Tiền mặt tại quầy
                  </div>
                  <div className="font-num text-footnote text-slate-500 mt-0.5">
                    Quỹ ca sáng: 2.500.000 ₫
                  </div>
                </Card>
              </div>
            </div>

            {/* Form Controls & Proposed Compact Modifier */}
            <Card className="space-y-3">
              <CardHeader>
                <CardTitle>3.5 FieldShell, .app-input (44px / 16px) & Đề xuất Compact</CardTitle>
                <CardDescription>
                  16px trên mobile ngăn iOS Safari tự phóng to trang khi chạm ô nhập
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FieldShell
                  label={label('Tên món bán (Sentence case)', 'Tên hiển thị đầy đủ trên thực đơn thu ngân')}
                  required
                  hint="Nhãn sentence-case tự nhiên, không còn IN HOA toàn bộ"
                >
                  <input
                    type="text"
                    defaultValue="Trà đào cam sả đặc biệt"
                    className="app-input"
                  />
                </FieldShell>

                <div className="grid grid-cols-2 gap-2.5">
                  <FieldShell label="Ô báo lỗi (Error)" error="Giá bán phải > 0 ₫">
                    <input
                      type="text"
                      defaultValue="0 ₫"
                      className="app-input font-num border-rose-400 focus:border-rose-600"
                    />
                  </FieldShell>
                  <FieldShell label="Ô bị khóa (Disabled)">
                    <input
                      type="text"
                      disabled
                      defaultValue="SKU-0042"
                      className="app-input font-num opacity-60 cursor-not-allowed bg-slate-50"
                    />
                  </FieldShell>
                </div>

                {/* Proposed Compact Row Preview for Pre-Step Dense BOM / Table Rows */}
                <div className="p-2.5 rounded-field bg-surface-grouped/80 border border-hairline space-y-1.5">
                  <div className="text-caption text-brand-700">
                    Xem trước đề xuất Pre-Step: Dòng bảng dày đặc (Compact h-8 khớp ModernSelect sm)
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                      <ModernSelect
                        size="sm"
                        options={selectOptions}
                        value={compactSelectVal}
                        onChange={setCompactSelectVal}
                      />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        defaultValue="250 ml"
                        aria-label="Định lượng compact"
                        className="w-full h-8 px-2.5 text-base md:text-xs font-num bg-surface-card border border-slate-300/80 rounded-sm-tahoe text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3.6 ListGroup, EmptyState & Skeleton */}
          <div
            className={cn(
              'grid gap-3.5',
              viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
            )}
          >
            <ListGroup
              header={label('Cấu hình cửa hàng & Định lượng', 'Danh sách nhóm cài đặt vận hành chi nhánh & định lượng')}
              footer="Mọi dòng danh sách đạt chiều cao tối thiểu 48px trên điện thoại, phân tách bằng đường kẻ mảnh inset hairline."
            >
              <ListRow
                leading={<Store className="w-4 h-4" />}
                title={label('RabbitPOS — Chi nhánh Quận 1', 'RabbitPOS Flagship — 128 Nguyễn Huệ, Quận 1, TP.HCM')}
                subtitle="Đang hoạt động · Tiền tệ: VNĐ (₫)"
                value="Mặc định"
                selected
                chevron
                onClick={() => showToast('info', 'Đã chạm dòng Chi nhánh Quận 1')}
              />
              <ListRow
                leading={<Package className="w-4 h-4" />}
                title={label('Giá vốn bình quân công thức', 'Tỷ suất giá vốn nguyên liệu định lượng trung bình')}
                subtitle="Cập nhật từ 18 phiếu nhập hàng tháng này"
                value="33,2%"
                chevron
                onClick={() => showToast('info', 'Đã chạm dòng Giá vốn công thức')}
              />
              <ListRow
                leading={<Flame className="w-4 h-4" />}
                title="Dòng bị vô hiệu hóa (Disabled)"
                subtitle="Chỉ dành cho tài khoản SuperAdmin"
                value="Khóa"
                disabled
              />
              <ListRow
                leading={<Trash2 className="w-4 h-4" />}
                title="Xóa bộ nhớ đệm ngoại tuyến (Destructive)"
                destructive
                onClick={() => showToast('warning', 'Mẫu dòng thao tác nguy hiểm')}
              />
            </ListGroup>

            <div className="space-y-3">
              <EmptyState
                compact
                surface="card"
                icon={<Receipt className="w-5 h-5" />}
                title={label('Chưa có phiếu thu chi nào', 'Chưa phát sinh giao dịch thu chi nào trong khung thời gian đã chọn')}
                description="Tạo phiếu thu/chi đầu tiên hoặc đổi bộ lọc ngày để xem lịch sử sổ quỹ."
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => showToast('success', 'Đã bấm nút hành động trong EmptyState')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo phiếu mới</span>
                  </Button>
                }
              />
              <SkeletonCard lines={2} />
              <SkeletonListGroup rows={2} />
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 4: INTERACTIVE OVERLAYS, SHEET DRAG (Q6) & PENDING LOCK (Q5)
            ===================================================================== */}
        <section className="space-y-4">
          <div>
            <Badge variant="brand" size="sm" className="mb-1">
              Section 4 · Overlays, Kéo đóng Sheet (Q6) & Khóa chống bấm đúp tiền tệ (Q5)
            </Badge>
            <h2 className="text-title-2 font-bold text-slate-900">
              FilterBar, ModernSelect, ModernDateRangePicker, ResponsiveSheet, ModalShell & ConfirmModal
            </h2>
          </div>

          {/* 4.1 FilterBar + ModernSelect + ModernDateRangePicker */}
          <Card className="p-4 space-y-4">
            <FilterBar
              searchValue={filterSearch}
              onSearchChange={setFilterSearch}
              searchPlaceholder={label('Tìm món, mã đơn, ghi chú...', 'Tìm kiếm theo tên nguyên liệu, mã chứng từ hoặc nhà cung cấp...')}
              activeFiltersCount={2}
              onReset={() => setFilterSearch('')}
              onApply={() => showToast('success', 'Đã áp dụng bộ lọc mẫu')}
              filters={
                <div className="w-full md:w-64">
                  <ModernSelect
                    searchable
                    clearable
                    options={selectOptions}
                    value={selectVal}
                    onChange={(val) => setSelectVal(val || 'arabica')}
                    title="Chọn nguyên liệu định lượng"
                  />
                </div>
              }
              actionsSlot={
                <ModernDateRangePicker
                  period={dateFilter.period}
                  customFrom={dateFilter.from}
                  customTo={dateFilter.to}
                  onChange={setDateFilter}
                />
              }
              chipsSlot={
                <>
                  <Chip active count={18}>
                    Tất cả phiếu
                  </Chip>
                  <Chip count={12}>Phiếu thu bán hàng</Chip>
                  <Chip count={6}>Phiếu nhập nguyên liệu</Chip>
                </>
              }
            />
          </Card>

          {/* 4.2 Interactive Overlay & Financial Lock Test Bench */}
          <div
            className={cn(
              'grid gap-3.5',
              viewportMode === 'mobile390' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
            )}
          >
            {/* Test 1: ResponsiveSheet Header-Only Drag (Override Q6) */}
            <Card className="p-4 flex flex-col justify-between gap-3">
              <div>
                <Badge variant="info" size="sm" className="mb-1.5">
                  Override Q6 · z-75 / z-70
                </Badge>
                <h3 className="text-headline font-semibold text-slate-900">
                  ResponsiveSheet kéo đóng ở thanh đầu
                </h3>
                <p className="text-footnote text-slate-600 mt-1">
                  Trên điện thoại (&lt;768px): vuốt cuộn danh sách 20 nguyên liệu bên trong thoải mái mà không bị đóng nhầm; kéo thanh grabber/tiêu đề trên cùng xuống &gt;72px để đóng mượt.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setIsSheetOpen(true)}
                className="w-full"
              >
                Mở Sheet kiểm tra kéo & cuộn
              </Button>
            </Card>

            {/* Test 2: ModalShell + Nested Demotion (Amendment A1) */}
            <Card className="p-4 flex flex-col justify-between gap-3">
              <div>
                <Badge variant="brand" size="sm" className="mb-1.5">
                  Amendment A1 · z-50 → z-60 → z-80
                </Badge>
                <h3 className="text-headline font-semibold text-slate-900">
                  Modal lồng nhau tự hạ kính về nền đặc
                </h3>
                <p className="text-footnote text-slate-600 mt-1">
                  Mở Modal cha (<code>z-50</code>), sau đó bấm mở Modal con (<code>z-60</code>) hoặc ConfirmDialog (<code>z-80</code>): Modal cha tự động tắt blur chuyển sang trắng đặc.
                </p>
              </div>
              <Button
                variant="soft"
                onClick={() => setIsParentModalOpen(true)}
                className="w-full"
              >
                Mở Modal cha (z-50)
              </Button>
            </Card>

            {/* Test 3: Override Q5 Financial Pending Lock + Toast Budget */}
            <Card className="p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Badge variant="danger" size="sm">
                    Override Q5 · z-80 + z-90
                  </Badge>
                  <span className="text-caption font-num text-slate-600">
                    Số lần thực thi: <strong>{confirmExecutionCount}</strong>
                  </span>
                </div>
                <h3 className="text-headline font-semibold text-slate-900">
                  Khóa chống bấm đúp giao dịch tiền
                </h3>
                <p className="text-footnote text-slate-600 mt-1">
                  Kiểm chứng khóa đồng bộ <code>confirmingRef</code> + xử lý lỗi mạng an toàn + chồng 3 Toast chỉ giữ tối đa 1 lớp kính.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void triggerFinancialConfirmSuccess()}
                  className="w-full"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Hủy đơn 1,5s (Chống bấm đúp)</span>
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void triggerFinancialConfirmFailure()}
                  >
                    Mô phỏng lỗi
                  </Button>
                  <Button variant="secondary" size="sm" onClick={fireStackedToasts}>
                    Bắn 3 Toast
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>

      {/* ─── Interactive ResponsiveSheet Demo (Override Q6) ─── */}
      <ResponsiveSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        triggerRef={sheetTriggerRef}
        detent="large"
        width="w-96"
        title="Chọn nguyên liệu nhập kho (Kéo thanh này xuống để đóng)"
        description="Vuốt danh sách bên dưới không gây đóng nhầm sheet (Override Q6)"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsSheetOpen(false)}>
              Đóng
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsSheetOpen(false);
                showToast('success', 'Đã xác nhận chọn nguyên liệu từ ResponsiveSheet');
              }}
            >
              Xác nhận chọn
            </Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          {Array.from({ length: 18 }).map((_, idx) => (
            <div
              key={idx}
              className="min-h-[48px] px-3.5 py-2.5 rounded-field bg-surface-card border border-card flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Coffee className="w-4 h-4 text-brand-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-subhead font-medium text-slate-900 truncate">
                    Nguyên liệu mẫu #{idx + 1} — Hạt Arabica Cầu Đất
                  </div>
                  <div className="text-caption text-slate-500">
                    1 Bao = 10 Túi · Hao hụt rang 15%
                  </div>
                </div>
              </div>
              <span className="font-num text-subhead font-semibold text-slate-800 shrink-0">
                {(185000 + idx * 15000).toLocaleString('vi-VN')} ₫
              </span>
            </div>
          ))}
        </div>
      </ResponsiveSheet>

      {/* ─── Interactive Parent ModalShell (z-50) + Nested Child ModalShell (z-60) ─── */}
      <ModalShell
        isOpen={isParentModalOpen}
        onClose={() => setIsParentModalOpen(false)}
        size="md"
        icon={<TrendingUp className="w-5 h-5" />}
        title="Modal tác vụ cha (z-modal: 50)"
        description="Khi bạn bấm mở Modal con (z-60) hoặc ConfirmModal (z-80) bên dưới, mặt kính của Modal cha này tự động chuyển thành nền đặc #FFFFFF (0px blur)."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => void triggerFinancialConfirmSuccess()}
            >
              Mở ConfirmModal (z-80) đè lên
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsParentModalOpen(false)}>
                Đóng
              </Button>
              <Button variant="primary" onClick={() => setIsNestedModalOpen(true)}>
                Mở Modal con (z-60)
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <Card className="p-3.5">
            <div className="flex items-center gap-2 text-subhead font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Kiểm chứng Amendment A1 trực tiếp</span>
            </div>
            <p className="text-footnote text-slate-600 mt-1 leading-relaxed">
              Nhìn lên thanh Header của trang Gallery phía sau màn mờ: hiện tại{' '}
              <code>html[data-overlay-open=&quot;true&quot;]</code> đang bật, nên thanh Header trang đã hạ xuống nền trắng đặc (0px blur). Tổng số lớp kính mờ trên toàn màn hình hiện chỉ là{' '}
              <strong className="font-num">{measuredActiveBlurNodes} / 3</strong>.
            </p>
          </Card>

          <ListGroup header="Tóm tắt phiếu nhập mẫu">
            <ListRow title="Tổng tiền hàng trước quy đổi" value="4.250.000 ₫" />
            <ListRow title="Chi phí vận chuyển phân bổ" value="150.000 ₫" />
            <ListRow title="Tổng thanh toán phiếu nhập" value="4.400.000 ₫" selected />
          </ListGroup>
        </div>
      </ModalShell>

      <ModalShell
        isOpen={isNestedModalOpen}
        onClose={() => setIsNestedModalOpen(false)}
        nested
        size="sm"
        title="Modal con lồng bên trên (z-modal-nested: 60)"
        description="Modal cha z-50 bên dưới đã tự động gắn data-under-nested-overlay='true' và tắt backdrop-filter!"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setIsNestedModalOpen(false)}>
              Đóng Modal con (Nhấn Escape chỉ đóng lớp này)
            </Button>
          </div>
        }
      >
        <p className="text-subhead text-slate-700 leading-relaxed">
          Nhấn phím <strong>Escape</strong> lúc này sẽ chỉ đóng Modal con <code>z-60</code> (nhờ cơ chế <code>isTopmostOverlay</code>), giữ nguyên Modal cha <code>z-50</code> và tự động trả lại hiệu ứng kính cho Modal cha!
        </p>
      </ModalShell>
    </div>
  );
}
