'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  User,
  Trash2,
  Check,
  Star,
  Search,
  KeyRound,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import ModernSelect, { ModernSelectOption } from '@/components/common/ModernSelect';
import {
  Store,
  StoreRole,
  StoreMemberResponse,
  UserListItem,
  CreateUserRequest,
} from '@/types/store';

interface MemberManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store | null;
  onUpdated?: () => void;
}

const ROLE_OPTIONS: ModernSelectOption[] = [
  { value: 'staff', label: 'Nhân viên bán hàng (Staff)', subLabel: 'Sử dụng POS, bán hàng và xem lịch sử đơn' },
  { value: 'store_admin', label: 'Quản lý cửa hàng (Store Admin)', subLabel: 'Quản lý thực đơn, nhập hàng, thu chi và báo cáo' },
];

export default function MemberManagerModal({
  isOpen,
  onClose,
  store,
  onUpdated,
}: MemberManagerModalProps) {
  const toast = useToast();
  const { confirm } = useConfirm();

  const [members, setMembers] = useState<StoreMemberResponse[]>([]);
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Modes: 'assign_existing' | 'create_new'
  const [addMode, setAddMode] = useState<'assign_existing' | 'create_new'>('assign_existing');

  // Assign existing state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<StoreRole>('staff');
  const [isAssigning, setIsAssigning] = useState(false);

  // Create new user state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<StoreRole>('staff');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const loadData = async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetchApi<StoreMemberResponse[]>(`/stores/${store.id}/members`, { skipCache: true }),
        fetchApi<UserListItem[]>('/users', { skipCache: true }),
      ]);

      if (membersRes.status === 'success' && membersRes.data) {
        setMembers(membersRes.data);
      }
      if (usersRes.status === 'success' && usersRes.data) {
        setAllUsers(usersRes.data);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách thành viên: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && store) {
      loadData();
    }
  }, [isOpen, store]);

  // Candidates for assignment: all users who are not yet members of this store
  const existingMemberUserIds = new Set(members.map((m) => m.user_id));
  const assignableUsers: ModernSelectOption[] = allUsers
    .filter((u) => !existingMemberUserIds.has(u.id))
    .map((u) => ({
      value: u.id,
      label: u.username,
      subLabel: `${u.email ? u.email + ' • ' : ''}Vai trò hệ thống: ${u.role}`,
    }));

  const handleAssignExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !selectedUserId) {
      toast.error('Vui lòng chọn nhân viên cần gán');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetchApi(`/stores/${store.id}/members`, {
        method: 'PUT',
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
          is_default: false,
        }),
      });

      if (res.status === 'success') {
        toast.success('Gán nhân viên vào cửa hàng thành công');
        setSelectedUserId(null);
        setSelectedRole('staff');
        loadData();
        onUpdated?.();
      } else {
        toast.error(res.message || 'Gán nhân viên thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gán nhân viên thất bại');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    if (!newUsername.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Mật khẩu tạm phải có ít nhất 6 ký tự');
      return;
    }

    setIsCreatingUser(true);
    try {
      const payload: CreateUserRequest = {
        username: newUsername.trim(),
        email: newEmail.trim() || undefined,
        role: newRole,
        temp_password: newPassword,
        memberships: [
          {
            store_id: store.id,
            role: newRole,
            is_default: true,
          },
        ],
      };

      const res = await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.status === 'success') {
        toast.success(`Tạo tài khoản '${newUsername}' và gán vào cửa hàng thành công`);
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('staff');
        loadData();
        onUpdated?.();
      } else {
        toast.error(res.message || 'Tạo tài khoản thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Tạo tài khoản thất bại');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRoleChange = async (member: StoreMemberResponse, newRole: StoreRole) => {
    if (!store) return;
    try {
      const res = await fetchApi(`/stores/${store.id}/members`, {
        method: 'PUT',
        body: JSON.stringify({
          user_id: member.user_id,
          role: newRole,
          is_default: member.is_default,
        }),
      });

      if (res.status === 'success') {
        toast.success(`Đã cập nhật vai trò của ${member.username} thành ${newRole}`);
        loadData();
        onUpdated?.();
      } else {
        toast.error(res.message || 'Cập nhật vai trò thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật vai trò thất bại');
    }
  };

  const handleToggleDefault = async (member: StoreMemberResponse) => {
    if (!store) return;
    try {
      const res = await fetchApi(`/stores/${store.id}/members`, {
        method: 'PUT',
        body: JSON.stringify({
          user_id: member.user_id,
          role: member.role,
          is_default: !member.is_default,
        }),
      });

      if (res.status === 'success') {
        toast.success(
          member.is_default
            ? `Đã bỏ cửa hàng mặc định của ${member.username}`
            : `Đã đặt ${store.name} làm cửa hàng mặc định cho ${member.username}`
        );
        loadData();
        onUpdated?.();
      } else {
        toast.error(res.message || 'Thao tác thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại');
    }
  };

  const handleRemoveMember = async (member: StoreMemberResponse) => {
    if (!store) return;
    const ok = await confirm({
      title: 'Gỡ nhân viên khỏi cửa hàng',
      message: `Bạn có chắc chắn muốn gỡ tài khoản '${member.username}' khỏi cửa hàng ${store.name}? Nhân viên này sẽ không thể truy cập cửa hàng này nữa.`,
      type: 'danger',
      confirmText: 'Gỡ nhân sự',
    });
    if (!ok) return;

    try {
      const res = await fetchApi(`/stores/${store.id}/members/${member.user_id}`, {
        method: 'DELETE',
      });

      if (res.status === 'success') {
        toast.success(`Đã gỡ ${member.username} khỏi cửa hàng`);
        loadData();
        onUpdated?.();
      } else {
        toast.error(res.message || 'Gỡ nhân viên thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gỡ nhân viên thất bại');
    }
  };

  if (!isOpen || !store) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 hardware-accelerated max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Quản lý Nhân sự: {store.name}
              </h3>
              <p className="text-xs text-slate-500">
                Phân quyền truy cập và gán vai trò nhân viên cho chi nhánh ({store.code})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Members List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Danh sách nhân sự hiện tại ({members.length})
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              ★ = Cửa hàng mặc định khi đăng nhập
            </span>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
              <span>Đang tải danh sách nhân sự...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Cửa hàng này hiện chưa có nhân sự nào được gán trực tiếp.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {members.map((m) => {
                const isSuper = m.global_role === 'super_admin';
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition"
                  >
                    {/* User info */}
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 uppercase border border-slate-200">
                        {m.username.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {m.username}
                          </span>
                          {isSuper && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200">
                              Super Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {m.email || 'Không có email'}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Role Selector + Star Default + Remove */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Default store star toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleDefault(m)}
                        title={
                          m.is_default
                            ? 'Đây là cửa hàng mặc định của nhân viên'
                            : 'Bấm để đặt làm cửa hàng mặc định'
                        }
                        className={`p-1.5 rounded-lg transition active:scale-90 ${
                          m.is_default
                            ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                            : 'text-slate-300 hover:text-amber-500 hover:bg-slate-50'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${m.is_default ? 'fill-amber-400' : ''}`} />
                      </button>

                      {/* Store role selector */}
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m, e.target.value as StoreRole)}
                        disabled={isSuper}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 cursor-pointer"
                      >
                        <option value="staff">Nhân viên (Staff)</option>
                        <option value="store_admin">Quản lý (Store Admin)</option>
                      </select>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        title="Gỡ nhân viên khỏi cửa hàng"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Member Section */}
        <div className="pt-3 border-t border-slate-100 space-y-3.5">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Thêm nhân sự vào chi nhánh
            </span>
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAddMode('assign_existing')}
                className={`px-3 py-1 rounded-lg transition ${
                  addMode === 'assign_existing'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Gán tài khoản có sẵn
              </button>
              <button
                type="button"
                onClick={() => setAddMode('create_new')}
                className={`px-3 py-1 rounded-lg transition ${
                  addMode === 'create_new'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tạo tài khoản mới
              </button>
            </div>
          </div>

          {/* Mode 1: Assign Existing User */}
          {addMode === 'assign_existing' && (
            <form onSubmit={handleAssignExisting} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chọn nhân viên trên hệ thống:
                  </label>
                  <ModernSelect
                    options={assignableUsers}
                    value={selectedUserId}
                    onChange={(val) => setSelectedUserId(Number(val))}
                    placeholder={
                      assignableUsers.length === 0
                        ? 'Tất cả nhân viên đã được gán'
                        : 'Tìm và chọn nhân viên...'
                    }
                    searchable
                    size="sm"
                    disabled={assignableUsers.length === 0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vai trò trong cửa hàng:
                  </label>
                  <ModernSelect
                    options={ROLE_OPTIONS}
                    value={selectedRole}
                    onChange={(val) => setSelectedRole(val as StoreRole)}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAssigning || !selectedUserId}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang gán...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Gán vào cửa hàng</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Mode 2: Create New User Account */}
          {addMode === 'create_new' && (
            <form onSubmit={handleCreateNewUser} className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="VD: thu_ngan_01"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu tạm thời <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vai trò trong cửa hàng:
                  </label>
                  <ModernSelect
                    options={ROLE_OPTIONS}
                    value={newRole}
                    onChange={(val) => setNewRole(val as StoreRole)}
                    size="sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email thông báo (tùy chọn)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nhanvien@example.com"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isCreatingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Tạo tài khoản & Gán</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
