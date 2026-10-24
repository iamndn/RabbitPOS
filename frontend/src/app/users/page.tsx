'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  KeyRound,
  Phone,
  Mail,
  Edit2,
  Lock,
  Power,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Building2,
  Hash,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi } from '@/lib/api';
import { getAuthUser, isMasterRole, isOwnerRole, UserInfo } from '@/lib/auth';
import { useStore } from '@/lib/StoreContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface UserItem {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  role: string;
  is_active: boolean;
  has_pin: boolean;
  needs_password_setup: boolean;
  last_login_at?: string | null;
  stores?: Array<{
    id: number;
    name: string;
    role: string;
    is_default: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { isSuperAdmin, storeRole } = useStore();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    phone: '',
    email: '',
    role: 'staff' as 'master' | 'owner' | 'staff',
    password: '',
    pin_code: '',
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Password & PIN Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');

  const isMasterCaller = useMemo(() => {
    return isMasterRole(currentUser?.role) || isSuperAdmin;
  }, [currentUser?.role, isSuperAdmin]);

  const isOwnerCaller = useMemo(() => {
    return isOwnerRole(currentUser?.role) || storeRole === 'store_admin';
  }, [currentUser?.role, storeRole]);

  // Authorization check on mount: Only Master and Owner can access
  useEffect(() => {
    const user = getAuthUser();
    setCurrentUser(user);
    if (!user || (!isMasterRole(user.role) && !isOwnerRole(user.role) && storeRole !== 'store_admin' && !isSuperAdmin)) {
      router.push('/');
    }
  }, [router, storeRole, isSuperAdmin]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi<UserItem[]>('/users', { skipCache: true });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setUsers(res.data);
      } else {
        toast.error(res.message || t('users.loading') || 'Không thể tải danh sách nhân viên');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));

      const matchRole =
        roleFilter === 'all' ||
        (roleFilter === 'master' && (u.role === 'master' || u.role === 'super_admin' || u.role === 'admin')) ||
        (roleFilter === 'owner' && (u.role === 'owner' || u.role === 'store_admin')) ||
        (roleFilter === 'staff' && (u.role === 'staff' || u.role === 'cashier'));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.is_active) ||
        (statusFilter === 'inactive' && !u.is_active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Counts
  const stats = useMemo(() => {
    let masterCount = 0;
    let ownerCount = 0;
    let staffCount = 0;
    users.forEach((u) => {
      if (u.role === 'master' || u.role === 'super_admin' || u.role === 'admin') masterCount++;
      else if (u.role === 'owner' || u.role === 'store_admin') ownerCount++;
      else staffCount++;
    });
    return { total: users.length, master: masterCount, owner: ownerCount, staff: staffCount };
  }, [users]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      phone: '',
      email: '',
      role: 'staff',
      password: '',
      pin_code: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    let normalizedRole: 'master' | 'owner' | 'staff' = 'staff';
    if (user.role === 'master' || user.role === 'super_admin' || user.role === 'admin') {
      normalizedRole = 'master';
    } else if (user.role === 'owner' || user.role === 'store_admin') {
      normalizedRole = 'owner';
    }
    setFormData({
      username: user.username,
      full_name: user.full_name || '',
      phone: user.phone || '',
      email: user.email || '',
      role: normalizedRole,
      password: '',
      pin_code: '',
      is_active: user.is_active,
    });
    setIsModalOpen(true);
  };

  // Submit User Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!editingUser && (!formData.password || formData.password.length < 6)) {
      toast.error('Mật khẩu khởi tạo phải từ 6 ký tự trở lên');
      return;
    }
    if (formData.pin_code && !/^\d{4,6}$/.test(formData.pin_code)) {
      toast.error('Mã PIN nhanh phải gồm 4 đến 6 chữ số');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        // Update user
        const payload: any = {
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active,
        };
        if (formData.password.trim()) {
          payload.password = formData.password.trim();
        }
        if (formData.pin_code !== '') {
          payload.pin_code = formData.pin_code;
        }

        const res = await fetchApi(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.status === 'success') {
          toast.success(t('users.toast_update_success') || 'Cập nhật nhân viên thành công');
          setIsModalOpen(false);
          loadUsers();
        } else {
          toast.error(res.message || 'Cập nhật thất bại');
        }
      } else {
        // Create user
        const res = await fetchApi('/users', {
          method: 'POST',
          body: JSON.stringify(formData),
        });

        if (res.status === 'success') {
          toast.success(t('users.toast_create_success') || 'Thêm nhân viên mới thành công');
          setIsModalOpen(false);
          loadUsers();
        } else {
          toast.error(res.message || 'Tạo nhân viên thất bại');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Đã có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (user: UserItem) => {
    const isActivating = !user.is_active;
    const title = isActivating
      ? (t('users.confirm_unlock_title') || 'Kích hoạt tài khoản')
      : (t('users.confirm_lock_title') || 'Khóa tài khoản');
    const msgTemplate = isActivating
      ? (t('users.confirm_unlock_msg') || `Bạn có chắc chắn muốn kích hoạt tài khoản '{username}'?`)
      : (t('users.confirm_lock_msg') || `Bạn có chắc chắn muốn khóa tài khoản '{username}'?`);
    const message = msgTemplate.replace('{username}', user.username);

    const ok = await confirm({
      title,
      message,
      confirmText: isActivating ? 'Kích hoạt' : 'Khóa',
      cancelText: t('common.cancel') || 'Hủy',
      type: isActivating ? 'info' : 'danger',
    });

    if (ok) {
      try {
        const res = await fetchApi(`/users/${user.id}/toggle-status`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: !user.is_active }),
        });
        if (res.status === 'success') {
          toast.success(t('users.toast_status_success') || 'Cập nhật trạng thái thành công');
          loadUsers();
        } else {
          toast.error(res.message || 'Thao tác thất bại');
        }
      } catch (err: any) {
        toast.error(err.message || 'Thao tác thất bại');
      }
    }
  };

  // Open Quick Password/PIN Modal
  const handleOpenPasswordModal = (user: UserItem) => {
    setPasswordTargetUser(user);
    setNewPassword('');
    setNewPin('');
    setIsPasswordModalOpen(true);
  };

  const handleSavePasswordPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    if (!newPassword.trim() && !newPin.trim()) {
      toast.error('Vui lòng nhập mật khẩu mới hoặc mã PIN mới');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }
    if (newPin && !/^\d{4,6}$/.test(newPin)) {
      toast.error('Mã PIN phải từ 4 đến 6 chữ số');
      return;
    }

    try {
      const payload: any = {};
      if (newPassword.trim()) payload.password = newPassword.trim();
      if (newPin.trim()) payload.pin_code = newPin.trim();

      const res = await fetchApi(`/users/${passwordTargetUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.status === 'success') {
        toast.success(t('users.toast_pwd_success') || 'Đã cập nhật mật khẩu / PIN thành công');
        setIsPasswordModalOpen(false);
        loadUsers();
      } else {
        toast.error(res.message || 'Cập nhật thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Đã có lỗi xảy ra');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master':
      case 'super_admin':
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            {t('users.role_master_badge') || 'Master (Owner)'}
          </span>
        );
      case 'owner':
      case 'store_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            {t('users.role_owner_badge') || 'Owner (Quản lý)'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Users className="w-3.5 h-3.5 text-purple-600" />
            {t('users.role_staff_badge') || 'Staff (Thu ngân)'}
          </span>
        );
    }
  };

  const formatLastLogin = (dateStr?: string | null) => {
    if (!dateStr) return t('users.never_logged_in') || 'Chưa đăng nhập';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-md shadow-purple-200 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {t('users.title') || 'Quản lý Nhân sự & Phân quyền'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {t('users.subtitle') || 'Quản lý danh sách nhân viên, phân quyền 3 cấp (Master, Owner, Staff) và thiết lập mã PIN thu ngân'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadUsers}
              disabled={isLoading}
              className="p-2.5 text-slate-600 hover:text-purple-700 hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer active:scale-95"
              title={t('users.reload_tooltip') || 'Tải lại danh sách'}
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-200 transition cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('users.btn_add_user') || 'Thêm Nhân Viên'}</span>
            </button>
          </div>
        </div>

        {/* Overview Stats Badges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">{t('users.stat_total') || 'Tổng nhân sự'}</p>
              <p className="text-xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-purple-600 uppercase">{t('users.stat_master') || 'Master Admin'}</p>
              <p className="text-xl font-black text-purple-900">{stats.master}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-blue-600 uppercase">{t('users.stat_owner') || 'Store Owner'}</p>
              <p className="text-xl font-black text-blue-900">{stats.owner}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-purple-600 uppercase">{t('users.stat_staff') || 'Cashier / Staff'}</p>
              <p className="text-xl font-black text-purple-900">{stats.staff}</p>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('users.search_placeholder') || 'Tìm theo tên đăng nhập, họ tên, SĐT hoặc email...'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer flex-1 md:flex-initial"
            >
              <option value="all">{t('users.filter_all_roles') || 'Tất cả vai trò'}</option>
              <option value="master">{t('users.role_master') || 'Master'}</option>
              <option value="owner">{t('users.role_owner') || 'Owner'}</option>
              <option value="staff">{t('users.role_staff') || 'Staff'}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer flex-1 md:flex-initial"
            >
              <option value="all">{t('users.filter_all_status') || 'Tất cả trạng thái'}</option>
              <option value="active">{t('users.filter_active') || 'Đang hoạt động'}</option>
              <option value="inactive">{t('users.filter_inactive') || 'Đã khóa'}</option>
            </select>
          </div>
        </div>

        {/* Mobile Card List (Visible on mobile, hidden on desktop) */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium text-xs">
              {t('users.loading') || 'Đang tải danh sách nhân viên...'}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 font-medium text-xs">
              {t('users.empty') || 'Không tìm thấy nhân viên nào phù hợp với bộ lọc.'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = currentUser?.id === u.id;
              const isTargetMaster = u.role === 'master' || u.role === 'super_admin' || u.role === 'admin';
              const isTargetOwner = u.role === 'owner' || u.role === 'store_admin';
              const canEditThisUser = isMasterCaller || isSelf || (!isTargetMaster && !isTargetOwner && isOwnerCaller);
              const canToggleThisUser = !isSelf && (isMasterCaller || (!isTargetMaster && !isTargetOwner && isOwnerCaller));

              return (
                <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
                  {/* Card Top: Avatar, Name, Role badge, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                          <span className="truncate">{u.full_name || u.username}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 font-extrabold rounded-md border border-purple-200 shrink-0">
                              {t('users.self_tag') || 'Bạn'}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">@{u.username}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {getRoleBadge(u.role)}
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                          {t('users.status_active') || 'Hoạt động'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          {t('users.status_inactive') || 'Tạm khóa'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details row: Phone, PIN */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 text-slate-600">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Số điện thoại</span>
                      {u.phone ? (
                        <a href={`tel:${u.phone}`} className="font-semibold text-purple-700 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{u.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Chưa cập nhật</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Mã PIN POS</span>
                      {u.has_pin ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 mt-0.5">
                          <KeyRound className="w-3 h-3 text-purple-600" />
                          {t('users.has_pin') || 'Đã cài PIN'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 mt-0.5">
                          {t('users.no_pin') || 'Chưa cài PIN'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Last Login */}
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Đăng nhập cuối:</span>
                    </span>
                    <span className="font-semibold text-slate-600">{formatLastLogin(u.last_login_at)}</span>
                  </div>

                  {/* Action Buttons row (Touch friendly) */}
                  {canEditThisUser && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenPasswordModal(u)}
                        className="flex items-center justify-center space-x-1 py-2 px-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition active:scale-95 cursor-pointer min-h-[38px]"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Đổi PIN</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="flex items-center justify-center space-x-1 py-2 px-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition active:scale-95 cursor-pointer min-h-[38px]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      {canToggleThisUser ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`flex items-center justify-center space-x-1 py-2 px-2 text-xs font-bold rounded-xl border transition active:scale-95 cursor-pointer min-h-[38px] ${
                            u.is_active
                              ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                              : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{u.is_active ? 'Khóa' : 'Mở'}</span>
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Users Table (Hidden on mobile) */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4">{t('users.col_user') || 'Nhân viên'}</th>
                  <th className="py-3.5 px-4">{t('users.col_role') || 'Vai trò'}</th>
                  <th className="py-3.5 px-4">{t('users.col_phone') || 'Số điện thoại'}</th>
                  <th className="py-3.5 px-4">{t('users.col_pin') || 'Mã PIN'}</th>
                  <th className="py-3.5 px-4">{t('users.col_status') || 'Trạng thái'}</th>
                  <th className="py-3.5 px-4">{t('users.col_last_login') || 'Đăng nhập lần cuối'}</th>
                  <th className="py-3.5 px-4 text-right">{t('users.col_actions') || 'Thao tác'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                      {t('users.loading') || 'Đang tải danh sách nhân viên...'}
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                      {t('users.empty') || 'Không tìm thấy nhân viên nào phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const isTargetMaster = u.role === 'master' || u.role === 'super_admin' || u.role === 'admin';
                    const isTargetOwner = u.role === 'owner' || u.role === 'store_admin';

                    // Master can edit anyone; Owner can only edit themselves or staff accounts (never other owners or masters)
                    const canEditThisUser = isMasterCaller || isSelf || (!isTargetMaster && !isTargetOwner && isOwnerCaller);
                    // Deactivate/Reactivate: Master can toggle anyone except self; Owner can only toggle staff accounts
                    const canToggleThisUser = !isSelf && (isMasterCaller || (!isTargetMaster && !isTargetOwner && isOwnerCaller));

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        {/* User Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {u.full_name || u.username}
                                {isSelf && (
                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 font-extrabold rounded-md border border-purple-200">
                                    {t('users.self_tag') || 'Bạn'}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500 font-medium truncate">@{u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>

                        {/* Phone & Email */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            {u.phone ? (
                              <p className="font-medium text-slate-800 flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {u.phone}
                              </p>
                            ) : (
                              <span className="text-slate-400 italic">{t('users.not_updated') || 'Chưa cập nhật'}</span>
                            )}
                            {u.email && (
                              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate max-w-[180px]">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {u.email}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* PIN Code Badge */}
                        <td className="py-3.5 px-4">
                          {u.has_pin ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                              <KeyRound className="w-3 h-3 text-purple-600" />
                              {t('users.has_pin') || 'Đã cài PIN'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                              {t('users.no_pin') || 'Chưa cài PIN'}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700">
                              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                              {t('users.status_active') || 'Hoạt động'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              {t('users.status_inactive') || 'Tạm khóa'}
                            </span>
                          )}
                        </td>

                        {/* Last Login timestamp */}
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs whitespace-nowrap">{formatLastLogin(u.last_login_at)}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {canEditThisUser ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPasswordModal(u)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition active:scale-95 cursor-pointer"
                                  title={t('users.modal_pwd_title') || 'Đổi mật khẩu / PIN'}
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(u)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition active:scale-95 cursor-pointer"
                                  title={t('users.modal_edit_title') || 'Chỉnh sửa thông tin'}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {canToggleThisUser && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(u)}
                                    className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
                                      u.is_active
                                        ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                        : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
                                    }`}
                                    title={u.is_active ? (t('users.confirm_lock_title') || 'Khóa tài khoản') : (t('users.confirm_unlock_title') || 'Kích hoạt tài khoản')}
                                  >
                                    <Power className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">{t('users.no_permission') || 'Không có quyền'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add / Edit User */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {editingUser
                        ? (t('users.modal_edit_title') || 'Chỉnh sửa Nhân viên')
                        : (t('users.modal_add_title') || 'Thêm Nhân viên Mới')}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {editingUser
                        ? `${t('users.modal_edit_desc') || 'Cập nhật thông tin tài khoản'} @${editingUser.username}`
                        : (t('users.modal_add_desc') || 'Khởi tạo tài khoản nhân viên & phân quyền')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('users.field_username') || 'Tên đăng nhập'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={!!editingUser}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={t('users.field_username_placeholder') || 'vd: thu_ngan_01'}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:opacity-60"
                      required
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('users.field_fullname') || 'Họ và tên'}
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder={t('users.field_fullname_placeholder') || 'vd: Nguyễn Văn A'}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('users.field_phone') || 'Số điện thoại'}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder={t('users.field_phone_placeholder') || 'vd: 0912345678'}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t('users.field_email') || 'Email'}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t('users.field_email_placeholder') || 'vd: nhanvien@rabbitpos.vn'}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('users.field_role') || 'Phân quyền vai trò'} <span className="text-rose-500">*</span>
                  </label>
                  <div className={`grid ${isMasterCaller ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                    {isMasterCaller && (
                      <label
                        className={`border rounded-xl p-3 flex flex-col cursor-pointer transition text-center ${
                          formData.role === 'master'
                            ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value="master"
                          checked={formData.role === 'master'}
                          onChange={() => setFormData({ ...formData, role: 'master' })}
                          className="sr-only"
                        />
                        <span className="text-xs font-black text-purple-900">{t('users.role_master') || 'Master'}</span>
                        <span className="text-[10px] text-purple-600 font-medium mt-0.5">
                          {t('users.role_master_desc') || 'Toàn quyền hệ thống'}
                        </span>
                      </label>
                    )}

                    <label
                      className={`border rounded-xl p-3 flex flex-col cursor-pointer transition text-center ${
                        formData.role === 'owner'
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="owner"
                        checked={formData.role === 'owner'}
                        onChange={() => setFormData({ ...formData, role: 'owner' })}
                        className="sr-only"
                      />
                      <span className="text-xs font-black text-blue-900">{t('users.role_owner') || 'Owner'}</span>
                      <span className="text-[10px] text-blue-600 font-medium mt-0.5">
                        {t('users.role_owner_desc') || 'Quản lý cửa hàng'}
                      </span>
                    </label>

                    <label
                      className={`border rounded-xl p-3 flex flex-col cursor-pointer transition text-center ${
                        formData.role === 'staff'
                          ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="staff"
                        checked={formData.role === 'staff'}
                        onChange={() => setFormData({ ...formData, role: 'staff' })}
                        className="sr-only"
                      />
                      <span className="text-xs font-black text-purple-900">{t('users.role_staff') || 'Staff'}</span>
                      <span className="text-[10px] text-purple-600 font-medium mt-0.5">
                        {t('users.role_staff_desc') || 'Thu ngân / Pha chế'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {editingUser
                      ? (t('users.field_password_edit') || 'Đặt lại mật khẩu mới (Bỏ trống nếu không đổi)')
                      : (t('users.field_password') || 'Mật khẩu khởi tạo')}
                    {!editingUser && <span className="text-rose-500"> *</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'Nhập mật khẩu mới...' : (t('users.field_password_placeholder') || 'Tối thiểu 6 ký tự')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                    required={!editingUser}
                  />
                </div>

                {/* PIN Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      {t('users.field_pin') || 'Mã PIN nhanh (4 - 6 số)'}
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t('users.field_pin_tip') || 'Dùng mở khóa máy POS nhanh'}
                    </span>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, '') })}
                    placeholder={editingUser ? 'Nhập PIN mới hoặc bỏ trống...' : (t('users.field_pin_placeholder') || 'vd: 1234')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {t('users.field_active') || 'Kích hoạt tài khoản'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t('users.field_active_desc') || 'Cho phép nhân viên đăng nhập vào hệ thống'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      formData.is_active ? 'bg-purple-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-end space-x-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {t('common.cancel') || 'Hủy'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-200 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting
                      ? (t('users.btn_saving') || 'Đang lưu...')
                      : editingUser
                      ? (t('users.btn_save') || 'Lưu thay đổi')
                      : (t('users.btn_create') || 'Tạo nhân viên')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Quick Password / PIN Reset */}
        {isPasswordModalOpen && passwordTargetUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {t('users.modal_pwd_title') || 'Đổi Mật khẩu / Mã PIN'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Tài khoản: @{passwordTargetUser.username}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePasswordPin} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('users.modal_pwd_new_password') || 'Mật khẩu mới (Tối thiểu 6 ký tự)'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('users.modal_pwd_password_placeholder') || 'Bỏ trống nếu chỉ đổi PIN...'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('users.modal_pwd_new_pin') || 'Mã PIN nhanh mới (4 - 6 số)'}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('users.modal_pwd_pin_placeholder') || 'Bỏ trống nếu không đổi...'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {t('common.cancel') || 'Hủy'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-200 transition cursor-pointer"
                  >
                    {t('users.btn_update') || 'Cập nhật'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
