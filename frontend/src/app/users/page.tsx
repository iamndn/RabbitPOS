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

  // Authorization check on mount
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
        toast.error(res.message || 'Không thể tải danh sách nhân viên');
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
          toast.success('Cập nhật nhân viên thành công');
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
          toast.success('Thêm nhân viên mới thành công');
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
    const actionText = user.is_active ? 'Khóa' : 'Kích hoạt';
    const ok = await confirm({
      title: `${actionText} tài khoản`,
      message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} tài khoản '${user.username}'?`,
      confirmText: actionText,
      cancelText: 'Hủy',
      type: user.is_active ? 'danger' : 'info',
    });

    if (ok) {
      try {
        const res = await fetchApi(`/users/${user.id}/toggle-status`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: !user.is_active }),
        });
        if (res.status === 'success') {
          toast.success(`${actionText} tài khoản thành công`);
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
        toast.success('Đã cập nhật mật khẩu / PIN thành công');
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
            Master (Owner)
          </span>
        );
      case 'owner':
      case 'store_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            Owner (Quản lý)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Staff (Thu ngân)
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-200 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Quản lý Nhân sự & Phân quyền
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Quản lý danh sách nhân viên, phân quyền 3 cấp (Master, Owner, Staff) và thiết lập mã PIN thu ngân
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadUsers}
              disabled={isLoading}
              className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer active:scale-95"
              title="Tải lại danh sách"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm Nhân Viên</span>
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
              <p className="text-[11px] font-bold text-slate-500 uppercase">Tổng nhân sự</p>
              <p className="text-xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-purple-600 uppercase">Master Admin</p>
              <p className="text-xl font-black text-purple-900">{stats.master}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-blue-600 uppercase">Store Owner</p>
              <p className="text-xl font-black text-blue-900">{stats.owner}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center space-x-3.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-600 uppercase">Cashier / Staff</p>
              <p className="text-xl font-black text-emerald-900">{stats.staff}</p>
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
              placeholder="Tìm theo tên đăng nhập, họ tên, SĐT hoặc email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer flex-1 md:flex-initial"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="master">Master</option>
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer flex-1 md:flex-initial"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã khóa</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4">Nhân viên</th>
                  <th className="py-3.5 px-4">Vai trò</th>
                  <th className="py-3.5 px-4">Số điện thoại</th>
                  <th className="py-3.5 px-4">Mã PIN</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      Đang tải danh sách nhân viên...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      Không tìm thấy nhân viên nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const isTargetMaster = u.role === 'master' || u.role === 'super_admin' || u.role === 'admin';
                    const canEditThisUser = isMasterCaller || (!isTargetMaster && isOwnerCaller);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        {/* User Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {u.full_name || u.username}
                                {isSelf && (
                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-md border border-emerald-200">
                                    Bạn
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
                              <span className="text-slate-400 italic">Chưa cập nhật</span>
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
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <KeyRound className="w-3 h-3 text-emerald-600" />
                              Đã cài PIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                              Chưa cài PIN
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              Tạm khóa
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {canEditThisUser ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPasswordModal(u)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition active:scale-95"
                                  title="Đổi mật khẩu / PIN"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(u)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition active:scale-95"
                                  title="Chỉnh sửa thông tin"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(u)}
                                    className={`p-1.5 rounded-lg transition active:scale-95 ${
                                      u.is_active
                                        ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                        : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                    title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                  >
                                    <Power className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Không có quyền</span>
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
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {editingUser ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên Mới'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {editingUser
                        ? `Cập nhật thông tin tài khoản @${editingUser.username}`
                        : 'Khởi tạo tài khoản nhân viên & phân quyền'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tên đăng nhập <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={!!editingUser}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="vd: thu_ngan_01"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
                      required
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Họ và tên</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="vd: Nguyễn Văn A"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Số điện thoại</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="vd: 0912345678"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vd: nhanvien@rabbitpos.vn"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Phân quyền vai trò <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
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
                        <span className="text-xs font-black text-purple-900">Master</span>
                        <span className="text-[10px] text-purple-600 font-medium mt-0.5">Toàn quyền hệ thống</span>
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
                      <span className="text-xs font-black text-blue-900">Owner</span>
                      <span className="text-[10px] text-blue-600 font-medium mt-0.5">Quản lý cửa hàng</span>
                    </label>

                    <label
                      className={`border rounded-xl p-3 flex flex-col cursor-pointer transition text-center ${
                        formData.role === 'staff'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
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
                      <span className="text-xs font-black text-emerald-900">Staff</span>
                      <span className="text-[10px] text-emerald-600 font-medium mt-0.5">Thu ngân / Pha chế</span>
                    </label>
                  </div>
                </div>

                {/* Password (Required for create, optional for edit) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {editingUser ? 'Đặt lại mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu khởi tạo'}
                    {!editingUser && <span className="text-rose-500"> *</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'Nhập mật khẩu mới...' : 'Tối thiểu 6 ký tự'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required={!editingUser}
                  />
                </div>

                {/* PIN Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Mã PIN nhanh (4 - 6 số)</label>
                    <span className="text-[10px] text-slate-400 font-medium">Dùng mở khóa máy POS nhanh</span>
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, '') })}
                    placeholder={editingUser ? 'Nhập PIN mới hoặc bỏ trống...' : 'vd: 1234'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Kích hoạt tài khoản</p>
                    <p className="text-[11px] text-slate-500 font-medium">Cho phép nhân viên đăng nhập vào hệ thống</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      formData.is_active ? 'bg-emerald-600' : 'bg-slate-300'
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
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang lưu...' : editingUser ? 'Lưu thay đổi' : 'Tạo nhân viên'}
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
                    <h3 className="font-black text-slate-900 text-base">Đổi Mật khẩu / Mã PIN</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Tài khoản: @{passwordTargetUser.username}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePasswordPin} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mật khẩu mới (Tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Bỏ trống nếu chỉ đổi PIN..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mã PIN nhanh mới (4 - 6 số)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Bỏ trống nếu không đổi..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-200 transition cursor-pointer"
                  >
                    Cập nhật
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
