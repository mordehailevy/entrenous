import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';

/**
 * Affiché quand un compte partagé est soldé (solde validé à 0, rien en attente) :
 * chacune des deux parties peut alors supprimer la dette.
 */
export function SettledLedgerCard({ onDelete }: { onDelete: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm('Supprimer définitivement cette dette et tout son historique, pour vous deux ?')) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La suppression a échoué.');
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-4 border border-credit/30 bg-credit-bg">
      <p className="font-semibold text-credit">Compte soldé</p>
      <p className="mt-1 text-sm text-ink">
        Tout est remboursé. Vous pouvez maintenant supprimer cette dette : elle disparaîtra pour vous deux.
      </p>
      {error && <p className="mt-2 text-sm text-debt">{error}</p>}
      <Button variant="danger" className="mt-3" onClick={handleClick} disabled={deleting}>
        {deleting ? 'Suppression...' : 'Supprimer la dette'}
      </Button>
    </Card>
  );
}
