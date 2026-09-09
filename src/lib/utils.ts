import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function maskBankAccount(acc: string | null | undefined): string {
  if (!acc) return 'N/A';
  const clean = acc.trim();
  if (clean.length <= 4) return clean;
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

export function maskUPI(upi: string | null | undefined): string {
  if (!upi) return 'N/A';
  const parts = upi.split('@');
  if (parts.length === 2 && parts[0].length > 2) {
    return `${parts[0].slice(0, 2)}***@${parts[1]}`;
  }
  return upi;
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTimeRemaining(expiresAt: string | null | undefined): {
  isExpired: boolean;
  formatted: string;
} {
  if (!expiresAt) return { isExpired: true, formatted: 'Expired' };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { isExpired: true, formatted: 'Expired' };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { isExpired: false, formatted: `${days}d ${hours % 24}h left` };
  }
  if (hours > 0) {
    return { isExpired: false, formatted: `${hours}h ${minutes}m left` };
  }
  return { isExpired: false, formatted: `${minutes}m ${seconds}s left` };
}
