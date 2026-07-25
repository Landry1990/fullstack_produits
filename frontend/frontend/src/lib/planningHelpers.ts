import type { ComponentType } from 'react';
import {
  Sun, Moon, Shield, Coffee, Plane,
} from 'lucide-react';
import type { ShiftType, LeaveType } from '../services/planningService';

export const SHIFT_STYLES: Record<ShiftType, { bg: string; text: string; border: string; Icon: ComponentType<{ size?: number }>; labelKey: string; short: string }> = {
  MATIN: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', Icon: Sun, labelKey: 'shift_types.MORNING', short: 'M' },
  NUIT: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', Icon: Moon, labelKey: 'shift_types.NIGHT', short: 'N' },
  GARDE: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', Icon: Shield, labelKey: 'shift_types.GUARD', short: 'G' },
  REPOS: { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', Icon: Coffee, labelKey: 'shift_types.REST', short: 'R' },
  CONGE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', Icon: Plane, labelKey: 'shift_types.LEAVE', short: 'C' },
};

export const LEAVE_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

export const LEAVE_TYPES: LeaveType[] = ['CONGE', 'MALADIE', 'SANS_SOLDE', 'AUTRE'];

export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthName(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

export function getWeekdayShort(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

export function getWeekLabel(start: Date, end: Date, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString(locale, opts)} - ${end.toLocaleDateString(locale, opts)}`;
}
