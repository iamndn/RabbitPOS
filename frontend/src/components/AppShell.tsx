'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getAuthUser, isAuthenticated, logout as authLogout, UserInfo } from '@/lib/auth';

interface HealthData {
  app: string;
  version: string;
  db_connected: boolean;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      const adminRoutes = ['/products', '/transactions', '/funds', '/dashboard'];
      if (adminRoutes.some((route) => pathname.startsWith(route))) {
        router.push('/');
      }
    }

    checkHealth();
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
    { label: 'POS Terminal', href: '/', icon: ShoppingCart, adminOnly: false },
    { label: 'Catalog', href: '/products', icon: Package, adminOnly: true },
    { label: 'Transactions', href: '/transactions', icon: ArrowUpRight, adminOnly: true },
    { label: 'Funds & Balances', href: '/funds', icon: Wallet, adminOnly: true },
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  ];

  const visibleNavItems = allNavItems.filter((item) => {
    if (item.adminOnly) {
      return currentUser?.role === 'admin';
    }
    return true;
  });

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shadow-md">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2 font-bold text-lg tracking-tight">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Coffee className="w-5 h-5 text-indigo-200" />
            </div>
            <span>ThoPOS</span>
          </Link>
          <span className="hidden sm:inline-block text-xs bg-indigo-700/80 px-2.5 py-1 rounded-full font-medium text-indigo-100 border border-indigo-500/30">
            Tho Juice & Coffee
          </span>
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
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-white/20 text-white shadow-sm font-bold'
                    : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Session & Logout */}
        <div className="flex items-center space-x-3 text-xs">
          {currentUser && (
            <div className="flex items-center space-x-2 bg-indigo-700/80 border border-indigo-500/40 px-2.5 py-1 rounded-xl">
              <div className="p-1 bg-indigo-500/30 rounded-lg">
                {currentUser.role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-purple-300" />
                ) : (
                  <User className="w-3.5 h-3.5 text-blue-300" />
                )}
              </div>
              <span className="font-bold text-white text-xs">{currentUser.username}</span>
              <span
                className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                  currentUser.role === 'admin' ? 'bg-purple-500/40 text-purple-200' : 'bg-blue-500/40 text-blue-200'
                }`}
              >
                {currentUser.role}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="bg-indigo-700 hover:bg-rose-600 text-indigo-100 hover:text-white p-1.5 rounded-lg transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <div className="flex-1 pb-16 md:pb-0">{children}</div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex justify-around py-2 px-2 shadow-lg">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
                isActive ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
