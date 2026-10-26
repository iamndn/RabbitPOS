'use client';

import React, { useEffect, useRef, useState } from 'react';
import InstallPWABanner from '@/components/common/InstallPWABanner';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Coffee,
  ShoppingCart,
  Package,
  ArrowUpRight,
  Wallet,
  LayoutDashboard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
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
} from 'lucide-react';
import { fetchApi, getImageUrl } from '@/lib/api';
import { getAuthUser, isAuthenticated, isMasterRole, isOwnerRole, logout as authLogout, UserInfo } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useStore } from '@/lib/StoreContext';
import StoreSwitcher from '@/components/StoreSwitcher';

interface HealthData {
  app: string;
  version: string;
  db_connected: boolean;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { activeStore, isSuperAdmin, storeRole } = useStore();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isMaster = isMasterRole(currentUser?.role) || isSuperAdmin;
  const isOwner = isOwnerRole(currentUser?.role) || storeRole === 'store_admin';
  const canManageStore = isMaster || isOwner;
  const canManageUsers = isMaster || isOwner;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Effect 1: App Mount Only (Initial Health check + Background 60s health monitor)
  useEffect(() => {
    setMounted(true);

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

    return () => clearInterval(interval);
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

  const handleLogout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' });
    authLogout();
    router.push('/login');
  };

  const allNavItems = [
    { label: t('nav.pos'), href: '/', icon: ShoppingCart, visible: true },
    { label: t('nav.transactions'), href: '/transactions', icon: ArrowUpRight, visible: true },
    { label: t('nav.catalog'), href: '/products', icon: Package, visible: canManageStore },
    { label: t('nav.purchases'), href: '/purchases', icon: ShoppingBag, visible: canManageStore },
    { label: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard, visible: canManageStore },
    { label: t('nav.stores') || 'Cửa hàng', href: '/stores', icon: StoreIcon, visible: isSuperAdmin },
  ];

  const visibleNavItems = allNavItems.filter((item) => item.visible);
  // Hide store management tab from mobile bottom bar (accessed via Header avatar/switcher)
  const mobileNavItems = visibleNavItems.filter((item) => item.href !== '/stores');

  if (!mounted) return null;

  const currentStoreName = activeStore?.name || 'RabbitPOS';

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-full overflow-x-hidden bg-slate-50 text-slate-800">
      {/* Top Application Header — pt-safe ensures content clears Notch / Dynamic Island in PWA mode */}
      <header className="sticky top-0 z-50 bg-purple-900 text-white shadow-md pt-safe w-full">
        <div className="w-full max-w-7xl 2xl:max-w-[1800px] 3xl:max-w-[2400px] 4k:max-w-[3200px] mx-auto px-3 sm:px-4 lg:px-6 2xl:px-8 py-2 flex items-center justify-between">
          {/* Brand Logo, App Title & Store Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-2.5 font-bold tracking-tight group active:scale-95 transition-transform shrink-0">
              {activeStore?.logo_url ? (
                <div className="flex items-center justify-center shrink-0">
                  <img
                    src={getImageUrl(activeStore.logo_url) || activeStore.logo_url}
                    alt={currentStoreName}
                    className="h-8 sm:h-9 max-w-[100px] sm:max-w-[120px] object-contain drop-shadow-sm rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center shrink-0 bg-white/10 rounded-xl p-1">
                  <img
                    src="/icons/rabbitpos_logo.png"
                    alt="RabbitPOS"
                    className="h-6 sm:h-7 max-w-[80px] sm:max-w-[100px] object-contain drop-shadow-sm"
                  />
                </div>
              )}
              <div className="hidden lg:flex flex-col justify-center min-w-0 text-left">
                <span className="text-sm font-black tracking-tight group-hover:text-purple-100 transition truncate leading-tight">
                  {currentStoreName}
                </span>
                <span className="text-[10px] text-purple-200/90 font-semibold truncate leading-tight">
                  RabbitPOS
                </span>
              </div>
            </Link>

            {/* Interactive Store Switcher Component */}
            <StoreSwitcher />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
                    isActive
                      ? 'bg-white/20 text-white shadow-sm font-bold'
                      : 'text-purple-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile Avatar Dropdown */}
          <div className="relative shrink-0" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 sm:space-x-2.5 bg-purple-800/90 hover:bg-purple-800 border border-purple-700/60 py-1.5 px-2.5 sm:px-3 rounded-xl transition cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95"
              aria-expanded={isUserMenuOpen}
            >
              <div className="w-7 h-7 rounded-lg bg-purple-700 text-purple-100 font-black flex items-center justify-center text-xs uppercase border border-purple-600/50 shrink-0">
                {currentUser?.username ? currentUser.username.slice(0, 2) : <User className="w-4 h-4" />}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-xs leading-none text-white">{currentUser?.username || 'User'}</span>
                <span className="text-[10px] text-purple-200 uppercase font-semibold leading-tight mt-0.5">
                  {isSuperAdmin
                    ? 'Super Admin'
                    : canManageStore
                    ? t('common.role_admin')
                    : t('common.role_staff')}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-purple-200 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Modal */}
            {isUserMenuOpen && (
              <>
                {/* Mobile backdrop for easy dismissal */}
                <div
                  className="fixed inset-0 z-50 bg-slate-900/40 sm:hidden animate-in fade-in-0 duration-150"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-64 max-w-xs bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-[100] text-slate-800 animate-in fade-in zoom-in-95 duration-150 hardware-accelerated">
                  {/* Header: User Profile Info */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 text-white font-black flex items-center justify-center text-sm shadow-md shadow-purple-100 shrink-0">
                      {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{currentUser?.username}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isMaster ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">
                            <Shield className="w-3 h-3" /> Master
                          </span>
                        ) : isOwner ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                            <Shield className="w-3 h-3" /> Owner
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">
                            <User className="w-3 h-3" /> Staff
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    {/* 1. Multi-Store Platform Admin (Super Admin only) */}
                    {isSuperAdmin && (
                      <Link
                        href="/stores"
                        onClick={() => setIsUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold transition active:scale-95 ${
                          pathname === '/stores' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700 hover:bg-slate-50 hover:text-purple-700'
                        }`}
                      >
                        <StoreIcon className="w-4 h-4 text-purple-600" />
                        <span>{t('nav.stores') || 'Quản lý cửa hàng'}</span>
                      </Link>
                    )}

                    {/* 2. Staff & User Management (Master or Owner) */}
                    {canManageUsers && (
                      <Link
                        href="/users"
                        onClick={() => setIsUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold transition active:scale-95 ${
                          pathname === '/users' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700 hover:bg-slate-50 hover:text-purple-700'
                        }`}
                      >
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>{t('nav.users') || 'Quản lý nhân sự'}</span>
                      </Link>
                    )}

                    {/* 3. System Settings (Store Admin or Super Admin) */}
                    {canManageStore && (
                      <Link
                        href="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold transition active:scale-95 ${
                          pathname === '/settings' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700 hover:bg-slate-50 hover:text-purple-700'
                        }`}
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>{t('nav.settings')}</span>
                      </Link>
                    )}

                    {/* Divider between management and preferences */}
                    <div className="border-t border-slate-100 my-1" />

                    {/* 4. Language Switcher */}
                    <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <div className="flex items-center space-x-3">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span>{locale === 'vi' ? 'Ngôn ngữ' : 'Language'}</span>
                      </div>
                      <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setLocale('vi')}
                          className={`px-2 py-0.5 rounded-md font-bold transition active:scale-95 cursor-pointer ${
                            locale === 'vi'
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          VI
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocale('en')}
                          className={`px-2 py-0.5 rounded-md font-bold transition active:scale-95 cursor-pointer ${
                            locale === 'en'
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 my-1" />

                  {/* Menu Item: Logout */}
                  <div className="px-1.5 py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition active:scale-95 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>{t('nav.logout')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Content Area — Wrapped in key={activeStore?.id ?? 'default'} (Decision D-8) so store switch remounts active page cleanly */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6 2xl:px-8 3xl:px-10 pb-24 md:pb-6 w-full max-w-full">
        <div key={activeStore?.id ?? 'default'} className="flex-1 flex flex-col min-h-0 w-full max-w-full">
          {children}
        </div>
      </div>

      {/* Mobile Bottom Navigation (Tab Cửa hàng được truy cập qua Header/Avatar/StoreSwitcher, không hiển thị ở footer) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex justify-around items-center py-1 px-1 sm:px-2 pb-safe shadow-lg w-full max-w-full overflow-hidden">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1.5 px-3 rounded-xl text-[10px] font-medium transition active:scale-90 ${
                isActive
                  ? 'text-purple-800 font-bold bg-purple-50/80 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-purple-700' : 'text-slate-400'}`} />
              <span className="truncate max-w-[68px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* iOS PWA Install Prompt — shown only on iOS Safari in browser (not standalone) mode */}
      <InstallPWABanner />
    </div>
  );
}
