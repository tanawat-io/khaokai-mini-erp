# Business Rules

## 1. Store
- V1 supports one store only.
- Store overhead is outside V1.
- Rent and electricity are excluded.

## 2. Users
- Login is required.
- Every authenticated user has Admin-level access.
- No role hierarchy in V1.

## 3. Menu Pricing
- Selling price is manually defined by the user.
- The system must not automatically recommend or force a selling price.

## 4. Recipe
- Each menu has ingredients/components and quantities.
- Portion quantities are user-entered.
- The system must not hard-code a standard portion for meat or other ingredients.
- A menu can use different quantities of the same ingredient.
- Add-ons can be configured independently.
- An add-on's quantity on an order line is independent of the parent menu item's quantity — it is never multiplied by it. Example: 3 × ผัดกะเพราหมู + 1 × ไข่ดาว consumes exactly 1 egg, not 3. This applies uniformly to stock-availability checking, FIFO allocation, COGS, and display.

## 5. Purchase
Every purchase should record:
- Ingredient
- Quantity
- Unit
- Purchase price
- Date/time
- Batch/reference information

Purchase price history must be retained.

## 6. Processing
Processing converts purchased/raw stock into user-defined portions or batches.

Example:
1 kg pork may become:
- 80 g × 8
- 50 g × 4

The system records the actual output.

Processed stock is normalized to grams (or the ingredient's base unit) internally for consumption and FIFO. "80 g × 8" is display metadata (portion size × portion count) layered over that gram-denominated lot, not a separate stock unit.

The user may record waste.
Waste is treated as a stock loss and its cost is calculated.

## 7. Processing Once
The user's operating model is to process an ingredient batch once and then use the resulting portions/batches.

The system should support this workflow without requiring repeated reprocessing for every order.

## 8. FIFO
Stock consumption follows FIFO:
- Oldest eligible batch is consumed first.
- If one batch is insufficient, consume the next batch.
- The transaction records which batches were consumed.

An "eligible" batch is one with `status = active` and `remaining_quantity > 0`. V1 has no expiration-date tracking, so eligibility does not consider age or expiry, only status and remaining quantity. Eligible lots span both purchase batches and processing outputs for the same ingredient (see Calculation Engine §8 and Database §16–17 for the source-type discriminator).

## 8a. Standard Cost Stock Tracking (Decision — Phase 2D)
`standard_cost` ingredients opt out of lot/FIFO tracking (Database §5), not out of stock tracking. Resolved rule:
- The ingredient still has a finite available quantity. Purchases increase it; order confirmation, order-edit re-allocation, and waste each decrease it; voiding an order or rolling back a failed edit restores it. All four movements are recorded as stock movements (Database §16) for audit purposes, exactly as required for any other ingredient.
- This quantity is a single running total for the ingredient, not a set of lots — it is derived from the ingredient's stock-movement history, not from summing purchase-batch `remaining_quantity`. Purchase batches are still created for a `standard_cost` ingredient (Purchase price history must be retained, §5, applies uniformly), but their `remaining_quantity`/`status` fields are informational only: they stay at their original purchased quantity and `active` status forever, are never treated as consumable lots, and are excluded from FIFO eligibility (§8) the same way `processed_batch` raw purchase batches already are.
- Insufficient stock is a hard block for `standard_cost` ingredients exactly as it is for any other ingredient (§18) — there is no quantity ceiling exemption.
- COGS for `standard_cost` consumption still uses the ingredient's configured `standard_cost`, never a purchase batch's own unit cost or a weighted average. No `FifoAllocation` row is created for this consumption, since there is no lot to attribute it to.
- Waste may be recorded against a `standard_cost` ingredient (§15); since there is no lot to reference, the waste record's source type identifies the ingredient directly rather than a purchase batch or processing output.

## 9. Stock
Stock must show:
- Remaining quantity
- Remaining value
- Batch source
- Batch history

The user should be able to know how much stock remains and which batch it came from.

## 10. Eggs
Eggs are tracked as units.
Example:
- Purchase 10 eggs for 40 baht
- Unit cost = 4 baht/egg
- A menu may consume 1 or 2 eggs.

## 11. Orders
- Every sale is recorded as an Order.
- Order number is sequential within the selling date.
- Editing an order recalculates stock and profit.
- Deleting an order is allowed in V1 and uses soft-delete/void semantics (see §17): the order record is never physically removed.
- Order history is permanently retained. Voided orders remain visible in history/audit and in the Orders list (marked voided) but are excluded from Revenue/COGS/Profit/active-order-count aggregates.

## 12. Revenue
Revenue is based on the actual selling price recorded on the order.

## 13. COGS
COGS is based on actual stock consumption and applicable costing rules.

## 14. Profit
V1 profit is:
Revenue - COGS

It is NOT reduced by:
- Rent
- Electricity
- General store overhead

V1 has no general expense feature. Profit = Revenue − COGS is exhaustive; there is no separate expense deduction step.

## 15. Waste
Waste is recorded as loss.
The system calculates the monetary value of wasted stock.

Every waste record must identify the ingredient it applies to and its source type (`purchase_batch`, `processing_output`, or — for a `standard_cost` ingredient, which has no lot to reference (§8a) — `standard_cost`), so waste on a processed portion can be traced without relying solely on an optional processing-batch reference.

## 16. Edit Rules
When a historical transaction is edited:
1. Rebuild the inventory effects of the edited order only — edits do not cascade-recalculate chronologically later orders. Each edit is its own discrete event in the transaction history.
2. Recalculate affected COGS.
3. Recalculate affected profit.
4. Recalculate affected stock balances — for FIFO-tracked ingredients this means reversing and re-committing FIFO allocations; for `standard_cost` ingredients (§8a) it means restoring and re-decrementing the ingredient's available quantity via stock movements, since there is no allocation row to reverse.
5. Preserve audit/history information where technically appropriate (Decision — Phase 2D). For V1 this is satisfied by the order's `editedAt` timestamp plus a History event marking that an edit occurred (Database §18); a full before/after snapshot of the edited order's prior state is not required — Database §2's recommended entity list has no snapshot/version table, and Database §18's "at minimum" event list is a list of event *types* to capture, not field-level diffs.
6. If re-allocating the edited order fails the insufficient-stock hard block (§18), the entire edit rolls back atomically: the original allocation is restored exactly as it was, and the edit is rejected rather than left half-applied.

## 17. Deletion
Deletion is allowed in V1 and uses soft-delete/void semantics — the order record is never physically deleted:
1. Set the order's status to `voided`.
2. Reverse its stock consumption and restore the affected stock — FIFO allocations for FIFO-tracked ingredients, and the ingredient's available quantity (via a stock movement) for `standard_cost` ingredients (§8a).
3. Reverse its revenue and COGS impact.
4. Exclude the voided order from Revenue/COGS/Profit/active-order-count aggregates going forward.
5. The order remains permanently visible in history/audit records (and in the Orders list, marked voided).
6. Deletion does not cascade-recalculate chronologically later orders; the void is itself a discrete, replayable event.

The UI should confirm destructive actions and explain that the order will be voided (not erased), stock restored, and revenue/COGS/profit reversed.

## 18. Data Integrity
The system must not allow a transaction to silently create impossible stock.

Insufficient stock is a hard block: order confirmation is rejected in full when required quantity exceeds available quantity for any ingredient — including `standard_cost` ingredients, whose available quantity is tracked as described in §8a; there is no tracking-type exemption. V1 never allows negative stock and never offers an override. The check aggregates required quantity per ingredient across every menu-item line and every add-on line in the order before any allocation is written, since a menu item and an add-on can each pass individually while jointly exceeding stock. On block, the system reports required / available / shortage per shortfalling ingredient. See Calculation Engine "Insufficient Stock" for the full rule.

## 19. Setup Wizard
A first-time user should be guided through:
- Store setup
- Ingredients
- Menus
- Initial stock/prices
- Add-ons
- Basic configuration
