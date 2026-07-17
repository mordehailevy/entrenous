import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/useAuth';
import type { Direction, Ledger, Transaction, TransactionKind } from '../types';
import { computeGuestBalance } from '../utils/balance';
import { removeProofFile, uploadProof, validateProofFile } from '../utils/proof';
import { exportTransactionsToCsv } from '../utils/csvExport';
import { notifyTransactionEvent } from '../utils/notify';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionList } from '../components/TransactionList';

const GUEST_NAME_KEY_PREFIX = 'entrenous_guest_name:';

export function GuestLedgerPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const guestNameKey = `${GUEST_NAME_KEY_PREFIX}${token}`;
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Petit message de succès temporaire (ex: "Transaction confirmée."), affiché
  // après une action réussie et effacé automatiquement après quelques secondes.
  function flashMessage(message: string) {
    setActionMessage(message);
    setTimeout(() => setActionMessage((current) => (current === message ? null : current)), 2500);
  }
  const [guestName, setGuestName] = useState<string | null>(() => localStorage.getItem(guestNameKey));
  const [nameInput, setNameInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const nextParam = `?next=${encodeURIComponent(`/l/${token}`)}`;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const { data: ledgerData, error: ledgerError } = await supabase
      .rpc('guest_get_ledger', { p_token: token })
      .single();

    if (ledgerError || !ledgerData) {
      setError('Ce lien est introuvable ou a expiré.');
      setLoading(false);
      return;
    }

    const ledgerRow = ledgerData as Ledger;
    setLedger(ledgerRow);

    const { data: txData } = await supabase.rpc('guest_get_transactions', { p_token: token });
    setTransactions((txData as Transaction[]) ?? []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Si l'utilisateur connecté est déjà le propriétaire ou le counterparty
  // associé de ce ledger, inutile de lui montrer la vue invité : direction
  // directe vers sa propre page de compte.
  useEffect(() => {
    if (!user || !ledger) return;
    if (user.id === ledger.owner_id || user.id === ledger.counterparty_id) {
      navigate(`/comptes/${ledger.id}`, { replace: true });
    }
  }, [user, ledger, navigate]);

  async function handleClaim() {
    if (!token) return;
    setClaiming(true);
    setClaimError(null);
    const { data, error } = await supabase.rpc('claim_ledger_as_counterparty', { p_token: token });
    setClaiming(false);
    if (error) {
      setClaimError(error.message);
      return;
    }
    const claimed = data as Ledger;
    navigate(`/comptes/${claimed.id}`, { replace: true });
  }

  function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) {
      setNameError('Merci de saisir votre prénom.');
      return;
    }
    setNameError(null);
    localStorage.setItem(guestNameKey, nameInput.trim());
    setGuestName(nameInput.trim());
  }

  async function handleAddTransaction(values: {
    amount: number;
    direction: 'owner_to_counterparty' | 'counterparty_to_owner';
    kind: TransactionKind;
    note: string;
  }) {
    if (!token) return;
    const { data: inserted, error } = await supabase.rpc('guest_add_transaction', {
      p_token: token,
      p_amount: values.amount,
      p_direction: values.direction,
      p_kind: values.kind,
      p_note: values.note || null,
    });
    if (error) throw new Error(error.message);
    setShowForm(false);
    await load();
    if (inserted) {
      notifyTransactionEvent({ transactionId: inserted.id, eventType: 'new_transaction', shareToken: token });
    }
  }

  async function handleConfirm(tx: Transaction) {
    if (!token) return;
    setActionError(null);
    const { error } = await supabase.rpc('guest_update_transaction_status', {
      p_token: token,
      p_tx_id: tx.id,
      p_status: 'confirmed',
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    flashMessage('✅ Transaction confirmée.');
    await load();
  }

  async function handleDispute(tx: Transaction, comment: string) {
    if (!token) return;
    setActionError(null);
    const { error } = await supabase.rpc('guest_update_transaction_status', {
      p_token: token,
      p_tx_id: tx.id,
      p_status: 'disputed',
      p_dispute_comment: comment,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    flashMessage('⚠️ Contestation envoyée.');
    await load();
    notifyTransactionEvent({ transactionId: tx.id, eventType: 'dispute', shareToken: token });
  }

  async function handleEditTransaction(
    tx: Transaction,
    values: { amount: number; direction: Direction; kind: TransactionKind; note: string },
  ) {
    if (!token) return;
    const { error } = await supabase.rpc('guest_edit_transaction', {
      p_token: token,
      p_tx_id: tx.id,
      p_amount: values.amount,
      p_direction: values.direction,
      p_kind: values.kind,
      p_note: values.note || null,
    });
    if (error) throw new Error(error.message);
    await load();
  }

  async function handleDeleteTransaction(tx: Transaction) {
    if (!token) return;
    if (tx.proof_path) await removeProofFile(tx.proof_path);
    const { error } = await supabase.rpc('guest_delete_transaction', { p_token: token, p_tx_id: tx.id });
    if (error) throw new Error(error.message);
    await load();
  }

  async function handleSetProof(tx: Transaction, file: File) {
    if (!token) return;
    setActionError(null);
    const validationError = validateProofFile(file);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    try {
      const path = await uploadProof(token, tx.id, file);
      const { error } = await supabase.rpc('guest_set_transaction_proof', {
        p_token: token,
        p_tx_id: tx.id,
        p_proof_path: path,
        p_proof_name: file.name,
      });
      if (error) throw new Error(error.message);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de l'envoi du fichier.");
    }
  }

  async function handleRemoveProof(tx: Transaction) {
    if (!token) return;
    setActionError(null);
    if (tx.proof_path) await removeProofFile(tx.proof_path);
    const { error } = await supabase.rpc('guest_set_transaction_proof', {
      p_token: token,
      p_tx_id: tx.id,
      p_proof_path: null,
      p_proof_name: null,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    await load();
  }

  function handleExportCsv() {
    if (!ledger) return;
    exportTransactionsToCsv(transactions, {
      fileName: `entrenous-${ledger.owner_display_name}.csv`,
      currency: ledger.currency,
      ownerLabel: ledger.owner_display_name,
      counterpartyLabel: guestName || ledger.counterparty_name,
    });
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-gray-400">Chargement...</p>;
  }

  if (error || !ledger) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <p className="text-sm text-debt">{error ?? 'Compte introuvable.'}</p>
      </div>
    );
  }

  if (!guestName && !user) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="gradient-text mb-1 text-center text-2xl font-extrabold">EntreNous</h1>
          <p className="mb-1 text-center text-sm text-gray-500">
            Compte entre vous et {ledger.owner_display_name}
          </p>
          <p className="mb-6 text-center text-sm text-gray-500">
            {ledger.owner_display_name} utilise EntreNous pour suivre vos comptes ensemble (dettes,
            virements).
          </p>
          <Card className="mb-4">
            <p className="mb-3 text-sm text-ink">
              Connectez-vous ou créez un compte pour retrouver ce suivi directement dans votre
              tableau de bord.
            </p>
            <div className="flex gap-2">
              <Link to={`/connexion${nextParam}`} className="flex-1">
                <Button className="w-full">Se connecter</Button>
              </Link>
              <Link to={`/inscription${nextParam}`} className="flex-1">
                <Button variant="secondary" className="w-full">
                  Créer un compte
                </Button>
              </Link>
            </div>
          </Card>
          <Card>
            <p className="mb-3 text-sm text-gray-500">
              Ou continuez sans compte : indiquez votre prénom pour voir le solde et l'historique,
              aucune inscription n'est nécessaire.
            </p>
            <form onSubmit={handleSaveName} noValidate className="space-y-4">
              <div>
                <Label htmlFor="guestName">Votre prénom</Label>
                <Input
                  id="guestName"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
              {nameError && <p className="text-sm text-debt">{nameError}</p>}
              <Button type="submit" variant="secondary" className="w-full">
                Continuer sans compte
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  if (!guestName && user) {
    // Utilisateur déjà connecté (mais pas encore owner/counterparty de ce
    // ledger, sinon le useEffect ci-dessus l'aurait déjà redirigé) : on lui
    // propose directement d'associer son compte plutôt que de lui redemander
    // un prénom d'invité.
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="gradient-text mb-1 text-2xl font-extrabold">EntreNous</h1>
          <p className="mb-6 text-sm text-gray-500">Compte entre vous et {ledger.owner_display_name}</p>
          <Card>
            <p className="mb-3 text-sm text-ink">
              Associez ce suivi à votre compte pour le retrouver dans votre tableau de bord.
            </p>
            {claimError && <p className="mb-3 text-sm text-debt">{claimError}</p>}
            <Button className="w-full" onClick={handleClaim} disabled={claiming}>
              {claiming ? 'Association...' : 'Associer ce compte à ce suivi'}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!guestName) return null; // toujours vrai ici (cf. les deux early-returns ci-dessus) ; satisfait le narrowing TS

  const { confirmedBalance, pendingBalance } = computeGuestBalance(transactions);

  return (
    <div className="min-h-svh">
      <header className="border-b border-gray-100 px-4 py-4 text-center">
        <h1 className="gradient-text text-xl font-extrabold">EntreNous</h1>
        <p className="text-sm text-gray-500">Compte entre vous et {ledger.owner_display_name}</p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="mb-4 border-2 border-dashed border-[--color-accent-start]/30">
          {user ? (
            <>
              <p className="text-sm text-ink">
                👋 Associez ce suivi à votre compte pour le retrouver dans votre tableau de bord.
              </p>
              {claimError && <p className="mt-2 text-sm text-debt">{claimError}</p>}
              <Button variant="secondary" className="mt-3" onClick={handleClaim} disabled={claiming}>
                {claiming ? 'Association...' : 'Associer ce compte à ce suivi'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink">
                👋 Créez votre compte gratuit pour retrouver ce suivi dans votre tableau de bord.
              </p>
              <div className="mt-3 flex gap-2">
                <Link to={`/connexion${nextParam}`}>
                  <Button variant="secondary">Se connecter</Button>
                </Link>
                <Link to={`/inscription${nextParam}`}>
                  <Button variant="secondary">Créer mon compte</Button>
                </Link>
              </div>
            </>
          )}
        </Card>

        <Card className="mb-4">
          <BalanceDisplay
            confirmedBalance={confirmedBalance}
            pendingBalance={pendingBalance}
            currency={ledger.currency}
            theyOweYouLabel={`${ledger.owner_display_name} vous doit`}
            youOweThemLabel={`Vous devez à ${ledger.owner_display_name}`}
          />
        </Card>

        <Card className="mb-4" ref={formRef}>
          {showForm ? (
            <TransactionForm
              currency={ledger.currency}
              actor="counterparty"
              ownerLabel={ledger.owner_display_name}
              counterpartyLabel={guestName}
              onSubmit={async (values) => {
                await handleAddTransaction(values);
                historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                setShowForm(true);
                requestAnimationFrame(() =>
                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                );
              }}
            >
              + Ajouter une transaction
            </Button>
          )}
        </Card>

        <Card ref={historyRef}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Historique</h2>
            {transactions.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="-m-2 p-2 text-xs font-medium text-gray-500 hover:text-ink"
              >
                ⬇️ Exporter en CSV
              </button>
            )}
          </div>
          {actionMessage && <p className="mb-3 text-sm text-credit">{actionMessage}</p>}
          {actionError && <p className="mb-3 text-sm text-debt">{actionError}</p>}
          <TransactionList
            transactions={transactions}
            currency={ledger.currency}
            viewer="counterparty"
            ownerLabel={ledger.owner_display_name}
            counterpartyLabel={guestName}
            onConfirm={handleConfirm}
            onDispute={handleDispute}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onSetProof={handleSetProof}
            onRemoveProof={handleRemoveProof}
          />
        </Card>
      </main>
    </div>
  );
}
