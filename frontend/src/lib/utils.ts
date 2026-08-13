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
 */
export function formatCurrency(
  amount: number,
  settings?: SettingsMap | null
): string {
  const symbol = settings?.currency_symbol ?? 'đ';
  const position = settings?.currency_position ?? 'suffix';
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  
  // Format with thousand separators
  const formattedVal = val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (position === 'prefix') {
    return `${symbol}${formattedVal}`;
  }
  return `${formattedVal} ${symbol}`;
}
