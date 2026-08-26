// Minimal auth state (Phase 3B §13). The mock repository has no login concept — it stays
// usable for dev/test by short-circuiting straight to 'authenticated' with zero network calls,
// exactly like it never gained a Setup Wizard concept requiring persistence. Only the real API
// repository actually talks to /api/auth/*.

import { create } from 'zustand';

const useMock = import.meta.env.VITE_REPOSITORY === 'mock';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  username: string | null;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  username: null,
  error: null,

  checkSession: async () => {
    if (useMock) {
      set({ status: 'authenticated', username: null });
      return;
    }
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return set({ status: 'unauthenticated' });
      const body = await res.json();
      set({ status: 'authenticated', username: body.username });
    } catch {
      set({ status: 'unauthenticated' });
    }
  },

  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = body?.error?.message ?? 'เข้าสู่ระบบไม่สำเร็จ';
      set({ error });
      return { ok: false, error };
    }
    set({ status: 'authenticated', username: body.username, error: null });
    return { ok: true };
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    set({ status: 'unauthenticated', username: null });
  },
}));
