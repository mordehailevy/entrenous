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
