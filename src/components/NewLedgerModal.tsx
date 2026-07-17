import { useState, type FormEvent } from 'react';
import type { Currency } from '../types';
import { Button } from './Button';
import { Input, Label, Select } from './Input';

interface NewLedgerModalProps {
  onClose: () => void;
  onCreate: (values: { counterpartyName: string; currency: Currency; isPrivate: boolean }) => Promise<void>;
}

export function NewLedgerModal({ onClose, onCreate }: NewLedgerModalProps) {
  const [counterpartyName, setCounterpartyName] = useState('');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!counterpartyName.trim()) {
      setError('Merci de saisir un nom.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ counterpartyName: counterpartyName.trim(), currency, isPrivate });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-ink">Nouveau compte</h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <Label htmlFor="counterpartyName">
              {isPrivate ? 'Titre de la note' : 'Nom de la personne'}
            </Label>
            <Input
              id="counterpartyName"
              required
              placeholder={isPrivate ? 'Ex : Dettes diverses' : 'Ex : Sarah'}
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="currency">Devise</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="ILS">₪ Shekel (ILS)</option>
              <option value="EUR">€ Euro (EUR)</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Note privée (pas de partage, transactions auto-confirmées)
          </label>
          {error && <p className="text-sm text-debt">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'Création...' : 'Créer'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
