/**
 * Currency utilities for salary formatting and conversion
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'INR': '₹',
  'JPY': '¥',
  'CNY': '¥',
  'AUD': 'A$',
  'CAD': 'C$',
  'SGD': 'S$',
  'HKD': 'HK$',
  'CHF': 'CHF',
  'SEK': 'kr',
  'NOK': 'kr',
  'DKK': 'kr',
  'BRL': 'R$',
  'MXN': '$',
  'AED': 'د.إ',
  'SAR': 'ر.س',
  'ZAR': 'R',
  'KRW': '₩',
  'THB': '฿',
  'MYR': 'RM',
  'PHP': '₱',
  'VND': '₫',
  'IDR': 'Rp',
  'ILS': '₪',
  'TRY': '₺',
};

/**
 * Get the currency symbol for a currency code
 */
export function getCurrencySymbol(currency?: string): string {
  if (!currency) return '$';
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Format salary range with currency
 * Handles different currencies appropriately
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string = 'USD'
): string {
  const symbol = getCurrencySymbol(currency);

  if (!min && !max) return 'Salary negotiable';

  // For most currencies, divide by 1000 and show as K
  // But for INR and other currencies with different scales, adjust accordingly
  const formatValue = (value: number): string => {
    if (currency === 'INR') {
      // INR values are typically much larger, show in appropriate scale
      if (value >= 10000000) {
        return `${(value / 10000000).toFixed(1)} Cr`;
      } else if (value >= 100000) {
        return `${(value / 100000).toFixed(0)}L`;
      } else {
        return `${(value / 1000).toFixed(0)}K`;
      }
    } else if (currency === 'JPY' || currency === 'KRW') {
      // JPY and KRW don't use decimal places typically
      return `${(value / 1000).toFixed(0)}K`;
    } else {
      // USD, EUR, GBP, etc. - use K suffix
      return `${(value / 1000).toFixed(0)}K`;
    }
  };

  if (!min) return `Up to ${symbol}${formatValue(max!)}`;
  if (!max) return `${symbol}${formatValue(min)}+`;
  return `${symbol}${formatValue(min)} - ${symbol}${formatValue(max)}`;
}

/**
 * Check if salary is considered "high" for comparison
 * Adjusted based on currency
 */
export function isHighSalary(
  min: number | null,
  max: number | null,
  currency: string = 'USD'
): boolean {
  if (!min && !max) return false;

  const thresholds: Record<string, number> = {
    'USD': 150000,
    'EUR': 130000,
    'GBP': 130000,
    'INR': 15000000, // 1.5 Cr in INR
    'AUD': 180000,
    'CAD': 180000,
    'SGD': 200000,
    'HKD': 1200000,
    'JPY': 20000000,
    'CNY': 1000000,
  };

  const threshold = thresholds[currency] || 150000;
  const avg = ((min || 0) + (max || 0)) / 2;
  return avg > threshold;
}
