# API Contract (Phase 3A, Part D — implemented Phase 3B)

The server is `server/index.ts` (Express), running on `PORT` (default 3001), proxied by Vite's
dev server at `/api` (see `vite.config.ts`). Every endpoint below is implemented and maps 1:1 to
a `RepositoryContract` method (`src/repository/contract.ts`) called by `server/api/router.ts` via
`server/repository/prismaRepository.ts` — see that file's header comment for the persistence
recipe. No hard-delete endpoint exists anywhere in this contract — every mutable entity uses
soft-delete/void/active-toggle per the specification (BUSINESS_RULES.md §17, DATABASE.md §19).

`RepositoryContract` is async (`Promise<T>` throughout) as of Phase 3B — both `mockRepository.ts`
(wrapped in `Promise.resolve`, unchanged internal behavior) and the real `apiRepository.ts`
(fetch-based, this contract) implement it identically from the frontend's perspective.

## Authentication

Every route below requires a valid session except `/api/health` and `/api/auth/*` themselves.
Session = an HTTP-only, `SameSite=Lax` cookie (`khaokai_session`) issued on login, checked against
the `Session` table server-side on every request (`server/auth/session.ts`) — never trusted as a
frontend-only flag. Passwords are hashed with Node's built-in `crypto.scrypt` (`server/auth/password.ts`),
never stored or compared in plaintext.

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` | Sets the session cookie. 401 on failure. |
| POST | `/api/auth/logout` | — | Destroys the session server-side and clears the cookie. |
| GET | `/api/auth/me` | — | `{ username }` if authenticated, else 401. Deliberately does not return `setupComplete` — see below. |

## Error format

Every failure responds with:
```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "สต๊อกไม่เพียงพอ", "details": { "shortages": [...] } } }
```
`code` is one of: `VALIDATION_ERROR`, `INSUFFICIENT_STOCK`, `INVALID_RECIPE`, `INVALID_QUANTITY`,
`ORDER_NOT_FOUND`, `ORDER_ALREADY_VOIDED`, `INVALID_STATUS`, `STANDARD_COST_UNAVAILABLE`,
`NOT_FOUND`, `UNAUTHENTICATED` (`server/api/errors.ts`). `details` carries the domain-layer
`errors`/`shortages` array where applicable so the frontend's existing `CatalogResult`/`OrderResult`
error handling needs no new logic — `apiRepository.ts` maps this envelope straight back into those
shapes.

## Snapshot (single read endpoint)

| Method | Endpoint | Contract method |
|---|---|---|
| GET | `/api/snapshot` | `getSnapshot()` |

This replaces the Phase 3A draft's per-entity `GET /api/ingredients` / `GET /api/menus` / etc. rows:
`RepositoryContract` itself only ever exposed one read method, `getSnapshot()` — the mock never had
per-entity getters either — so a real per-entity GET would be an endpoint nothing calls (Phase 3B
§5: "no unnecessary endpoints"). `state/store.ts` calls this once after every mutation, exactly as
it called the mock's synchronous `getSnapshot()` before.

## Ingredients

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/ingredients` | `createIngredient(input: IngredientInput)` |
| PUT | `/api/ingredients/:id` | `updateIngredient(id, input: IngredientInput)` |
| PATCH | `/api/ingredients/:id/active` | `setIngredientActive(id, active: boolean)` |

Server re-runs `validateIngredientInput` (`domain/catalog.ts`) — including the `standard_cost`
positive-finite-number rule — the same function the mock uses; never trusts client-side validation.

## Menus

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/menus` | `createMenu(input: CatalogItemInput)` |
| PUT | `/api/menus/:id` | `updateMenu(id, input: CatalogItemInput)` |
| PATCH | `/api/menus/:id/active` | `setMenuActive(id, active: boolean)` |

## Add-ons

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/add-ons` | `createAddOn(input: CatalogItemInput)` |
| PUT | `/api/add-ons/:id` | `updateAddOn(id, input: CatalogItemInput)` |
| PATCH | `/api/add-ons/:id/active` | `setAddOnActive(id, active: boolean)` |

## Purchases

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/purchases` | `createPurchase(input: PurchaseInput)` |

No edit/void — purchase price history is an immutable ledger (BUSINESS_RULES.md §5). For a
`standard_cost` ingredient, the same transaction also writes a `stock_movements` row
(`sourceType: 'standard_cost'`, `movementType: 'purchase'`, positive delta).

## Processing

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/processing` | `createProcessing(input: ProcessingInput, nowIso)` |
| POST | `/api/processing/:id/void` | `voidProcessing(batchId)` |

Atomically: decrements the source purchase batch, inserts the processing batch row, inserts one
processing-output row per portion-size group, and (if `wasteQuantity > 0`) a waste record.

`void` is the only correction path — there is no edit endpoint (`domain/processingEngine.ts`).
It is hard-blocked (`409 INVALID_STATUS`) unless every output this batch produced is still fully
untouched (`remainingQuantity === quantity` — nothing consumed by an order, no waste recorded
against an output since); the batch itself must also still be `active`. On success: the source
purchase batch's `remainingQuantity` is restored by `inputQuantity`, every output row is set to
`status: 'void'`/`remainingQuantity: 0` (kept for audit, not deleted), the processing batch's own
`status` flips to `void`, and the `WasteRecord` created at processing time (if any) is hard-deleted
— the one exception to "no hard delete" in this contract, since that waste never happened once the
batch is voided and `WasteRecord` has no status field to soft-void it with. Serialized through the
same `orderMutex` as order mutations, since it touches `ProcessingOutput.remainingQuantity`.
`404 NOT_FOUND` if the batch doesn't exist (or belongs to another store).

## Waste

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/waste` | `recordWaste(input: WasteInput, nowIso)` |

For the `standard_cost` case, `sourceBatchId` is omitted and quantity is validated against the
movement-derived available quantity (`STANDARD_COST_UNAVAILABLE` on failure), then a compensating
negative `stock_movements` row is written.

## Orders

| Method | Endpoint | Contract method |
|---|---|---|
| POST | `/api/orders` | `createOrder(sellingDate, draft: OrderDraft)` |
| PUT | `/api/orders/:id` | `editOrder(orderId, draft: OrderDraft)` |
| POST | `/api/orders/:id/void` | `voidOrder(orderId)` |

The three highest-stakes endpoints. Each runs inside one Prisma transaction wrapping: aggregate
required quantities → hard stock check (including `standard_cost`, CALCULATION_ENGINE.md §17) →
allocate (FIFO rows + `standard_cost` movements) → write order/items/allocations/movements, with
no partial write on any failure (`server/repository/prismaRepository.ts`). Concurrent order
mutations are additionally serialized by an in-process mutex (`server/repository/mutex.ts`) — SQLite
has no per-row locking, so that mutex, not DB isolation, is what prevents two simultaneous orders
from both passing the stock check.

**`sellingDate` is always the server's real current date** — the client's value is accepted for
contract-shape compatibility with the mock (which has no server clock of its own) but is ignored;
never trusted, since it drives order-number sequencing and Dashboard "today" aggregates (Phase 3B
security decision). `PUT`/`POST .../void` first check the order's existence/status server-side to
return the specific `ORDER_NOT_FOUND` / `ORDER_ALREADY_VOIDED` codes — `editOrder`/`voidOrder`'s
own domain-layer result doesn't distinguish those two cases, so the route does before calling in.

## Settings / Setup

| Method | Endpoint | Contract method |
|---|---|---|
| PUT | `/api/settings/store-name` | `updateStoreName(name: string)` |
| POST | `/api/setup/complete` | — (sets `Store.name` + `Store.setupComplete = true`) |

Currency is read-only in V1 (UI_SPEC.md §11b). `setupComplete` lives only on `Store` (returned via
`GET /api/snapshot`) — `/api/auth/me` deliberately does not duplicate it, so there is exactly one
source of truth for whether `App.tsx` shows the Setup Wizard.

## History / Dashboard

Both remain client-derived from `getSnapshot()` (`domain/history.ts`, `domain/aggregates.ts`) —
no dedicated endpoint, same reasoning as Phase 3A (V1 scale is small enough that a full-snapshot
fetch is cheap — DATABASE.md §24).
