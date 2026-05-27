import { create } from 'zustand';
import type { SessionMe } from '../types.js';

type SessionState = {
  me: SessionMe | null;
  setMe: (me: SessionMe | null) => void;
};
export const useSession = create<SessionState>(set => ({
  me: null,
  setMe: me => set({ me }),
}));
