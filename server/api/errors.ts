// Consistent JSON error envelope (Phase 3B §15): { error: { code, message, details } }.
// Codes match the task's required list exactly so the frontend can branch on `code` while
// showing a Thai `message` to the user.

import type { Response } from 'express';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_RECIPE'
  | 'INVALID_QUANTITY'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ALREADY_VOIDED'
  | 'INVALID_STATUS'
  | 'STANDARD_COST_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'USERNAME_TAKEN';

export function sendError(res: Response, status: number, code: ErrorCode, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, details } });
}
