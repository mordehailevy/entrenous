import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Merci de saisir votre email.');
      return;
    }
    setSubmitting(true);
    const { error } = await forgotPassword(email);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Recevez un lien pour en choisir un nouveau">
      {done ? (
        <p className="text-center text-sm text-credit">
          Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-debt">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Envoi...' : 'Envoyer le lien'}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-gray-500">
        <Link to="/connexion" className="font-semibold text-[--color-accent-start]">
          Retour à la connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
