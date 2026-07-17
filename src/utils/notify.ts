import { supabase } from '../lib/supabaseClient';

/**
 * Prévient l'autre partie par email (best-effort) qu'une transaction a été
 * ajoutée ou contestée. N'échoue jamais bruyamment : ceci ne doit jamais
 * bloquer ni faire échouer l'action principale de l'utilisateur si l'envoi
 * d'email échoue ou si l'Edge Function n'est pas disponible (ex : en local
 * sans clé Resend configurée).
 */
export function notifyTransactionEvent(params: {
  transactionId: string;
  eventType: 'new_transaction' | 'dispute';
  ledgerId?: string;
  shareToken?: string;
}): void {
  supabase.functions.invoke('notify-transaction-event', { body: params }).catch((err) => {
    console.warn('notify-transaction-event: envoi non bloquant échoué', err);
  });
}
