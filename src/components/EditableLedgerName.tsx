import { useState, type FormEvent } from 'react';
import { Input } from './Input';

interface EditableLedgerNameProps {
  name: string;
  onSave: (newName: string) => Promise<void>;
}

export function EditableLedgerName({ name, onSave }: EditableLedgerNameProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-1">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSubmit}
          disabled={saving}
          className="text-xl font-bold"
        />
        {error && <p className="text-xs text-debt">{error}</p>}
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(name);
        setEditing(true);
      }}
      aria-label="Modifier le nom du compte"
      className="flex items-center gap-2 text-left"
    >
      <h1 className="text-xl font-bold text-ink">{name}</h1>
      <span aria-hidden className="text-sm text-gray-400 transition-colors hover:text-ink">
        ✏️
      </span>
    </button>
  );
}
