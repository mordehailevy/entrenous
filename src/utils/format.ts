import type { Currency } from '../types';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ILS: '₪',
  EUR: '€',
};

export function formatAmount(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const formatted = rounded.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${formatted} ${symbol}`;
}

export function formatSignedAmount(amount: number, currency: Currency): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatAmount(amount, currency)}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const KIND_LABELS: Record<string, string> = {
  virement: 'Virement',
  dette: 'Dette',
  remboursement: 'Remboursement',
  ajustement: 'Ajustement',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  disputed: 'Contesté',
};
