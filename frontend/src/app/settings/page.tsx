'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Settings as SettingsIcon,
  Store,
  Coins,
  QrCode,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ImageIcon,
  Upload,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, uploadImage, getImageUrl } from '@/lib/api';
import { SettingsMap, formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'store' | 'currency' | 'vietqr'>('store');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [form, setForm] = useState<SettingsMap>({
    store_name: 'Thỏ Juice & Coffee',
    store_address: '123 Vo Van Kiet, D1, HCMC',
    store_phone: '0901234567',
    store_logo_url: '',
    currency_code: 'VND',
    currency_symbol: 'đ',
    currency_position: 'suffix',
    vietqr_bank_id: 'MB',
    vietqr_account_no: '123456789',
    vietqr_account_name: 'THO JUICE AND COFFEE',
  });

  const loadSettings = async () => {
    setLoading(true);
    setErrorMessage(null);
    const res = await fetchApi<SettingsMap>('/settings');
    if (res.status === 'success' && res.data) {
      setForm((prev) => ({
        ...prev,
        ...res.data,
      }));
    } else {
      setErrorMessage(res.message || 'Failed to load settings');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setToastMessage(null);

    const res = await fetchApi<SettingsMap>('/settings', {
      method: 'PUT',
      body: JSON.stringify(form),
    });

    if (res.status === 'success' && res.data) {
      setForm((prev) => ({
        ...prev,
        ...res.data,
      }));
      setToastMessage(t('settings.save_success'));
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setErrorMessage(res.message || 'Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-indigo-600" />
              {t('settings.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        {/* Success Toast Banner */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl shadow-sm flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {toastMessage}
            </span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3 rounded-xl shadow-sm flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {errorMessage}
            </span>
          </div>
        )}

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 flex justify-center items-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Tab Navigation Controls */}
            <div className="flex border-b border-slate-200 bg-white p-1.5 rounded-2xl border shadow-sm space-x-1">
              <button
                type="button"
                onClick={() => setActiveTab('store')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'store'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>{t('settings.tab_store')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('currency')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'currency'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>{t('settings.tab_currency')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vietqr')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === 'vietqr'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>{t('settings.tab_vietqr')}</span>
              </button>
            </div>

            {/* TAB 1: Store Information */}
            {activeTab === 'store' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs animate-in fade-in duration-150">
                <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Store className="w-4 h-4 text-indigo-600" />
                  {t('settings.tab_store')}
                </h3>

                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.store_name')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.store_name || ''}
                      onChange={(e) => handleChange('store_name', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder={t('settings.store_name_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.store_address')}
                    </label>
                    <input
                      type="text"
                      value={form.store_address || ''}
                      onChange={(e) => handleChange('store_address', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder={t('settings.store_address_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.store_phone')}
                    </label>
                    <input
                      type="text"
                      value={form.store_phone || ''}
                      onChange={(e) => handleChange('store_phone', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder={t('settings.store_phone_placeholder')}
                    />
                  </div>

                  {/* Store Logo Upload */}
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.store_logo')}
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={form.store_logo_url || ''}
                        onChange={(e) => handleChange('store_logo_url', e.target.value)}
                        className="flex-1 p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder={t('settings.store_logo_placeholder')}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading}
                        className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold px-3 py-2.5 rounded-xl transition text-xs whitespace-nowrap disabled:opacity-50"
                      >
                        {logoUploading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {t('settings.upload_logo')}
                      </button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLogoUploading(true);
                          setErrorMessage(null);
                          try {
                            const res = await uploadImage(file);
                            if (res.status === 'success' && res.data?.url) {
                              handleChange('store_logo_url', res.data.url);
                              setToastMessage(t('settings.logo_upload_success') || 'Tải ảnh logo thành công');
                              setTimeout(() => setToastMessage(null), 3000);
                            } else {
                              setErrorMessage(res.message || 'Failed to upload logo image');
                              setTimeout(() => setErrorMessage(null), 5000);
                            }
                          } catch (err: any) {
                            console.error('Logo upload failed:', err);
                            setErrorMessage(err?.message || 'Failed to upload logo image');
                            setTimeout(() => setErrorMessage(null), 5000);
                          }
                          setLogoUploading(false);
                          if (logoInputRef.current) logoInputRef.current.value = '';
                        }}
                      />
                    </div>
                    {/* Logo preview */}
                    {form.store_logo_url && (
                      <div className="mt-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-slate-500 flex-shrink-0">{t('settings.logo_preview')}:</span>
                        <img
                          src={getImageUrl(form.store_logo_url) || form.store_logo_url}
                          alt="Store logo preview"
                          className="h-10 max-w-[120px] object-contain rounded-lg"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Currency & Pricing */}
            {activeTab === 'currency' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs animate-in fade-in duration-150">
                <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-indigo-600" />
                  {t('settings.tab_currency')}
                </h3>

                <div className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 mb-1 block">
                        {t('settings.currency_code')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.currency_code || ''}
                        onChange={(e) => handleChange('currency_code', e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="VND, USD, EUR..."
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 mb-1 block">
                        {t('settings.currency_symbol')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.currency_symbol || ''}
                        onChange={(e) => handleChange('currency_symbol', e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="đ"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.currency_position')}
                    </label>
                    <select
                      value={form.currency_position || 'suffix'}
                      onChange={(e) => handleChange('currency_position', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="suffix">{t('settings.position_suffix')}</option>
                      <option value="prefix">{t('settings.position_prefix')}</option>
                    </select>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 mt-3">
                    <p className="text-[11px] text-slate-500 font-medium mb-1">{t('settings.preview_label')}</p>
                    <p className="text-sm font-extrabold text-indigo-700">
                      {formatCurrency(35000, form)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VietQR Payment Settings */}
            {activeTab === 'vietqr' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs animate-in fade-in duration-150">
                <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  {t('settings.tab_vietqr')}
                </h3>

                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.vietqr_bank_id')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.vietqr_bank_id || ''}
                      onChange={(e) => handleChange('vietqr_bank_id', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder="MB, VCB, ACB, TCB..."
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.vietqr_account_no')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.vietqr_account_no || ''}
                      onChange={(e) => handleChange('vietqr_account_no', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder={t('settings.vietqr_account_no_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">
                      {t('settings.vietqr_account_name')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.vietqr_account_name || ''}
                      onChange={(e) => handleChange('vietqr_account_name', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase"
                      placeholder={t('settings.vietqr_account_name_placeholder')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-md transition flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('pos.processing')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t('common.save')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
