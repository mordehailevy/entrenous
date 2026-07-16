import { useState } from 'react';
import { Button } from './Button';

interface ShareLinkButtonProps {
  shareToken: string;
  onRegenerate?: () => Promise<void>;
}

export function ShareLinkButton({ shareToken, onRegenerate }: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const url = `${window.location.origin}/l/${shareToken}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiez ce lien :', url);
    }
  }

  async function handleRegenerate() {
    if (!onRegenerate) return;
    if (
      !window.confirm(
        "Régénérer le lien de partage ? L'ancien lien cessera de fonctionner immédiatement, y compris pour la personne qui l'a déjà reçu.",
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={handleCopy}>
        {copied ? '✅ Lien copié !' : '🔗 Copier le lien de partage'}
      </Button>
      {onRegenerate && (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-xs font-medium text-gray-500 hover:text-ink"
        >
          {regenerating ? 'Régénération...' : 'Régénérer'}
        </button>
      )}
    </div>
  );
}
