import { useState, type FormEvent } from 'react';
import type { CreatedBy, Currency, Direction, TransactionKind } from '../types';
import { Button } from './Button';
import { Input, Label, Select, Textarea } from './Input';
import { KIND_LABELS } from '../utils/format';

interface TransactionFormValues {
  amount: number;
  direction: Direction;
  kind: TransactionKind;
  note: string;
}

interface TransactionFormProps {
  currency: Currency;
  /** Qui remplit le formulaire : 'owner' ou 'counterparty'. */
  actor: CreatedBy;
  ownerLabel: string;
  counterpartyLabel: string;
  /** Note privée : pas de vrai interlocuteur, le "nom" peut être une catégorie plutôt qu'une personne. */
  isPrivate?: boolean;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onCancel?: () => void;
  /** Pré-remplit le formulaire pour une édition plutôt qu'une création. */
  initialValues?: TransactionFormValues;
  submitLabel?: string;
  submittingLabel?: string;
}

export function TransactionForm({
  currency,
  actor,
  ownerLabel,
  counterpartyLabel,
  isPrivate = false,
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Ajouter la transaction',
  submittingLabel = 'Ajout...',
}: TransactionFormProps) {
  const initialSent = initialValues
    ? actor === 'owner'
      ? initialValues.direction === 'owner_to_counterparty'
      : initialValues.direction === 'counterparty_to_owner'
    : true;

  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : '');
  const [sent, setSent] = useState(initialSent); // true = "j'ai envoyé", false = "j'ai reçu"
  const [kind, setKind] = useState<TransactionKind>(initialValues?.kind ?? 'virement');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note privée : le "nom" du compte peut être une catégorie ("Dettes diverses") plutôt qu'une
  // personne, donc "J'ai envoyé à Dettes diverses" serait bancal — on omet le destinataire.
  const sentLabel = isPrivate
    ? "J'ai payé"
    : actor === 'owner'
      ? `J'ai envoyé à ${counterpartyLabel}`
      : `J'ai envoyé à ${ownerLabel}`;
  const receivedLabel = isPrivate
    ? "J'ai reçu"
    : actor === 'owner'
      ? `J'ai reçu de ${counterpartyLabel}`
      : `J'ai reçu de ${ownerLabel}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = amount.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      setError('Merci de saisir un montant valide (ex : 120 ou 120,50).');
      return;
    }
    const value = parseFloat(normalized);
    if (!value || value <= 0) {
      setError('Merci de saisir un montant valide.');
      return;
    }

    // direction est toujours exprimée du point de vue de l'owner
    let direction: Direction;
    if (actor === 'owner') {
      direction = sent ? 'owner_to_counterparty' : 'counterparty_to_owner';
    } else {
      direction = sent ? 'counterparty_to_owner' : 'owner_to_counterparty';
    }

    setSubmitting(true);
    try {
      await onSubmit({ amount: value, direction, kind, note });
      if (!initialValues) {
        setAmount('');
        setNote('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="amount">Montant</Label>
        <Input
          id="amount"
          inputMode="decimal"
          placeholder={`0 ${currency === 'ILS' ? '₪' : '€'}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div>
        <Label>Sens</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSent(true)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              sent ? 'border-transparent gradient-accent text-white' : 'border-gray-200 text-ink hover:bg-gray-50'
            }`}
          >
            {sentLabel}
          </button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              !sent ? 'border-transparent gradient-accent text-white' : 'border-gray-200 text-ink hover:bg-gray-50'
            }`}
          >
            {receivedLabel}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {isPrivate ? (
            <>
              💡 « J'ai payé » augmente ce qu'on vous doit, « J'ai reçu » augmente ce que vous
              devez. Pas besoin de distinguer un prêt d'un remboursement : le solde se recalcule
              automatiquement sur l'ensemble des transactions. Par exemple, si vous êtes remboursé
              après avoir indiqué « J'ai payé », indiquez simplement « J'ai reçu » — le solde
              s'ajustera tout seul.
            </>
          ) : (
            <>
              💡 « J'ai envoyé » augmente ce que l'autre vous doit, « J'ai reçu » augmente ce que vous
              devez. Pas besoin de distinguer un prêt d'un remboursement : le solde se recalcule
              automatiquement sur l'ensemble des transactions. Par exemple, si on vous a envoyé de
              l'argent et que vous le renvoyez ensuite (remboursement ou nouveau prêt), indiquez
              simplement « J'ai envoyé » — le solde s'ajustera tout seul.
            </>
          )}
        </p>
      </div>

      <div>
        <Label htmlFor="kind">Type</Label>
        <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as TransactionKind)}>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-gray-500">
          Purement indicatif pour l'historique — n'affecte pas le calcul du solde.
        </p>
      </div>

      <div>
        <Label htmlFor="note">Note (optionnel)</Label>
        <Textarea id="note" rows={2} placeholder="Ex : loyer de juillet" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && <p className="text-sm text-debt">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? submittingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
