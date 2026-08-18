'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coffee,
  Lock,
  User,
  LogIn,
  AlertCircle,
  RefreshCw,
  Shield,
  UserCheck,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { setAuth, UserInfo } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';

interface LoginData {
  token: string;
  user: UserInfo;
}

interface NeedsSetupData {
  username: string;
  temp_token: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();

  // Login form state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Password setup modal state
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [setupData, setSetupData] = useState<NeedsSetupData | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [setupLoading, setSetupLoading] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetchApi<LoginData | NeedsSetupData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    // Check for all three possible status values from the login endpoint
    const resStatus = (res as { status: string }).status;

    if (resStatus === 'success' && res.data) {
      // Normal successful login
      const loginData = res.data as LoginData;
      setAuth(loginData.token, loginData.user);
      router.push('/');
    } else if (resStatus === 'needs_setup' && res.data) {
      // First-time setup required — show the setup modal
      setSetupData(res.data as NeedsSetupData);
      setShowSetupModal(true);
    } else {
      setError(res.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (newPassword !== confirmPassword) {
      setSetupError(t('login.password_mismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setSetupError('Password must be at least 6 characters.');
      return;
    }
    if (!setupData) return;

    setSetupLoading(true);
    const res = await fetchApi<LoginData>('/auth/setup-password', {
      method: 'POST',
      body: JSON.stringify({
        username: setupData.username,
        temp_token: setupData.temp_token,
        new_password: newPassword,
      }),
    });

    if (res.status === 'success' && res.data) {
      setSetupSuccess(true);
      setAuth(res.data.token, res.data.user);
      // Brief success flash before redirecting
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else {
      setSetupError(res.message || 'Failed to set password. Please try again.');
    }
    setSetupLoading(false);
  };

  const setDemoCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
            <Coffee className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('login.title')}</h1>
          <p className="text-xs text-slate-500 font-medium">{t('login.subtitle')}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3.5 rounded-2xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block uppercase tracking-wider">{t('login.username')}</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                placeholder={t('login.username_placeholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block uppercase tracking-wider">{t('login.password')}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder={t('login.password_placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{t('login.sign_in')}</span>
          </button>
        </form>

        {/* Demo Quick Login Pills */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block text-center">
            {t('login.quick_demo_accounts')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDemoCredentials('admin', 'admin123')}
              className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-left transition flex items-center space-x-2"
            >
              <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <div>
                <span className="block font-bold text-xs text-indigo-900">{t('common.role_admin')}</span>
                <span className="text-[10px] text-slate-500">admin / admin123</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDemoCredentials('staff', 'staff123')}
              className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-left transition flex items-center space-x-2"
            >
              <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <span className="block font-bold text-xs text-blue-900">{t('common.role_staff')}</span>
                <span className="text-[10px] text-slate-500">staff / staff123</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Password Setup Modal ─────────────────────────────────────── */}
      {showSetupModal && setupData && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 shadow-sm">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {t('login.setup_password_title')}
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {t('login.setup_password_subtitle')}
              </p>
              <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                {setupData.username}
              </span>
            </div>

            {/* Success state */}
            {setupSuccess ? (
              <div className="flex flex-col items-center space-y-3 py-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-bold text-emerald-700">{t('login.setup_success')}</p>
              </div>
            ) : (
              <>
                {/* Setup Error */}
                {setupError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3.5 rounded-2xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{setupError}</span>
                  </div>
                )}

                {/* Setup Form */}
                <form onSubmit={handleSetupPassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block uppercase tracking-wider">
                      {t('login.new_password')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        id="setup-new-password"
                        type="password"
                        required
                        minLength={6}
                        placeholder={t('login.new_password_placeholder')}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block uppercase tracking-wider">
                      {t('login.confirm_password')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        id="setup-confirm-password"
                        type="password"
                        required
                        minLength={6}
                        placeholder={t('login.confirm_password_placeholder')}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    id="setup-submit-btn"
                    type="submit"
                    disabled={setupLoading}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm"
                  >
                    {setupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>{t('login.setup_submit')}</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
