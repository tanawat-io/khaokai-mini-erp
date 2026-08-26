# Food Cost & Profit Mini ERP — Product Specification

## 1. Product Overview
A web application for a small food business to manage food costs, sales revenue, expenses, stock, and profit.

V1 is a single-store Mini ERP focused on accurate, practical cost and profit calculation.

## 2. Users
- Login required.
- All users have the same Admin-level permissions.
- Intended primarily for the owner and family/partners.

## 3. V1 Scope
### Included
- Menu management
- Recipe/cost calculation
- Ingredient management
- Purchase recording
- Purchase price history
- Processing ingredients into portions/batches
- Stock tracking
- FIFO stock consumption
- Waste recording and waste value calculation
- Order recording
- Add-ons such as extra meat and extra eggs
- Revenue tracking
- Profit/loss calculation
- History
- Setup Wizard
- Mobile/iPad/Desktop responsive UI
- Edit/delete records in V1

### Excluded from V1
- Multiple stores
- Employee roles/permissions
- Rent
- Electricity
- General store overhead
- Tax/accounting system
- Supplier management
- Advanced reports
- Photos
- Platform fee calculation
- Full accounting
- Automated selling-price recommendation

## 4. Core Business Concept
The system follows:

Purchase → Stock → Processing/Batch → Menu consumption → Order → Revenue/COGS → Profit

## 5. Portioning
The system MUST NOT fix portion sizes.

The user enters the actual portion quantity whenever processing or using an ingredient.

Example:
- 1 kg pork
- Process into 80 g × 8 portions and 50 g × 4 portions
- The system records the actual portions created.

## 6. Ingredient Types
The system must support:
- Raw ingredients purchased by weight/quantity
- Processed ingredients stored as batches
- Whole pieces such as chicken thighs
- Ingredients that are not individually processed, such as curry paste, vegetables, sauces
- Eggs tracked as individual units

## 7. Costing
- Purchase price history is retained.
- Menu cost changes according to actual historical purchase cost.
- FIFO is used for stock consumption.
- Weighted-average costing is used only as a display/estimate reference (e.g. a menu's current estimated cost before any order consumes stock); it never substitutes for FIFO when calculating actual order-time COGS, as defined in the calculation engine.
- Sauces/ingredients can be configured with a user-defined standard cost when desired.

## 8. Orders
Orders record what was actually sold.
Order numbers reset/count by selling date.

Orders can be edited.
When an order is edited, the system recalculates:
- Revenue
- COGS
- Stock
- Profit

## 9. Add-ons
Menus support add-ons, for example:
- Extra pork
- Extra egg
- Extra ingredients

The same menu may use different quantities, e.g. one menu may use 2 eggs.

## 10. Dashboard
The dashboard should prioritize:
1. Revenue
2. COGS
3. Profit
4. Orders
5. Stock status

## 11. Platforms
- Online only
- Web App
- Thai UI
- Mobile-first
- iPad supported
- Desktop supported

## 12. Scale
V1 target:
- ≤ 50 menus
- Hundreds of orders
- One store

## 13. Design Goal
Simple, modern, clean, friendly, practical, and understandable without accounting knowledge.
