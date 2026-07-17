import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link
          to="/"
          className="gradient-text shrink-0 text-xl font-extrabold tracking-tight"
        >
          EntreNous
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {profile && (
            <Link
              to="/profil"
              className="min-w-0 truncate text-sm text-gray-500 hover:text-ink"
            >
              Bonjour, {profile.display_name}
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="shrink-0 text-sm font-medium text-gray-500 hover:text-ink"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
