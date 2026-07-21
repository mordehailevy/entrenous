import type { Currency, Transaction } from '../types';
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from './format';

/**
 * Génère un PDF de l'historique d'un compte et déclenche son téléchargement.
 * jsPDF est importé dynamiquement pour ne pas alourdir le bundle principal
 * (dépendance chargée uniquement au moment de l'export, cf. plan-ameliorations-ux.md).
 * Les montants sont affichés avec le code devise (ILS/EUR) plutôt que le
 * symbole (₪/€), non supporté par la police par défaut de jsPDF.
 */
export async function exportTransactionsToPdf(
  transactions: Transaction[],
  options: { fileName: string; currency: Currency; ownerLabel: string; counterpartyLabel: string; title: string },
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('EntreNous', 14, 18);
  doc.setFontSize(11);
  doc.text(options.title, 14, 26);

  const rows = [...transactions]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((tx) => {
      const fromLabel = tx.direction === 'owner_to_counterparty' ? options.ownerLabel : options.counterpartyLabel;
      const toLabel = tx.direction === 'owner_to_counterparty' ? options.counterpartyLabel : options.ownerLabel;
      return [
        formatDateTime(tx.created_at),
        `${tx.amount} ${options.currency}`,
        `${fromLabel} -> ${toLabel}`,
        KIND_LABELS[tx.kind] ?? tx.kind,
        STATUS_LABELS[tx.status] ?? tx.status,
        tx.note ?? '',
      ];
    });

  autoTable(doc, {
    startY: 32,
    head: [['Date', 'Montant', 'Sens', 'Type', 'Statut', 'Note']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [124, 58, 237] },
  });

  doc.save(options.fileName);
}
