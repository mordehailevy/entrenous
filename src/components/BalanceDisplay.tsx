import type { Currency } from '../types';
import { formatAmount } from '../utils/format';

interface BalanceDisplayProps {
  confirmedBalance: number;
  pendingBalance: number;
  currency: Currency;
  /** Libellés du point de vue de qui regarde l'écran. */
  theyOweYouLabel: string;
  youOweThemLabel: string;
}

export function BalanceDisplay({
  confirmedBalance,
  pendingBalance,
  currency,
  theyOweYouLabel,
  youOweThemLabel,
}: BalanceDisplayProps) {
  const isCredit = confirmedBalance >= 0;
  const colorClass = confirmedBalance === 0 ? 'text-ink' : isCredit ? 'text-credit' : 'text-debt';
  const label = confirmedBalance === 0 ? 'Solde à jour' : isCredit ? theyOweYouLabel : youOweThemLabel;

  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-4xl font-extrabold tracking-tight ${colorClass}`}>
        {formatAmount(confirmedBalance, currency)}
      </p>
      {pendingBalance !== 0 && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-pending-bg px-2.5 py-1 text-xs font-medium text-pending">
          ⏳ {formatAmount(pendingBalance, currency)} en attente de confirmation
        </p>
      )}
    </div>
  );
}
