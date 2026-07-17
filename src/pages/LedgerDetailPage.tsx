import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/useAuth';
import type { Direction, Ledger, Transaction, TransactionKind } from '../types';
import { computeBalanceHistory, computeGuestBalance, computeOwnerBalance } from '../utils/balance';
import { removeProofFile, uploadProof, validateProofFile } from '../utils/proof';
import { exportTransactionsToCsv } from '../utils/csvExport';
import { notifyTransactionEvent } from '../utils/notify';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { ShareLinkButton } from '../components/ShareLinkButton';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionList } from '../components/TransactionList';
import { BalanceChart } from '../components/BalanceChart';
import { EditableLedgerName } from '../components/EditableLedgerName';

export function LedgerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Petit message de succès temporaire (ex: "Transaction confirmée."), affiché
  // après une action réussie et effacé automatiquement après quelques secondes.
  function flashMessage(message: string) {
    setActionMessage(message);
    setTimeout(() => setActionMessage((current) => (current === message ? null : current)), 2500);
  }

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: ledgerData, error: ledgerError }, { data: txData }] = await Promise.all([
      supabase.from('ledgers').select('*').eq('id', id).single(),
      supabase.from('transactions').select('*').eq('ledger_id', id),
    ]);
    if (ledgerError) {
      setError('Compte introuvable.');
      setLoading(false);
      return;
    }
    setLedger(ledgerData as Ledger);
    setTransactions((txData as Transaction[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddTransaction(values: {
    amount: number;
    direction: 'owner_to_counterparty' | 'counterparty_to_owner';
    kind: TransactionKind;
    note: string;
  }) {
    if (!ledger) return;
    const createdBy = ledger.owner_id === user?.id ? 'owner' : 'counterparty';
    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({
        ledger_id: ledger.id,
        amount: values.amount,
        direction: values.direction,
        kind: values.kind,
        note: values.note || null,
        created_by: createdBy,
        status: ledger.is_private ? 'confirmed' : 'pending',
        confirmed_at: ledger.is_private ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    setShowForm(false);
    await load();
    if (inserted) {
      notifyTransactionEvent({ transactionId: inserted.id, eventType: 'new_transaction', ledgerId: ledger.id });
    }
  }

  async function handleConfirm(tx: Transaction) {
    setActionError(null);
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', tx.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    flashMessage('✅ Transaction confirmée.');
    await load();
  }

  async function handleDispute(tx: Transaction, comment: string) {
    setActionError(null);
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'disputed', dispute_comment: comment })
      .eq('id', tx.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    flashMessage('⚠️ Contestation envoyée.');
    await load();
    if (ledger) {
      notifyTransactionEvent({ transactionId: tx.id, eventType: 'dispute', ledgerId: ledger.id });
    }
  }

  async function handleEditTransaction(
    tx: Transaction,
    values: { amount: number; direction: Direction; kind: TransactionKind; note: string },
  ) {
    const { error } = await supabase
      .from('transactions')
      .update({
        amount: values.amount,
        direction: values.direction,
        kind: values.kind,
        note: values.note || null,
      })
      .eq('id', tx.id);
    if (error) throw new Error(error.message);
    await load();
  }

  async function handleRegenerateShareToken() {
    if (!ledger) return;
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('ledgers').update({ share_token: newToken }).eq('id', ledger.id);
    if (error) throw new Error(error.message);
    await load();
  }

  async function handleRenameLedger(newName: string) {
    if (!ledger) return;
    const { error } = await supabase
      .from('ledgers')
      .update({ counterparty_name: newName })
      .eq('id', ledger.id);
    if (error) throw new Error(error.message);
    await load();
  }

  async function handleDeleteTransaction(tx: Transaction) {
    if (tx.proof_path) await removeProofFile(tx.proof_path);
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
    if (error) throw new Error(error.message);
    await load();
  }

  async function handleSetProof(tx: Transaction, file: File) {
    if (!ledger) return;
    setActionError(null);
    const validationError = validateProofFile(file);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    try {
      const path = await uploadProof(ledger.share_token, tx.id, file);
      const { error } = await supabase
        .from('transactions')
        .update({ proof_path: path, proof_name: file.name })
        .eq('id', tx.id);
      if (error) throw new Error(error.message);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de l'envoi du fichier.");
    }
  }

  async function handleRemoveProof(tx: Transaction) {
    setActionError(null);
    if (tx.proof_path) await removeProofFile(tx.proof_path);
    const { error } = await supabase
      .from('transactions')
      .update({ proof_path: null, proof_name: null })
      .eq('id', tx.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    await load();
  }

  function handleExportCsv() {
    if (!ledger) return;
    const label = ledger.is_private ? 'notes' : ledger.counterparty_name;
    exportTransactionsToCsv(transactions, {
      fileName: `entrenous-${label}.csv`,
      currency: ledger.currency,
      ownerLabel: ledger.owner_display_name || profile?.display_name || 'Vous',
      counterpartyLabel: ledger.counterparty_name,
    });
  }

  async function handleDeleteLedger() {
    if (!ledger) return;
    const label = ledger.is_private ? 'cette note privée' : `le compte "${ledger.counterparty_name}"`;
    if (!window.confirm(`Supprimer définitivement ${label} et toutes ses transactions ?`)) return;
    const { error } = await supabase.from('ledgers').delete().eq('id', ledger.id);
    if (error) {
      setError(error.message);
      return;
    }
    navigate('/');
  }

  if (loading) {
    return (
      <div className="min-h-svh">
        <Header />
        <p className="py-12 text-center text-sm text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (error || !ledger) {
    return (
      <div className="min-h-svh">
        <Header />
        <p className="py-12 text-center text-sm text-debt">{error ?? 'Compte introuvable.'}</p>
      </div>
    );
  }

  // Un ledger peut désormais être vu par deux comptes réels : son
  // propriétaire, ou le counterparty qui a associé son compte depuis le lien
  // de partage (voir GuestLedgerPage). Tout le calcul de solde/labels doit
  // s'adapter au point de vue du viewer courant.
  const isCounterparty = ledger.owner_id !== user?.id && ledger.counterparty_id === user?.id;
  const viewerRole: 'owner' | 'counterparty' = isCounterparty ? 'counterparty' : 'owner';
  const { confirmedBalance, pendingBalance } = isCounterparty
    ? computeGuestBalance(transactions)
    : computeOwnerBalance(transactions);
  const ownerHistory = computeBalanceHistory(transactions);
  const history = isCounterparty
    ? ownerHistory.map((point) => ({ ...point, balance: -point.balance }))
    : ownerHistory;
  // ownerLabel/counterpartyLabel reflètent toujours les vrais noms stockés
  // sur le ledger, indépendamment de qui regarde.
  const ownerLabel = ledger.owner_display_name || profile?.display_name || 'Vous';

  return (
    <div className="min-h-svh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="mb-4 inline-block text-sm text-gray-500 hover:text-ink">
          ← Retour au tableau de bord
        </Link>

        <Card className="mb-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            {isCounterparty ? (
              <h1 className="text-lg font-bold text-ink">{ledger.owner_display_name}</h1>
            ) : (
              <EditableLedgerName name={ledger.counterparty_name} onSave={handleRenameLedger} />
            )}
            {!isCounterparty && (
              <div className="flex flex-wrap items-center gap-2">
                {!ledger.is_private && (
                  <ShareLinkButton shareToken={ledger.share_token} onRegenerate={handleRegenerateShareToken} />
                )}
                <button
                  type="button"
                  onClick={handleDeleteLedger}
                  className="text-xs font-medium text-gray-500 hover:text-debt"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
          <BalanceDisplay
            confirmedBalance={confirmedBalance}
            pendingBalance={pendingBalance}
            currency={ledger.currency}
            theyOweYouLabel={
              isCounterparty
                ? `${ledger.owner_display_name} vous doit`
                : ledger.is_private
                  ? 'On vous doit'
                  : `${ledger.counterparty_name} vous doit`
            }
            youOweThemLabel={
              isCounterparty
                ? `Vous devez à ${ledger.owner_display_name}`
                : ledger.is_private
                  ? 'Vous devez'
                  : `Vous devez à ${ledger.counterparty_name}`
            }
          />
        </Card>

        {!ledger.is_private && (
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Évolution du solde</h2>
            <BalanceChart data={history} currency={ledger.currency} />
          </Card>
        )}

        <Card className="mb-4" ref={formRef}>
          {showForm ? (
            <TransactionForm
              currency={ledger.currency}
              actor={viewerRole}
              ownerLabel={ownerLabel}
              counterpartyLabel={ledger.counterparty_name}
              isPrivate={ledger.is_private}
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
            viewer={viewerRole}
            ownerLabel={ownerLabel}
            counterpartyLabel={ledger.counterparty_name}
            isPrivate={ledger.is_private}
            onConfirm={handleConfirm}
            onDispute={handleDispute}
            readOnly={ledger.is_private}
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
