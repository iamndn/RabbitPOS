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
