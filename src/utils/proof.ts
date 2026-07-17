import { supabase } from '../lib/supabaseClient';

// Bucket public : quiconque possède déjà le share_token d'un ledger a de
// toute façon accès à son contenu (c'est le même modèle de confiance que le
// reste de l'accès invité), et le nom de fichier inclut ce token donc n'est
// pas devinable de l'extérieur. Voir supabase/migrations/0005_transaction_proofs.sql.
const BUCKET = 'transaction-proofs';

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

/** Vérifie un fichier avant envoi ; retourne un message d'erreur en français ou null si ok. */
export function validateProofFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) {
    return 'Le fichier est trop volumineux (8 Mo maximum).';
  }
  // Certains navigateurs/mobiles ne renseignent pas toujours `file.type` (ex :
  // certains formats HEIC) — dans ce cas on ne bloque pas sur ce seul critère.
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return 'Format non supporté (photo ou PDF uniquement).';
  }
  return null;
}

function buildProofPath(shareToken: string, transactionId: string, file: File): string {
  const dotIndex = file.name.lastIndexOf('.');
  const rawExt = dotIndex >= 0 ? file.name.slice(dotIndex + 1) : '';
  const safeExt = rawExt ? `.${rawExt.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
  return `${shareToken}/${transactionId}/${crypto.randomUUID()}${safeExt}`;
}

/** Envoie le fichier de preuve et retourne le chemin de stockage à enregistrer sur la transaction. */
export async function uploadProof(shareToken: string, transactionId: string, file: File): Promise<string> {
  const path = buildProofPath(shareToken, transactionId, file);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** URL publique d'affichage/téléchargement d'une preuve déjà envoyée. */
export function getProofUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort : on ne bloque jamais l'action utilisateur si la suppression du fichier échoue. */
export async function removeProofFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
