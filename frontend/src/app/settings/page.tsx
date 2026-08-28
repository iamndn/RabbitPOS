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
  Building2,
  HelpCircle,
  FileCheck,
  Check,
  CreditCard,
  Clock,
  Trash2,
  ExternalLink,
  Zap,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, uploadImage, getImageUrl, getApiBaseUrl } from '@/lib/api';
import { SettingsMap, formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import ModernSelect from '@/components/common/ModernSelect';
import ImageCropModal from '@/components/common/ImageCropModal';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'store' | 'currency' | 'vietqr' | 'email' | 'sheets' | 'backup'>('store');
  const [backupSubTab, setBackupSubTab] = useState<'json_backup' | 'excel_import'>('json_backup');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoCropComplete = async (croppedFile: File) => {
    setLogoUploading(true);
    setErrorMessage(null);
    try {
      const res = await uploadImage(croppedFile);
      if (res.status === 'success' && res.data?.url) {
        handleChange('store_logo_url', res.data.url);
        setToastMessage(t('settings.logo_upload_success') || 'Tải ảnh logo thành công');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setErrorMessage(res.message || 'Tải ảnh logo thất bại');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Tải ảnh logo thất bại');
    } finally {
      setLogoUploading(false);
    }
  };

  // Form State
  const [form, setForm] = useState<SettingsMap>({
    store_name: 'Thỏ Juice & Coffee',
    store_address: '123 Võ Văn Kiệt, Q1, TP.HCM',
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
    google_sheets_sync_enabled: 'false',
    google_sheets_spreadsheet_id: '',
    google_sheets_service_account_json: '',
    google_sheets_auto_realtime_sync: 'true',
    google_sheets_last_synced_at: '',
    google_sheets_last_sync_status: 'idle',
    google_sheets_last_sync_error: '',
    auto_show_receipt_after_checkout: 'true',
  });

  const [testingSmtp, setTestingSmtp] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Google Sheets Action States
  const [testingSheets, setTestingSheets] = useState<boolean>(false);
  const [sheetsTestResult, setSheetsTestResult] = useState<{ type: 'success' | 'error'; message: string; details?: any } | null>(null);
  const [syncingSheetsNow, setSyncingSheetsNow] = useState<boolean>(false);
  const sheetsJsonFileRef = useRef<HTMLInputElement>(null);

  // JSON Backup & Restore V2 State
  const [exportingBackup, setExportingBackup] = useState<boolean>(false);
  const [previewingBackup, setPreviewingBackup] = useState<boolean>(false);
  const [restoringBackup, setRestoringBackup] = useState<boolean>(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any | null>(null);
  const [backupEncryptionKey, setBackupEncryptionKey] = useState<string>('');
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Excel & CSV Data Import State
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);
  const [importingData, setImportingData] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTarget, setImportTarget] = useState<string>('all');
  const [upsertProducts, setUpsertProducts] = useState<boolean>(true);
  const [updateFunds, setUpdateFunds] = useState<boolean>(true);
  const [importResult, setImportResult] = useState<any | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchApi<SettingsMap>('/settings');
      if (res.status === 'success' && res.data) {
        setForm((prev) => ({
          ...prev,
          ...res.data,
        }));
      } else {
        setErrorMessage(res.message || 'Không thể tải thông tin cài đặt');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
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

    try {
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
        setErrorMessage(res.message || 'Lưu cài đặt thất bại');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Lưu cài đặt thất bại');
    } finally {
      setSaving(false);
    }
  };

  // JSON Export Handler
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
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        setErrorMessage(res.message || 'Tải bản sao lưu thất bại');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Tải bản sao lưu thất bại');
    } finally {
      setExportingBackup(false);
    }
  };

  // JSON File Selection & Preview Handler (Dry-run)
  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFile(file);
    setRestoreResult(null);
    setErrorMessage(null);
    setPreviewingBackup(true);

    try {
      const baseUrl = getApiBaseUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;
      const formData = new FormData();
      formData.append('backup_file', file);
      if (backupEncryptionKey) {
        formData.append('encryption_key', backupEncryptionKey);
      }

      const res = await fetch(`${baseUrl}/backup/preview`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setBackupPreview(json.data);
      } else {
        setErrorMessage(json.message || 'Kiểm tra file sao lưu thất bại');
        setBackupPreview(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Kiểm tra file sao lưu thất bại');
      setBackupPreview(null);
    } finally {
      setPreviewingBackup(false);
    }
  };

  // JSON Restore Execute Handler with Single-Use Restore Token
  const handleExecuteRestore = async () => {
    if (!backupPreview || !backupPreview.restore_token) return;
    setRestoringBackup(true);
    setErrorMessage(null);
    setShowRestoreModal(false);

    try {
      const res = await fetchApi<any>('/backup/restore', {
        method: 'POST',
        body: JSON.stringify({
          restore_token: backupPreview.restore_token,
          encryption_key: backupEncryptionKey,
        }),
        headers: {
          'X-Restore-Token': backupPreview.restore_token,
        },
        skipCache: true,
      });

      if (res.status === 'success' && res.data) {
        setRestoreResult(res.data);
        setToastMessage(t('settings.restore_success'));
        setBackupFile(null);
        setBackupPreview(null);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        setErrorMessage(res.message || 'Phục hồi dữ liệu thất bại');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Phục hồi dữ liệu thất bại');
    } finally {
      setRestoringBackup(false);
    }
  };

  // Excel Template Download Handler
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setErrorMessage(null);
    try {
      const baseUrl = getApiBaseUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;
      const res = await fetch(`${baseUrl}/import/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Không thể tải file mẫu từ máy chủ');
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

  // Excel File Select Handler
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
  };

  // Excel Import Execute Handler
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
        setTimeout(() => setToastMessage(null), 3500);
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

  // SMTP Test Handler
  const handleTestSMTP = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetchApi<any>('/settings/test-smtp', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.status === 'success') {
        setSmtpTestResult({ type: 'success', message: t('email_report.test_smtp_success') });
      } else {
        setSmtpTestResult({ type: 'error', message: res.message || t('email_report.test_smtp_error') });
      }
    } catch (e: any) {
      setSmtpTestResult({ type: 'error', message: e.message || t('email_report.test_smtp_error') });
    } finally {
      setTestingSmtp(false);
      setTimeout(() => setSmtpTestResult(null), 5000);
    }
  };

  // Google Sheets Connection Test Handler
  const handleTestSheetsConnection = async () => {
    setTestingSheets(true);
    setSheetsTestResult(null);
    try {
      const res = await fetchApi<any>('/settings/sheets/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          spreadsheet_id: form.google_sheets_spreadsheet_id,
          service_account_json: form.google_sheets_service_account_json,
        }),
      });
      if (res.status === 'success' && res.data) {
        setSheetsTestResult({
          type: 'success',
          message: res.message || t('google_sheets.test_success_msg'),
          details: res.data,
        });
        setToastMessage(t('google_sheets.test_success_msg'));
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        setSheetsTestResult({
          type: 'error',
          message: res.message || t('google_sheets.test_error_msg', { error: 'Unknown' }),
        });
      }
    } catch (err: any) {
      setSheetsTestResult({
        type: 'error',
        message: err.message || t('google_sheets.test_error_msg', { error: 'Unknown' }),
      });
    } finally {
      setTestingSheets(false);
    }
  };

  // Google Sheets Sync All Now Handler
  const handleSyncSheetsNow = async () => {
    setSyncingSheetsNow(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const res = await fetchApi<any>('/settings/sheets/sync-now', {
        method: 'POST',
      });
      if (res.status === 'success') {
        setToastMessage(t('google_sheets.sync_success_msg'));
        if (res.data) {
          setForm((prev: any) => ({
            ...prev,
            google_sheets_last_synced_at: res.data.last_synced_at || new Date().toISOString(),
            google_sheets_last_sync_status: 'success',
            google_sheets_last_sync_error: '',
          }));
        }
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        const errMsg = res.message || t('google_sheets.sync_error_msg', { error: 'Unknown' });
        setErrorMessage(errMsg);
        setForm((prev: any) => ({
          ...prev,
          google_sheets_last_sync_status: 'error',
          google_sheets_last_sync_error: res.message || '',
        }));
      }
    } catch (err: any) {
      const errMsg = err.message || t('google_sheets.sync_error_msg', { error: 'Unknown' });
      setErrorMessage(errMsg);
    } finally {
      setSyncingSheetsNow(false);
    }
  };

  // Google Sheets Service Account JSON File Selection Handler
  const handleSheetsJsonFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text); // validate json syntax
      handleChange('google_sheets_service_account_json', text);
      setToastMessage('Đã tải lên tệp Service Account JSON thành công!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setErrorMessage('Tệp tải lên không phải là JSON hợp lệ.');
    } finally {
      if (sheetsJsonFileRef.current) sheetsJsonFileRef.current.value = '';
    }
  };

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto w-full max-w-full overflow-x-hidden">
        {/* Page Header */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {t('settings.title')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('settings.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Success Toast Banner */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-2xl shadow-xs flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {toastMessage}
            </span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3 rounded-2xl shadow-xs flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {errorMessage}
            </span>
          </div>
        )}

        {loading ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 flex flex-col justify-center items-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium text-slate-400">Đang tải cài đặt hệ thống...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Main Tab Navigation Bar (5 Main Tabs) */}
            <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex space-x-1.5 overflow-x-auto scrollbar-none">
              {/* Tab 1: Store */}
              <button
                type="button"
                onClick={() => setActiveTab('store')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  activeTab === 'store'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Store className={`w-4 h-4 ${activeTab === 'store' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{t('settings.tab_store')}</span>
              </button>

              {/* Tab 2: Currency */}
              <button
                type="button"
                onClick={() => setActiveTab('currency')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  activeTab === 'currency'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Coins className={`w-4 h-4 ${activeTab === 'currency' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{t('settings.tab_currency')}</span>
              </button>

              {/* Tab 3: VietQR */}
              <button
                type="button"
                onClick={() => setActiveTab('vietqr')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  activeTab === 'vietqr'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <QrCode className={`w-4 h-4 ${activeTab === 'vietqr' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{t('settings.tab_vietqr')}</span>
              </button>

              {/* Tab 4: Email */}
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  activeTab === 'email'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Mail className={`w-4 h-4 ${activeTab === 'email' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{t('settings.tab_email') || 'Cấu hình Email'}</span>
              </button>

              {/* Tab 5: Google Sheets Sync */}
              <button
                type="button"
                onClick={() => setActiveTab('sheets')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  activeTab === 'sheets'
                    ? 'bg-white text-teal-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'sheets' ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{t('google_sheets.tab_title') || 'Google Sheets'}</span>
              </button>

              {/* Tab 6: Backup & Data Management */}
              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  activeTab === 'backup'
                    ? 'bg-white text-violet-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Database className={`w-4 h-4 ${activeTab === 'backup' ? 'text-violet-600' : 'text-slate-400'}`} />
                <span>{t('settings.tab_backup')}</span>
              </button>
            </div>

            {/* TAB 1: Store Information */}
            {activeTab === 'store' && (
              <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 text-xs animate-in fade-in duration-150">
                <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t('settings.tab_store')}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Thông tin cơ bản hiển thị trên hóa đơn và tiêu đề hệ thống.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="app-label">
                      {t('settings.store_name')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.store_name || ''}
                      onChange={(e) => handleChange('store_name', e.target.value)}
                      className="app-input"
                      placeholder={t('settings.store_name_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="app-label">
                      {t('settings.store_phone')}
                    </label>
                    <input
                      type="text"
                      value={form.store_phone || ''}
                      onChange={(e) => handleChange('store_phone', e.target.value)}
                      className="app-input"
                      placeholder={t('settings.store_phone_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="app-label">
                      {t('settings.store_address')}
                    </label>
                    <input
                      type="text"
                      value={form.store_address || ''}
                      onChange={(e) => handleChange('store_address', e.target.value)}
                      className="app-input"
                      placeholder={t('settings.store_address_placeholder')}
                    />
                  </div>

                  {/* Store Logo Upload Section */}
                  <div className="md:col-span-2 pt-2 border-t border-slate-100 space-y-3">
                    <label className="font-semibold text-slate-700 block">
                      {t('settings.store_logo')}
                    </label>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Logo Preview box */}
                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                        {form.store_logo_url ? (
                          <img
                            src={getImageUrl(form.store_logo_url) || form.store_logo_url}
                            alt="Logo preview"
                            className="w-full h-full object-contain p-1.5"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      <div className="space-y-2 flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={form.store_logo_url || ''}
                            onChange={(e) => handleChange('store_logo_url', e.target.value)}
                            className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white focus:bg-white transition text-xs"
                            placeholder={t('settings.store_logo_placeholder')}
                          />
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoUploading}
                            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2.5 rounded-xl transition text-xs whitespace-nowrap disabled:opacity-50"
                          >
                            {logoUploading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <span>{t('settings.upload_logo')}</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Hỗ trợ định dạng ảnh PNG, JPG, SVG, WebP. Khuyến nghị ảnh vuông hoặc chữ nhật nhỏ.
                        </p>
                      </div>

                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setCropFile(file);
                          setIsCropModalOpen(true);
                          if (logoInputRef.current) logoInputRef.current.value = '';
                        }}
                      />
                    </div>
                  </div>

                  {/* POS & Receipt Printing Settings */}
                  <div className="md:col-span-2 pt-4 border-t border-slate-100 space-y-3">
                    <label className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>Cài đặt Bán hàng & In Hóa đơn POS</span>
                    </label>

                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 block text-xs">
                          Tự động bật hộp thoại in hóa đơn sau khi thanh toán đơn hàng
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Nếu tắt, đơn hàng sẽ hoàn tất nhanh mà không tự bật cửa sổ in (bạn vẫn có thể in lại bất cứ lúc nào trong mục Lịch sử đơn hàng).
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={form.auto_show_receipt_after_checkout !== 'false'}
                          onChange={(e) => handleChange('auto_show_receipt_after_checkout', e.target.checked ? 'true' : 'false')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Currency & Pricing */}
            {activeTab === 'currency' && (
              <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 text-xs animate-in fade-in duration-150">
                <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t('settings.tab_currency')}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Cấu hình định dạng hiển thị đơn vị tiền tệ trên toàn bộ ứng dụng và hóa đơn.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="font-semibold text-slate-700 mb-1.5 block">
                      {t('settings.currency_code')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.currency_code || ''}
                      onChange={(e) => handleChange('currency_code', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                      placeholder="VND, USD, EUR..."
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1.5 block">
                      {t('settings.currency_symbol')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.currency_symbol || ''}
                      onChange={(e) => handleChange('currency_symbol', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                      placeholder="đ, $, €..."
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 mb-1.5 block">
                      {t('settings.currency_position')}
                    </label>
                    <ModernSelect
                      value={form.currency_position || 'suffix'}
                      onChange={(val) => handleChange('currency_position', String(val))}
                      options={[
                        { value: 'suffix', label: t('settings.position_suffix') || 'Hậu tố (35.000 đ)', badge: 'Suffix', badgeColor: 'indigo' },
                        { value: 'prefix', label: t('settings.position_prefix') || 'Tiền tố ($35.000)', badge: 'Prefix', badgeColor: 'emerald' },
                      ]}
                    />
                  </div>

                  {/* Preview Box */}
                  <div className="sm:col-span-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100/80 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-indigo-900 font-semibold block">{t('settings.preview_label')}</span>
                      <span className="text-xs text-slate-500">Mẫu định dạng tiền tệ thực tế</span>
                    </div>
                    <span className="text-base font-extrabold text-indigo-700 bg-white px-3.5 py-1.5 rounded-xl border border-indigo-200 shadow-2xs">
                      {formatCurrency(35000, form)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VietQR Payment Settings */}
            {activeTab === 'vietqr' && (
              <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 text-xs animate-in fade-in duration-150">
                <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t('settings.tab_vietqr')}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Cấu hình tài khoản ngân hàng để tự động tạo mã VietQR động khi thanh toán tại quầy POS.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">
                        {t('settings.vietqr_bank_id')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.vietqr_bank_id || ''}
                        onChange={(e) => handleChange('vietqr_bank_id', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="MB, VCB, ACB, TCB, VPB, TPB, BIDV..."
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Mã ngân hàng chuẩn VietQR (VD: MB, VCB, ACB, VPB...)</p>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">
                        {t('settings.vietqr_account_no')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.vietqr_account_no || ''}
                        onChange={(e) => handleChange('vietqr_account_no', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white focus:bg-white transition font-mono"
                        placeholder={t('settings.vietqr_account_no_placeholder')}
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">
                        {t('settings.vietqr_account_name')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.vietqr_account_name || ''}
                        onChange={(e) => handleChange('vietqr_account_name', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 hover:bg-white focus:bg-white transition uppercase font-semibold"
                        placeholder={t('settings.vietqr_account_name_placeholder')}
                      />
                    </div>
                  </div>

                  {/* Visual Bank Card Mock Preview */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm tracking-wider text-indigo-300">VIETQR DYNAMIC</span>
                      <CreditCard className="w-6 h-6 text-indigo-400" />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Số tài khoản</span>
                      <span className="font-mono text-lg font-bold tracking-widest text-white block">
                        {form.vietqr_account_no || '•••• •••• ••••'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Chủ tài khoản</span>
                        <span className="font-bold text-slate-200 uppercase">
                          {form.vietqr_account_name || 'CHỦ TÀI KHOẢN'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Ngân hàng</span>
                        <span className="font-bold text-indigo-300">
                          {form.vietqr_bank_id || 'MBBANK'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Email & Automated Reports */}
            {activeTab === 'email' && (
              <div className="space-y-6 text-xs animate-in fade-in duration-150">
                {/* 1. SMTP Server Settings Card */}
                <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                  <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {t('email_report.settings_section_title')}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">{t('email_report.settings_section_desc')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.smtp_host')}</label>
                      <input type="text" value={form.smtp_host || ''} onChange={(e) => handleChange('smtp_host', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="smtp.gmail.com" />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.smtp_port')}</label>
                      <input type="text" value={form.smtp_port || ''} onChange={(e) => handleChange('smtp_port', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="587" />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.smtp_user')}</label>
                      <input type="email" value={form.smtp_user || ''} onChange={(e) => handleChange('smtp_user', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="your-email@gmail.com" />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.smtp_password')}</label>
                      <input type="password" value={form.smtp_password || ''} onChange={(e) => handleChange('smtp_password', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="xxxx xxxx xxxx xxxx" />
                      <p className="text-slate-400 text-[11px] mt-1">{t('email_report.smtp_password_hint')}</p>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.smtp_from_email')}</label>
                      <input type="email" value={form.smtp_from_email || ''} onChange={(e) => handleChange('smtp_from_email', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="rabbitpos@yourdomain.com" />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.smtp_from_name')}</label>
                      <input type="text" value={form.smtp_from_name || ''} onChange={(e) => handleChange('smtp_from_name', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="RabbitPOS" />
                    </div>
                  </div>

                  {/* Test SMTP button */}
                  <div className="pt-2 flex justify-end">
                    <button type="button" onClick={handleTestSMTP} disabled={testingSmtp}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center gap-2 shadow-xs">
                      {testingSmtp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{testingSmtp ? t('email_report.sending') : t('email_report.test_smtp_button')}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Automated Daily Report Configuration */}
                <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                  <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        Báo Cáo Tài Chính Tự Động Hàng Ngày
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">Tự động tổng hợp và gửi báo cáo kết ca / chốt ngày qua email cho ban quản lý.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="font-semibold text-slate-700 mb-1.5 block">{t('email_report.recipients')}</label>
                      <input type="text" value={form.report_recipient_emails || ''} onChange={(e) => handleChange('report_recipient_emails', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 hover:bg-white focus:bg-white transition"
                        placeholder="admin1@email.com,admin2@email.com" />
                      <p className="text-[11px] text-slate-400 mt-1">Nhiều email cách nhau bằng dấu phẩy (,)</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 transition hover:bg-emerald-50">
                        <input type="checkbox" checked={form.enable_daily_email_report === 'true'}
                          onChange={(e) => handleChange('enable_daily_email_report', e.target.checked ? 'true' : 'false')}
                          className="w-4 h-4 accent-emerald-600 rounded" />
                        <div>
                          <span className="text-xs font-bold text-emerald-900 block">{t('email_report.enable_auto_report')}</span>
                          <span className="text-[11px] text-emerald-700">Tự động gửi báo cáo mỗi ngày</span>
                        </div>
                      </label>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                        <label className="font-semibold text-slate-700 block">{t('email_report.report_time')}</label>
                        <input type="time" value={form.daily_report_time || '22:30'} onChange={(e) => handleChange('daily_report_time', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Google Sheets Synchronization */}
            {activeTab === 'sheets' && (
              <div className="space-y-6 text-xs animate-in fade-in duration-150">
                {/* 1. Configuration & Service Account Card */}
                <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
                  <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-100 text-teal-600">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {t('google_sheets.section_title')}
                        </h3>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {t('google_sheets.section_desc')}
                        </p>
                      </div>
                    </div>

                    {/* Quick status pill */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border ${
                        form.google_sheets_sync_enabled === 'true' && form.google_sheets_spreadsheet_id
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          form.google_sheets_sync_enabled === 'true' && form.google_sheets_spreadsheet_id
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-slate-400'
                        }`} />
                        {form.google_sheets_sync_enabled === 'true' && form.google_sheets_spreadsheet_id
                          ? t('google_sheets.connected_badge')
                          : t('google_sheets.not_connected_badge')}
                      </span>
                    </div>
                  </div>

                  {/* Sync Switches */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Enable Sync Master Switch */}
                    <label className="flex items-start gap-3 cursor-pointer bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 transition hover:bg-teal-50">
                      <input
                        type="checkbox"
                        checked={form.google_sheets_sync_enabled === 'true'}
                        onChange={(e) => handleChange('google_sheets_sync_enabled', e.target.checked ? 'true' : 'false')}
                        className="w-4 h-4 accent-teal-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-teal-950 block">
                          {t('google_sheets.enable_sync')}
                        </span>
                        <span className="text-[11px] text-teal-700">
                          {t('google_sheets.enable_sync_desc')}
                        </span>
                      </div>
                    </label>

                    {/* Real-time Append Switch */}
                    <label className="flex items-start gap-3 cursor-pointer bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 transition hover:bg-emerald-50">
                      <input
                        type="checkbox"
                        checked={form.google_sheets_auto_realtime_sync !== 'false'}
                        onChange={(e) => handleChange('google_sheets_auto_realtime_sync', e.target.checked ? 'true' : 'false')}
                        className="w-4 h-4 accent-emerald-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-emerald-950 block flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {t('google_sheets.realtime_sync')}
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          {t('google_sheets.realtime_sync_desc')}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Spreadsheet ID Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 block">
                        {t('google_sheets.spreadsheet_id')} <span className="text-rose-500">*</span>
                      </label>
                      {form.google_sheets_spreadsheet_id && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${form.google_sheets_spreadsheet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                        >
                          <span>{t('google_sheets.open_sheet_link')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      value={form.google_sheets_spreadsheet_id || ''}
                      onChange={(e) => handleChange('google_sheets_spreadsheet_id', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 hover:bg-white focus:bg-white transition font-mono text-xs"
                      placeholder={t('google_sheets.spreadsheet_id_placeholder')}
                    />
                    <p className="text-[11px] text-slate-400">
                      {t('google_sheets.spreadsheet_id_hint')}
                    </p>
                  </div>

                  {/* Service Account JSON Input & File Upload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 block">
                        {t('google_sheets.service_account_json')} <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => sheetsJsonFileRef.current?.click()}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition shadow-2xs"
                      >
                        <FileJson className="w-3.5 h-3.5 text-teal-600" />
                        <span>{t('google_sheets.upload_json_btn')}</span>
                      </button>
                    </div>

                    <input
                      ref={sheetsJsonFileRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleSheetsJsonFileSelect}
                      className="hidden"
                    />

                    <textarea
                      rows={5}
                      value={form.google_sheets_service_account_json || ''}
                      onChange={(e) => handleChange('google_sheets_service_account_json', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 hover:bg-white focus:bg-white transition font-mono text-[11px] leading-relaxed"
                      placeholder='{\n  "type": "service_account",\n  "project_id": "...",\n  "client_email": "...",\n  "private_key": "..."\n}'
                    />
                    <p className="text-[11px] text-slate-400">
                      {t('google_sheets.service_account_json_hint')}
                    </p>
                  </div>

                  {/* Important Google Permission Warning Banner */}
                  <div className="bg-amber-50/80 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] space-y-0.5">
                      <span className="font-bold">{t('google_sheets.permission_warning_title')}</span>
                      <p className="text-amber-800 leading-relaxed">
                        {t('google_sheets.permission_warning_desc')}
                      </p>
                    </div>
                  </div>

                  {/* Test Connection Button & Result Box */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
                    <div className="flex-1">
                      {sheetsTestResult && (
                        <div className={`p-3 rounded-xl border flex items-start gap-2 text-[11px] font-semibold animate-in fade-in ${
                          sheetsTestResult.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          {sheetsTestResult.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span>{sheetsTestResult.message}</span>
                            {sheetsTestResult.details?.sheets && (
                              <p className="font-normal text-emerald-700 mt-0.5 text-[10px]">
                                Các trang tính: {sheetsTestResult.details.sheets.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleTestSheetsConnection}
                      disabled={testingSheets || !form.google_sheets_spreadsheet_id || !form.google_sheets_service_account_json}
                      className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition flex items-center justify-center gap-2 shadow-xs shrink-0"
                    >
                      {testingSheets ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>{testingSheets ? t('google_sheets.testing_connection') : t('google_sheets.test_connection_btn')}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Sync Status & Controls Card */}
                <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                  <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {t('google_sheets.sync_status_title')}
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {t('google_sheets.sync_status_desc')}
                      </p>
                    </div>
                  </div>

                  {/* Status Metrics Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">
                        {t('google_sheets.status_label')}
                      </span>
                      <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          form.google_sheets_last_sync_status === 'success'
                            ? 'bg-emerald-500'
                            : form.google_sheets_last_sync_status === 'error'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`} />
                        {form.google_sheets_last_sync_status === 'success'
                          ? t('google_sheets.status_success')
                          : form.google_sheets_last_sync_status === 'error'
                          ? t('google_sheets.status_error')
                          : t('google_sheets.status_idle')}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">
                        {t('google_sheets.last_synced_at')}
                      </span>
                      <span className="font-bold text-xs text-slate-800 block">
                        {form.google_sheets_last_synced_at || t('google_sheets.never_synced')}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">
                          Trang Tính
                        </span>
                        <span className="font-bold text-xs text-slate-800">5 Tabs Chuẩn</span>
                      </div>
                      {form.google_sheets_spreadsheet_id ? (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${form.google_sheets_spreadsheet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Mở Sheet</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Chưa nhập ID</span>
                      )}
                    </div>
                  </div>

                  {/* Sync Error Alert if any */}
                  {form.google_sheets_last_sync_error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] space-y-0.5">
                        <span className="font-bold">Lỗi đồng bộ gần nhất:</span>
                        <p className="text-rose-800 font-mono text-[10px]">{form.google_sheets_last_sync_error}</p>
                      </div>
                    </div>
                  )}

                  {/* Managed Tabs Visual List */}
                  <div className="space-y-2.5 pt-2">
                    <span className="font-bold text-slate-800 text-xs block">
                      {t('google_sheets.synced_tabs_title')}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 space-y-0.5">
                        <span className="font-bold text-slate-900 block text-xs">{t('google_sheets.tab_1_name')}</span>
                        <p className="text-[11px] text-slate-500">{t('google_sheets.tab_1_desc')}</p>
                      </div>
                      <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 space-y-0.5">
                        <span className="font-bold text-slate-900 block text-xs">{t('google_sheets.tab_2_name')}</span>
                        <p className="text-[11px] text-slate-500">{t('google_sheets.tab_2_desc')}</p>
                      </div>
                      <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 space-y-0.5">
                        <span className="font-bold text-slate-900 block text-xs">{t('google_sheets.tab_3_name')}</span>
                        <p className="text-[11px] text-slate-500">{t('google_sheets.tab_3_desc')}</p>
                      </div>
                      <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 space-y-0.5">
                        <span className="font-bold text-slate-900 block text-xs">{t('google_sheets.tab_4_name')}</span>
                        <p className="text-[11px] text-slate-500">{t('google_sheets.tab_4_desc')}</p>
                      </div>
                      <div className="sm:col-span-2 bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 space-y-0.5">
                        <span className="font-bold text-slate-900 block text-xs">{t('google_sheets.tab_5_name')}</span>
                        <p className="text-[11px] text-slate-500">{t('google_sheets.tab_5_desc')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sync All Now Trigger Button */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">
                      Đồng bộ định kỳ tự động chạy mỗi đêm lúc 22:30 cùng báo cáo doanh thu.
                    </p>
                    <button
                      type="button"
                      onClick={handleSyncSheetsNow}
                      disabled={syncingSheetsNow || !form.google_sheets_spreadsheet_id || !form.google_sheets_service_account_json}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
                    >
                      {syncingSheetsNow ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span>{syncingSheetsNow ? t('google_sheets.syncing_now') : t('google_sheets.sync_all_now_btn')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: Backup & Data Management (with Sub-tab Switcher) */}
            {activeTab === 'backup' && (
              <div className="space-y-6 text-xs animate-in fade-in duration-150">
                {/* Sub-Tab Switcher inside Backup Tab */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 w-full sm:w-fit gap-1">
                  <button
                    type="button"
                    onClick={() => setBackupSubTab('json_backup')}
                    className={`flex-1 sm:flex-none py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      backupSubTab === 'json_backup'
                        ? 'bg-white text-violet-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Sao Lưu & Phục Hồi (.json)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBackupSubTab('excel_import')}
                    className={`flex-1 sm:flex-none py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      backupSubTab === 'excel_import'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Nhập Dữ Liệu Excel / CSV</span>
                  </button>
                </div>

                {/* Sub-tab 1: JSON Backup & Restore */}
                {backupSubTab === 'json_backup' && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* 1. Export Backup Card */}
                    <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                      <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-2.5 bg-violet-50 rounded-xl border border-violet-100 text-violet-600">
                          <Download className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">
                            {t('settings.backup_section_title')}
                          </h3>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {t('settings.backup_section_desc')}
                          </p>
                        </div>
                      </div>

                      <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-violet-600" />
                            Toàn bộ cơ sở dữ liệu hệ thống (Định dạng JSON chuẩn)
                          </span>
                          <p className="text-slate-500 text-[11px] leading-relaxed">
                            Bao gồm: Thực đơn, Danh mục, Biến thể, Topping, Quỹ tiền, Sổ thu chi, Đơn hàng, Khuyến mãi và Cài đặt cửa hàng.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportBackup}
                          disabled={exportingBackup}
                          className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-5 rounded-xl shadow-xs transition flex items-center gap-2 shrink-0 self-start sm:self-auto"
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
                    <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                      <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">
                            {t('settings.restore_section_title')}
                          </h3>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {t('settings.restore_section_desc')}
                          </p>
                        </div>
                      </div>

                      {/* Warning banner */}
                      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <span className="font-bold">Lưu ý quan trọng:</span>
                          <p className="text-amber-800 leading-relaxed">{t('settings.restore_warning')}</p>
                        </div>
                      </div>

                      {/* File Upload Drop Area */}
                      <div
                        onClick={() => backupInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-2xl p-7 text-center cursor-pointer transition bg-slate-50/50 hover:bg-violet-50/20 space-y-2"
                      >
                        <input
                          ref={backupInputRef}
                          type="file"
                          accept=".json,.enc,application/json"
                          onChange={handleBackupFileSelect}
                          className="hidden"
                        />
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-violet-600 flex items-center justify-center mx-auto shadow-2xs">
                          {previewingBackup ? <RefreshCw className="w-6 h-6 animate-spin text-violet-600" /> : <FileJson className="w-6 h-6" />}
                        </div>
                        <div>
                          <span className="font-bold text-slate-700 block text-xs">
                            {previewingBackup
                              ? 'Đang kiểm tra toàn vẹn file sao lưu...'
                              : backupFile
                              ? backupFile.name
                              : t('settings.restore_select_file')}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {backupFile
                              ? `${(backupFile.size / 1024).toFixed(1)} KB · Bấm để chọn file khác`
                              : t('settings.restore_drag_hint')}
                          </span>
                        </div>
                      </div>

                      {/* Backup Preview V2 Rich Card */}
                      {backupPreview && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">Phiên bản:</span>
                              {backupPreview.format_version === '2.0' ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Chuẩn V2.0 (16 Bảng dữ liệu)
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Chuẩn cũ V1.0 (Thiếu BOM & NVL)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {backupPreview.checksum_valid ? (
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Checksum SHA-256 Hợp Lệ
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">Không có Checksum V2</span>
                              )}
                            </div>
                          </div>

                          {/* Warnings List if any */}
                          {backupPreview.warnings && backupPreview.warnings.length > 0 && (
                            <div className="bg-amber-50/80 border border-amber-200 text-amber-900 p-3 rounded-xl space-y-1">
                              {backupPreview.warnings.map((w: string, idx: number) => (
                                <div key={idx} className="text-[11px] flex items-start gap-1.5 leading-relaxed">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{w}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 16 Tables Stats Grid */}
                          {backupPreview.stats && (
                            <div className="space-y-1.5">
                              <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                                Thống kê 16 bảng dữ liệu:
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] text-slate-600">
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.categories || 0}</span> Danh mục
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.products || 0}</span> Sản phẩm
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.product_variants || 0}</span> Biến thể
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.toppings || 0}</span> Topping
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-indigo-600">{backupPreview.stats.ingredients || 0}</span> Nguyên vật liệu
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-indigo-600">{backupPreview.stats.purchase_items || 0}</span> Nhập hàng
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-indigo-600">{backupPreview.stats.recipe_items || 0}</span> Định lượng BOM
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.promotions || 0}</span> Khuyến mãi
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.orders || 0}</span> Đơn hàng
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.order_items || 0}</span> Chi tiết đơn
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.transactions || 0}</span> Giao dịch
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                                  <span className="font-bold text-slate-900">{backupPreview.stats.funds || 0}</span> Quỹ tiền
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Button */}
                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setShowRestoreModal(true)}
                              disabled={restoringBackup || !backupPreview.restore_token}
                              className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                            >
                              {restoringBackup ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <UploadCloud className="w-4 h-4" />
                              )}
                              <span>{restoringBackup ? t('settings.restore_loading') : 'Khôi phục dữ liệu'}</span>
                            </button>
                          </div>
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
                                <span className="font-semibold text-slate-800">{restoreResult.restored_stats.ingredients || 0}</span> NVL
                              </div>
                              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                                <span className="font-semibold text-slate-800">{restoreResult.restored_stats.recipe_items || 0}</span> BOM
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
                                <span className="font-semibold text-slate-800">{restoreResult.restored_stats.settings}</span> Cài đặt
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Excel & CSV Data Import */}
                {backupSubTab === 'excel_import' && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* 1. Download Template Card */}
                    <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                      <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">
                              {t('settings.import_section_title')}
                            </h3>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {t('settings.import_section_desc')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href="/mau_import_don_hang.xlsx"
                            download="mau_import_don_hang.xlsx"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 px-3.5 rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 shrink-0"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>Mẫu đơn hàng (.xlsx)</span>
                          </a>
                          <a
                            href="/mau_import_don_hang.csv"
                            download="mau_import_don_hang.csv"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 px-3.5 rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 shrink-0"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                            <span>Mẫu đơn (.csv)</span>
                          </a>
                          <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition flex items-center gap-2 shrink-0 self-start sm:self-auto"
                          >
                            {downloadingTemplate ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            <span>{t('settings.download_template_btn')}</span>
                          </button>
                        </div>
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
                    <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                      <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">
                            {t('settings.upload_import_title')}
                          </h3>
                          <p className="text-slate-500 text-xs mt-0.5">
                            Chọn file Excel (.xlsx) hoặc file (.csv) chuẩn để tiến hành nạp dữ liệu.
                          </p>
                        </div>
                      </div>

                      {/* File Dropzone */}
                      <div
                        onClick={() => importInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-7 text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/20 space-y-2"
                      >
                        <input
                          ref={importInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImportFileSelect}
                          className="hidden"
                        />
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-700 block text-xs">
                            {importFile ? importFile.name : t('settings.upload_import_title')}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {importFile
                              ? `${(importFile.size / 1024).toFixed(1)} KB · Bấm để chọn file khác`
                              : t('settings.upload_import_drag_hint')}
                          </span>
                        </div>
                      </div>

                      {/* Configuration Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
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
                          <label className="flex items-center gap-2.5 cursor-pointer">
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

                          <label className="flex items-center gap-2.5 cursor-pointer">
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
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center gap-2"
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
              </div>
            )}

            {/* Save Button (displayed for form-based tabs: store, currency, vietqr, email) */}
            {activeTab !== 'backup' && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-xs transition flex items-center space-x-2"
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
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl space-y-4 sm:space-y-5 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe sm:pb-8 border border-slate-100">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">{t('settings.restore_confirm_title')}</h3>
                  <p className="text-slate-500 text-xs truncate">File: {backupFile?.name}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-medium text-slate-600">Phiên bản:</span>
                {backupPreview.format_version === '2.0' ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    V2.0 (16 Bảng dữ liệu)
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    V1.0 (Thiếu BOM & NVL)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {t('settings.restore_confirm_desc')}
              </p>

              {backupPreview.stats && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                    Thống kê dữ liệu trong file:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div>• Danh mục: <b>{backupPreview.stats.categories || 0}</b></div>
                    <div>• Sản phẩm: <b>{backupPreview.stats.products || 0}</b></div>
                    <div>• Topping: <b>{backupPreview.stats.toppings || 0}</b></div>
                    <div>• Nguyên vật liệu: <b>{backupPreview.stats.ingredients || 0}</b></div>
                    <div>• Định lượng BOM: <b>{backupPreview.stats.recipe_items || 0}</b></div>
                    <div>• Đơn hàng: <b>{backupPreview.stats.orders || 0}</b></div>
                    <div>• Giao dịch: <b>{backupPreview.stats.transactions || 0}</b></div>
                    <div>• Quỹ tiền: <b>{backupPreview.stats.funds || 0}</b></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer text-center justify-center flex items-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={restoringBackup || !backupPreview.restore_token}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
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
          <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold animate-in fade-in slide-in-from-top-2 ${
            smtpTestResult.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {smtpTestResult.message}
          </div>
        )}

        {/* 1:1 Image Crop Modal */}
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageFile={cropFile}
          onClose={() => setIsCropModalOpen(false)}
          onCropComplete={handleLogoCropComplete}
          aspectRatio={1}
        />
      </div>
    </AppShell>
  );
}
