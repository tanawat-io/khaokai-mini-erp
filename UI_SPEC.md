# UI Specification

## 1. UI Goal
Create a Thai-language, mobile-first web application that is simple enough for a small food business owner and detailed enough to trace costs.

## 2. Main Screens
V1 screens:
1. Login
2. Setup Wizard
3. Dashboard
4. Orders
5. New Order
6. Order Detail
7. Menus
8. Menu Detail / Recipe
9. Ingredients
10. Purchases
11. Processing
12. Stock
13. Stock Detail / Batch
14. Add-ons
15. History
16. Settings

## 3. Dashboard
Priority:
1. Revenue
2. COGS
3. Profit
4. Orders
5. Stock warnings
6. Quick actions

Example KPI:
- ยอดขายวันนี้
- ต้นทุนวันนี้
- กำไรวันนี้
- จำนวน Orders

## 4. New Order
Optimize for speed.

Order flow:
- Select menu
- Quantity
- Add-ons
- Review
- Save

Show running total.

Save is blocked when required stock exceeds available stock for any ingredient (aggregated across menu-item and add-on lines) — this is a hard block with no override in V1. Show required / available / shortage per shortfalling ingredient inline (see §18 States → Validation/Error).

## 5. Order Detail
Show:
- Order #
- Date/time
- Items
- Add-ons
- Revenue
- COGS
- Profit
- Cost breakdown
- FIFO/batch details

Edit button must be readily accessible.

Delete marks the order voided (not erased): stock is restored, revenue/COGS/profit are reversed, and the order remains visible in the Orders list (with a voided status badge) and in History. See §20 Destructive Actions.

## 6. Menu
Menu list:
- Menu name
- Selling price
- Current estimated cost
- Estimated profit
- Active status

No menu photo required.

## 7. Menu Recipe
Show:
- Ingredients
- Quantity
- Unit
- Cost contribution
- Total cost

Allow user to enter menu-specific quantities.

## 8. Purchase
Fields:
- Ingredient
- Quantity
- Unit
- Purchase price
- Date
- Reference

Show:
- Total cost
- Unit cost

## 9. Processing
Fields:
- Source ingredient/batch
- Input quantity
- Output portions
- Output quantity
- Waste quantity
- Waste reason

Do not pre-fill a fixed portion unless it is explicitly user-configured.

Portion size and portion count are entry/display convenience only. Stock is normalized and consumed in the ingredient's base unit (grams for weight-tracked ingredients) internally.

## 10. Stock
Show:
- Ingredient
- Remaining quantity
- Stock value
- Batch count
- Low-stock status

## 11. Batch Detail
Show:
- Batch ID
- Source purchase
- Purchase price
- Original quantity
- Remaining quantity
- Unit cost
- Processing history
- Consumption history

## 11a. Add-ons
Fields:
- Name
- Selling price
- Ingredient/quantity recipe line(s) (same pattern as Menu Recipe §7)
- Computed cost (from the recipe, via FIFO — not a flat entry)
- Active status

## 11b. Settings
Minimum V1 scope:
- Store name (editable)
- Currency (read-only display)

No other settings in V1 (no roles, no multi-store, no authentication management specified elsewhere in the spec set).

## 12. History
Timeline/list:
- Date
- Type
- Reference
- Quantity/value
- Detail

Filters:
- Date
- Type
- Ingredient/menu where applicable

## 13. Forms
Forms should be grouped into logical sections.
Labels must remain visible.
Number and currency inputs should be touch-friendly.

## 14. Tables
Use tables on desktop/iPad where useful.
Use cards/expandable rows on mobile.

## 15. Mobile
- 16px page padding
- 44–48px touch targets
- bottom navigation
- sticky save/action bar for important forms
- avoid horizontal scrolling

## 16. iPad
- use available width
- split view where useful
- touch-friendly controls
- tables may remain usable

## 17. Desktop
- sidebar
- tables
- detail panels
- greater information density

## 18. States
Every important screen should define:
- Loading
- Empty
- Error
- Success
- Disabled
- Validation

New Order and Edit Order must specifically define an "Insufficient stock" Validation/Error state: hard block, no override, showing required/available/shortage per shortfalling ingredient (see §4).

## 19. Financial Display
Revenue, COGS, and profit must be visually distinct.

Cost breakdown should be inspectable.

Example:
Revenue 50.00
COGS 21.40
Profit 28.60

## 20. Destructive Actions
Delete must require confirmation.
The UI should explain what will happen to stock/profit.

Order deletion is a void, not an erase: the confirmation must state that the order will be marked voided, stock will be restored, revenue/COGS/profit will be reversed, and the order will remain visible (with a voided badge) in the Orders list and in History.

## 21. UX Principle
The user should always be able to answer:
- What happened?
- How much stock changed?
- How much did it cost?
- How much revenue was generated?
- How much profit resulted?

## 22. Responsive Breakpoints
Reference:
- Mobile < 768px
- Tablet 768–1023px
- Desktop ≥ 1024px

## 23. Visual Design Reference
See:
design/README.md
