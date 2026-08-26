# Calculation Engine

## 1. Purpose
This document defines the calculation rules for stock, recipe cost, COGS, revenue, waste, and profit.

## 2. Units
The engine must support appropriate units such as:
- g
- kg
- ml
- L
- piece
- egg
- portion

Internally, quantities should be normalized where practical while preserving display units.

## 3. Purchase Unit Cost
For a purchase:

Unit Cost = Purchase Price / Purchased Quantity

Example:
1,000 g pork costs 130 baht.

Unit cost:
130 / 1,000 = 0.13 baht/g

## 4. Weighted Average for Raw Cost
When calculating an ingredient's raw cost across purchases:

Weighted Average Cost = Total Purchase Value / Total Purchase Quantity

This is a display/estimate reference only (for example, a menu's "current estimated cost" shown before any order has consumed stock). It is never used to compute actual order-time COGS — actual COGS always comes from FIFO batch consumption (§8). Ingredients with `tracking_type = standard_cost` use a separate, user-entered fixed cost (see Database §5) instead of a computed average; the two are not blended.

## 5. Processing
Processing takes input stock and produces one or more output portions/batches.

Example:
Input:
1,000 g pork

Output:
- 80 g × 8 = 640 g
- 50 g × 4 = 200 g
- Waste = 160 g

The engine must preserve:
- Input batch
- Input quantity
- Output portions
- Waste quantity
- Cost allocation

## 6. Processing Cost Allocation
Processing allocates the input batch's cost on an **input-gram basis**: the per-gram cost is the source batch's unit cost, applied uniformly to every gram of the input — usable output and waste alike. There is no separate "usable-gram" recomputation that raises the per-gram cost to absorb waste; waste simply carries its proportional share of the input cost out of stock as a real loss.

Worked example:
Input: 1,000 g pork, cost = 130 baht → unit cost = 130 / 1,000 = 0.13 baht/g.

Output:
- 80 g × 8 portions = 640 g → 640 × 0.13 = 83.20 baht
- 50 g × 4 portions = 200 g → 200 × 0.13 = 26.00 baht
- Waste = 160 g → 160 × 0.13 = 20.80 baht (real, recorded loss)

Check: 83.20 + 26.00 + 20.80 = 130.00 baht, matching the input cost exactly.

A single 80 g portion therefore costs 0.13 × 80 = **10.40 baht**, consistent with the traceability example in §19. This allocation is deterministic and reproducible: given the same input cost, input quantity, and output/waste quantities, it always yields the same per-gram cost and the same per-line allocation.

## 7. Waste
Waste is a real loss.

Waste Value = Waste Quantity × Applicable Cost per Unit

Waste must reduce available stock and must be included in waste history.

Waste must NOT become usable stock.

## 8. FIFO
For consumption:
1. Find oldest available eligible stock batch.
2. Consume required quantity.
3. If insufficient, consume the remaining quantity.
4. Continue with the next oldest batch.
5. Record every allocation.

Example:
Need 100 g.

Batch A:
60 g @ 0.13 = 7.80

Batch B:
40 g @ 0.15 = 6.00

COGS = 13.80

FIFO operates over normalized gram quantities (or the ingredient's base unit) and spans both `ingredient_purchase_batches` and `processing_outputs` for a given ingredient — "oldest eligible batch" is determined across both sources by date, not within one table only. Each allocation records which source table (`purchase_batch` or `processing_output`) and which row it consumed from.

## 9. Menu Recipe Cost
Menu COGS is the sum of the actual cost allocated to every ingredient consumed by the recipe.

Menu Cost =
Ingredient 1 Cost
+ Ingredient 2 Cost
+ ...
+ Add-on Cost

## 10. Example Menu
If a menu uses:
- Pork 80 g
- Rice 1 portion
- Sauce
- Box
- Egg 1

The system calculates each component according to its configured cost/stock consumption.

## 11. Add-ons
Add-ons are additional order components. Each add-on has its own ingredient/quantity recipe (equivalent in structure to a menu's recipe lines — see Database §12a), and its COGS is computed the same way a menu ingredient line is: via FIFO consumption of the linked ingredient.

An add-on's quantity is independent of its parent menu item's quantity — it is never multiplied by the menu quantity. Example: an order line of 3 × ผัดกะเพราหมู with 1 × ไข่ดาว (extra egg) consumes exactly 1 egg, not 3. This holds for stock-availability aggregation, FIFO consumption, and COGS calculation alike (see Business Rules §4).

Example:
Base menu: 50 baht (COGS from its own recipe, e.g. 21.40 baht as in §19)

Add-on "Extra pork" (+10 baht selling price): recipe = pork 40 g → FIFO-allocated cost, e.g. 40 g × 0.13 baht/g = 5.20 baht COGS.

Add-on "Extra egg" (+7 baht selling price): recipe = egg × 1 → FIFO-allocated cost from the current egg batch, e.g. 4.00 baht COGS (per §12).

Revenue: 50 + 10 + 7 = 67 baht
COGS: 21.40 + 5.20 + 4.00 = 30.60 baht

COGS is recalculated from the actual additional quantities consumed, using the add-on's own recipe — not a flat estimate.

## 12. Eggs
For 10 eggs purchased for 40 baht:

Unit Cost = 40 / 10 = 4 baht/egg

A menu using 2 eggs:
Egg COGS = 2 × 4 = 8 baht

Actual batch allocation should still follow the inventory model.

## 13. Revenue
Order Revenue = Sum of actual selling prices of all order lines and add-ons.

## 14. Profit
Gross Selling Profit:

Profit = Revenue - COGS

V1 excludes:
- Rent
- Electricity
- General store expenses

## 15. Order Editing
When an order changes:
1. Reverse its previous inventory allocations — FIFO allocations for FIFO-tracked ingredients, and available-quantity restoration (Business Rules §8a) for `standard_cost` ingredients.
2. Restore affected stock.
3. Recalculate the new order.
4. Allocate stock again — FIFO for FIFO-tracked ingredients, available-quantity decrement at the ingredient's `standard_cost` for `standard_cost` ingredients (no new FIFO allocation row is created for the latter).
5. Recalculate COGS.
6. Recalculate profit.

This applies only to the edited order itself — edits do not cascade-recalculate chronologically later orders. If step 4's re-allocation fails the insufficient-stock hard block (§17), the entire edit rolls back atomically: the reversal from steps 1–2 is undone and the original allocation is restored exactly as it was, rather than leaving stock reversed with no valid allocation in its place.

## 16. Order Deletion
Deletion uses soft-delete/void semantics — the order record is never physically deleted. When an order is voided:
1. Set the order's status to `voided`.
2. Reverse its stock consumption and restore affected stock — FIFO allocations for FIFO-tracked ingredients, and available-quantity restoration (Business Rules §8a) for `standard_cost` ingredients.
3. Reverse its revenue and COGS effect.
4. Recalculate affected summaries, excluding the voided order from all Revenue/COGS/Profit/active-order-count aggregates going forward.
5. Record the void as a discrete, replayable event — the order stays permanently visible in history/audit and in the Orders list (marked voided).

Deletion does not cascade-recalculate chronologically later orders.

## 17. Insufficient Stock
Order confirmation (new order or a re-allocation triggered by an edit) is a hard block when required quantity exceeds available quantity for any ingredient, including `standard_cost` ingredients — there is no tracking-type exemption (Business Rules §8a, Decision — Phase 2D):
1. Aggregate required quantity per ingredient across every menu-item line and every add-on line in the order — a menu item and an add-on can each pass individually while jointly exceeding stock, so the check must sum across both before evaluating.
2. Compare aggregated requirement against currently available quantity for each ingredient — sum of eligible batches' remaining quantity for FIFO-tracked ingredients; the ingredient's tracked available quantity (Business Rules §8a) for `standard_cost` ingredients.
3. If any ingredient is short, reject the entire order confirmation — no partial allocation is written, no negative stock is created, and V1 offers no override.
4. Report required / available / shortage per shortfalling ingredient.
5. For an edit, this check runs after the previous allocation has been reversed (§15) and before the new allocation is committed; a failure here triggers the atomic rollback described in §15.

## 18. Rounding
Store calculation values with sufficient precision.
Round only for presentation where possible.

Financial display:
- Show 2 decimal places when necessary.
- Avoid cumulative rounding errors.

## 19. Calculation Traceability
Every COGS result should be explainable.

Example:

21.40 baht
= Pork 10.40
+ Rice 4.00
+ Sauce 5.00
+ Box 2.00

The user should be able to inspect the source batch for stock-based costs.

## 20. Stock Value
Stock value is calculated from the remaining quantities and applicable batch costs.

## 21. Required Engine Outputs
The calculation engine should be able to return:
- Revenue
- COGS
- Profit
- Ingredient consumption
- Batch consumption
- Remaining stock
- Stock value
- Waste quantity
- Waste value
- Cost breakdown
- FIFO allocation details

## 22. Determinism
Given the same data and transaction order, the engine must produce the same result.

Determinism is defined over the full event log — purchases, processing, orders, edits, and voids each as their own discrete events. An edit or a void is a new event appended to the log, not a rewrite of a prior event; replaying the log reproduces the live state without needing to cascade-recalculate later orders.

This is a behavioral requirement, not a mandate for a literal append-only event-sourced datastore (Decision — Phase 2D). It is satisfied by a transactional backend where: (a) `stock_movements` and `fifo_allocations` rows are immutable once written — an edit or void never updates or deletes an existing row, it only inserts new rows (reversal movements, a fresh allocation set) alongside the ones already there; (b) `orders` (and `ingredients`/`purchase_batches`/`processing_outputs`) hold current/mutable state plus timestamp columns (`created_at`, `edited_at`, `voided_at`, etc.); and (c) each edit/void handler touches only its own order's rows, never a later order's. Given those three properties, replaying the immutable movement/allocation history reproduces the same live state regardless of whether the storage layer is literally event-sourced — so V1's backend may use transactional state + immutable history records instead of a dedicated event store.

## 23. Separation
Business calculations must live outside UI components.
UI components display calculation results; they do not implement FIFO or COGS logic.
