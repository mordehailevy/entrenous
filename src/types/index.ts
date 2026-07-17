export type Currency = 'ILS' | 'EUR';

export type Direction = 'owner_to_counterparty' | 'counterparty_to_owner';

export type TransactionKind = 'virement' | 'dette' | 'remboursement' | 'ajustement';

export type CreatedBy = 'owner' | 'counterparty';

export type TransactionStatus = 'pending' | 'confirmed' | 'disputed';

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Ledger {
  id: string;
  owner_id: string;
  owner_display_name: string;
  counterparty_name: string;
  counterparty_id: string | null;
  share_token: string;
  currency: Currency;
  is_private: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  ledger_id: string;
  amount: number;
  direction: Direction;
  kind: TransactionKind;
  note: string | null;
  created_by: CreatedBy;
  status: TransactionStatus;
  dispute_comment: string | null;
  confirmed_at: string | null;
  created_at: string;
  proof_path: string | null;
  proof_name: string | null;
}

export interface BalanceSummary {
  confirmedBalance: number; // positive = owner is owed, negative = owner owes
  pendingBalance: number;
}
