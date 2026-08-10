'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Coffee, Store, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchApi, ApiResponse } from '@/lib/api';

interface HealthData {
  app: string;
  version: string;
  db_connected: boolean;
}

export default function PosPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    const res: ApiResponse<HealthData> = await fetchApi<HealthData>('/health');
    if (res.status === 'success') {
      setHealth(res.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-800">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shadow-md">
        <div className="flex items-center space-x-2">
          <Coffee className="w-6 h-6" />
          <span className="font-bold text-lg tracking-tight">ThoPOS</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-indigo-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Store className="w-3.5 h-3.5" /> Main Store
          </span>
        </div>
      </header>

      {/* Backend Status Banner */}
      <div className="bg-slate-800 text-white px-4 py-2 text-xs flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-300">Backend API:</span>
          {loading ? (
            <span className="text-amber-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Connecting...
            </span>
          ) : error ? (
            <span className="text-rose-400 flex items-center gap-1" title={error}>
              <AlertCircle className="w-3 h-3" /> Offline / Disconnected
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Online ({health?.app} v{health?.version}) DB: {health?.db_connected ? 'Connected' : 'Degraded'}
            </span>
          )}
        </div>
        <button
          onClick={checkBackendHealth}
          className="p-1 hover:bg-slate-700 rounded transition"
          title="Retry Connection"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 flex flex-col space-y-4">
        {/* Category Tabs (Horizontal Scroll) */}
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-none">
          {['All Items', 'Coffee', 'Fresh Juice', 'Tea & Milk Tea', 'Toppings'].map((cat, idx) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shadow-sm transition ${
                idx === 0
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid Placeholder */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[
            { name: 'Iced Black Coffee', price: '$2.50', tag: 'Best Seller' },
            { name: 'Fresh Orange Juice', price: '$3.00', tag: 'Fresh' },
            { name: 'Milk Tea Boba', price: '$3.50', tag: 'Popular' },
            { name: 'Coconut Water', price: '$2.00', tag: 'New' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="w-full h-24 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-slate-400">
                  <Coffee className="w-8 h-8 opacity-40" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">
                  {item.tag}
                </span>
                <h3 className="font-medium text-slate-900 text-sm mt-1 leading-tight">{item.name}</h3>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-indigo-600 text-sm">{item.price}</span>
                <button className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-lg transition">
                  + Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Cart Summary Bottom Sheet Bar (Mobile First) */}
      <footer className="sticky bottom-0 z-20 bg-white border-t border-slate-200 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
              <ShoppingBag className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                0
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Cart Subtotal</p>
              <p className="text-lg font-bold text-slate-900">$0.00</p>
            </div>
          </div>
          <button
            disabled
            className="bg-slate-300 text-slate-500 font-bold px-6 py-3 rounded-xl cursor-not-allowed text-sm transition shadow-sm"
          >
            Checkout
          </button>
        </div>
      </footer>
    </div>
  );
}
