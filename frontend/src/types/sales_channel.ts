export interface SalesChannel {
  id: string; // unique code/slug, e.g. "dine_in", "takeaway", "shopeefood", "tiktok"
  name: string; // display name, e.g. "Tại quán", "TikTok Shop"
  icon: string; // emoji icon, e.g. "🏠", "🛍️", "🧡", "🎵"
  color: string; // color identifier, e.g. "purple", "indigo", "orange", "emerald", "amber", "rose", "sky", "teal"
  default_commission_pct: number; // e.g. 0, 15, 20
  is_delivery_app: boolean; // whether it calculates platform commission
  is_system?: boolean; // system defaults (e.g. dine_in, takeaway)
  is_active?: boolean;
}

export const CHANNEL_COLORS = [
  { id: 'purple', name: 'Tím (Purple)', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', active: 'bg-purple-700 text-white shadow-xs' },
  { id: 'indigo', name: 'Xanh Chàm (Indigo)', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', active: 'bg-indigo-600 text-white shadow-xs' },
  { id: 'orange', name: 'Cam (Orange)', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', active: 'bg-orange-600 text-white shadow-xs' },
  { id: 'emerald', name: 'Xanh Lá (Emerald)', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', active: 'bg-emerald-600 text-white shadow-xs' },
  { id: 'amber', name: 'Vàng Hổ Phách (Amber)', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', active: 'bg-amber-500 text-white shadow-xs' },
  { id: 'rose', name: 'Đỏ Hồng (Rose)', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', active: 'bg-rose-600 text-white shadow-xs' },
  { id: 'sky', name: 'Xanh Trời (Sky)', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', active: 'bg-sky-600 text-white shadow-xs' },
  { id: 'teal', name: 'Xanh Mòng Két (Teal)', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', active: 'bg-teal-600 text-white shadow-xs' },
  { id: 'slate', name: 'Xám Đá (Slate)', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', active: 'bg-slate-700 text-white shadow-xs' },
];

export const DEFAULT_SALES_CHANNELS: SalesChannel[] = [
  { id: 'dine_in', name: 'Tại quán', icon: '🏠', color: 'purple', default_commission_pct: 0, is_delivery_app: false, is_system: true, is_active: true },
  { id: 'takeaway', name: 'Mang về', icon: '🛍️', color: 'indigo', default_commission_pct: 0, is_delivery_app: false, is_system: true, is_active: true },
  { id: 'shopeefood', name: 'ShopeeFood', icon: '🧡', color: 'orange', default_commission_pct: 20, is_delivery_app: true, is_system: false, is_active: true },
  { id: 'grabfood', name: 'GrabFood', icon: '💚', color: 'emerald', default_commission_pct: 20, is_delivery_app: true, is_system: false, is_active: true },
  { id: 'befood', name: 'BeFood', icon: '💛', color: 'amber', default_commission_pct: 20, is_delivery_app: true, is_system: false, is_active: true },
];

export function parseSalesChannels(rawJson?: string | null): SalesChannel[] {
  if (!rawJson) return DEFAULT_SALES_CHANNELS;
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_SALES_CHANNELS;
}

export function getChannelBadge(channelId?: string, customChannels: SalesChannel[] = []): {
  id: string;
  name: string;
  icon: string;
  badgeClasses: string;
  activeClasses: string;
  colorDef: typeof CHANNEL_COLORS[0];
  is_delivery_app: boolean;
  default_commission_pct: number;
} {
  const all = customChannels && customChannels.length > 0 ? customChannels : DEFAULT_SALES_CHANNELS;
  const found = all.find((c) => c.id === channelId) || DEFAULT_SALES_CHANNELS.find((c) => c.id === channelId);

  if (found) {
    const colorDef = CHANNEL_COLORS.find((c) => c.id === found.color) || CHANNEL_COLORS[0];
    return {
      id: found.id,
      name: found.name,
      icon: found.icon || '🏷️',
      badgeClasses: `${colorDef.bg} ${colorDef.text} ${colorDef.border}`,
      activeClasses: colorDef.active,
      colorDef,
      is_delivery_app: found.is_delivery_app,
      default_commission_pct: found.default_commission_pct || 0,
    };
  }

  const fallbackColor = CHANNEL_COLORS[0];
  const formattedName = channelId ? channelId.replace(/_/g, ' ') : 'Tại quán';
  return {
    id: channelId || 'dine_in',
    name: formattedName,
    icon: '🛵',
    badgeClasses: `${fallbackColor.bg} ${fallbackColor.text} ${fallbackColor.border}`,
    activeClasses: fallbackColor.active,
    colorDef: fallbackColor,
    is_delivery_app: false,
    default_commission_pct: 0,
  };
}

