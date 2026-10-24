'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coffee,
  Lock,
  User,
  LogIn,
  AlertCircle,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  Store as StoreIcon,
  Phone,
  Mail,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { fetchApi, getImageUrl } from '@/lib/api';
import { setAuth, UserInfo } from '@/lib/auth';
import { getSavedStoreBrand, setActiveStoreId } from '@/lib/store';
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

  // Mode: 'login' | 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Saved store branding (pre-auth)
  const [savedBrand, setSavedBrand] = useState<{ store_name?: string; logo_url?: string } | null>(null);

  useEffect(() => {
    setSavedBrand(getSavedStoreBrand());
  }, []);

  const storeLogo = savedBrand?.logo_url || null;
  const lastStoreName = savedBrand?.store_name || null;

  // Login form state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Register form state
  const [regFullName, setRegFullName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regPinCode, setRegPinCode] = useState<string>('');
  const [regStoreName, setRegStoreName] = useState<string>('');
  const [regBusinessType, setRegBusinessType] = useState<string>('cafe');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [showRegConfirm, setShowRegConfirm] = useState<boolean>(false);

  // Password setup modal state (for seeded accounts requiring first-time setup)
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [setupData, setSetupData] = useState<NeedsSetupData | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [setupLoading, setSetupLoading] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState<boolean>(false);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetchApi<LoginData | NeedsSetupData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    const resStatus = (res as { status: string }).status;

    if (resStatus === 'success' && res.data) {
      const loginData = res.data as LoginData;
      setAuth(loginData.token, loginData.user);
      if (loginData.user.default_store_id) {
        setActiveStoreId(loginData.user.default_store_id);
      }
      router.push('/');
    } else if (resStatus === 'needs_setup' && res.data) {
      setSetupData(res.data as NeedsSetupData);
      setShowSetupModal(true);
    } else {
      setError(res.message || t('login.invalid_credentials') || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
    setLoading(false);
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Frontend validations
    if (regPassword !== regConfirmPassword) {
      setError(t('login.password_mismatch') || 'Mật khẩu xác nhận không khớp.');
      return;
    }
    if (regPassword.length < 6) {
      setError(t('login.password_min_length') || 'Mật khẩu phải từ 6 ký tự trở lên.');
      return;
    }
    if (regPinCode && !/^\d{4,6}$/.test(regPinCode)) {
      setError(t('login.invalid_pin') || 'Mã PIN phải gồm từ 4 đến 6 chữ số.');
      return;
    }
    if (!regStoreName.trim()) {
      setError(t('login.store_name_required') || 'Vui lòng nhập tên cửa hàng khởi tạo.');
      return;
    }

    setLoading(true);

    const res = await fetchApi<LoginData>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: regUsername.trim(),
        full_name: regFullName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        password: regPassword,
        pin_code: regPinCode.trim(),
        store_name: regStoreName.trim(),
        business_type: regBusinessType,
      }),
    });

    if (res.status === 'success' && res.data) {
      setAuth(res.data.token, res.data.user);
      if (res.data.user.default_store_id) {
        setActiveStoreId(res.data.user.default_store_id);
      }
      router.push('/');
    } else {
      setError(res.message || 'Đăng ký tài khoản thất bại. Vui lòng thử lại.');
    }
    setLoading(false);
  };

  // Handle First-time Password Setup
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (newPassword !== confirmPassword) {
      setSetupError(t('login.password_mismatch') || 'Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 6) {
      setSetupError('Mật khẩu phải từ 6 ký tự trở lên.');
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
      if (res.data.user.default_store_id) {
        setActiveStoreId(res.data.user.default_store_id);
      }
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else {
      setSetupError(res.message || 'Thiết lập mật khẩu thất bại. Vui lòng thử lại.');
    }
    setSetupLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-3 sm:p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 border border-slate-100 my-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-xs items-center justify-center">
            {storeLogo ? (
              <img
                src={getImageUrl(storeLogo) || storeLogo}
                alt="Store Logo"
                className="h-10 max-w-[140px] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Coffee className="w-8 h-8 text-emerald-600" />
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">RabbitPOS</h1>
          <p className="text-xs text-slate-500 font-medium">
            {lastStoreName ? `Chi nhánh gần nhất: ${lastStoreName}` : t('login.subtitle')}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 sm:py-2.5 text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 flex items-center justify-center space-x-1.5 ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t('login.tab_signin') || 'Đăng nhập'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 sm:py-2.5 text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 flex items-center justify-center space-x-1.5 ${
              mode === 'register'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('login.tab_register') || 'Đăng ký tài khoản'}</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3.5 rounded-2xl flex items-start space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* ── TAB 1: LOGIN FORM ────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block uppercase tracking-wider">
                {t('login.username')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder={t('login.username_placeholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block uppercase tracking-wider">
                {t('login.password')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={t('login.password_placeholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-700/20 transition flex items-center justify-center space-x-2 text-sm cursor-pointer active:scale-95"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{t('login.sign_in')}</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                {t('login.prompt_no_account') || 'Chưa có tài khoản? Đăng ký khởi tạo quán ngay'}
              </button>
            </div>
          </form>
        )}

        {/* ── TAB 2: REGISTER FORM ─────────────────────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-3">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. Thông tin Chủ Tài Khoản</span>
              </span>

              {/* Full name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    placeholder="chu_quan_01"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="0912345678"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Email</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      placeholder="chuquan@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Mật khẩu (≥ 6 ký tự) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      tabIndex={-1}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Xác nhận mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirm ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirm(!showRegConfirm)}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      tabIndex={-1}
                    >
                      {showRegConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick PIN */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Mã PIN nhanh 4-6 số (Tùy chọn)
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="vd: 1234 (dùng mở khóa máy POS nhanh)"
                    value={regPinCode}
                    onChange={(e) => setRegPinCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* Store Information Section */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <StoreIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Thông tin Cửa Hàng Khởi Tạo</span>
              </span>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Tên cửa hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: Rabbit Coffee & Tea"
                  value={regStoreName}
                  onChange={(e) => setRegStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Loại hình kinh doanh
                </label>
                <select
                  value={regBusinessType}
                  onChange={(e) => setRegBusinessType(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white font-medium cursor-pointer transition"
                >
                  <option value="cafe">Quán Cà phê / Trà sữa / Đồ uống</option>
                  <option value="fnb">F&B / Nhà hàng / Quán ăn</option>
                  <option value="bakery">Tiệm Bánh & Tráng miệng</option>
                  <option value="retail">Cửa hàng Bán lẻ</option>
                  <option value="other">Mô hình kinh doanh khác</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-700/20 transition flex items-center justify-center space-x-2 text-sm cursor-pointer active:scale-95 mt-4"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Đăng Ký & Tạo Cửa Hàng</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                Đã có tài khoản? Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Password Setup Modal ─────────────────────────────────────── */}
      {showSetupModal && setupData && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe sm:pb-8 border border-slate-100">
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
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm cursor-pointer active:scale-95"
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
