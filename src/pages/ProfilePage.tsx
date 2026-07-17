import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/useAuth';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setDone(false);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Merci de saisir un prénom.');
      return;
    }
    setSaving(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id);
    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    // Le nom affiché est dupliqué sur chaque ledger au moment de sa création
    // (pour l'affichage côté invité sans jointure). On le resynchronise ici
    // pour que les comptes déjà partagés reflètent le nouveau nom.
    const { error: ledgersError } = await supabase
      .from('ledgers')
      .update({ owner_display_name: trimmed })
      .eq('owner_id', user.id);
    if (ledgersError) {
      setError(ledgersError.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setDone(true);
  }

  return (
    <div className="min-h-svh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="mb-4 inline-block text-sm text-gray-500 hover:text-ink">
          ← Retour au tableau de bord
        </Link>

        <Card>
          <h1 className="mb-4 text-lg font-bold text-ink">Mon profil</h1>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <Label htmlFor="displayName">Prénom affiché</Label>
              <Input
                id="displayName"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Ce nom est visible par les personnes avec qui vous partagez un compte.
              </p>
            </div>
            {error && <p className="text-sm text-debt">{error}</p>}
            {done && <p className="text-sm text-credit">Profil mis à jour.</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
