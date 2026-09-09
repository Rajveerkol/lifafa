import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ShieldCheck,
  Filter,
  Plus,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { HeroWalletCard } from '../components/wallet/HeroWalletCard';
import { useAuth } from '../context/AuthContext';
import { walletService } from '../services/walletService';
import type { WalletTransaction, Withdrawal, TransactionType } from '../types/database';
import { formatCurrency, formatDate, maskBankAccount, maskUPI } from '../lib/utils';

interface WalletPageProps {
  onOpenWithdraw: () => void;
  onOpenAddMoney: () => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({ onOpenWithdraw, onOpenAddMoney }) => {
  const { user, wallet } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activeTab, setActiveTab] = useState<'transactions' | 'withdrawals'>('transactions');
  const [txFilter, setTxFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        walletService.getTransactions(user.id),
        walletService.getWithdrawals(user.id),
      ])
        .then(([txList, wList]) => {
          setTransactions(txList);
          setWithdrawals(wList);
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  const availableBalance = wallet?.available_balance ?? 0;
  const reservedBalance = wallet?.reserved_balance ?? 0;
  const totalEarned = wallet?.total_earned ?? 0;
  const totalWithdrawn = wallet?.total_withdrawn ?? 0;

  const filteredTransactions = transactions.filter((t) => {
    if (txFilter === 'ALL') return true;
    return t.type === txFilter;
  });

  const getTxTypeBadge = (type: TransactionType) => {
    switch (type) {
      case 'CLAIM':
      case 'CREDIT':
        return <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Credit</span>;
      case 'DEBIT':
      case 'WITHDRAWAL':
        return <span className="bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Debit</span>;
      case 'RESERVE':
        return <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Reserved</span>;
      case 'RELEASE':
      case 'REFUND':
      case 'WITHDRAWAL_REVERSAL':
        return <span className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Refund</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-10 max-w-4xl mx-auto">
      {/* 1. Hero Wallet Card */}
      <HeroWalletCard
        onAddMoneyClick={onOpenAddMoney}
        onWithdrawClick={onOpenWithdraw}
      />

      {/* 2. Wallet Financial Stats 4-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            Available Balance
          </span>
          <span className="text-lg font-black text-blue-700 mt-1 block">
            {formatCurrency(availableBalance)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            Reserved in Lifafas
          </span>
          <span className="text-lg font-black text-amber-600 mt-1 block">
            {formatCurrency(reservedBalance)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            Total Earned
          </span>
          <span className="text-lg font-black text-emerald-600 mt-1 block">
            {formatCurrency(totalEarned)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            Total Withdrawn
          </span>
          <span className="text-lg font-black text-slate-800 mt-1 block">
            {formatCurrency(totalWithdrawn)}
          </span>
        </div>
      </div>

      {/* 3. Transaction & Withdrawal History Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
        {/* Toggle between Ledger and Withdrawals */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'transactions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ledger Transactions ({transactions.length})
            </button>

            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'withdrawals'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Withdrawals ({withdrawals.length})
            </button>
          </div>

          {activeTab === 'transactions' && (
            <div className="flex items-center gap-1 overflow-x-auto">
              {(['ALL', 'CLAIM', 'RESERVE', 'WITHDRAWAL', 'REFUND'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTxFilter(filter)}
                  className={`py-1 px-2.5 rounded-lg text-[10px] font-extrabold uppercase transition-colors ${
                    txFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading ledger data...</div>
        ) : activeTab === 'transactions' ? (
          filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No transactions found in your ledger.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const isPositive = ['CLAIM', 'CREDIT', 'REFUND', 'RELEASE', 'WITHDRAWAL_REVERSAL'].includes(tx.type);
                return (
                  <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                          isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                            {tx.reference_type.replace(/_/g, ' ')}
                          </h5>
                          {getTxTypeBadge(tx.type)}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{formatDate(tx.created_at)}</span>
                          <span>•</span>
                          <span>
                            Bal: {formatCurrency(tx.balance_after)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm sm:text-base font-black ${
                          isPositive ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isPositive ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </span>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Withdrawals History List */
          withdrawals.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No withdrawal requests recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {withdrawals.map((w) => (
                <div key={w.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                        {w.account_holder_name}
                      </h5>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          w.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : w.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {w.bank_account_number_masked}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Requested on {formatDate(w.created_at)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-sm sm:text-base font-black text-slate-900">
                      {formatCurrency(w.net_amount)}
                    </span>
                    {w.fee_amount > 0 && (
                      <span className="block text-[10px] text-slate-400">
                        Fee: {formatCurrency(w.fee_amount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
