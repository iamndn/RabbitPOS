'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { RefreshCw } from 'lucide-react';

export default function FundsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/transactions?tab=funds');
  }, [router]);

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    </AppShell>
  );
}
