# User Flows

## 1. First Launch
User opens app.

Flow:
Login
→ Setup Wizard
→ Dashboard

## 2. Setup Wizard
Step 1:
Store information

Step 2:
Add ingredients

Step 3:
Add initial purchase/stock

Step 4:
Create menus

Step 5:
Create add-ons

Step 6:
Review

Step 7:
Finish

## 3. Login
Login
→ Dashboard

All authenticated users have Admin-level access.

## 4. Dashboard
Dashboard provides, in priority order:
- Revenue
- COGS
- Profit
- Orders
- Stock alerts
- Quick actions

Quick actions:
- New Order
- Purchase
- Processing
- Add Menu

## 5. Create Purchase
Purchase
→ Select ingredient
→ Enter quantity
→ Enter purchase price
→ Confirm
→ Create purchase batch
→ Update stock
→ Update purchase price history

## 6. Process Ingredient
Processing
→ Select source stock/batch
→ Enter actual output portions
→ Enter waste if any
→ Review cost allocation
→ Save
→ Create output stock
→ Reduce source stock
→ Record waste

## 7. Create Menu
Menus
→ Add Menu
→ Name
→ Selling Price
→ Recipe
→ Add ingredients
→ Enter actual recipe quantity
→ Add add-ons if needed
→ Save

## 7a. Create/Edit Add-on
Add-ons
→ Add Add-on
→ Name
→ Selling Price
→ Recipe
→ Add ingredient(s)
→ Enter actual recipe quantity
→ Save

## 8. Create Order
New Order
→ Select menu
→ Enter quantity
→ Add add-ons
→ Review
→ Save Order
→ Check stock availability (aggregated across menu-item and add-on ingredient lines)
  → If any ingredient is short: block confirmation, show required/available/shortage per ingredient, return to Review
→ Consume stock using FIFO
→ Calculate COGS
→ Calculate revenue
→ Calculate profit
→ Show Order Detail

## 9. Add-on Flow
Order item
→ Add add-on
→ Select quantity
→ Review price
→ Review additional cost
→ Save

Example:
Extra egg × 2

## 10. Order Detail
Order Detail shows:
- Order #
- Date/time
- Menu
- Add-ons
- Revenue
- COGS
- Profit
- Cost breakdown
- Stock/batch allocation

## 11. Edit Order
Order Detail
→ Edit
→ Change menu/quantity/add-ons/price as allowed
→ Save
→ Reverse previous stock allocations
→ Recalculate stock
→ Re-run FIFO
  → If the new allocation fails the insufficient-stock check: roll back the entire edit atomically (restore the original allocation), show required/available/shortage, order stays as it was
→ Recalculate COGS
→ Recalculate profit

Edits affect only this order — later orders are never cascade-recalculated.

## 12. Delete Order
Order Detail
→ Delete
→ Confirmation (explains: the order will be voided, not erased; stock will be restored; revenue/COGS/profit will be reversed; the order remains visible in History)
→ Mark order `voided`
→ Reverse stock consumption via FIFO reversal
→ Reverse revenue and COGS effect
→ Update summaries (excluding the voided order)
→ Order remains visible in the Orders list (marked voided) and in History

## 13. Stock
Stock
→ Ingredient list
→ Select ingredient
→ View remaining quantity
→ View stock value
→ View batches
→ View batch source/history

## 14. Batch Detail
Stock
→ Ingredient
→ Batch
→ View:
- source purchase
- processing
- original quantity
- remaining quantity
- unit cost
- consumption history

## 15. Waste
Processing
→ Record waste
→ Enter actual quantity
→ Enter reason
→ System calculates waste value
→ Save

## 16. History
History
→ Filter by date/type
→ Select transaction
→ View details

History types:
- Purchase
- Processing
- Waste
- Order
- Edit
- Delete/Reversal

## 17. Mobile Navigation
Primary:
- Home
- Orders
- Stock
- More

More:
- Menus
- Ingredients
- Purchases
- Processing
- Add-ons
- History
- Settings

## 18. Responsive Behavior
Mobile:
- card/list UI
- bottom navigation
- sticky actions

iPad:
- split/list-detail layouts where useful

Desktop:
- sidebar
- tables
- higher information density
