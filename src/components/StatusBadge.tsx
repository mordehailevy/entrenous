import type { TransactionStatus } from '../types';
import { STATUS_LABELS } from '../utils/format';

const STYLES: Record<TransactionStatus, string> = {
  confirmed: 'bg-credit-bg text-credit',
  pending: 'bg-pending-bg text-pending',
  disputed: 'bg-debt-bg text-debt',
};

const ICONS: Record<TransactionStatus, string> = {
  confirmed: '✅',
  pending: '⏳',
  disputed: '⚠️',
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span aria-hidden>{ICONS[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  );
}
