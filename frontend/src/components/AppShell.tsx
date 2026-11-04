'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InstallPWABanner from '@/components/common/InstallPWABanner';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Package,
  Wallet,
  LayoutDashboard,
  LogOut,
  Shield,
  User,
  Settings,
  Tag,
  ShoppingBag,
  ChevronDown,
  Globe,
  Store as StoreIcon,
  Users,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  WifiOff,
  Truck,
} from 'lucide-react';
import SalesChannelModal from '@/components/common/SalesChannelModal';
import { fetchApi, getImageUrl } from '@/lib/api';
import { getAuthUser, isAuthenticated, isMasterRole, isOwnerRole, logout as authLogout, UserInfo } from '@/lib/auth';
import {
  GLASS_EFFECTS_CHANGE_EVENT,
  syncGlassEffectsClass,
} from '@/lib/featureFlags';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useStore } from '@/lib/StoreContext';
import { cn } from '@/lib/cn';
import StoreSwitcher from '@/components/StoreSwitcher';
import {
  Badge,
  Button,
  Divider,
  ListGroup,
  ListRow,
  ResponsiveSheet,
  SegmentedControl,
} from '@/components/ui';

interface HealthData {
  app: string;
  version: string;
  db_connected: boolean;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'rabbitpos_sidebar_collapsed';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { activeStore, isSuperAdmin, storeRole } = useStore();
  const network = useNetworkStatus();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isPromotionsQueryOpen, setIsPromotionsQueryOpen] = useState<boolean>(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState<boolean>(false);

  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const inlineTitleRef = useRef<HTMLDivElement>(null);

  const isMaster = isMasterRole(currentUser?.role) || isSuperAdmin;
  const isOwner = isOwnerRole(currentUser?.role) || storeRole === 'store_admin';
  const canManageStore = isMaster || isOwner;
  const canManageUsers = isMaster || isOwner;

  // Effect 1: App Mount Only (Initial Health check + Background 60s health monitor + Glass & Sidebar prefs)
  useEffect(() => {
    setMounted(true);

    // Sync per-device Liquid Glass preference (Override Q3)
    syncGlassEffectsClass();

    const handleGlassChange = () => {
      syncGlassEffectsClass();
    };

    const reducedTransMq = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const contrastMq = window.matchMedia('(prefers-contrast: more)');
    window.addEventListener(GLASS_EFFECTS_CHANGE_EVENT, handleGlassChange);
    reducedTransMq.addEventListener('change', handleGlassChange);
    contrastMq.addEventListener('change', handleGlassChange);

    // Initialize collapsible sidebar state (Override Q2: 68px rail on 768-1023px, 240px on >= 1024px)
    const desktopMq = window.matchMedia('(min-width: 1024px)');
    const storedCollapse = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (storedCollapse === 'true' || storedCollapse === 'false') {
      setSidebarCollapsed(storedCollapse === 'true');
    } else {
      setSidebarCollapsed(!desktopMq.matches);
    }

    const handleDesktopBreakpointChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === null) {
        setSidebarCollapsed(!e.matches);
      }
    };
    desktopMq.addEventListener('change', handleDesktopBreakpointChange);

    const loadInitialData = async () => {
      try {
        const hRes = await fetchApi<HealthData>('/health');
        if (hRes.status === 'success') {
          setHealth(hRes.data);
          setError(null);
        } else {
          setError(hRes.message);
        }
      } catch (err: any) {
        setError(err.message || 'Không thể kết nối máy chủ');
      }
    };

    loadInitialData();

    // Silent background health polling every 60s without blocking UI
    const interval = setInterval(async () => {
      try {
        const res = await fetchApi<HealthData>('/health', { skipCache: true });
        if (res.status === 'success') {
          setHealth(res.data);
          setError(null);
        } else {
          setError(res.message);
        }
      } catch {
        // Silent background check
      }
    }, 60_000);

    return () => {
      clearInterval(interval);
      window.removeEventListener(GLASS_EFFECTS_CHANGE_EVENT, handleGlassChange);
      reducedTransMq.removeEventListener('change', handleGlassChange);
      contrastMq.removeEventListener('change', handleGlassChange);
      desktopMq.removeEventListener('change', handleDesktopBreakpointChange);
    };
  }, []);

  // Effect 2: Fast synchronous route & auth guard (Runs on pathname change, 0ms, 0 network requests)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const u = getAuthUser();
    setCurrentUser(u);

    // Role Guard Check: Restrict Staff from Store Management & Admin routes
    if (!canManageStore) {
      const adminRoutes = ['/products', '/purchases', '/promotions', '/funds', '/settings', '/stores', '/users'];
      if (adminRoutes.some((route) => pathname.startsWith(route))) {
        router.push('/');
        return;
      }
    }

    // Restrict non-super-admins from /stores
    if (pathname.startsWith('/stores') && !isSuperAdmin) {
      router.push('/');
    }
  }, [pathname, router, canManageStore, isSuperAdmin]);

  // Effect 3: Client query check for /products?open=promotions without un-suspended useSearchParams()
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncPromoQuery = () => {
      const params = new URLSearchParams(window.location.search);
      setIsPromotionsQueryOpen(params.get('open') === 'promotions');
    };
    syncPromoQuery();
    window.addEventListener('popstate', syncPromoQuery);
    return () => window.removeEventListener('popstate', syncPromoQuery);
  }, [pathname]);

  // Effect 4: Passive scroll listener for Large-Title -> Inline Top Bar Title fade (Override Q4, 0 React re-renders)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateScrollState = () => {
      const scrolled = window.scrollY > 48;
      if (headerRef.current) {
        headerRef.current.dataset.scrolled = scrolled ? 'true' : 'false';
      }
      if (inlineTitleRef.current) {
        inlineTitleRef.current.classList.toggle('opacity-100', scrolled);
        inlineTitleRef.current.classList.toggle('opacity-0', !scrolled);
      }
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, [pathname]);

  const handleLogout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' });
    authLogout();
    router.push('/login');
  };

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  // Navigate to Promotions reliably even when already standing on /products
  const handleNavigatePromotions = useCallback(
    (e?: React.MouseEvent) => {
      setIsMoreSheetOpen(false);
      setIsUserMenuOpen(false);
      if (pathname === '/products') {
        e?.preventDefault();
        setIsPromotionsQueryOpen(true);
        router.push('/promotions');
      } else {
        setIsPromotionsQueryOpen(true);
        if (!e) {
          router.push('/products?open=promotions');
        }
      }
    },
    [pathname, router]
  );

  // Route Title Lookup for Inline Scroll-Fade Header (Override Q4; POS '/' has no Large Title)
  const activeRouteTitle = useMemo(() => {
    if (pathname === '/') return '';
    if (pathname.startsWith('/transactions') || pathname.startsWith('/funds')) return t('nav.transactions');
    if (pathname.startsWith('/purchases')) return t('nav.purchases');
    if (pathname.startsWith('/dashboard')) return t('nav.dashboard');
    if (pathname.startsWith('/promotions') || (pathname === '/products' && isPromotionsQueryOpen)) {
      return t('nav.promotions');
    }
    if (pathname.startsWith('/products')) return t('nav.menu_catalog');
    if (pathname.startsWith('/users')) return t('nav.staff_management');
    if (pathname.startsWith('/settings')) return t('nav.system_settings');
    if (pathname.startsWith('/stores')) return t('nav.store_chain');
    return '';
  }, [pathname, isPromotionsQueryOpen, t]);

  // Group A: Daily Operations (4 primary destinations for admin & SuperAdmin)
  const primaryOpsItems = useMemo(
    () => [
      {
        id: 'pos',
        label: t('nav.pos_short'),
        sidebarLabel: t('nav.pos_short'),
        href: '/',
        icon: ShoppingCart,
        isActive: pathname === '/',
      },
      {
        id: 'transactions',
        label: t('nav.transactions_short'),
        sidebarLabel: t('nav.transactions_short'),
        href: '/transactions',
        icon: Wallet,
        isActive: pathname.startsWith('/transactions') || pathname.startsWith('/funds'),
      },
      {
        id: 'purchases',
        label: t('nav.purchases_short'),
        sidebarLabel: t('nav.purchases'),
        href: '/purchases',
        icon: ShoppingBag,
        isActive: pathname.startsWith('/purchases'),
      },
      {
        id: 'dashboard',
        label: t('nav.dashboard_short'),
        sidebarLabel: t('nav.dashboard_short'),
        href: '/dashboard',
        icon: LayoutDashboard,
        isActive: pathname.startsWith('/dashboard'),
      },
    ],
    [pathname, t]
  );

  // Group B: Catalog & Administration (More Sheet on <768px / Sidebar Group B on >=768px)
  const managementItems = useMemo(
    () => [
      {
        id: 'products',
        label: t('nav.menu_catalog'),
        href: '/products',
        icon: Package,
        visible: canManageStore,
        isActive: pathname === '/products' && !isPromotionsQueryOpen,
        isPromotions: false,
      },
      {
        id: 'promotions',
        label: t('nav.promotions'),
        href: '/products?open=promotions',
        icon: Tag,
        visible: canManageStore,
        isActive: pathname.startsWith('/promotions') || (pathname === '/products' && isPromotionsQueryOpen),
        isPromotions: true,
      },
      {
        id: 'users',
        label: t('nav.staff_management'),
        href: '/users',
        icon: Users,
        visible: canManageUsers,
        isActive: pathname.startsWith('/users'),
        isPromotions: false,
      },
      {
        id: 'stores',
        label: t('nav.store_chain'),
        href: '/stores',
        icon: StoreIcon,
        visible: isSuperAdmin,
        isActive: pathname.startsWith('/stores'),
        isPromotions: false,
      },
      {
        id: 'channels',
        label: 'Kênh bán hàng',
        href: '#channels',
        icon: Truck,
        visible: canManageStore,
        isActive: false,
        isPromotions: false,
        isChannels: true,
      },
    ].filter((item) => item.visible),
    [canManageStore, canManageUsers, isSuperAdmin, pathname, isPromotionsQueryOpen, t]
  );

  const isMoreRouteActive = useMemo(
    () => managementItems.some((item) => item.isActive),
    [managementItems]
  );

  if (!mounted) return null;

  const currentStoreName = activeStore?.name || t('common.app_title');
  const isServerOnline = network.isOnline && (!error || Boolean(health?.db_connected));
  const roleShortLabel = isSuperAdmin
    ? t('nav.role_super_admin_short')
    : canManageStore
      ? t('nav.role_owner_short')
      : t('nav.role_staff_short');

  const shellSidebarWidth = canManageStore ? (sidebarCollapsed ? '68px' : '240px') : '0px';

  return (
    <div
      className="flex flex-col flex-1 min-h-0 w-full max-w-full bg-canvas text-slate-900"
      style={{ '--shell-sidebar-w': shellSidebarWidth } as React.CSSProperties}
    >
      {/* =====================================================================
          TOP APPLICATION TOOLBAR (z-shell-bar: 30, glass-regular, pt-safe)
          Demotes automatically to opaque #FFFFFF when html[data-overlay-open="true"]
         ===================================================================== */}
      <header
        ref={headerRef}
        data-scrolled="false"
        className="sticky top-0 z-shell-bar glass-regular border-b border-glass pt-safe w-full"
      >
        <div className="w-full h-[52px] md:h-14 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2">
          {/* Left Slot: Brand Logo + Store Switcher */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
            <Link
              href="/"
              onClick={() => setIsPromotionsQueryOpen(false)}
              className="inline-flex items-center gap-2 min-h-[44px] md:min-h-[36px] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97] transition duration-press ease-press shrink-0"
              aria-label={currentStoreName}
            >
              {activeStore?.logo_url ? (
                <img
                  src={getImageUrl(activeStore.logo_url) || activeStore.logo_url}
                  alt={currentStoreName}
                  className="h-8 w-8 sm:h-9 sm:w-9 object-contain rounded-sm-tahoe bg-surface-card border border-card p-0.5 shadow-card shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-sm-tahoe bg-brand-600/10 border border-brand-200/70 p-1 shrink-0">
                  <img
                    src="/icons/rabbitpos_logo.png"
                    alt="RabbitPOS"
                    className="h-6 w-6 object-contain"
                  />
                </div>
              )}
              <div className="hidden xl:flex flex-col justify-center min-w-0 text-left">
                <span className="text-subhead font-bold text-slate-900 truncate max-w-[200px] 2xl:max-w-[260px]">
                  {currentStoreName}
                </span>
                <span className="text-caption text-slate-500 font-medium leading-tight">
                  {t('common.app_title')}
                </span>
              </div>
            </Link>

            <StoreSwitcher />
          </div>

          {/* Center Slot:
              - Role staff (!canManageStore): Inline 2-pill POS | Thu chi capsule (Reachability Matrix §2.4)
              - Role admin / SuperAdmin: Passive scroll-fade inline route title (Override Q4) */}
          {!canManageStore ? (
            <nav
              aria-label="Cashier navigation"
              className="inline-flex items-center p-0.5 bg-surface-grouped border border-hairline rounded-full shrink-0"
            >
              <Link
                href="/"
                prefetch={true}
                className={cn(
                  'min-h-[44px] md:min-h-[34px] min-w-[44px] px-2.5 sm:px-3.5 rounded-full inline-flex items-center justify-center gap-1.5 text-footnote font-semibold transition duration-press ease-press active:scale-[0.97]',
                  pathname === '/'
                    ? 'bg-surface-card text-brand-700 shadow-glass-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                <span>{t('nav.pos_short')}</span>
              </Link>
              <Link
                href="/transactions"
                prefetch={true}
                className={cn(
                  'min-h-[44px] md:min-h-[34px] min-w-[44px] px-2.5 sm:px-3.5 rounded-full inline-flex items-center justify-center gap-1.5 text-footnote font-semibold transition duration-press ease-press active:scale-[0.97]',
                  pathname.startsWith('/transactions')
                    ? 'bg-surface-card text-brand-700 shadow-glass-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                <span>{t('nav.transactions_short')}</span>
              </Link>
            </nav>
          ) : (
            <div
              ref={inlineTitleRef}
              aria-hidden={!activeRouteTitle}
              className="pointer-events-none flex-1 min-w-0 px-2 text-center opacity-0 transition-opacity duration-snappy ease-spring-snappy"
            >
              {activeRouteTitle && (
                <span className="text-headline font-semibold text-slate-900 truncate inline-block max-w-full align-middle">
                  {activeRouteTitle}
                </span>
              )}
            </div>
          )}

          {/* Right Slot: Online/Offline Health Indicator + User Profile Capsule */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Online / Offline Status Pill */}
            {isServerOnline ? (
              <div
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 h-8 rounded-full bg-surface-card/90 border border-card shadow-card select-none"
                title={t('nav.status_online')}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="hidden lg:inline text-caption font-semibold text-slate-700">
                  {t('nav.status_online')}
                </span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-amber-50 border border-amber-300/80 text-amber-900 select-none"
                title={error || t('nav.status_offline')}
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="hidden sm:inline text-caption font-semibold">
                  {t('nav.status_offline')}
                </span>
              </div>
            )}

            {/* User Profile Capsule Trigger */}
            <div className="relative shrink-0">
              <button
                ref={userMenuTriggerRef}
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="inline-flex items-center gap-2 bg-surface-card/90 hover:bg-surface-card border border-card min-h-[44px] min-w-[44px] md:min-h-[36px] px-2 sm:px-2.5 rounded-full shadow-card transition duration-press ease-press cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-[0.97]"
                aria-expanded={isUserMenuOpen}
                aria-label={currentUser?.username || 'User menu'}
              >
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-caption uppercase shrink-0">
                  {currentUser?.username ? (
                    currentUser.username.slice(0, 2)
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="hidden sm:flex flex-col min-w-0 max-w-[110px] justify-center text-left">
                  <span className="font-semibold text-footnote leading-tight text-slate-900 truncate">
                    {currentUser?.username || 'User'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium leading-tight truncate mt-0.5">
                    {roleShortLabel}
                  </span>
                </div>
                <ChevronDown
                  className={`hidden sm:block w-3.5 h-3.5 text-slate-500 transition-transform duration-snappy ease-spring-snappy shrink-0 ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* User Menu ResponsiveSheet (z-75 mobile sheet / z-70 desktop anchored popover) */}
              <ResponsiveSheet
                isOpen={isUserMenuOpen}
                onClose={() => setIsUserMenuOpen(false)}
                triggerRef={userMenuTriggerRef}
                exclusiveId="user-menu"
                align="end"
                width="w-80"
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-subhead shrink-0 shadow-sm">
                      {currentUser?.username ? (
                        currentUser.username.slice(0, 2).toUpperCase()
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-semibold text-headline text-slate-900 truncate leading-snug">
                        {currentUser?.username}
                      </p>
                      <div className="mt-1 flex items-center">
                        <Badge variant={isMaster ? 'brand' : isOwner ? 'info' : 'neutral'}>
                          <Shield className="w-3 h-3 mr-1" />
                          {roleShortLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                }
                footer={
                  <Button
                    variant="danger"
                    size="md"
                    fullWidth
                    leftIcon={<LogOut className="w-4 h-4" />}
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    {t('nav.logout')}
                  </Button>
                }
              >
                <div className="space-y-4 py-1">
                  <ListGroup header={t('nav.group_management')}>
                    <ListRow
                      leading={<Settings className="w-4 h-4 text-slate-500" />}
                      title={t('nav.system_settings')}
                      selected={pathname.startsWith('/settings')}
                      chevron
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        router.push('/settings');
                      }}
                    />
                  </ListGroup>

                  <ListGroup header={t('nav.group_device_prefs')}>
                    <ListRow
                      leading={<Globe className="w-4 h-4 text-slate-500" />}
                      title={t('nav.language')}
                      trailing={
                        <SegmentedControl
                          size="sm"
                          aria-label={t('nav.language')}
                          value={locale}
                          onChange={(val) => setLocale(val as 'vi' | 'en')}
                          options={[
                            { value: 'vi', label: 'VI' },
                            { value: 'en', label: 'EN' },
                          ]}
                        />
                      }
                    />
                  </ListGroup>
                </div>
              </ResponsiveSheet>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          SHELL BODY: [Collapsible Left Glass Sidebar >=768px (admin only)] + [Main Pane]
         ===================================================================== */}
      <div className="flex flex-1 min-h-0 w-full max-w-full">
        {/* Desktop & Tablet Collapsible Glass Sidebar (>= 768px, admin & SuperAdmin only) */}
        {canManageStore && (
          <aside
            aria-label="Primary sidebar"
            className={cn(
              'hidden md:flex flex-col justify-between shrink-0 sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] z-shell-bar glass-regular border-r border-glass select-none transition-[width] duration-snappy ease-spring-snappy',
              sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
            )}
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-1 custom-scrollbar">
              {/* Group A: Daily Operations */}
              {!sidebarCollapsed && (
                <div className="px-2.5 pt-1 pb-1 text-caption font-semibold text-slate-500 truncate">
                  {t('nav.group_daily_ops')}
                </div>
              )}
              {primaryOpsItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={true}
                    onClick={() => setIsPromotionsQueryOpen(false)}
                    title={sidebarCollapsed ? item.sidebarLabel : undefined}
                    aria-label={sidebarCollapsed ? item.sidebarLabel : undefined}
                    aria-current={item.isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center rounded-field transition duration-press ease-press active:scale-[0.98]',
                      sidebarCollapsed
                        ? 'w-11 h-11 mx-auto justify-center'
                        : 'h-10 px-3 gap-3 text-subhead',
                      item.isActive
                        ? 'bg-brand-glass-pill text-brand-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-900/[0.04] hover:text-slate-900 font-medium'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0',
                        item.isActive ? 'text-brand-700' : 'text-slate-500'
                      )}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.sidebarLabel}</span>
                    )}
                  </Link>
                );
              })}

              <div className="py-2">
                <Divider />
              </div>

              {/* Group B: Catalog & Administration */}
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 text-caption font-semibold text-slate-500 truncate">
                  {t('nav.group_management')}
                </div>
              )}
              {managementItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={true}
                    onClick={(e) => {
                      if (item.isPromotions) {
                        handleNavigatePromotions(e);
                      } else if ((item as any).isChannels) {
                        e.preventDefault();
                        setIsChannelModalOpen(true);
                      } else {
                        setIsPromotionsQueryOpen(false);
                      }
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    aria-current={item.isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center rounded-field transition duration-press ease-press active:scale-[0.98]',
                      sidebarCollapsed
                        ? 'w-11 h-11 mx-auto justify-center'
                        : 'h-10 px-3 gap-3 text-subhead',
                      item.isActive
                        ? 'bg-brand-glass-pill text-brand-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-900/[0.04] hover:text-slate-900 font-medium'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0',
                        item.isActive ? 'text-brand-700' : 'text-slate-500'
                      )}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Sidebar Footer: Collapse / Expand Toggle persisted in localStorage */}
            <div className="p-2.5 border-t border-hairline shrink-0">
              <button
                type="button"
                onClick={handleToggleSidebar}
                title={
                  sidebarCollapsed
                    ? t('nav.expand_sidebar')
                    : t('nav.collapse_sidebar')
                }
                aria-label={
                  sidebarCollapsed
                    ? t('nav.expand_sidebar')
                    : t('nav.collapse_sidebar')
                }
                className={cn(
                  'flex items-center rounded-field text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.04] transition duration-press ease-press active:scale-[0.98] cursor-pointer',
                  sidebarCollapsed
                    ? 'w-11 h-10 mx-auto justify-center'
                    : 'w-full h-10 px-3 gap-3 text-footnote font-semibold'
                )}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="w-[18px] h-[18px] shrink-0 text-slate-500" />
                ) : (
                  <>
                    <PanelLeftClose className="w-[18px] h-[18px] shrink-0 text-slate-500" />
                    <span className="truncate">{t('nav.collapse_sidebar')}</span>
                  </>
                )}
              </button>
            </div>
          </aside>
        )}

        {/* Main Page Content Area — Wrapped in key={activeStore?.id ?? 'default'} (Decision D-8) so store switch remounts active page cleanly */}
        <main
          className={cn(
            'flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden [scrollbar-gutter:stable] px-2.5 py-2.5 sm:px-4 sm:py-4 md:px-6 md:py-5 2xl:px-8 3xl:px-10 md:pb-6 w-full max-w-full',
            canManageStore ? 'pb-24' : 'pb-6'
          )}
        >
          <div
            key={activeStore?.id ?? 'default'}
            className="flex-1 flex flex-col min-h-0 w-full max-w-full"
          >
            {children}
          </div>
        </main>
      </div>

      {/* =====================================================================
          MOBILE FLOATING GLASS BOTTOM TAB BAR (< 768px, admin & SuperAdmin ONLY)
          Role staff renders NO Bottom Tab Bar (gains +64px vertical catalog height)
         ===================================================================== */}
      {canManageStore && (
        <>
          <nav
            aria-label="Mobile bottom navigation"
            className="md:hidden fixed bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] inset-x-3 z-shell-bar glass-regular rounded-full border border-glass h-14 px-1.5 flex items-center justify-between gap-0.5 select-none"
          >
            {primaryOpsItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setIsPromotionsQueryOpen(false)}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={cn(
                    'flex-1 min-w-0 min-h-[44px] py-1 px-0.5 sm:px-1.5 rounded-full flex flex-col items-center justify-center transition duration-press ease-press active:scale-[0.95]',
                    item.isActive
                      ? 'bg-brand-glass-pill text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-[19px] h-[19px] mb-0.5 shrink-0',
                      item.isActive ? 'text-brand-700' : 'text-slate-500'
                    )}
                  />
                  <span className="text-[10px] sm:text-caption leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-0.5">
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* 5th Tab: More ("Thêm") opening ResponsiveSheet (z-75) */}
            <button
              type="button"
              onClick={() => setIsMoreSheetOpen(true)}
              aria-expanded={isMoreSheetOpen}
              className={cn(
                'flex-1 min-w-0 min-h-[44px] py-1 px-0.5 sm:px-1.5 rounded-full flex flex-col items-center justify-center transition duration-press ease-press active:scale-[0.95] cursor-pointer',
                isMoreSheetOpen || isMoreRouteActive
                  ? 'bg-brand-glass-pill text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              )}
            >
              <MoreHorizontal
                className={cn(
                  'w-[19px] h-[19px] mb-0.5 shrink-0',
                  isMoreSheetOpen || isMoreRouteActive
                    ? 'text-brand-700'
                    : 'text-slate-500'
                )}
              />
              <span className="text-[10px] sm:text-caption leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-0.5">
                {t('nav.more')}
              </span>
            </button>
          </nav>

          {/* More ("Thêm") Sheet — Exact Reachability Matrix §2.2 & §2.4 */}
          <ResponsiveSheet
            isOpen={isMoreSheetOpen}
            onClose={() => setIsMoreSheetOpen(false)}
            exclusiveId="more-nav"
            detent="large"
            title={
              <span className="text-headline font-semibold text-slate-900">
                {t('nav.more_title')}
              </span>
            }
            footer={
              <Button
                variant="danger"
                size="md"
                fullWidth
                leftIcon={<LogOut className="w-4 h-4" />}
                onClick={() => {
                  setIsMoreSheetOpen(false);
                  handleLogout();
                }}
              >
                {t('nav.logout')}
              </Button>
            }
          >
            <div className="space-y-4 py-1">
              {/* Group 1: Catalog & Store Administration */}
              <ListGroup header={t('nav.group_management')}>
                {managementItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <ListRow
                      key={item.id}
                      leading={<Icon className="w-4 h-4 text-brand-600" />}
                      title={item.label}
                      selected={item.isActive}
                      chevron
                      onClick={() => {
                        if (item.isPromotions) {
                          handleNavigatePromotions();
                        } else if ((item as any).isChannels) {
                          setIsPromotionsQueryOpen(false);
                          setIsMoreSheetOpen(false);
                          setIsChannelModalOpen(true);
                        } else {
                          setIsPromotionsQueryOpen(false);
                          setIsMoreSheetOpen(false);
                          router.push(item.href);
                        }
                      }}
                    />
                  );
                })}
              </ListGroup>

              {/* Group 2: Per-Device Preferences */}
              <ListGroup header={t('nav.group_device_prefs')}>
                <ListRow
                  leading={<Globe className="w-4 h-4 text-slate-500" />}
                  title={t('nav.language')}
                  trailing={
                    <SegmentedControl
                      size="sm"
                      aria-label={t('nav.language')}
                      value={locale}
                      onChange={(val) => setLocale(val as 'vi' | 'en')}
                      options={[
                        { value: 'vi', label: 'VI' },
                        { value: 'en', label: 'EN' },
                      ]}
                    />
                  }
                />
              </ListGroup>
            </div>
          </ResponsiveSheet>
        </>
      )}

      {/* iOS PWA Install Prompt — shown only on iOS Safari in browser (not standalone) mode */}
      <InstallPWABanner />

      {/* Sales Channel Management Modal (accessible from More Menu or Desktop Sidebar) */}
      <SalesChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        channels={[]}
        onChannelsUpdated={() => {}}
      />
    </div>
  );
}
