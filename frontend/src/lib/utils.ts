export interface SettingsMap {
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  currency_code?: string;
  currency_symbol?: string;
  currency_position?: string;
  vietqr_bank_id?: string;
  vietqr_account_no?: string;
  vietqr_account_name?: string;
  [key: string]: string | undefined;
}

/**
 * Dynamically format currency amount based on store settings (symbol and suffix/prefix position)
 * Standardized for Vietnamese F&B business concept with dot (.) thousand separators and no decimal places for VND (e.g., 35.000 đ).
 */
export function formatCurrency(
  amount: number,
  settings?: SettingsMap | null
): string {
  const symbol = settings?.currency_symbol ?? 'đ';
  const position = settings?.currency_position ?? 'suffix';
  const currencyCode = settings?.currency_code ?? 'VND';
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;

  const isNegative = val < 0;
  const absVal = Math.abs(val);

  let formattedVal: string;
  if (currencyCode === 'VND' || symbol === 'đ') {
    // Whole integer formatting for VND with dot (.) thousand separators
    const rounded = Math.round(absVal);
    formattedVal = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else {
    // Other currencies formatting
    const rounded = Math.round(absVal * 100) / 100;
    const parts = rounded.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    formattedVal = parts.join(',');
  }

  const sign = isNegative ? '-' : '';

  if (position === 'prefix') {
    return `${sign}${symbol} ${formattedVal}`.trim();
  }
  return `${sign}${formattedVal} ${symbol}`.trim();
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  sale: ['sale', 'doanh thu bán hàng pos', 'doanh thu bán hàng', 'bán hàng', 'pos'],
  ingredient_purchase: ['ingredient_purchase', 'mua nguyên liệu', 'mua nguyên vật liệu', 'nguyên liệu'],
  utility_bill: ['utility_bill', 'chi phí vận hành', 'vận hành'],
  reconciliation_variance: ['reconciliation_variance', 'chênh lệch đối soát', 'chênh lệch đối soát két', 'đối soát'],
  order_refund: ['order_refund', 'hủy đơn / trả hàng', 'hủy đơn', 'trả hàng', 'hoàn tiền đơn hàng', 'hoàn tiền'],
  other: ['other', 'khác', 'chi phí khác', 'thu khác'],
};

/**
 * Checks if a transaction's category matches a selected filter category (by code, name, or alias)
 */
export function matchTransactionCategory(
  txCategory?: string,
  filterCategory?: string,
  categories: { id?: number; name: string; code?: string }[] = []
): boolean {
  if (!filterCategory || filterCategory === 'all') return true;
  if (!txCategory) return false;

  const normTx = txCategory.trim().toLowerCase();
  const normFilter = filterCategory.trim().toLowerCase();

  if (normTx === normFilter) return true;

  // Check direct alias matches
  for (const [, aliases] of Object.entries(CATEGORY_ALIASES)) {
    const filterMatches = aliases.some((a) => a.toLowerCase() === normFilter);
    const txMatches = aliases.some((a) => a.toLowerCase() === normTx);
    if (filterMatches && txMatches) return true;
  }

  // Find category objects
  const filterCat = categories.find(
    (c) =>
      c.code?.toLowerCase() === normFilter ||
      c.name?.toLowerCase() === normFilter ||
      (c.id !== undefined && String(c.id) === normFilter)
  );

  const txCat = categories.find(
    (c) =>
      c.code?.toLowerCase() === normTx ||
      c.name?.toLowerCase() === normTx
  );

  if (filterCat && txCat && filterCat.id !== undefined && filterCat.id === txCat.id) return true;

  if (filterCat) {
    if (filterCat.name.toLowerCase() === normTx || filterCat.code?.toLowerCase() === normTx) {
      return true;
    }
    for (const [, aliases] of Object.entries(CATEGORY_ALIASES)) {
      const filterCatMatches = aliases.some((a) => a.toLowerCase() === filterCat.name.toLowerCase() || (filterCat.code && a.toLowerCase() === filterCat.code.toLowerCase()));
      const txMatches = aliases.some((a) => a.toLowerCase() === normTx);
      if (filterCatMatches && txMatches) return true;
    }
  }

  return false;
}

/**
 * Format date and time string in Vietnamese locale
 */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

