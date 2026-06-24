# Elixir & Oak — Admin Manual

**App URL:** `https://app.elixirandoak.com`
**Login:** Click "Admin" → Enter credentials

---

## 1. Dashboard

The dashboard shows real-time KPIs:
- **Today's Revenue** — Total sales for current day
- **Active Orders** — Orders currently being prepared
- **Occupancy** — Current table occupancy percentage
- **Low Stock Items** — Items below reorder threshold

Click any KPI card to navigate to the relevant section.

---

## 2. Inventory Management

**Path:** Dashboard → Inventory

### Tabs:
- **All Items** — Complete inventory with search, sort, pagination
- **Low Stock** — Auto-filtered items below threshold
- **Suppliers** — Supplier management
- **Purchase Orders** — Create and track purchase orders

### Add Inventory Item:
1. Click "Add Item"
2. Fill in name, category, unit, current stock, reorder level
3. Click Save

### Adjust Stock:
1. Click item row
2. Edit quantity
3. Reason for adjustment (sold, damaged, received)
4. Click Save

---

## 3. Order Management

**Path:** Dashboard → Orders

Order status workflow:
`Pending → Confirmed → Preparing → Ready → Served → Paid → Completed`

### Cancel an Order:
1. Open order details
2. Click "Cancel"
3. Select reason
4. Confirm → Payment auto-refunded

---

## 4. Menu Management

**Path:** Dashboard → Menu

### Add Category:
1. Click "Add Category"
2. Name, slug, display order
3. Save

### Add Menu Item:
1. Select category
2. Fill name, description, price, image
3. Set availability (available/unavailable)
4. Dietary tags (vegetarian, vegan, gluten-free)
5. Save

---

## 5. Reservations

**Path:** Dashboard → Reservations

- View all reservations in table/card view
- Filter by date, status, party size
- Confirm or cancel reservations
- View customer notes

---

## 6. CRM

**Path:** Dashboard → CRM

### Features:
- **Customer List** — All registered customers
- **Customer Detail** — Order history, loyalty points, total spend
- **Gift Cards** — Issue, void, track gift cards
- **Referrals** — Track referral campaigns

---

## 7. Marketing

**Path:** Dashboard → Marketing

### Campaigns:
- Create email/SMS campaigns
- Schedule send time
- Target by segment
- Track open/click rates

### Coupons:
- Create discount coupons (percentage or fixed)
- Set minimum order value
- Expiration dates
- Usage limits

---

## 8. Reports

**Path:** Dashboard → Reports

### Available Reports:
- **Sales Report** — Daily/weekly/monthly sales breakdown
- **Inventory Report** — Stock usage, waste tracking
- **Customer Report** — New vs returning, lifetime value
- **Popular Items** — Best sellers by volume/revenue

Reports can be exported as CSV.

---

## 9. Staff Management

**Path:** Dashboard → Staff

- Add staff members with role (admin, manager, chef, waiter)
- Set permissions per role
- View staff activity log

---

## 10. Audit Logs

**Path:** Dashboard → Audit Logs

Every admin action is logged with:
- Timestamp
- Admin user
- Action performed
- Target resource
- IP address
- Old/new values (for updates)

Searchable by action type, user, date range.

---

## 11. Background Jobs

**Path:** Dashboard → Jobs

View and retry failed background jobs:
- Email notifications
- Analytics processing
- Backup execution
- Loyalty point calculations
