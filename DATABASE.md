# Database Specification

## 1. Goal
Define the V1 data model for a single-store Food Cost & Profit Mini ERP.

## 2. Core Entities
Recommended entities:

- users
- store
- ingredients
- ingredient_purchase_batches
- processing_batches
- processing_outputs
- waste_records
- menus
- menu_items
- add_ons
- orders
- order_items
- order_item_add_ons
- add_on_items
- stock_movements
- fifo_allocations
- audit/history records where needed

## 3. Users
Fields:
- id
- name
- email/username
- password/auth reference
- created_at
- updated_at

All authenticated users have Admin permissions in V1.

## 4. Store
Fields:
- id
- name
- currency
- created_at
- updated_at

V1 supports one store.

## 5. Ingredients
Fields:
- id
- name
- category
- base_unit
- tracking_type
- standard_cost (nullable — only used when tracking_type = standard_cost)
- low_stock_threshold (nullable, quantity in base_unit — alert fires when aggregate active remaining quantity falls below it; feature is off when null)
- active
- created_at
- updated_at

`tracking_type` enum:
- `raw_by_weight` — purchased and consumed by weight/quantity (e.g. Pork, Chicken as raw input).
- `processed_batch` — must go through Processing before it becomes consumable stock (e.g. Pork/Chicken once portioned).
- `whole_piece` — tracked as discrete pieces without weight-based portioning (e.g. Egg, with `base_unit = piece`; egg unit-cost per Calculation Engine §12 is ordinary FIFO/unit-cost arithmetic on this type, not a separate mode).
- `standard_cost` — not individually FIFO-tracked; uses the ingredient's user-entered `standard_cost` instead (e.g. Curry paste, Sauce, where the user opts out of batch-level tracking). It still has a finite available quantity (Business Rules §8a, Decision — Phase 2D): purchases increase it, order confirmation/edit/waste decrease it, void/rollback restore it, and insufficient stock still hard-blocks (Calculation Engine §17). This quantity is a single running total derived from the ingredient's `stock_movements` history (§16) — not a sum of purchase-batch `remaining_quantity` (§6) — since there is no lot structure to sum.

Examples:
- Pork
- Chicken
- Egg
- Rice
- Curry paste
- Vegetables
- Sauce

## 6. Purchase Batch
Fields:
- id
- ingredient_id
- purchase_date
- quantity
- unit
- total_cost
- unit_cost
- remaining_quantity
- status
- reference
- created_at
- updated_at

`status` enum: `active` (remaining_quantity > 0, FIFO-eligible) | `depleted` (remaining_quantity = 0) | `void` (the purchase itself was voided/corrected and must not be consumed).

Purchase history must never be overwritten simply because a new price is entered.

For a `standard_cost` ingredient (§5), a purchase batch row is still created (purchase price history is retained uniformly across tracking types), but `remaining_quantity`/`status` are not maintained: they stay at the originally purchased quantity and `active` respectively, are not FIFO-eligible (§17), and are not the source of that ingredient's live available quantity (§5, §16) — they exist for price-history display only.

## 7. Processing Batch
Fields:
- id
- source_batch_id
- ingredient_id
- processed_at
- input_quantity
- input_cost
- status
- created_at

`status` enum: `active` | `void` (the processing run was voided/corrected).

## 8. Processing Outputs
Fields:
- id
- processing_batch_id
- quantity
- unit
- output_type
- portion_size (display only, in the ingredient's base unit — e.g. 80)
- portion_count (display only — e.g. 8)
- remaining_quantity
- allocated_cost
- unit_cost
- created_at

`quantity` and `remaining_quantity` are stored in the ingredient's base unit (grams for weight-tracked ingredients) — this is the real FIFO-consumable amount. `portion_size` and `portion_count` are display/entry convenience only (so the UI can show "12 portions of 80 g remaining"); they do not create separate stock buckets. One row is created per portion-size group within a processing run — e.g. "80 g × 8" and "50 g × 4" from the same run are two separate rows sharing the same `unit_cost` (same source batch, input-gram basis) but tracked as distinct rows so portion counts remain queryable per size.

`output_type` is a display category only (`portion` | `piece` | `usable_stock`); actual consumption and FIFO always operate on `remaining_quantity` in the base unit, never on `output_type`.

The user defines the actual quantity each time.

## 9. Waste
Fields:
- id
- ingredient_id
- source_type (`purchase_batch` | `processing_output` | `standard_cost`)
- source_batch_id (nullable — not applicable when source_type = `standard_cost`, since that ingredient has no lot; `ingredient_id` alone identifies the source in that case)
- processing_batch_id nullable
- quantity
- unit
- unit_cost
- waste_value
- reason
- created_at

`standard_cost` was added to `source_type` (Decision — Phase 2D, Business Rules §8a): a `standard_cost` ingredient still has a trackable available quantity and can incur waste against it, but that quantity is not lot-based, so there is no `source_batch_id` to record. `unit_cost` for this case is the ingredient's configured `standard_cost`.

`ingredient_id` and `source_type` are required so waste recorded against a processing output (e.g. a spoiled portion) can be traced by ingredient without depending solely on the nullable `processing_batch_id`.

## 10. Menus
Fields:
- id
- name
- selling_price
- active
- created_at
- updated_at

## 11. Menu Items / Recipe Lines
Fields:
- id
- menu_id
- ingredient_id
- quantity
- created_at
- updated_at

(Phase 3B correction: this section previously listed a stray `ingredient_id or stock_source_id`
alternative plus an undefined `item_type` field — an inconsistency with §12a's clean single-field
pattern, never implemented anywhere and not a real design ambiguity. The actual model, unchanged
since Phase 2, has always used a single `ingredient_id`, identical in shape to `add_on_items`
below — confirmed via `src/domain/types.ts`'s `MenuItemRecipe`, `orderEngine.ts`, `mockRepository.ts`,
and `RecipeEditor.tsx`. `unit` is also removed here to match the implementation exactly — the
domain layer never carried a separate display unit for recipe lines, only `quantity` in the
ingredient's base unit.)

The quantity is recipe-specific and is expressed in the ingredient's base unit for consumption (e.g. grams for a weight-tracked ingredient); `unit` is retained for display only.
No global fixed portion should be assumed.

## 12. Add-ons
Fields:
- id
- name
- selling_price
- active
- created_at
- updated_at

Cost is not stored as a flat "cost configuration" value — it is computed from the add-on's recipe lines (§12a), the same mechanism used for menu cost, so COGS reflects actual ingredient consumption.

Examples:
- Extra pork
- Extra egg

## 12a. Add-on Items
Fields:
- id
- add_on_id
- ingredient_id
- quantity (ingredient's base unit)
- unit (display only)
- created_at
- updated_at

Mirrors `menu_items`. Example: add-on "Extra egg" → one `add_on_items` row: ingredient = Egg, quantity = 1 piece.

## 13. Orders
Fields:
- id
- order_number
- selling_date
- sold_at
- total_revenue
- total_cogs
- total_profit
- status
- created_at
- updated_at

`status` enum: `active` | `voided`. Deletion is soft-delete/void (see Business Rules §17): a voided order row is never physically removed and retains every original field for audit. All aggregate queries (dashboard totals, Revenue/COGS/Profit, active-order counts) must filter `status != voided`; this satisfies History §18's requirement to capture order deletion as a retained record and Referential Integrity §19's requirement not to silently orphan records, via a controlled reversal rather than a hard delete.

Order number is sequential per selling date.

## 14. Order Items
Fields:
- id
- order_id
- menu_id
- quantity
- unit_selling_price
- line_revenue
- line_cogs
- line_profit

## 15. Order Item Add-ons
Fields:
- id
- order_item_id
- add_on_id
- quantity
- unit_selling_price
- revenue
- cogs
- line_profit

## 16. Stock Movements
Every stock-affecting action should create a movement.

Types may include:
- purchase
- processing_input
- processing_output
- sale_consumption
- waste
- adjustment
- reversal

Fields:
- id
- ingredient/source reference
- source_type (`purchase_batch` | `processing_output` | `standard_cost`)
- batch reference (nullable — not applicable when source_type = `standard_cost`; the ingredient/source reference alone identifies it)
- quantity_delta
- unit
- value_delta
- movement_type
- reference_type
- reference_id
- created_at

`source_type` disambiguates which table `batch reference` points into, since a given ingredient's stock can live in `ingredient_purchase_batches`, `processing_outputs`, or — for `standard_cost` ingredients (Decision — Phase 2D, Business Rules §8a) — nowhere lot-shaped at all: the movement references the ingredient directly, and the ingredient's live available quantity is the sum of its `standard_cost` movements. Every purchase/order-confirmation/order-edit/void/waste action against a `standard_cost` ingredient must create one of these rows — it is the only record of that ingredient's quantity, since its purchase batches' `remaining_quantity` is not maintained (§6).

## 17. FIFO Allocations
Fields:
- id
- order_id/order_item reference
- source_type (`purchase_batch` | `processing_output`)
- source_batch_id
- quantity_consumed
- unit_cost
- allocated_cost
- created_at

`source_type` disambiguates which table `source_batch_id` points into (see §16). This provides traceability for COGS.

## 18. History
History should capture important changes and transactions.

At minimum:
- purchase
- processing
- waste
- order
- order edit
- order deletion
- stock adjustment

## 19. Referential Integrity
Do not silently orphan stock or financial records.

Deletion should either:
- perform a controlled reversal, or
- delete dependent V1 records in a consistent transaction.

## 20. Timestamps
Use created_at and updated_at consistently.
Transaction timestamps should be preserved.

## 21. Money
Use a numeric/decimal type suitable for financial precision.
Do not use floating-point values for persisted money if the database supports exact decimal types.

## 22. Quantity
Use sufficient precision for weights and volumes.
Do not restrict quantities to integers.

## 23. Indexing
Indexes should exist for:
- ingredient_id
- menu_id
- order date
- batch status
- batch created/purchase date
- stock movement reference
- FIFO allocation source batch

## 24. V1 Scale
Design should comfortably support:
- ≤ 50 menus
- hundreds of orders
- normal small-business inventory history

## 25. Persistence Mapping (Phase 3A)
Maps each entity already defined above (§5–§18) to a conceptual table/collection for a future
real backend. No new schema is introduced — this is a mapping of existing entities, per this
phase's constraint against inventing new structure. Database technology is intentionally
unspecified (Phase 2D/3A both leave it undecided — see `API_CONTRACT.md` header); the mapping
below is relational-shaped but is equally realizable as document collections with the same keys.

| Entity (§) | Table/collection | Key relationships |
|---|---|---|
| Ingredients (§5) | `ingredients` | referenced by id from every other entity below |
| Purchase Batch (§6) | `ingredient_purchase_batches` | `ingredient_id → ingredients.id` |
| Processing Batch (§7) | `processing_batches` | `source_batch_id → ingredient_purchase_batches.id`, `ingredient_id → ingredients.id` |
| Processing Outputs (§8) | `processing_outputs` | `processing_batch_id → processing_batches.id` |
| Waste (§9) | `waste_records` | `ingredient_id → ingredients.id`; `source_batch_id → ingredient_purchase_batches.id \| processing_outputs.id` (nullable when source_type = `standard_cost`); `processing_batch_id` nullable |
| Menus (§10) | `menus` | — |
| Menu Items (§11) | `menu_items` | `menu_id → menus.id`, `ingredient_id → ingredients.id` |
| Add-ons (§12) | `add_ons` | — |
| Add-on Items (§12a) | `add_on_items` | `add_on_id → add_ons.id`, `ingredient_id → ingredients.id` |
| Orders (§13) | `orders` | — |
| Order Items (§14) | `order_items` | `order_id → orders.id`, `menu_id → menus.id` (frozen reference — never re-reads live menu) |
| Order Item Add-ons (§15) | `order_item_add_ons` | `order_item_id → order_items.id`, `add_on_id → add_ons.id` |
| Stock Movements (§16) | `stock_movements` | `ingredient_id → ingredients.id`; `reference_id → orders.id \| ingredient_purchase_batches.id \| waste_records.id` per `reference_type` |
| FIFO Allocations (§17) | `fifo_allocations` | `order_id → orders.id`, `ingredient_id → ingredients.id`, `source_batch_id → ingredient_purchase_batches.id \| processing_outputs.id` |
| Settings/Store (§4) | `store` | single row in V1 (one store only, §1) |

`stock_movements` is still populated only for `standard_cost` ingredients' four paths (purchase/
order-consume/waste/reversal), same scope as Phase 3A — extending it to every FIFO-tracked
ingredient's movements remains a flagged future candidate, not required by any current business
rule.

**Transaction boundary** (Part G, implemented Phase 3B): `domain/orderEngine.ts`'s existing
pattern — validate, mutate an in-memory context, report success only once every write has
happened — is reused unchanged server-side (`server/repository/prismaRepository.ts`), not
reimplemented. `createOrder`/`editOrder`/`voidOrder` each run inside one Prisma transaction:
hydrate the same context shape from the DB → call the identical domain function → on success,
write the order/items/fifo_allocations rows, append new `stock_movements` rows, and update the
`remainingQuantity`/`status` of exactly the purchase-batch/processing-output rows the resulting
allocations touch. On failure, nothing is written. Concurrent order mutations are serialized by
an in-process mutex (`server/repository/mutex.ts`) ahead of the DB transaction, since SQLite has
no per-row locking to rely on for that.

## 26. Real Implementation (Phase 3B)

Database: SQLite via Prisma ORM (`server/prisma/schema.prisma`), chosen over PostgreSQL because
this environment has neither Postgres nor Docker installed and SQLite fully satisfies §24's V1
scale with zero added infrastructure — Prisma keeps a future Postgres migration a
provider/connection-string change, not a rewrite (explicit user decision).

Every entity in §25's mapping table is a real table now, with one storage-layer caveat: SQLite has
no native `enum` type, so Prisma does not support the `enum` keyword on this datasource — every
"enum" column (`tracking_type`, `status`, `source_type`, `movement_type`, etc.) is a plain `String`
column, validated by the same TypeScript union types and `validate*Input()` functions the mock
already relied on (never a DB-level constraint even in-memory). This changes nothing about how or
where those rules are enforced. §21's "exact decimal type" preference does not apply here either —
SQLite has none, and the existing implementation was already computing money as JS `number` values
rounded to 2 decimal places at every step (`round2()`), which SQLite's `REAL` (IEEE 754 double)
represents with the same precision, so this is not a behavior change from what the mock already did.

`createdAt`/`updatedAt` audit columns (§20) were added to every table at the Prisma layer — the
domain TS types never carried them (an in-memory prototype had no use for them) and still don't;
they exist for real persistence's sake and are not surfaced through the domain layer or UI.

Migrations: `server/prisma/migrations/` (via `prisma migrate dev`), reproducible from empty.
Seed: `server/prisma/seed.ts`, reproducing `src/repository/seedData.ts`'s scenario plus the same
scripted order sequence `mockRepository.ts` runs, through the real `createOrderForSeed`/
`voidOrderForSeed` functions so seeded FIFO/COGS figures are guaranteed consistent with live code.
