import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="gradient-text text-2xl font-extrabold">404</p>
      <p className="text-sm text-gray-500">Cette page n'existe pas.</p>
      <Link to="/" className="text-sm font-semibold text-[--color-accent-start]">
        Retour à l'accueil
      </Link>
    </div>
  );
}
