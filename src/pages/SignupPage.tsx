import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Un lien "?next=/l/<token>" est ajouté quand on arrive ici depuis une page
  // invité (voir GuestLedgerPage), pour revenir sur ce même lien une fois le
  // compte confirmé et pouvoir l'associer automatiquement à ce ledger.
  const next = searchParams.get('next');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError('Merci de saisir votre prénom.');
      return;
    }
    if (!email.trim()) {
      setError('Merci de saisir votre email.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(email, password, displayName, next ?? undefined);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
    setNeedsConfirmation(needsEmailConfirmation);
    // Si une confirmation email est requise, l'utilisateur n'a pas encore de
    // session : le rediriger vers "/" le renverrait à la connexion, ce qui
    // contredirait le message affiché. Le lien de confirmation email renverra
    // directement vers `next` (voir emailRedirectTo dans AuthContext).
    if (!needsEmailConfirmation) {
      setTimeout(() => navigate(next ?? '/'), 1500);
    }
  }

  return (
    <AuthLayout title="Créer un compte" subtitle="Gratuit, en 30 secondes">
      {done ? (
        <p className="text-center text-sm text-credit">
          {needsConfirmation
            ? 'Compte créé ! Vérifiez votre boîte email et cliquez sur le lien de confirmation pour vous connecter.'
            : 'Compte créé ! Redirection en cours...'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <Label htmlFor="displayName">Prénom affiché</Label>
            <Input
              id="displayName"
              required
              placeholder="Mordehai"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-debt">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-gray-500">
        Déjà inscrit ?{' '}
        <Link
          to={next ? `/connexion?next=${encodeURIComponent(next)}` : '/connexion'}
          className="font-semibold text-[--color-accent-start]"
        >
          Connectez-vous
        </Link>
      </p>
    </AuthLayout>
  );
}
