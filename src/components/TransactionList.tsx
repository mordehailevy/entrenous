import { useState } from 'react';
import type { CreatedBy, Currency, Direction, Transaction, TransactionKind, TransactionStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { Select, Textarea } from './Input';
import { TransactionForm } from './TransactionForm';
import { formatAmount, formatDateTime, KIND_LABELS } from '../utils/format';
import { getProofUrl, validateProofFile } from '../utils/proof';

interface TransactionListProps {
  transactions: Transaction[];
  currency: Currency;
  /** L'identité de la personne qui regarde l'écran ('owner' ou 'counterparty'). */
  viewer: CreatedBy;
  ownerLabel: string;
  counterpartyLabel: string;
  /** Note privée : pas de vrai interlocuteur, le "nom" peut être une catégorie plutôt qu'une personne. */
  isPrivate?: boolean;
  onConfirm: (tx: Transaction) => Promise<void>;
  onDispute: (tx: Transaction, comment: string) => Promise<void>;
  readOnly?: boolean;
  onEdit?: (
    tx: Transaction,
    values: { amount: number; direction: Direction; kind: TransactionKind; note: string },
  ) => Promise<void>;
  onDelete?: (tx: Transaction) => Promise<void>;
  /** Preuve de virement (photo/document) : disponible pour tout le monde, owner, counterparty ou invité. */
  onSetProof?: (tx: Transaction, file: File) => Promise<void>;
  onRemoveProof?: (tx: Transaction) => Promise<void>;
}

export function TransactionList({
  transactions,
  currency,
  viewer,
  ownerLabel,
  counterpartyLabel,
  isPrivate = false,
  onConfirm,
  onDispute,
  readOnly = false,
  onEdit,
  onDelete,
  onSetProof,
  onRemoveProof,
}: TransactionListProps) {
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [proofBusyId, setProofBusyId] = useState<string | null>(null);
  const [proofErrorId, setProofErrorId] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | TransactionKind>('all');

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Aucune transaction pour l'instant.</p>;
  }

  const sorted = [...transactions]
    .filter((tx) => statusFilter === 'all' || tx.status === statusFilter)
    .filter((tx) => kindFilter === 'all' || tx.kind === kindFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  async function handleConfirm(tx: Transaction) {
    setBusyId(tx.id);
    try {
      await onConfirm(tx);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisputeSubmit(tx: Transaction) {
    setBusyId(tx.id);
    try {
      await onDispute(tx, comment);
      setDisputingId(null);
      setComment('');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!window.confirm('Supprimer définitivement cette transaction ?')) return;
    setBusyId(tx.id);
    try {
      await onDelete?.(tx);
    } finally {
      setBusyId(null);
    }
  }

  async function handleFileSelected(tx: Transaction, file: File) {
    const validationError = validateProofFile(file);
    if (validationError) {
      setProofErrorId(tx.id);
      setProofError(validationError);
      return;
    }
    setProofErrorId(null);
    setProofError(null);
    setProofBusyId(tx.id);
    try {
      await onSetProof?.(tx, file);
    } finally {
      setProofBusyId(null);
    }
  }

  async function handleRemoveProof(tx: Transaction) {
    if (!window.confirm('Retirer cette preuve ?')) return;
    setProofBusyId(tx.id);
    try {
      await onRemoveProof?.(tx);
    } finally {
      setProofBusyId(null);
    }
  }

  return (
    <div>
      {transactions.length > 1 && (
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmées</option>
              <option value="disputed">Contestées</option>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}>
              <option value="all">Tous les types</option>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Aucune transaction ne correspond à ce filtre.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sorted.map((tx) => {
            const fromLabel = tx.direction === 'owner_to_counterparty' ? ownerLabel : counterpartyLabel;
            const toLabel = tx.direction === 'owner_to_counterparty' ? counterpartyLabel : ownerLabel;
            const canAct = !readOnly && tx.status === 'pending' && tx.created_by !== viewer;
            // Note privée (readOnly) : toujours modifiable. Compte partagé : tant que la
            // transaction créée par soi-même n'est pas confirmée (une contestation reste
            // modifiable pour permettre de la corriger, ce qui la repasse en attente).
            const canEdit = Boolean(onEdit) && (readOnly || (tx.created_by === viewer && tx.status !== 'confirmed'));

            if (canEdit && editingId === tx.id) {
              return (
                <li key={tx.id} className="py-4">
                  <TransactionForm
                    currency={currency}
                    actor={viewer}
                    ownerLabel={ownerLabel}
                    counterpartyLabel={counterpartyLabel}
                    isPrivate={isPrivate}
                    initialValues={{ amount: tx.amount, direction: tx.direction, kind: tx.kind, note: tx.note ?? '' }}
                    submitLabel="Enregistrer"
                    submittingLabel="Enregistrement..."
                    onSubmit={async (values) => {
                      await onEdit?.(tx, values);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              );
            }

            return (
              <li key={tx.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {KIND_LABELS[tx.kind]} · {formatAmount(tx.amount, currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fromLabel} → {toLabel}
                    </p>
                    {tx.note && <p className="mt-1 text-sm text-gray-600">{tx.note}</p>}
                    {tx.status === 'disputed' && tx.dispute_comment && (
                      <p className="mt-1 text-sm text-debt">Contestation : {tx.dispute_comment}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(tx.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={tx.status} />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingId(tx.id)}
                        className="text-xs font-medium text-gray-500 hover:text-ink"
                      >
                        Modifier
                      </button>
                    )}
                    {canEdit && onDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tx)}
                        disabled={busyId === tx.id}
                        className="text-xs font-medium text-gray-500 hover:text-debt"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {canAct && (
                  <div className="mt-3">
                    {disputingId === tx.id ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          placeholder="Pourquoi contestez-vous cette transaction ?"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="danger"
                            onClick={() => handleDisputeSubmit(tx)}
                            disabled={busyId === tx.id}
                          >
                            Confirmer la contestation
                          </Button>
                          <Button variant="ghost" onClick={() => setDisputingId(null)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="success" onClick={() => handleConfirm(tx)} disabled={busyId === tx.id}>
                          ✅ Confirmer
                        </Button>
                        <Button variant="danger" onClick={() => setDisputingId(tx.id)} disabled={busyId === tx.id}>
                          ⚠️ Contester
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3">
                  {tx.proof_path ? (
                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={getProofUrl(tx.proof_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[--color-accent-start] hover:underline"
                      >
                        📎 {tx.proof_name || 'Voir la preuve'}
                      </a>
                      {onRemoveProof && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProof(tx)}
                          disabled={proofBusyId === tx.id}
                          className="text-gray-400 hover:text-debt"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  ) : (
                    onSetProof && (
                      <label className="inline-flex cursor-pointer items-center text-xs font-medium text-gray-500 hover:text-ink">
                        {proofBusyId === tx.id ? 'Envoi...' : '📎 Ajouter une preuve'}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={proofBusyId === tx.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) handleFileSelected(tx, file);
                          }}
                        />
                      </label>
                    )
                  )}
                  {proofErrorId === tx.id && proofError && <p className="mt-1 text-xs text-debt">{proofError}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
