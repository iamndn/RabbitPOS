'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, ShoppingCart, Package, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchApi, ApiResponse } from '@/lib/api';

interface HealthData {
  app: string;
  version: string;
  db_connected: boolean;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    checkHealth();
  }, []);

  const navItems = [
    { label: 'POS Terminal', href: '/', icon: ShoppingCart },
    { label: 'Catalog / Products', href: '/products', icon: Package },
  ];

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status Pill */}
        <div className="flex items-center space-x-2 text-xs">
          {loading ? (
            <span className="bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2 py-1 rounded-md flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Checking
            </span>
          ) : error ? (
            <button
              onClick={checkHealth}
              className="bg-rose-500/20 text-rose-200 border border-rose-400/30 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-rose-500/30 transition"
              title={error}
            >
              <AlertCircle className="w-3 h-3" /> Offline
            </button>
          ) : (
            <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Online</span>
            </span>
          )}
        </div>
      </header>

      {/* Main Page Content */}
      <div className="flex-1 pb-16 md:pb-0">{children}</div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex justify-around py-2 px-4 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium transition ${
                isActive ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
