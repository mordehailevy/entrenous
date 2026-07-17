import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Cf. SignupPage : "?next=/l/<token>" ramène vers la page invité d'origine
  // après connexion, pour pouvoir associer ce ledger au compte.
  const next = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      return;
    }
    navigate(next ?? '/');
  }

  return (
    <AuthLayout title="Connexion" subtitle="Suivi de dettes et virements confirmés à deux">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-debt">{error}</p>}
        <div className="text-right">
          <Link to="/mot-de-passe-oublie" className="text-xs font-medium text-gray-500 hover:text-ink">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Pas encore de compte ?{' '}
        <Link
          to={next ? `/inscription?next=${encodeURIComponent(next)}` : '/inscription'}
          className="font-semibold text-[--color-accent-start]"
        >
          Inscrivez-vous
        </Link>
      </p>
    </AuthLayout>
  );
}
