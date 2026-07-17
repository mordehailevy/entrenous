// Edge Function : envoie un email de notification (best-effort) quand une
// transaction est ajoutée par l'autre partie, ou quand une transaction est
// contestée. Appelée directement depuis le frontend juste après un insert/
// update réussi (pas de trigger DB, pour rester simple à déployer).
//
// Sécurité : le destinataire n'est jamais fourni par l'appelant. On relit le
// ledger et la transaction en base (service role) et on calcule nous-mêmes
// qui doit être notifié, pour ne pas permettre d'envoyer un email à
// n'importe qui. L'accès est vérifié soit via le JWT de l'appelant (owner ou
// counterparty authentifié), soit via le share_token du ledger (invité).
//
// Vie privée : l'email ne contient jamais le montant, le type ni la note de
// la transaction — seulement le nom de l'autre partie (déjà visible par le
// destinataire dans l'app) et un lien vers l'app pour voir le détail.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  transactionId: string;
  eventType: 'new_transaction' | 'dispute';
  ledgerId?: string;
  shareToken?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.transactionId || !body.eventType) {
      return json({ error: 'transactionId et eventType sont requis.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Qui appelle ? (peut être anonyme, auquel cas seul shareToken compte)
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    let callerUserId: string | null = null;
    if (jwt) {
      const { data } = await admin.auth.getUser(jwt);
      callerUserId = data.user?.id ?? null;
    }

    const { data: tx, error: txError } = await admin
      .from('transactions')
      .select('*')
      .eq('id', body.transactionId)
      .single();
    if (txError || !tx) return json({ error: 'Transaction introuvable.' }, 404);

    const { data: ledger, error: ledgerError } = await admin
      .from('ledgers')
      .select('*')
      .eq('id', tx.ledger_id)
      .single();
    if (ledgerError || !ledger) return json({ error: 'Compte introuvable.' }, 404);

    const hasAccess =
      (body.shareToken && body.shareToken === ledger.share_token) ||
      (callerUserId && (callerUserId === ledger.owner_id || callerUserId === ledger.counterparty_id));
    if (!hasAccess) return json({ error: 'Accès refusé.' }, 403);

    if (ledger.is_private) {
      // Note privée : personne d'autre à notifier.
      return json({ skipped: 'private_ledger' }, 200);
    }

    // Détermine qui recevoir la notification, sans jamais faire confiance à
    // l'appelant pour ça.
    const recipientRole: 'owner' | 'counterparty' =
      body.eventType === 'dispute' ? tx.created_by : tx.created_by === 'owner' ? 'counterparty' : 'owner';

    const recipientUserId = recipientRole === 'owner' ? ledger.owner_id : ledger.counterparty_id;
    if (!recipientUserId) {
      // Le counterparty n'a pas encore associé de compte (mode invité pur) :
      // pas d'email possible.
      return json({ skipped: 'no_linked_account' }, 200);
    }

    const { data: recipientUser } = await admin.auth.admin.getUserById(recipientUserId);
    const recipientEmail = recipientUser?.user?.email;
    if (!recipientEmail) return json({ skipped: 'no_email' }, 200);

    const otherPartyName = recipientRole === 'owner' ? ledger.counterparty_name : ledger.owner_display_name;
    const { subject, text } = buildMessage(body.eventType, otherPartyName);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      // Pas de clé configurée (typiquement en local) : on ne bloque rien,
      // on log juste pour le débogage.
      console.log('RESEND_API_KEY absente, email non envoyé (mode local ?)', { recipientEmail, subject });
      return json({ skipped: 'no_resend_key' }, 200);
    }

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'EntreNous <notifications@entrenous.dev>';
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Échec de l'envoi Resend :", resendResponse.status, errText);
      return json({ error: 'Échec envoi email.' }, 502);
    }

    return json({ sent: true }, 200);
  } catch (err) {
    console.error('notify-transaction-event error:', err);
    return json({ error: err instanceof Error ? err.message : 'Erreur inconnue.' }, 500);
  }
});

function buildMessage(eventType: RequestBody['eventType'], otherPartyName: string) {
  if (eventType === 'dispute') {
    return {
      subject: 'Une transaction a été contestée sur EntreNous',
      text: `Bonjour,\n\nUne transaction a été contestée sur votre compte avec ${otherPartyName} dans EntreNous.\n\nConnectez-vous pour en savoir plus : https://entrenous.dev\n\n— EntreNous`,
    };
  }
  return {
    subject: 'Nouvelle transaction sur EntreNous',
    text: `Bonjour,\n\n${otherPartyName} a ajouté une nouvelle transaction sur votre compte dans EntreNous.\n\nConnectez-vous pour la consulter : https://entrenous.dev\n\n— EntreNous`,
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
