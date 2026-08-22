'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import PurchasesCostTab from '@/components/transactions/PurchasesCostTab';
import TransactionModal from '@/components/transactions/TransactionModal';
import { fetchApi } from '@/lib/api';
import { SettingsMap } from '@/lib/utils';
import { TransactionCategory } from '@/types/transaction_category';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

export default function PurchasesPage() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [txCategories, setTxCategories] = useState<TransactionCategory[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const loadData = async () => {
    try {
      const [settingsRes, fundsRes, catsRes] = await Promise.all([
        fetchApi<any>('/settings'),
        fetchApi<Fund[]>('/funds'),
        fetchApi<TransactionCategory[]>('/transaction-categories'),
      ]);

      if (settingsRes.status === 'success' && settingsRes.data) {
        if (Array.isArray(settingsRes.data)) {
          const map: SettingsMap = {};
          settingsRes.data.forEach((s: any) => {
            if (s && s.key) map[s.key] = s.value;
          });
          setSettings(map);
        } else if (typeof settingsRes.data === 'object') {
          setSettings(settingsRes.data as SettingsMap);
        }
      }

      if (fundsRes.status === 'success' && Array.isArray(fundsRes.data)) {
        setFunds(fundsRes.data);
      }

      if (catsRes.status === 'success' && Array.isArray(catsRes.data)) {
        setTxCategories(catsRes.data);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full max-w-full overflow-x-hidden">
        <PurchasesCostTab
          key={refreshTrigger}
          onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
          settings={settings}
          funds={funds}
          txCategories={txCategories}
          onDataChanged={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </div>

      <TransactionModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={() => {
          setIsExpenseModalOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
        funds={funds}
        txCategories={txCategories}
        initialData={null}
      />
    </AppShell>
  );
}
