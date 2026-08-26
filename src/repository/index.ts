// Single swap point (Phase 3A Part I/Part C; real binding added Phase 3B §19). state/store.ts
// imports `repository` (and `today`) from here, never from mockRepository.ts or apiRepository.ts
// directly — this file is the only place the MOCK vs REAL decision is made.
//
// Controlled by VITE_REPOSITORY: 'mock' selects the in-memory dev/test fallback (never deleted —
// still used by the frontend's own vitest suite and available for offline/demo use); anything
// else (including unset) defaults to the real API-backed repository, since that is what a real
// deployment of this app is for.

import type { RepositoryContract } from './contract';
import { mockRepository } from './mockRepository';
import { apiRepository } from './apiRepository';
import { TODAY } from '@/config';

const useMock = import.meta.env.VITE_REPOSITORY === 'mock';

export const repository: RepositoryContract = useMock ? mockRepository : apiRepository;

// The mock's seed data is anchored to a fixed historical date (see config.ts); the real backend
// always stamps orders with the actual current date (Phase 3B §21 — server-authoritative
// sellingDate). Dashboard's "today" KPIs must agree with whichever policy is actually in effect,
// or they read empty against the real backend while orders genuinely exist for today.
export const today = (): string => (useMock ? TODAY : new Date().toISOString().slice(0, 10));

export type { RepositoryContract };
