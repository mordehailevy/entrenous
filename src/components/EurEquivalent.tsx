import type { Currency } from '../types';
import { useIlsToEurRate } from '../hooks/useIlsToEurRate';
import { formatAmount } from '../utils/format';

/** « ≈ 1 758 € » à côté d'un montant en shekels, au taux BCE du jour. Rien pour les autres devises. */
export function EurEquivalent({
  amount,
  currency,
  className = '',
  showRate = false,
}: {
  amount: number;
  currency: Currency;
  className?: string;
  showRate?: boolean;
}) {
  const rate = useIlsToEurRate();
  if (currency !== 'ILS' || !rate || amount === 0) return null;

  const rateDate = new Date(`${rate.date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return (
    <span
      className={`text-gray-500 ${className}`}
      title={`Taux BCE du ${rateDate} : 1 ₪ = ${rate.rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} €`}
    >
      ≈ {formatAmount(Math.round(Math.abs(amount) * rate.rate), 'EUR')}
      {showRate && (
        <span className="ml-1 text-xs text-gray-400">
          (1 ₪ = {rate.rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} €, BCE {rateDate})
        </span>
      )}
    </span>
  );
}
