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
  Mail,
  Send,
  Database,
  Download,
  UploadCloud,
  FileJson,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, uploadImage, getImageUrl, getApiBaseUrl } from '@/lib/api';
import { SettingsMap, formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import ModernSelect from '@/components/common/ModernSelect';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'store' | 'currency' | 'vietqr' | 'email' | 'backup' | 'import'>('store');
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
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Thỏ Juice & Coffee - RabbitPOS',
    report_recipient_emails: 'nhanhdn.jfw@gmail.com,candynhung754@gmail.com,150498tranquangdat@gmail.com',
    enable_daily_email_report: 'true',
    daily_report_time: '22:30',
  });

  const [testingSmtp, setTestingSmtp] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Backup & Restore State
  const [exportingBackup, setExportingBackup] = useState<boolean>(false);
  const [restoringBackup, setRestoringBackup] = useState<boolean>(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    setExportingBackup(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const res = await fetchApi<any>('/backup/export', { skipCache: true });
      if (res.status === 'success' && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `rabbitpos_backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setToastMessage(t('settings.export_backup_success'));
      } else {
        setErrorMessage(res.message || 'Tải bản sao lưu thất bại');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Tải bản sao lưu thất bại');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFile(file);
    setRestoreResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setBackupPreview(json);
    } catch {
      setErrorMessage('File sao lưu không hợp lệ hoặc bị lỗi định dạng JSON.');
      setBackupFile(null);
      setBackupPreview(null);
    }
  };

  const handleExecuteRestore = async () => {
    if (!backupPreview) return;
    setRestoringBackup(true);
    setErrorMessage(null);
    setShowRestoreModal(false);
    try {
      const res = await fetchApi<any>('/backup/restore', {
        method: 'POST',
        body: JSON.stringify(backupPreview),
        skipCache: true,
      });
      if (res.status === 'success' && res.data) {
        setRestoreResult(res.data);
        setToastMessage(t('settings.restore_success'));
        setTimeout(() => {
          loadSettings();
        }, 1000);
      } else {
        setErrorMessage(res.message || 'Phục hồi dữ liệu thất bại.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Phục hồi dữ liệu thất bại.');
    } finally {
      setRestoringBackup(false);
    }
  };

  // Data Import State
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);
  const [importingData, setImportingData] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTarget, setImportTarget] = useState<string>('all');
  const [upsertProducts, setUpsertProducts] = useState<boolean>(true);
  const [updateFunds, setUpdateFunds] = useState<boolean>(true);
  const [importResult, setImportResult] = useState<any | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setErrorMessage(null);
    try {
      const baseUrl = getApiBaseUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;
      const res = await fetch(`${baseUrl}/import/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Không thể tải file mẫu');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Nhap_Du_Lieu_RabbitPOS.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrorMessage(e.message || 'Tải file mẫu thất bại');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
  };

  const handleExecuteImport = async () => {
    if (!importFile) return;
    setImportingData(true);
    setErrorMessage(null);
    setToastMessage(null);
    setImportResult(null);

    try {
      const baseUrl = getApiBaseUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('target', importTarget);
      formData.append('upsert_products', upsertProducts ? 'true' : 'false');
      formData.append('update_funds', updateFunds ? 'true' : 'false');

      const res = await fetch(`${baseUrl}/import/excel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status === 'success' && data.data) {
        setImportResult(data.data);
        setToastMessage(t('settings.import_success_title'));
      } else {
        setErrorMessage(data.message || 'Nhập dữ liệu thất bại.');
        if (data.data) {
          setImportResult(data.data);
        }
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Nhập dữ liệu thất bại.');
    } finally {
      setImportingData(false);
    }
  };

  const handleTestSMTP = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetchApi<any>('/settings/test-smtp', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.status === 'success') {
        setSmtpTestResult({ type: 'success', message: t('email_report.test_smtp_success') });
      } else {
        setSmtpTestResult({ type: 'error', message: res.message || t('email_report.test_smtp_error') });
      }
    } catch {
      setSmtpTestResult({ type: 'error', message: t('email_report.test_smtp_error') });
    } finally {
      setTestingSmtp(false);
      setTimeout(() => setSmtpTestResult(null), 6000);
    }
  };

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
            <div className="flex border-b border-slate-200 bg-white p-1.5 rounded-2xl border shadow-sm space-x-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('store')}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
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
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
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
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'vietqr'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>{t('settings.tab_vietqr')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'email'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{t('email_report.settings_section_title').split(' ')[0]}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'backup'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>{t('settings.tab_backup')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'import'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Nhập Dữ Liệu Excel</span>
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
                    <ModernSelect
                      value={form.currency_position || 'suffix'}
                      onChange={(val) => handleChange('currency_position', String(val))}
                      options={[
                        { value: 'suffix', label: t('settings.position_suffix') || 'Hậu tố (VD: 35.000 đ)', badge: 'Suffix', badgeColor: 'indigo' },
                        { value: 'prefix', label: t('settings.position_prefix') || 'Tiền tố (VD: $35.000)', badge: 'Prefix', badgeColor: 'emerald' },
                      ]}
                    />
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

            {/* TAB 4: Email & Automated Reports */}
            {activeTab === 'email' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs animate-in fade-in duration-150">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    {t('email_report.settings_section_title')}
                  </h3>
                  <p className="text-slate-500 text-xs mt-2">{t('email_report.settings_section_desc')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.smtp_host')}</label>
                    <input type="text" value={form.smtp_host || ''} onChange={(e) => handleChange('smtp_host', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="smtp.gmail.com" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.smtp_port')}</label>
                    <input type="text" value={form.smtp_port || ''} onChange={(e) => handleChange('smtp_port', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="587" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.smtp_user')}</label>
                    <input type="email" value={form.smtp_user || ''} onChange={(e) => handleChange('smtp_user', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="your-email@gmail.com" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.smtp_password')}</label>
                    <input type="password" value={form.smtp_password || ''} onChange={(e) => handleChange('smtp_password', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="xxxx xxxx xxxx xxxx" />
                    <p className="text-slate-400 text-xs mt-1">{t('email_report.smtp_password_hint')}</p>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.smtp_from_email')}</label>
                    <input type="email" value={form.smtp_from_email || ''} onChange={(e) => handleChange('smtp_from_email', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="rabbitpos@yourdomain.com" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.smtp_from_name')}</label>
                    <input type="text" value={form.smtp_from_name || ''} onChange={(e) => handleChange('smtp_from_name', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="RabbitPOS" />
                  </div>
                </div>

                <div className="max-w-2xl">
                  <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.recipients')}</label>
                  <input type="text" value={form.report_recipient_emails || ''} onChange={(e) => handleChange('report_recipient_emails', e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    placeholder="admin1@email.com,admin2@email.com" />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
                  <label className="flex items-center gap-2.5 cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex-1">
                    <input type="checkbox" checked={form.enable_daily_email_report === 'true'}
                      onChange={(e) => handleChange('enable_daily_email_report', e.target.checked ? 'true' : 'false')}
                      className="w-4 h-4 accent-emerald-600 rounded" />
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-800">{t('email_report.enable_auto_report')}</span>
                  </label>

                  <div className="flex-1">
                    <label className="font-semibold text-slate-700 mb-1 block">{t('email_report.report_time')}</label>
                    <input type="time" value={form.daily_report_time || '22:30'} onChange={(e) => handleChange('daily_report_time', e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                  </div>
                </div>

                  {/* Test SMTP button (separate from main save) */}
                  <div className="pt-2 border-t border-slate-100">
                    <button type="button" onClick={handleTestSMTP} disabled={testingSmtp}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition flex items-center gap-2">
                      {testingSmtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {testingSmtp ? t('email_report.sending') : t('email_report.test_smtp_button')}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: Backup & Restore */}
              {activeTab === 'backup' && (
                <div className="space-y-6 text-xs animate-in fade-in duration-150">
                  {/* 1. Export Backup Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Download className="w-4 h-4 text-violet-600" />
                        {t('settings.backup_section_title')}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {t('settings.backup_section_desc')}
                      </p>
                    </div>

                    <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-violet-600" />
                          Toàn bộ cơ sở dữ liệu hệ thống (Định dạng JSON chuẩn)
                        </span>
                        <p className="text-slate-500 text-[11px]">
                          Bao gồm: Thực đơn, Danh mục, Biến thể, Topping, Quỹ tiền, Giao dịch thu chi, Lịch sử đơn hàng, Khuyến mãi và Cài đặt cửa hàng.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        disabled={exportingBackup}
                        className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-5 rounded-xl shadow-md transition flex items-center gap-2 shrink-0"
                      >
                        {exportingBackup ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{exportingBackup ? t('settings.export_backup_loading') : t('settings.export_backup_btn')}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Restore Backup Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-amber-600" />
                        {t('settings.restore_section_title')}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {t('settings.restore_section_desc')}
                      </p>
                    </div>

                    {/* Warning banner */}
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <span className="font-bold">Lưu ý quan trọng:</span>
                        <p className="text-amber-800">{t('settings.restore_warning')}</p>
                      </div>
                    </div>

                    {/* File Upload Drop Area */}
                    <div
                      onClick={() => backupInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-violet-50/20 space-y-2"
                    >
                      <input
                        ref={backupInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleBackupFileSelect}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-violet-600 flex items-center justify-center mx-auto shadow-sm">
                        <FileJson className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 block text-xs">
                          {backupFile ? backupFile.name : t('settings.restore_select_file')}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {backupFile
                            ? `${(backupFile.size / 1024).toFixed(1)} KB · Bấm để đổi file khác`
                            : t('settings.restore_drag_hint')}
                        </span>
                      </div>
                    </div>

                    {/* If file is selected and parsed, show action button */}
                    {backupFile && backupPreview && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowRestoreModal(true)}
                          disabled={restoringBackup}
                          className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-md transition flex items-center gap-2"
                        >
                          {restoringBackup ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <UploadCloud className="w-4 h-4" />
                          )}
                          <span>{restoringBackup ? t('settings.restore_loading') : t('settings.restore_btn')}</span>
                        </button>
                      </div>
                    )}

                    {/* Restore Result Summary */}
                    {restoreResult && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {t('settings.restore_success')}
                        </div>
                        {restoreResult.restored_stats && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1">
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.categories}</span> Danh mục
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.products}</span> Sản phẩm
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.toppings}</span> Topping
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.orders}</span> Đơn hàng
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.transactions}</span> Giao dịch
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.funds}</span> Quỹ tiền
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.promotions}</span> Khuyến mãi
                            </div>
                            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                              <span className="font-semibold text-slate-800">{restoreResult.restored_stats.settings}</span> Cài đặt
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: Automated Data Import Engine */}
              {activeTab === 'import' && (
                <div className="space-y-6 text-xs animate-in fade-in duration-150">
                  {/* 1. Download Template Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          {t('settings.import_section_title')}
                        </h3>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {t('settings.import_section_desc')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        disabled={downloadingTemplate}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-2 shrink-0 self-start sm:self-auto"
                      >
                        {downloadingTemplate ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{t('settings.download_template_btn')}</span>
                      </button>
                    </div>

                    {/* Supported Sheets Overview Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 space-y-1">
                        <span className="font-bold text-indigo-900 block text-xs">📁 Danh Mục</span>
                        <p className="text-slate-500 text-[11px]">Tên danh mục, thứ tự, trạng thái</p>
                      </div>
                      <div className="bg-violet-50/70 border border-violet-100 rounded-xl p-3 space-y-1">
                        <span className="font-bold text-violet-900 block text-xs">🧋 Topping</span>
                        <p className="text-slate-500 text-[11px]">Giá bán, giá vốn COGS, phân loại</p>
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 space-y-1">
                        <span className="font-bold text-emerald-900 block text-xs">🍹 Sản Phẩm & Size</span>
                        <p className="text-slate-500 text-[11px]">Món ăn, Size M/L, giá vốn, giá bán</p>
                      </div>
                      <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 space-y-1">
                        <span className="font-bold text-amber-900 block text-xs">💸 Sổ Thu Chi</span>
                        <p className="text-slate-500 text-[11px]">Khoản thu, khoản chi, quỹ tiền</p>
                      </div>
                      <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 space-y-1">
                        <span className="font-bold text-rose-900 block text-xs">🧾 Lịch Sử Đơn Hàng</span>
                        <p className="text-slate-500 text-[11px]">Đơn hàng, chi tiết món & topping</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. File Upload & Ingestion Settings Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                    <div className="pb-3 border-b border-slate-100">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-emerald-600" />
                        {t('settings.upload_import_title')}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Chọn file mẫu Excel (.xlsx) hoặc file (.csv) đã điền dữ liệu để tiến hành nhập.
                      </p>
                    </div>

                    {/* File Dropzone */}
                    <div
                      onClick={() => importInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/20 space-y-2"
                    >
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportFileSelect}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 block text-xs">
                          {importFile ? importFile.name : t('settings.upload_import_title')}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {importFile
                            ? `${(importFile.size / 1024).toFixed(1)} KB · Bấm để đổi file khác`
                            : t('settings.upload_import_drag_hint')}
                        </span>
                      </div>
                    </div>

                    {/* Configuration Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <label className="font-semibold text-slate-700 mb-1.5 block">
                          {t('settings.import_target_label')}
                        </label>
                        <ModernSelect
                          size="sm"
                          value={importTarget}
                          onChange={(val) => setImportTarget(String(val))}
                          options={[
                            { value: 'all', label: t('settings.target_all') },
                            { value: 'categories', label: t('settings.target_categories') },
                            { value: 'toppings', label: t('settings.target_toppings') },
                            { value: 'products', label: t('settings.target_products') },
                            { value: 'transactions', label: t('settings.target_transactions') },
                            { value: 'orders', label: t('settings.target_orders') },
                          ]}
                        />
                      </div>

                      <div className="sm:col-span-2 flex flex-col justify-end space-y-2.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={upsertProducts}
                            onChange={(e) => setUpsertProducts(e.target.checked)}
                            className="w-4 h-4 accent-emerald-600 rounded"
                          />
                          <span className="text-slate-700 font-medium">
                            {t('settings.opt_upsert_products')}
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={updateFunds}
                            onChange={(e) => setUpdateFunds(e.target.checked)}
                            className="w-4 h-4 accent-emerald-600 rounded"
                          />
                          <span className="text-slate-700 font-medium">
                            {t('settings.opt_update_funds')}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        disabled={!importFile || importingData}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-md transition flex items-center gap-2"
                      >
                        {importingData ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <UploadCloud className="w-4 h-4" />
                        )}
                        <span>{importingData ? t('settings.importing_loading') : t('settings.start_import_btn')}</span>
                      </button>
                    </div>

                    {/* Import Result Breakdown */}
                    {importResult && (
                      <div className="space-y-4 pt-2 animate-in fade-in">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              {importResult.message || t('settings.import_success_title')}
                            </span>
                          </div>

                          {importResult.stats && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-slate-900 text-sm block">{importResult.stats.categories_count}</span>
                                Danh mục món
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-slate-900 text-sm block">{importResult.stats.toppings_count}</span>
                                Topping
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-slate-900 text-sm block">{importResult.stats.products_count}</span>
                                Món ăn ({importResult.stats.variants_count} size)
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-slate-900 text-sm block">{importResult.stats.transactions_count}</span>
                                Giao dịch thu chi
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-slate-900 text-sm block">{importResult.stats.orders_count}</span>
                                Đơn hàng ({importResult.stats.order_items_count} chi tiết món)
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-slate-900 text-sm block">{importResult.stats.total_errors}</span>
                                Cảnh báo / Lỗi
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Error Log Table */}
                        {importResult.errors && importResult.errors.length > 0 && (
                          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                            <h4 className="font-bold text-rose-800 text-xs flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                              {t('settings.import_errors_title')} ({importResult.errors.length})
                            </h4>
                            <div className="max-h-48 overflow-y-auto divide-y divide-rose-100 border border-rose-100 rounded-xl bg-white text-[11px]">
                              {importResult.errors.map((err: any, idx: number) => (
                                <div key={idx} className="p-2.5 flex items-start gap-2">
                                  <span className="font-mono font-bold text-rose-600 shrink-0">#{idx + 1}</span>
                                  <div className="space-y-0.5 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800">{err.sheet}</span>
                                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">Dòng {err.row}</span>
                                      {err.field && <span className="text-slate-400">({err.field})</span>}
                                    </div>
                                    <p className="text-rose-700">{err.message}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save Button (hidden on backup and import tabs) */}
              {activeTab !== 'backup' && activeTab !== 'import' && (
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
              )}
            </form>
          )}

          {/* Restore Confirmation Modal */}
          {showRestoreModal && backupPreview && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95">
                <div className="flex items-center gap-3 text-amber-600">
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{t('settings.restore_confirm_title')}</h3>
                    <p className="text-slate-500 text-xs">File: {backupFile?.name}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('settings.restore_confirm_desc')}
                </p>

                {backupPreview.stats && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600">
                    <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                      Thống kê dữ liệu trong file:
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <div>• Danh mục: <b>{backupPreview.stats.categories || 0}</b></div>
                      <div>• Sản phẩm: <b>{backupPreview.stats.products || 0}</b></div>
                      <div>• Topping: <b>{backupPreview.stats.toppings || 0}</b></div>
                      <div>• Đơn hàng: <b>{backupPreview.stats.orders || 0}</b></div>
                      <div>• Giao dịch: <b>{backupPreview.stats.transactions || 0}</b></div>
                      <div>• Quỹ tiền: <b>{backupPreview.stats.funds || 0}</b></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={restoringBackup}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    {restoringBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    <span>{t('settings.restore_btn')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SMTP Test Result toast */}
          {smtpTestResult && (
            <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold ${
              smtpTestResult.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {smtpTestResult.message}
            </div>
          )}
      </div>
    </AppShell>
  );
}
