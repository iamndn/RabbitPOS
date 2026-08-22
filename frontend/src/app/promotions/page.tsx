'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PromotionsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/products?open=promotions');
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
      Đang chuyển hướng đến Quản lý Khuyến mãi...
    </div>
  );
}
