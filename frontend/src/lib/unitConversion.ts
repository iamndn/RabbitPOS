// Unit Conversion & Recipe Costing Utilities for RabbitPOS
// 3 main unit groups: Volume (ml, L), Mass (g, kg), Count (cái, quả, viên, miếng,...)

export type UnitGroup = 'volume' | 'weight' | 'count' | 'other';

export const COMMON_PURCHASE_UNITS = [
  'Chai',
  'Lon',
  'Hộp',
  'Túi',
  'Gói',
  'Thùng',
  'Can',
  'Kg',
  'Gram',
  'Lít',
  'ml',
  'Cái',
  'Quả',
  'Khác',
] as const;

export const COMMON_BASE_UNITS = [
  { value: 'ml', label: 'ml (Mililit - Dung tích)' },
  { value: 'g', label: 'g (Gram - Khối lượng)' },
  { value: 'cái', label: 'cái (Đơn vị đếm)' },
  { value: 'quả', label: 'quả (Trái cây)' },
  { value: 'viên', label: 'viên (Topping)' },
  { value: 'lon', label: 'lon (Lon/Hộp)' },
  { value: 'hộp', label: 'hộp' },
  { value: 'túi', label: 'túi' },
  { value: 'miếng', label: 'miếng' },
  { value: 'phần', label: 'phần' },
  { value: 'lít', label: 'lít (L)' },
  { value: 'kg', label: 'kg (Kilogram)' },
];

/**
 * Returns the unit category group: 'volume', 'weight', 'count', or 'other'
 */
export function getUnitGroup(unit: string): UnitGroup {
  if (!unit) return 'other';
  const u = unit.trim().toLowerCase();
  if (['ml', 'l', 'lít', 'lit', 'liter', 'mililit'].includes(u)) {
    return 'volume';
  }
  if (['g', 'kg', 'gram', 'gr', 'kilogram', 'kilo'].includes(u)) {
    return 'weight';
  }
  if (
    [
      'cái',
      'quả',
      'viên',
      'gói',
      'miếng',
      'phần',
      'lon',
      'hộp',
      'chai',
      'túi',
      'thùng',
      'can',
      'ly',
      'nắp',
      'que',
      'bịch',
      'khay',
    ].includes(u)
  ) {
    return 'count';
  }
  return 'other';
}

/**
 * Standard ratio between two units within the same category
 * E.g. L -> ml returns 1000, kg -> g returns 1000
 */
export function getUnitFactor(fromUnit: string, toUnit: string): number {
  const from = fromUnit.trim().toLowerCase();
  const to = toUnit.trim().toLowerCase();

  if (from === to) return 1.0;

  // Volume: L <-> ml
  const isFromL = from === 'l' || from === 'lít' || from === 'lit';
  const isToMl = to === 'ml';
  if (isFromL && isToMl) return 1000.0;

  const isFromMl = from === 'ml';
  const isToL = to === 'l' || to === 'lít' || to === 'lit';
  if (isFromMl && isToL) return 0.001;

  // Weight: kg <-> g
  const isFromKg = from === 'kg' || from === 'kilogram';
  const isToG = to === 'g' || to === 'gram' || to === 'gr';
  if (isFromKg && isToG) return 1000.0;

  const isFromG = to === 'g' || to === 'gram' || to === 'gr';
  const isToKg = from === 'kg' || from === 'kilogram';
  if (isFromG && isToKg) return 0.001;

  return 1.0;
}

export interface PurchaseConversionParams {
  purchaseQty: number; // e.g. 2
  purchaseUnitPrice: number; // e.g. 120,000
  purchaseUnit: string; // e.g. Chai
  packQty?: number; // e.g. 12 (thùng 12 chai) or 1
  packUnit?: string; // e.g. Chai
  capacityQty?: number; // e.g. 1000
  capacityUnit?: string; // e.g. ml
  baseUnit: string; // e.g. ml
  lossRate?: number; // e.g. 0.05 (5% hao hụt)
}

export interface PurchaseConversionResult {
  totalBaseQuantity: number;
  subtotal: number;
  baseUnitPrice: number;
  lossRate: number;
  effectiveBaseQuantity: number;
  effectiveBasePrice: number;
  conversionRate: number;
  conversionSpec: string;
  isValid: boolean;
  validationError?: string;
}

/**
 * Computes multi-level unit conversions, loss adjustments, and effective unit prices
 */
export function calculatePurchaseConversion(
  params: PurchaseConversionParams
): PurchaseConversionResult {
  const purchaseQty = Number(params.purchaseQty) || 0;
  const purchaseUnitPrice = Number(params.purchaseUnitPrice) || 0;
  const purchaseUnit = (params.purchaseUnit || '').trim();
  const packQty = Number(params.packQty) > 0 ? Number(params.packQty) : 1;
  const packUnit = (params.packUnit || '').trim();
  const capacityQty = Number(params.capacityQty) > 0 ? Number(params.capacityQty) : 1;
  const capacityUnit = (params.capacityUnit || params.baseUnit || '').trim();
  const baseUnit = (params.baseUnit || 'ml').trim();
  let lossRate = Number(params.lossRate) || 0;

  if (lossRate < 0) lossRate = 0;
  if (lossRate >= 1.0) lossRate = 0.99; // Cap at 99%

  // Check validity
  if (purchaseQty <= 0) {
    return {
      totalBaseQuantity: 0,
      subtotal: 0,
      baseUnitPrice: 0,
      lossRate: 0,
      effectiveBaseQuantity: 0,
      effectiveBasePrice: 0,
      conversionRate: 1,
      conversionSpec: '',
      isValid: false,
      validationError: 'Số lượng nhập phải lớn hơn 0',
    };
  }

  if (purchaseUnitPrice < 0) {
    return {
      totalBaseQuantity: 0,
      subtotal: 0,
      baseUnitPrice: 0,
      lossRate: 0,
      effectiveBaseQuantity: 0,
      effectiveBasePrice: 0,
      conversionRate: 1,
      conversionSpec: '',
      isValid: false,
      validationError: 'Đơn giá nhập không thể âm',
    };
  }

  // Multi-level unit conversion factor
  const unitFactor = getUnitFactor(capacityUnit, baseUnit);
  const conversionRate = packQty * capacityQty * unitFactor;
  const totalBaseQuantity = Math.round(purchaseQty * conversionRate * 1000) / 1000;
  const subtotal = Math.round(purchaseQty * purchaseUnitPrice);

  const baseUnitPrice =
    totalBaseQuantity > 0
      ? Math.round((subtotal / totalBaseQuantity) * 1000) / 1000
      : 0;

  const effectiveBaseQuantity =
    Math.round(totalBaseQuantity * (1.0 - lossRate) * 1000) / 1000;

  const effectiveBasePrice =
    effectiveBaseQuantity > 0
      ? Math.round((subtotal / effectiveBaseQuantity) * 1000) / 1000
      : baseUnitPrice;

  // Build human-friendly specification description
  let conversionSpec = '';
  const isMultiLevel = packQty > 1 && packUnit && packUnit !== purchaseUnit;
  const hasCapacity = capacityQty > 1 || capacityUnit.toLowerCase() !== purchaseUnit.toLowerCase();

  if (isMultiLevel) {
    conversionSpec = `${purchaseQty} ${purchaseUnit} × ${packQty} ${packUnit} × ${capacityQty.toLocaleString('vi-VN')} ${capacityUnit}`;
  } else if (hasCapacity) {
    conversionSpec = `${purchaseQty} ${purchaseUnit} × ${capacityQty.toLocaleString('vi-VN')} ${capacityUnit}`;
  } else {
    conversionSpec = `${purchaseQty} ${purchaseUnit}`;
  }

  return {
    totalBaseQuantity,
    subtotal,
    baseUnitPrice,
    lossRate,
    effectiveBaseQuantity,
    effectiveBasePrice,
    conversionRate,
    conversionSpec,
    isValid: true,
  };
}

/**
 * Format quantity with unit (e.g. 1.000 ml, 2.5 kg)
 */
export function formatQuantityWithUnit(qty: number, unit: string): string {
  const formattedQty = Number(qty || 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 3,
  });
  return `${formattedQty} ${unit || ''}`.trim();
}
