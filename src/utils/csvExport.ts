import type { Currency, Transaction } from '../types';
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from './format';

/**
 * Échappe une valeur pour l'insérer dans une cellule CSV (RFC 4180) : on
 * entoure de guillemets et double les guillemets internes dès qu'il y a une
 * virgule, un guillemet ou un retour à la ligne.
 */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Génère le contenu CSV de l'historique d'un compte (colonnes : date,
 * montant, sens, type, statut, note) et déclenche son téléchargement côté
 * client, sans dépendance externe (Blob + lien de téléchargement temporaire).
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  options: { fileName: string; currency: Currency; ownerLabel: string; counterpartyLabel: string },
): void {
  const header = ['Date', 'Montant', 'Devise', 'Sens', 'Type', 'Statut', 'Note'];
  const rows = [...transactions]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((tx) => {
      const fromLabel = tx.direction === 'owner_to_counterparty' ? options.ownerLabel : options.counterpartyLabel;
      const toLabel = tx.direction === 'owner_to_counterparty' ? options.counterpartyLabel : options.ownerLabel;
      return [
        formatDateTime(tx.created_at),
        tx.amount.toString(),
        options.currency,
        `${fromLabel} -> ${toLabel}`,
        KIND_LABELS[tx.kind] ?? tx.kind,
        STATUS_LABELS[tx.status] ?? tx.status,
        tx.note ?? '',
      ];
    });

  const csvContent = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
