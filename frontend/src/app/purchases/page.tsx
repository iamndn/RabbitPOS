'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { RefreshCw } from 'lucide-react';

export default function PurchasesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/transactions?tab=purchases');
  }, [router]);

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">
          Đang chuyển hướng đến Nhập hàng & Giá vốn trong Sổ Giao Dịch...
        </p>
      </div>
    </AppShell>
  );
}
