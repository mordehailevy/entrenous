import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Direction, Ledger, Transaction, TransactionKind } from '../types';
import { computeGuestBalance } from '../utils/balance';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionList } from '../components/TransactionList';

const GUEST_NAME_KEY_PREFIX = 'entrenous_guest_name:';

export function GuestLedgerPage() {
  const { token } = useParams<{ token: string }>();
  const guestNameKey = `${GUEST_NAME_KEY_PREFIX}${token}`;
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(() => localStorage.getItem(guestNameKey));
  const [nameInput, setNameInput] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

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

  function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
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
    const { error } = await supabase.rpc('guest_add_transaction', {
      p_token: token,
      p_amount: values.amount,
      p_direction: values.direction,
      p_kind: values.kind,
      p_note: values.note || null,
    });
    if (error) throw new Error(error.message);
    setShowForm(false);
    await load();
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
    await load();
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
    const { error } = await supabase.rpc('guest_delete_transaction', { p_token: token, p_tx_id: tx.id });
    if (error) throw new Error(error.message);
    await load();
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

  if (!guestName) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="gradient-text mb-1 text-center text-2xl font-extrabold">EntreNous</h1>
          <p className="mb-1 text-center text-sm text-gray-500">
            Compte entre vous et {ledger.owner_display_name}
          </p>
          <p className="mb-6 text-center text-sm text-gray-500">
            {ledger.owner_display_name} utilise EntreNous pour suivre vos comptes ensemble (dettes,
            virements). Indiquez votre prénom pour voir le solde et l'historique — aucune inscription
            n'est nécessaire.
          </p>
          <Card>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <Label htmlFor="guestName">Votre prénom</Label>
                <Input
                  id="guestName"
                  required
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Continuer
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  const { confirmedBalance, pendingBalance } = computeGuestBalance(transactions);

  return (
    <div className="min-h-svh">
      <header className="border-b border-gray-100 px-4 py-4 text-center">
        <h1 className="gradient-text text-xl font-extrabold">EntreNous</h1>
        <p className="text-sm text-gray-500">Compte entre vous et {ledger.owner_display_name}</p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="mb-4 border-2 border-dashed border-[--color-accent-start]/30">
          <p className="text-sm text-ink">
            👋 Créez votre compte gratuit pour gérer vos propres dettes et envoyer vos liens.
          </p>
          <Link to="/inscription">
            <Button variant="secondary" className="mt-3">
              Créer mon compte
            </Button>
          </Link>
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
          <h2 className="mb-2 text-sm font-semibold text-ink">Historique</h2>
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
          />
        </Card>
      </main>
    </div>
  );
}
