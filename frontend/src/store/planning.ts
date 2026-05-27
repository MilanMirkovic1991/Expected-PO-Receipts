import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Mode = 'range' | 'nextDays';

type State = {
  mode: Mode;
  dateFrom: string;
  dateTo: string;
  nextDays: number;
  selected: Set<number>;
  assignedUsername: string;
  setMode: (m: Mode) => void;
  setDateFrom: (s: string) => void;
  setDateTo: (s: string) => void;
  setNextDays: (n: number) => void;
  toggle: (id: number) => void;
  isSelected: (id: number) => boolean;
  selectAll: (ids: number[]) => void;
  deselectAll: (ids: number[]) => void;
  setAssignedUsername: (u: string) => void;
  reset: () => void;
};

function today(): string { const d = new Date(); return d.toISOString().slice(0, 10); }
function plusDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const usePlanning = create<State>()(
  persist((set, get) => ({
    mode: 'range', dateFrom: today(), dateTo: plusDays(today(), 14), nextDays: 14,
    selected: new Set(), assignedUsername: '',
    setMode: m => set({ mode: m }),
    setDateFrom: s => set({ dateFrom: s }),
    setDateTo: s => set({ dateTo: s }),
    setNextDays: n => set({ nextDays: n, dateTo: plusDays(get().dateFrom, n) }),
    toggle: id => { const s = new Set(get().selected); s.has(id) ? s.delete(id) : s.add(id); set({ selected: s }); },
    isSelected: id => get().selected.has(id),
    selectAll: ids => { const s = new Set(get().selected); ids.forEach(i => s.add(i)); set({ selected: s }); },
    deselectAll: ids => { const s = new Set(get().selected); ids.forEach(i => s.delete(i)); set({ selected: s }); },
    setAssignedUsername: u => set({ assignedUsername: u }),
    reset: () => set({ selected: new Set(), assignedUsername: '' }),
  }), {
    name: 'epr-planning',
    partialize: (s) => ({ mode: s.mode, dateFrom: s.dateFrom, dateTo: s.dateTo, nextDays: s.nextDays }),
  }),
);
