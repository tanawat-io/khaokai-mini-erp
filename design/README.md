# Food Cost & Profit Mini ERP
## Design System & Visual Design Direction — V1

> This document defines the visual design direction and design-system principles for V1.

## 1. Design Goal
The application should feel:
- Simple
- Modern
- Clean
- Friendly
- Practical
- Fast
- Reliable

It should not feel like a complex accounting or enterprise ERP system.

## 2. Core Principle
"เห็นสิ่งสำคัญก่อน รายละเอียดค่อยเปิดดู"

Prioritize:
- ยอดขาย (Revenue)
- ต้นทุน (COGS)
- กำไร (Profit)
- Orders
- Stock

## 3. Visual Direction
Modern SaaS Dashboard + subtle food-business character.

Avoid:
- large food photos
- excessive gradients
- heavy shadows
- excessive colors
- overly playful cartoon UI

## 4. Color Direction
Warm and approachable:
- Primary: warm orange
- Secondary: warm cream
- Background: soft warm gray/off-white
- Surface: white
- Text: dark charcoal
- Muted: gray
- Success: green
- Warning: amber/orange
- Danger: red

Exact tokens should be finalized in Figma.

## 5. Typography
Thai readability is a priority.

Possible fonts:
- Noto Sans Thai
- LINE Seed Sans TH
- IBM Plex Sans Thai

Use:
- Regular 400
- Medium 500
- SemiBold 600
- Bold 700

## 6. Typography Scale
- Display: 32px
- Page heading: 24–28px
- Section heading: 18–20px
- Card heading: 16–18px
- Body: 14–16px
- Secondary: 12–14px
- Caption: 11–12px

## 7. Spacing
Use a 4px base scale:
4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

## 8. Radius
- Small: 8px
- Medium: 12px
- Large: 16px

Use pills mainly for status/badges.

## 9. Buttons
Primary: filled
Secondary: outline/subtle
Tertiary: text
Danger: danger style

Mobile important actions: 48px minimum preferred.

## 10. Inputs
Touch-friendly:
- 44–48px mobile height
- visible labels
- placeholders provide examples but never replace labels

## 11. Cards
One logical piece of information per card.

Examples:
- Profit Card
- Stock Card
- Batch Card
- Menu Card
- Order Card

## 12. Navigation
Desktop:
- Sidebar

Mobile:
- Bottom Navigation

Recommended mobile primary items:
- หน้าหลัก
- Orders
- Stock
- เพิ่มเติม

## 13. Tables
Desktop/iPad:
- tables are allowed

Mobile:
- cards
- lists
- expandable rows

## 14. Financial UI
Make the following obvious:
Revenue - COGS = Profit

Allow users to inspect cost breakdowns and source batches.

## 15. Mobile-first
The main usage is mobile and iPad.

Mobile:
- 16px page padding
- large touch targets
- sticky action bar for important forms
- no unnecessary horizontal scrolling

## 16. Responsive
Reference:
- Mobile < 768px
- Tablet 768–1023px
- Desktop ≥ 1024px

## 17. Accessibility
Support:
- readable contrast
- visible focus
- large touch targets
- clear labels
- icons + text
- descriptive errors
- do not communicate meaning by color alone

## 18. Animation
Use subtle transitions around 100–200ms.
Avoid unnecessary animation.

## 19. Figma Structure
Recommended pages:
- 00 Cover
- 01 Design Tokens
- 02 Components
- 03 Mobile
- 04 Tablet
- 05 Desktop
- 06 Prototype
- 07 User Flows

## 20. First Figma Screens
Start with:
1. Login
2. Dashboard
3. New Order
4. Order Detail
5. Menu + Recipe
6. New Purchase
7. Processing
8. Stock
9. Setup Wizard

## 21. Source of Truth
PRODUCT_SPEC.md = product scope
BUSINESS_RULES.md = business rules
CALCULATION_ENGINE.md = calculations
DATABASE.md = data model
USER_FLOWS.md = user behavior
UI_SPEC.md = UI behavior
design/README.md = visual design rules
Figma = visual design + prototype

## 22. Design Change Rule
If Figma introduces new behavior:
Specification must be updated before implementation.

## 23. Definition of Done
- Design tokens defined
- Core components defined
- Responsive rules defined
- Core screens designed
- Loading/empty/error/success states considered
- Figma prototype reviewed against specifications
