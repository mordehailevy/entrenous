import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';

export function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/'), 1500);
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-400">Chargement...</p>;
  }

  // Le clic sur le lien reçu par email établit une session de récupération
  // via Supabase avant que cette page ne soit affichée. Sans cette session,
  // le lien est invalide, expiré, ou déjà utilisé.
  if (!user) {
    return (
      <AuthLayout title="Lien invalide" subtitle="Ce lien de réinitialisation est invalide ou a expiré">
        <Link to="/mot-de-passe-oublie" className="text-sm font-semibold text-[--color-accent-start]">
          Redemander un lien
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe">
      {done ? (
        <p className="text-center text-sm text-credit">Mot de passe mis à jour ! Redirection en cours...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-debt">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
