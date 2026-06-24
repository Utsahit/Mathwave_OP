# Elixir & Oak — API Integration Guide

**Base URL:** `https://api.elixirandoak.com/api/v1`
**Swagger UI:** `https://api.elixirandoak.com/api-docs/`

## Authentication

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "password": "SecurePass123!"
}
```

Response: `201 Created` — Returns JWT access + refresh tokens.

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

Response: `200 OK` — Returns JWT tokens + user profile.

### Using Tokens

```http
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes. Use the refresh endpoint to get new tokens.

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

## Public Endpoints

### Health Check

```http
GET /health
```

### Public Menu

```http
GET /menu/public
```

Returns all active menu items grouped by category.

## Customer Endpoints

Headers: `Authorization: Bearer <access_token>`

### Cart

```http
GET    /cart                          # View cart
POST   /cart/items                    # Add item
PUT    /cart/items/:itemId            # Update quantity
DELETE /cart/items/:itemId            # Remove item
```

### Orders

```http
POST   /orders                        # Create order
GET    /orders                        # My orders (paginated)
GET    /orders/:id                    # Order details
```

### Reservations

```http
POST   /reservations                  # Create reservation
PUT    /reservations/:id              # Modify reservation
DELETE /reservations/:id              # Cancel reservation
```

### Payments

```http
POST   /payments/create-order         # Create Razorpay order
POST   /payments/verify               # Verify payment signature
GET    /payments/history              # Payment history
```

**Webhook (server-side):** `POST /payments/webhook` — Razorpay sends events here.

### Loyalty

```http
GET    /loyalty/points                # Current points balance
GET    /loyalty/history               # Points earned/redeemed history
POST   /loyalty/redeem                # Redeem points for reward
```

## Admin Endpoints

Headers: `Authorization: Bearer <admin_access_token>`

### Dashboard

```http
GET /analytics/dashboard    # Revenue, orders, occupancy KPIs
```

### Inventory

```http
GET    /admin/inventory               # All inventory items (paginated)
POST   /admin/inventory               # Add inventory item
PUT    /admin/inventory/:id           # Update stock level
GET    /admin/inventory/low-stock     # Low stock alerts
```

### Menu Management

```http
POST   /admin/menu/items              # Add menu item
PUT    /admin/menu/items/:id          # Update menu item
DELETE /admin/menu/items/:id          # Remove menu item
POST   /admin/menu/categories         # Add category
```

### Orders Management

```http
GET    /admin/orders                  # All orders (paginated, filterable)
PUT    /admin/orders/:id/status       # Update order status
```

### Reports

```http
GET /admin/reports/sales              # Sales report (date range)
GET /admin/reports/inventory          # Inventory report
GET /admin/reports/customers          # Customer analytics
```

### Audit Logs

```http
GET /admin/audit                      # All admin actions (paginated)
```

## Error Handling

All errors return a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

Common HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Validation error
- `401` — Unauthorized
- `403` — Forbidden (wrong role)
- `404` — Not found
- `429` — Rate limited
- `500` — Internal server error

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Global | 100 req/min per IP |
| Auth (login/register) | 10 req/min per IP |
| Admin | 200 req/min per IP |
| WebSocket | 60 messages/min per connection |
