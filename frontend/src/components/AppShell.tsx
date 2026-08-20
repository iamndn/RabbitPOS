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
  ChevronDown,
  Globe,
} from 'lucide-react';
import { fetchApi, getImageUrl } from '@/lib/api';
import { getAuthUser, isAuthenticated, logout as authLogout, UserInfo } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface HealthData {
  app: string;
  version: string;
  db_connected: boolean;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('Thỏ Juice & Coffee');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setMounted(true);

    // 1. Auth Guard Check
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const u = getAuthUser();
    setCurrentUser(u);

    // 2. Role Guard Check: Restrict Staff from Admin routes
    if (u && u.role === 'staff') {
      const adminRoutes = ['/products', '/promotions', '/transactions', '/funds', '/dashboard', '/settings'];
      if (adminRoutes.some((route) => pathname.startsWith(route))) {
        router.push('/');
      }
    }

    checkHealth();

    // 3. Load store logo & store name from settings
    const loadSettings = async () => {
      const res = await fetchApi<Record<string, string>>('/settings');
      if (res.status === 'success' && res.data) {
        const data = res.data as Record<string, string>;
        if (data.store_logo_url) setStoreLogo(data.store_logo_url);
        if (data.store_name) setStoreName(data.store_name);
      }
    };
    loadSettings();
  }, [pathname]);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchApi<HealthData>('/health');
    if (res.status === 'success') {
      setHealth(res.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' });
    authLogout();
    router.push('/login');
  };

  const allNavItems = [
    { label: t('nav.pos'), href: '/', icon: ShoppingCart, adminOnly: false },
    { label: t('nav.catalog'), href: '/products', icon: Package, adminOnly: true },
    { label: t('nav.promotions'), href: '/promotions', icon: Tag, adminOnly: true },
    { label: t('nav.transactions'), href: '/transactions', icon: ArrowUpRight, adminOnly: true },
    { label: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  ];

  const visibleNavItems = allNavItems.filter((item) => {
    if (item.adminOnly) {
      return currentUser?.role === 'admin';
    }
    return true;
  });

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-800 overflow-hidden">
      {/* Top Application Header — pt-safe ensures content clears Notch / Dynamic Island in PWA mode */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-emerald-900 text-white shadow-md pt-safe hardware-accelerated">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5 font-bold text-lg tracking-tight group active:scale-95 transition-transform">
            {storeLogo ? (
              <div className="flex items-center justify-center">
                <img
                  src={getImageUrl(storeLogo) || storeLogo}
                  alt="Store logo"
                  className="h-9 max-w-[120px] object-contain drop-shadow-sm"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="p-2 bg-white/10 rounded-xl flex items-center justify-center">
                <Coffee className="w-5 h-5 text-emerald-200" />
              </div>
            )}
            <span className="text-lg sm:text-xl font-black tracking-tight group-hover:text-emerald-100 transition">
              {t('common.app_title')}
            </span>
          </Link>
          {storeName && (
            <span className="hidden sm:inline-block text-xs bg-emerald-800/80 px-2.5 py-1 rounded-full font-medium text-emerald-100 border border-emerald-700/40">
              {storeName}
            </span>
          )}
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
                    : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Avatar Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2.5 bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-700/50 py-1.5 px-3 rounded-xl transition cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95"
            aria-expanded={isUserMenuOpen}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-700/60 text-emerald-100 font-extrabold flex items-center justify-center text-xs uppercase border border-emerald-600/40">
              {currentUser?.username ? currentUser.username.slice(0, 2) : <User className="w-4 h-4" />}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-xs leading-none text-white">{currentUser?.username || 'User'}</span>
              <span className="text-[10px] text-emerald-200 uppercase font-semibold leading-tight mt-0.5">
                {currentUser?.role === 'admin' ? t('common.role_admin') : t('common.role_staff')}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-emerald-200 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu Modal */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150 hardware-accelerated">
              {/* Header: User Profile Info */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-black flex items-center justify-center text-sm shadow-md shadow-emerald-100">
                  {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{currentUser?.username}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {currentUser?.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">
                        <Shield className="w-3 h-3" /> {t('common.role_admin')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                        <User className="w-3 h-3" /> {t('common.role_staff')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="py-1">
                {/* Menu Item 1: System Settings (Admin only) */}
                {currentUser?.role === 'admin' && (
                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition active:scale-95"
                  >
                    <Settings className="w-4 h-4 text-slate-400 group-hover:text-emerald-700" />
                    <span>{t('nav.settings')}</span>
                  </Link>
                )}

                {/* Menu Item 2: Language Switcher */}
                <div className="px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span>{locale === 'vi' ? 'Ngôn ngữ' : 'Language'}</span>
                  </div>
                  <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLocale('vi')}
                      className={`px-2 py-1 rounded-md font-bold transition active:scale-95 ${
                        locale === 'vi'
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      VI
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocale('en')}
                      className={`px-2 py-1 rounded-md font-bold transition active:scale-95 ${
                        locale === 'en'
                          ? 'bg-emerald-700 text-white shadow-sm'
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

              {/* Menu Item 3: Logout */}
              <div className="px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition active:scale-95"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Page Content — flex-1 overflow-y-auto allows smooth internal scrolling while body is locked */}
      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</div>

      {/* Mobile Bottom Navigation — pb-safe keeps items above Home Indicator on iPhone */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 flex justify-around items-center py-1.5 px-2 pb-safe shadow-lg hardware-accelerated">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1.5 px-3 rounded-xl text-[10px] font-medium transition active:scale-90 ${
                isActive
                  ? 'text-emerald-800 font-bold bg-emerald-50/80 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
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

