'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Coffee, Store, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, ApiResponse } from '@/lib/api';

interface Category {
  id: number;
  name: string;
  display_order: number;
}

interface ProductVariant {
  id: number;
  variant_name: string;
  cogs_price: number;
  retail_price: number;
}

interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  image_url: string;
  tag: string;
  variants: ProductVariant[];
}

export default function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    const catRes = await fetchApi<Category[]>('/categories');
    if (catRes.status === 'success' && catRes.data) {
      setCategories(catRes.data);
    }

    const prodRes = await fetchApi<Product[]>('/products');
    if (prodRes.status === 'success' && prodRes.data) {
      setProducts(prodRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = activeCategoryId
    ? products.filter((p) => p.category_id === activeCategoryId)
    : products;

  return (
    <AppShell>
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* Category Tabs (Horizontal Scroll) */}
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-none">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shadow-sm transition ${
              activeCategoryId === null
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap shadow-sm transition ${
                activeCategoryId === cat.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No products found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((item) => {
              const startingPrice =
                item.variants && item.variants.length > 0
                  ? Math.min(...item.variants.map((v) => v.retail_price))
                  : 0;

              return (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-full h-28 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-slate-400 overflow-hidden relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Coffee className="w-8 h-8 opacity-40" />
                      )}
                    </div>
                    {item.tag && item.tag !== 'none' && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md tracking-wider">
                        {item.tag.replace('_', ' ')}
                      </span>
                    )}
                    <h3 className="font-semibold text-slate-900 text-sm mt-1 leading-tight">{item.name}</h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-indigo-600 text-sm">
                      ${startingPrice.toFixed(2)}
                    </span>
                    <button className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-2.5 py-1 rounded-lg transition">
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cart Bar Footer */}
        <div className="fixed bottom-14 md:bottom-4 left-4 right-4 max-w-7xl mx-auto z-20 bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-2xl shadow-xl flex items-center justify-between">
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
            className="bg-slate-300 text-slate-500 font-bold px-6 py-2.5 rounded-xl cursor-not-allowed text-sm transition shadow-sm"
          >
            Checkout
          </button>
        </div>
      </div>
    </AppShell>
  );
}
