import React, { useState, useEffect, useMemo } from 'react';
import {
  Gift,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { LifafaCard } from '../components/lifafa/LifafaCard';
import { useAuth } from '../context/AuthContext';
import { lifafaService } from '../services/lifafaService';
import type { Lifafa, LifafaClaim } from '../types/database';
import { formatCurrency, formatDate } from '../lib/utils';

interface LifafaDashboardPageProps {
  onCreateClick: () => void;
  onClaimClick: (lifafa: Lifafa) => void;
  onShareClick: (lifafa: Lifafa) => void;
}

type TabType = 'all' | 'active' | 'completed' | 'created' | 'claimed' | 'expired';

export const LifafaDashboardPage: React.FC<LifafaDashboardPageProps> = ({
  onCreateClick,
  onClaimClick,
  onShareClick,
}) => {
  const { user, refreshWallet } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lifafas, setLifafas] = useState<Lifafa[]>([]);
  const [myCreated, setMyCreated] = useState<Lifafa[]>([]);
  const [myClaimed, setMyClaimed] = useState<(LifafaClaim & { lifafa: Lifafa })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Authoritative user claims lookup map
  const myClaimedMap = useMemo(() => {
    const map = new Map<string, LifafaClaim>();
    for (const c of myClaimed) {
      if (c.lifafa_id) {
        map.set(c.lifafa_id, c);
      }
    }
    return map;
  }, [myClaimed]);

  const loadData = async () => {
    setLoading(true);
    try {
      const publicList = await lifafaService.getPublicLifafas();
      setLifafas(publicList);

      if (user) {
        const created = await lifafaService.getMyCreatedLifafas(user.id);
        setMyCreated(created);

        const claimed = await lifafaService.getMyClaimedLifafas(user.id);
        setMyClaimed(claimed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleRefundCancel = async (lifafaId: string) => {
    if (!confirm('Are you sure you want to cancel and refund remaining funds for this Lifafa?')) {
      return;
    }

    try {
      setActionLoading(lifafaId);
      await lifafaService.refundExpiredOrCancelled(lifafaId);
      await refreshWallet();
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Refund failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter items based on tab
  const getFilteredLifafas = (): Lifafa[] => {
    let list: Lifafa[] = [];

    if (currentTab === 'created') {
      list = myCreated;
    } else if (currentTab === 'claimed') {
      return []; // Rendered specially below
    } else if (currentTab === 'active') {
      list = lifafas.filter(
        (l) => l.status === 'ACTIVE' && new Date(l.expires_at) > new Date() && l.claimed_count < l.winner_count && l.remaining_amount > 0
      );
    } else if (currentTab === 'completed') {
      list = lifafas.filter(
        (l) => l.status === 'COMPLETED' || l.claimed_count >= l.winner_count || l.remaining_amount <= 0
      );
    } else if (currentTab === 'expired') {
      list = lifafas.filter((l) => l.status === 'EXPIRED' || new Date(l.expires_at) <= new Date());
    } else {
      list = lifafas;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q) ||
          (l.message && l.message.toLowerCase().includes(q))
      );
    }

    return list;
  };

  const filteredLifafas = getFilteredLifafas();

  return (
    <div className="space-y-6 pb-20 md:pb-10">
      {/* Top Action & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Gift className="w-6 h-6 text-blue-600" />
            <span>Lifafa Dashboard</span>
          </h2>
          <p className="text-xs text-slate-500">
            Explore community rewards, manage your created gifts, and track claims
          </p>
        </div>

        <button
          onClick={onCreateClick}
          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Lifafa</span>
        </button>
      </div>

      {/* Filter Tabs & Search Header */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {(['all', 'active', 'completed', 'created', 'claimed', 'expired'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${
                  currentTab === tab
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab === 'created' ? `My Created (${myCreated.length})` : tab === 'claimed' ? `My Claimed (${myClaimed.length})` : tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or code..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Content Feed */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Loading Lifafas...</span>
        </div>
      ) : currentTab === 'claimed' ? (
        myClaimed.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
              <Gift className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Claims Yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Explore public Lifafas from the dashboard and claim rewards to see them here!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-2xs">
            <div className="divide-y divide-slate-100">
              {myClaimed.map((c) => (
                <div key={c.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">
                        {c.lifafa?.title || 'Lifafa Reward'}
                      </h5>
                      <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mr-2">
                        {c.lifafa?.code}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(c.claimed_at)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-emerald-600">
                      +{formatCurrency(c.amount)}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                      Claimed & Credited
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : filteredLifafas.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
            <Gift className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Lifafas Found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            No matching records under this tab. Try selecting another filter or create your own!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLifafas.map((lifafa) => (
            <div key={lifafa.id} className="flex flex-col">
              <LifafaCard
                lifafa={lifafa}
                onClaimClick={onClaimClick}
                onShareClick={onShareClick}
                isCreator={user?.id === lifafa.creator_id}
                isClaimed={myClaimedMap.has(lifafa.id)}
                claimedAmount={myClaimedMap.get(lifafa.id)?.amount}
              />
              {user?.id === lifafa.creator_id && lifafa.remaining_amount > 0 && lifafa.status === 'ACTIVE' && (
                <button
                  onClick={() => handleRefundCancel(lifafa.id)}
                  disabled={actionLoading === lifafa.id}
                  className="mt-1 text-[11px] font-bold text-red-600 hover:text-red-700 py-1 text-center"
                >
                  {actionLoading === lifafa.id ? 'Refunding...' : 'Cancel Lifafa & Refund Remaining'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
