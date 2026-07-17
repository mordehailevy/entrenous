import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/useAuth';
import type { Currency, Ledger, Transaction } from '../types';
import { computeGuestBalance, computeOwnerBalance } from '../utils/balance';
import { formatAmount } from '../utils/format';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { NewLedgerModal } from '../components/NewLedgerModal';

interface LedgerWithBalance extends Ledger {
  confirmedBalance: number;
  pendingBalance: number;
  // true si l'utilisateur courant est le counterparty (compte associé depuis
  // un lien de partage) plutôt que le propriétaire de ce ledger.
  viewerIsCounterparty: boolean;
}

export function DashboardPage() {
  const { user, profile } = useAuth();
  const [ledgers, setLedgers] = useState<LedgerWithBalance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadLedgers = useCallback(async () => {
    setLoading(true);
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('ledgers')
      .select('*')
      .order('created_at', { ascending: false });

    if (ledgerError || !ledgerRows) {
      setError(ledgerError?.message ?? 'Erreur de chargement.');
      setLoading(false);
      return;
    }

    const rows = ledgerRows as Ledger[];
    const txByLedger = new Map<string, Transaction[]>();
    if (rows.length > 0) {
      const { data: txRows } = await supabase
        .from('transactions')
        .select('*')
        .in(
          'ledger_id',
          rows.map((l) => l.id),
        );
      for (const tx of (txRows as Transaction[]) ?? []) {
        const list = txByLedger.get(tx.ledger_id) ?? [];
        list.push(tx);
        txByLedger.set(tx.ledger_id, list);
      }
    }

    const withBalances = rows.map((ledger) => {
      const viewerIsCounterparty = ledger.owner_id !== user?.id && ledger.counterparty_id === user?.id;
      const balance = viewerIsCounterparty
        ? computeGuestBalance(txByLedger.get(ledger.id) ?? [])
        : computeOwnerBalance(txByLedger.get(ledger.id) ?? []);
      return {
        ...ledger,
        confirmedBalance: balance.confirmedBalance,
        pendingBalance: balance.pendingBalance,
        viewerIsCounterparty,
      };
    });

    setLedgers(withBalances);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) loadLedgers();
  }, [user, loadLedgers]);

  async function handleCreateLedger(values: {
    counterpartyName: string;
    currency: 'ILS' | 'EUR';
    isPrivate: boolean;
  }) {
    if (!user || !profile) return;
    const { error } = await supabase.from('ledgers').insert({
      owner_id: user.id,
      owner_display_name: profile.display_name,
      counterparty_name: values.counterpartyName,
      currency: values.currency,
      is_private: values.isPrivate,
    });
    if (error) throw new Error(error.message);
    await loadLedgers();
  }

  const allLedgers = ledgers ?? [];
  const sharedLedgers = allLedgers.filter((l) => !l.is_private);
  const privateLedgers = allLedgers.filter((l) => l.is_private);

  // Recherche par nom (personne ou catégorie), insensible à la casse/aux accents.
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchesSearch = (ledger: LedgerWithBalance) =>
    ledgerLabel(ledger).toLocaleLowerCase().includes(normalizedSearch);
  const filteredSharedLedgers = normalizedSearch ? sharedLedgers.filter(matchesSearch) : sharedLedgers;
  const filteredPrivateLedgers = normalizedSearch ? privateLedgers.filter(matchesSearch) : privateLedgers;

  // Les soldes sont totalisés par devise plutôt que sommés en un seul nombre,
  // car additionner des ILS et des EUR bruts n'a pas de sens arithmétique.
  const totalsByCurrency = new Map<Currency, { owed: number; owing: number }>();
  for (const ledger of sharedLedgers) {
    const entry = totalsByCurrency.get(ledger.currency) ?? { owed: 0, owing: 0 };
    if (ledger.confirmedBalance > 0) entry.owed += ledger.confirmedBalance;
    else if (ledger.confirmedBalance < 0) entry.owing += Math.abs(ledger.confirmedBalance);
    totalsByCurrency.set(ledger.currency, entry);
  }
  const currencyTotals = [...totalsByCurrency.entries()];

  return (
    <div className="min-h-svh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Card className="!p-4">
            <p className="text-xs text-gray-500">On me doit</p>
            {currencyTotals.length === 0 ? (
              <p className="text-xl font-bold text-credit">{formatAmount(0, 'ILS')}</p>
            ) : (
              currencyTotals.map(([currency, totals]) => (
                <p key={currency} className="text-xl font-bold text-credit">
                  {formatAmount(totals.owed, currency)}
                </p>
              ))
            )}
          </Card>
          <Card className="!p-4">
            <p className="text-xs text-gray-500">Je dois</p>
            {currencyTotals.length === 0 ? (
              <p className="text-xl font-bold text-debt">{formatAmount(0, 'ILS')}</p>
            ) : (
              currencyTotals.map(([currency, totals]) => (
                <p key={currency} className="text-xl font-bold text-debt">
                  {formatAmount(totals.owing, currency)}
                </p>
              ))
            )}
          </Card>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Mes comptes</h2>
          <Button onClick={() => setShowModal(true)}>+ Nouveau compte</Button>
        </div>

        {allLedgers.length > 1 && (
          <div className="mb-4">
            <Input
              type="search"
              placeholder="🔍 Rechercher une personne..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {error && <p className="mb-4 text-sm text-debt">{error}</p>}

        {loading ? (
          <p className="py-12 text-center text-sm text-gray-400">Chargement...</p>
        ) : (
          <div className="space-y-3">
            {filteredSharedLedgers.map((ledger) => (
              <LedgerRow key={ledger.id} ledger={ledger} />
            ))}
            {sharedLedgers.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                Aucun compte partagé pour l'instant. Créez-en un pour commencer.
              </p>
            )}
            {sharedLedgers.length > 0 && filteredSharedLedgers.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">Aucun compte ne correspond à cette recherche.</p>
            )}
          </div>
        )}

        {privateLedgers.length > 0 && filteredPrivateLedgers.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-ink">Mes notes privées</h2>
            <div className="space-y-3">
              {filteredPrivateLedgers.map((ledger) => (
                <LedgerRow key={ledger.id} ledger={ledger} />
              ))}
            </div>
          </div>
        )}
      </main>

      {showModal && <NewLedgerModal onClose={() => setShowModal(false)} onCreate={handleCreateLedger} />}
    </div>
  );
}

function ledgerLabel(ledger: LedgerWithBalance): string {
  return ledger.viewerIsCounterparty ? ledger.owner_display_name : ledger.counterparty_name;
}

function LedgerRow({ ledger }: { ledger: LedgerWithBalance }) {
  const isCredit = ledger.confirmedBalance >= 0;
  const label = ledgerLabel(ledger);
  return (
    <Link to={`/comptes/${ledger.id}`} className="block">
      <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
        <div>
          <p className="font-semibold text-ink">{label}</p>
          {ledger.pendingBalance !== 0 && (
            <span className="mt-1 inline-block rounded-full bg-pending-bg px-2 py-0.5 text-xs font-medium text-pending">
              {formatAmount(ledger.pendingBalance, ledger.currency)} en attente
            </span>
          )}
        </div>
        <p className={`text-lg font-bold ${ledger.confirmedBalance === 0 ? 'text-ink' : isCredit ? 'text-credit' : 'text-debt'}`}>
          {formatAmount(ledger.confirmedBalance, ledger.currency)}
        </p>
      </Card>
    </Link>
  );
}
