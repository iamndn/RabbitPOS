'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Store as StoreIcon,
  Upload,
  Image as ImageIcon,
  Check,
  Building2,
  Copy,
  Layers,
  Sparkles,
  Phone,
  MapPin,
  Coins,
  QrCode,
  Globe,
  Loader2,
} from 'lucide-react';
import { fetchApi, uploadImage, getImageUrl } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import ModernSelect, { ModernSelectOption } from '@/components/common/ModernSelect';
import {
  Store,
  CreateStoreRequest,
  UpdateStoreRequest,
  StoreBusinessType,
  CurrencyPosition,
} from '@/types/store';

interface StoreFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  storeToEdit?: Store | null;
  existingStores?: Store[];
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const BUSINESS_TYPE_OPTIONS: ModernSelectOption[] = [
  { value: 'fnb', label: 'F&B / Ăn uống', subLabel: 'Nhà hàng, quán ăn tổng hợp' },
  { value: 'cafe', label: 'Cà phê & Đồ uống', subLabel: 'Quán cà phê, trà sữa, nước ép' },
  { value: 'bakery', label: 'Tiệm bánh / Bakery', subLabel: 'Bánh ngọt, bánh mì, tráng miệng' },
  { value: 'retail', label: 'Bán lẻ / Retail', subLabel: 'Cửa hàng tạp hóa, thời trang, tiện lợi' },
  { value: 'other', label: 'Mô hình khác', subLabel: 'Dịch vụ và bán hàng tổng hợp' },
];

const CURRENCY_POSITION_OPTIONS: ModernSelectOption[] = [
  { value: 'suffix', label: 'Phía sau (ví dụ: 50.000 đ)' },
  { value: 'prefix', label: 'Phía trước (ví dụ: $ 50.00)' },
];

const VIETNAM_BANKS: ModernSelectOption[] = [
  { value: 'MB', label: 'MB Bank', subLabel: 'Ngân hàng Quân đội' },
  { value: 'VCB', label: 'Vietcombank', subLabel: 'Ngoại thương Việt Nam' },
  { value: 'TCB', label: 'Techcombank', subLabel: 'Kỹ thương Việt Nam' },
  { value: 'ACB', label: 'ACB', subLabel: 'Á Châu' },
  { value: 'VPB', label: 'VPBank', subLabel: 'Việt Nam Thịnh Vượng' },
  { value: 'TPB', label: 'TPBank', subLabel: 'Tiên Phong' },
  { value: 'BIDV', label: 'BIDV', subLabel: 'Đầu tư và Phát triển' },
  { value: 'ICB', label: 'VietinBank', subLabel: 'Công thương Việt Nam' },
  { value: 'STB', label: 'Sacombank', subLabel: 'Sài Gòn Thương Tín' },
  { value: 'HDB', label: 'HDBank', subLabel: 'Phát triển TP.HCM' },
];

export default function StoreFormModal({
  isOpen,
  onClose,
  onSuccess,
  storeToEdit,
  existingStores = [],
}: StoreFormModalProps) {
  const toast = useToast();
  const { t } = useTranslation();
  const isEdit = !!storeToEdit;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [businessType, setBusinessType] = useState('fnb');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Currency
  const [currencyCode, setCurrencyCode] = useState('VND');
  const [currencySymbol, setCurrencySymbol] = useState('đ');
  const [currencyPosition, setCurrencyPosition] = useState<CurrencyPosition>('suffix');

  // VietQR
  const [vietqrBankId, setVietqrBankId] = useState('MB');
  const [vietqrAccountNo, setVietqrAccountNo] = useState('');
  const [vietqrAccountName, setVietqrAccountName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');

  // Menu Cloning (Create mode only)
  const [cloneMode, setCloneMode] = useState<'blank' | 'clone'>('blank');
  const [cloneSourceId, setCloneSourceId] = useState<number | null>(null);
  const [cloneCategories, setCloneCategories] = useState(true);
  const [cloneProducts, setCloneProducts] = useState(true);
  const [cloneVariants, setCloneVariants] = useState(true);
  const [cloneToppings, setCloneToppings] = useState(true);
  const [clonePromotions, setClonePromotions] = useState(true);
  const [cloneRecipes, setCloneRecipes] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (storeToEdit) {
      setName(storeToEdit.name || '');
      setCode(storeToEdit.code || '');
      setCodeManuallyEdited(true);
      setBusinessType(storeToEdit.business_type || 'fnb');
      setPhone(storeToEdit.phone || '');
      setAddress(storeToEdit.address || '');
      setLogoUrl(storeToEdit.logo_url || '');
      setCurrencyCode(storeToEdit.currency_code || 'VND');
      setCurrencySymbol(storeToEdit.currency_symbol || 'đ');
      setCurrencyPosition((storeToEdit.currency_position as CurrencyPosition) || 'suffix');
      setVietqrBankId(storeToEdit.vietqr_bank_id || 'MB');
      setVietqrAccountNo(storeToEdit.vietqr_account_no || '');
      setVietqrAccountName(storeToEdit.vietqr_account_name || '');
      setTimezone(storeToEdit.timezone || 'Asia/Ho_Chi_Minh');
    } else {
      // Defaults for new store
      setName('');
      setCode('');
      setCodeManuallyEdited(false);
      setBusinessType('fnb');
      setPhone('');
      setAddress('');
      setLogoUrl('');
      setCurrencyCode('VND');
      setCurrencySymbol('đ');
      setCurrencyPosition('suffix');
      setVietqrBankId('MB');
      setVietqrAccountNo('');
      setVietqrAccountName('');
      setTimezone('Asia/Ho_Chi_Minh');
      setCloneMode('blank');
      setCloneSourceId(existingStores.length > 0 ? existingStores[0].id : null);
      setCloneCategories(true);
      setCloneProducts(true);
      setCloneVariants(true);
      setCloneToppings(true);
      setClonePromotions(true);
      setCloneRecipes(true);
    }
  }, [storeToEdit, isOpen, existingStores]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit && !codeManuallyEdited) {
      setCode(slugify(val));
    }
  };

  const handleCodeChange = (val: string) => {
    setCode(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setCodeManuallyEdited(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await uploadImage(file);
      if (res.status === 'success' && res.data?.url) {
        setLogoUrl(res.data.url);
        toast.success('Tải ảnh logo lên thành công');
      } else {
        toast.error(res.message || 'Tải ảnh thất bại');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Tải ảnh thất bại');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên cửa hàng');
      return;
    }
    const cleanCode = code.trim().toLowerCase();
    if (!cleanCode || cleanCode.length < 2) {
      toast.error('Mã cửa hàng phải có ít nhất 2 ký tự (chữ thường, số, dấu gạch nối)');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit) {
        const payload: UpdateStoreRequest = {
          name: name.trim(),
          code: cleanCode,
          business_type: businessType,
          phone: phone.trim(),
          address: address.trim(),
          logo_url: logoUrl.trim(),
          currency_code: currencyCode.trim(),
          currency_symbol: currencySymbol.trim(),
          currency_position: currencyPosition,
          vietqr_bank_id: vietqrBankId.trim(),
          vietqr_account_no: vietqrAccountNo.trim(),
          vietqr_account_name: vietqrAccountName.trim().toUpperCase(),
          timezone: timezone.trim(),
        };

        const res = await fetchApi<Store>(`/stores/${storeToEdit.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.status === 'success') {
          toast.success('Cập nhật cửa hàng thành công');
          onSuccess();
          onClose();
        } else {
          toast.error(res.message || 'Cập nhật cửa hàng thất bại');
        }
      } else {
        const payload: CreateStoreRequest = {
          name: name.trim(),
          code: cleanCode,
          business_type: businessType,
          phone: phone.trim(),
          address: address.trim(),
          logo_url: logoUrl.trim(),
          currency_code: currencyCode.trim(),
          currency_symbol: currencySymbol.trim(),
          currency_position: currencyPosition,
          vietqr_bank_id: vietqrBankId.trim(),
          vietqr_account_no: vietqrAccountNo.trim(),
          vietqr_account_name: vietqrAccountName.trim().toUpperCase(),
          timezone: timezone.trim(),
          clone_from_store_id: cloneMode === 'clone' ? cloneSourceId : null,
          clone_options:
            cloneMode === 'clone'
              ? {
                  categories: cloneCategories,
                  products: cloneProducts,
                  variants: cloneVariants,
                  toppings: cloneToppings,
                  promotions: clonePromotions,
                  recipes: cloneRecipes,
                }
              : undefined,
        };

        const res = await fetchApi<Store>('/stores', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.status === 'success') {
          toast.success(
            cloneMode === 'clone'
              ? 'Tạo cửa hàng và sao chép menu thành công'
              : 'Tạo cửa hàng mới thành công'
          );
          onSuccess();
          onClose();
        } else {
          toast.error(res.message || 'Tạo cửa hàng thất bại');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi xảy ra khi lưu cửa hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const cloneStoreOptions: ModernSelectOption[] = existingStores.map((s) => ({
    value: s.id,
    label: s.name,
    subLabel: `Mã: ${s.code} • ${s.business_type?.toUpperCase()}`,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 hardware-accelerated max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <StoreIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isEdit ? 'Chỉnh sửa Cửa hàng' : 'Thêm Cửa hàng Mới'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? `Cập nhật thông tin chi nhánh: ${storeToEdit?.name}`
                  : 'Khởi tạo chi nhánh kinh doanh độc lập trên hệ thống RabbitPOS'}
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Basic Information */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              Thông tin nhận diện
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Store Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên cửa hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ví dụ: Rabbit Coffee - Chi nhánh 2"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold"
                  required
                />
              </div>

              {/* Store Code (Slug) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã cửa hàng (Code slug) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="slug: cn2, bakery-d1..."
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Chữ thường, số và gạch ngang (dùng định danh và lọc dữ liệu)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Business Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Loại hình kinh doanh
                </label>
                <ModernSelect
                  options={BUSINESS_TYPE_OPTIONS}
                  value={businessType}
                  onChange={(val) => setBusinessType(val)}
                  size="sm"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại Hotline
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full pl-8.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ chi nhánh</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP..."
                  className="w-full pl-8.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Logo cửa hàng</label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="relative w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={getImageUrl(logoUrl) || logoUrl}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="absolute inset-0 bg-slate-900/50 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition"
                      title="Xóa logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1">
                  <label className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition active:scale-95">
                    {uploadingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{uploadingLogo ? 'Đang tải lên...' : 'Tải ảnh logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">
                    PNG, JPG hoặc WebP. Khuyến nghị ảnh vuông hoặc tỉ lệ ngang nhỏ hơn 2MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Currency & VietQR */}
          <div className="space-y-3.5 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              Tiền tệ & Thanh toán VietQR
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã tiền tệ</label>
                <input
                  type="text"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="VND"
                  className="w-full px-3 py-2 text-xs font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ký hiệu tiền</label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="đ"
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vị trí ký hiệu</label>
                <ModernSelect
                  options={CURRENCY_POSITION_OPTIONS}
                  value={currencyPosition}
                  onChange={(val) => setCurrencyPosition(val as CurrencyPosition)}
                  size="sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ngân hàng VietQR</label>
                <ModernSelect
                  options={VIETNAM_BANKS}
                  value={vietqrBankId}
                  onChange={(val) => setVietqrBankId(val)}
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số tài khoản</label>
                <input
                  type="text"
                  value={vietqrAccountNo}
                  onChange={(e) => setVietqrAccountNo(e.target.value.replace(/\s+/g, ''))}
                  placeholder="0298618519999"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên chủ tài khoản</label>
                <input
                  type="text"
                  value={vietqrAccountName}
                  onChange={(e) => setVietqrAccountName(e.target.value.toUpperCase())}
                  placeholder="NGUYEN VAN A"
                  className="w-full px-3 py-2 text-xs font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Menu Cloning (Only shown during Store Creation) */}
          {!isEdit && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                Khởi tạo Menu & Dữ liệu Danh mục
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Option 1: Blank */}
                <label
                  className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition ${
                    cloneMode === 'blank'
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cloneMode"
                    value="blank"
                    checked={cloneMode === 'blank'}
                    onChange={() => setCloneMode('blank')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">
                      Tạo menu trống (Blank)
                    </span>
                    <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">
                      Chỉ tạo quỹ tiền mặc định (Tiền mặt, Chuyển khoản) và danh mục thu chi.
                    </span>
                  </div>
                </label>

                {/* Option 2: Clone */}
                <label
                  className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition ${
                    cloneMode === 'clone'
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cloneMode"
                    value="clone"
                    checked={cloneMode === 'clone'}
                    onChange={() => setCloneMode('clone')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      Sao chép từ cửa hàng khác
                    </span>
                    <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">
                      Sao chép món, biến thể, topping, khuyến mãi & công thức từ chi nhánh sẵn có.
                    </span>
                  </div>
                </label>
              </div>

              {/* Clone Options Details */}
              {cloneMode === 'clone' && (
                <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Chọn cửa hàng nguồn để sao chép:
                    </label>
                    <ModernSelect
                      options={cloneStoreOptions}
                      value={cloneSourceId}
                      onChange={(val) => setCloneSourceId(Number(val))}
                      size="sm"
                      placeholder="Chọn cửa hàng nguồn..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Dữ liệu được sao chép sang cửa hàng mới:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cloneCategories}
                          onChange={(e) => setCloneCategories(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Danh mục món</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cloneProducts}
                          onChange={(e) => setCloneProducts(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Món & Biến thể size</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cloneToppings}
                          onChange={(e) => setCloneToppings(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Danh sách Topping</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clonePromotions}
                          onChange={(e) => setClonePromotions(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Chương trình KM</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cloneRecipes}
                          onChange={(e) => setCloneRecipes(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Công thức món (BOM)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isEdit ? 'Lưu thay đổi' : 'Tạo cửa hàng'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
