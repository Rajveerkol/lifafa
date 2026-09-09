import React from 'react';
import { X, Info, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/utils';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToAdmin?: () => void;
  onGoToExplore?: () => void;
}

export const AddMoneyModal: React.FC<AddMoneyModalProps> = ({
  isOpen,
  onClose,
  onGoToAdmin,
  onGoToExplore,
}) => {
  const { wallet, isAdmin } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
          <Info className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-1">Add Money Notice</h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          Online UPI/Card wallet recharge is currently managed through admin allocations and rewards.
        </p>

        <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100 text-left space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Current Available:</span>
            <span className="font-bold text-slate-900">{formatCurrency(wallet?.available_balance ?? 0)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Reserved in Lifafas:</span>
            <span className="font-bold text-amber-600">{formatCurrency(wallet?.reserved_balance ?? 0)}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {isAdmin && onGoToAdmin && (
            <button
              onClick={() => {
                onClose();
                onGoToAdmin();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl shadow-md text-xs flex items-center justify-center gap-2"
            >
              <span>Admin: Adjust Wallet Balance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {onGoToExplore && (
            <button
              onClick={() => {
                onClose();
                onGoToExplore();
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <span>Earn Money by Claiming Lifafas</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full text-slate-400 hover:text-slate-600 text-xs font-semibold py-1.5"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
