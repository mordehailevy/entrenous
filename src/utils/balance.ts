import type { BalanceSummary, Transaction } from '../types';

/**
 * Signe du point de vue de l'owner : quand l'owner envoie de l'argent (owner_to_counterparty),
 * l'autre partie lui doit désormais cette somme (l'owner est créditeur). Quand l'owner reçoit
 * de l'argent (counterparty_to_owner), c'est l'owner qui doit cette somme (l'owner est débiteur).
 * Convention : montant positif = l'owner est créditeur (on lui doit de l'argent).
 */
function signedAmount(tx: Transaction): number {
  return tx.direction === 'owner_to_counterparty' ? tx.amount : -tx.amount;
}

export function computeOwnerBalance(transactions: Transaction[]): BalanceSummary {
  let confirmedBalance = 0;
  let pendingBalance = 0;

  for (const tx of transactions) {
    const signed = signedAmount(tx);
    if (tx.status === 'confirmed') {
      confirmedBalance += signed;
    } else if (tx.status === 'pending') {
      pendingBalance += signed;
    }
  }

  return { confirmedBalance, pendingBalance };
}

/** Vue de l'invité : signe inversé par rapport à l'owner. */
export function computeGuestBalance(transactions: Transaction[]): BalanceSummary {
  const owner = computeOwnerBalance(transactions);
  return {
    confirmedBalance: -owner.confirmedBalance,
    pendingBalance: -owner.pendingBalance,
  };
}

export interface BalancePoint {
  date: string;
  balance: number;
}

/** Évolution du solde validé dans le temps (point de vue owner), pour le graphique. */
export function computeBalanceHistory(transactions: Transaction[]): BalancePoint[] {
  const confirmed = transactions
    .filter((tx) => tx.status === 'confirmed')
    .sort((a, b) => new Date(a.confirmed_at ?? a.created_at).getTime() - new Date(b.confirmed_at ?? b.created_at).getTime());

  let running = 0;
  return confirmed.map((tx) => {
    running += signedAmount(tx);
    return {
      date: tx.confirmed_at ?? tx.created_at,
      balance: running,
    };
  });
}

export interface DebtPoint {
  /** Timestamp (ms) : l'axe X est une vraie échelle de temps. */
  time: number;
  /** Solde signé du point de vue du viewer (positif = on lui doit). */
  balance: number;
  /** Montant restant dû, quel que soit le sens : c'est la courbe affichée. */
  remaining: number;
}

/**
 * Courbe du « reste à rembourser » : part de 0, monte quand une dette est
 * contractée et descend à chaque remboursement. Un point final à aujourd'hui
 * prolonge le palier actuel pour que la courbe reflète l'état réel.
 */
export function computeDebtHistory(history: BalancePoint[], now = Date.now()): DebtPoint[] {
  if (history.length === 0) return [];
  const toPoint = (time: number, balance: number): DebtPoint => ({
    time,
    balance,
    remaining: Math.abs(balance),
  });
  const points = [toPoint(new Date(history[0].date).getTime(), 0)];
  for (const p of history) points.push(toPoint(new Date(p.date).getTime(), p.balance));
  const last = points[points.length - 1];
  if (now > last.time) points.push(toPoint(now, last.balance));
  return points;
}

/** Total déjà remboursé : somme de toutes les baisses du reste dû. */
export function computeRepaidTotal(points: DebtPoint[]): number {
  let repaid = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    // Un changement de sens (je devais → on me doit) rembourse d'abord toute l'ancienne dette.
    if (Math.sign(prev.balance) !== Math.sign(cur.balance) && prev.balance !== 0) {
      repaid += prev.remaining;
    } else if (cur.remaining < prev.remaining) {
      repaid += prev.remaining - cur.remaining;
    }
  }
  return repaid;
}

/**
 * Total de ce que le viewer doit, tous comptes confondus, au fil du temps.
 * On additionne seulement les comptes où il est débiteur (solde négatif) :
 * un remboursement reçu sur un autre compte ne doit pas faire bouger la courbe.
 * Résultat en convention signée (négatif = je dois) pour réutiliser BalanceChart.
 */
export function computeTotalDebtHistory(histories: BalancePoint[][]): BalancePoint[] {
  const events = histories
    .flatMap((history, ledgerIndex) => history.map((point) => ({ ...point, ledgerIndex })))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const current = new Map<number, number>();
  return events.map((event) => {
    current.set(event.ledgerIndex, event.balance);
    let owing = 0;
    for (const balance of current.values()) if (balance < 0) owing += -balance;
    return { date: event.date, balance: -owing };
  });
}

/**
 * Compte soldé : il a un historique, rien n'est en attente et le solde validé est à 0
 * (mêmes règles que le RPC delete_settled_ledger, les transactions contestées ne comptent pas).
 */
export function isLedgerSettled(
  transactions: Transaction[],
  confirmedBalance: number,
): boolean {
  return (
    transactions.length > 0 &&
    !transactions.some((tx) => tx.status === 'pending') &&
    Math.abs(confirmedBalance) < 0.005
  );
}
