# Jcom POS API Reference

This document is the frontend integration contract for the Express API. It describes the current routes, authentication, request shapes, query/path parameters, response envelopes, validation behavior, and known runtime caveats.

## 1. Base URL and conventions

### Base URL

The application mounts all routes under `/api`.

| Environment | Base URL |
|---|---|
| Local development | `http://localhost:3000/api` |
| Custom local port | `http://localhost:<PORT>/api` |
| Production | `https://<your-api-domain>/api` |

`PORT` defaults to `3000`. The frontend should keep the base URL in an environment variable, for example:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### Request headers

```http
Content-Type: application/json
Authorization: Bearer <accessToken>
```

For CSV endpoints, do not parse the response as JSON. The response has `Content-Type: text/csv` and an attachment filename.

### Success envelope

Most JSON endpoints return:

```json
{
  "success": true,
  "data": {}
}
```

Mutation endpoints that only return a message use:

```json
{
  "success": true,
  "message": "Resource deleted successfully"
}
```

### Error envelope

All handled errors use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Common status codes

| Status | Meaning | Typical codes/messages |
|---:|---|---|
| `200` | Request succeeded | Normal reads, updates, login, refresh, delete messages |
| `201` | Resource created | Register, create user/customer/product/category/brand/supplier, create sale draft, returns, payments, stock operations, purchase orders |
| `400` | Invalid payload, query, path, or business rule | `VALIDATION_ERROR`, `APP_ERROR`, `PASSWORD_MISMATCH`, invalid stock/payment/discount rules |
| `401` | Authentication failed or session is invalid | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `USER_INACTIVE`, `INVALID_REFRESH_TOKEN`, `SESSION_REVOKED`, `SESSION_EXPIRED` |
| `403` | User lacks required permission | `FORBIDDEN`, `Insufficient access` |
| `404` | Requested resource does not exist | `NOT_FOUND`, `COMPANY_NOT_FOUND`, `USER_NOT_FOUND`, `PRODUCT_NOT_FOUND`, or module-specific not-found code |
| `409` | Resource conflicts with existing data or state | `EMAIL_ALREADY_EXISTS`, duplicate SKU/name, invalid state transition |
| `500` | Unexpected server/database/integration failure | `INTERNAL_SERVER_ERROR` |

Validation errors return the first Zod validation message in `error.message`, so the frontend should display the server message rather than depend only on the code.

## 2. Authentication

### `POST /auth/register`

Creates a company, its initial Admin user, a walk-in customer, and an initial session.

**Auth:** Public  
**Success:** `201`

```json
{
  "company": {
    "name": "Harbor & Pine Market",
    "phone": "+27 11 555 0100",
    "email": "owner@example.com",
    "countryCode": "ZA",
    "currencyCode": "ZAR",
    "timezone": "Africa/Johannesburg"
  },
  "admin": {
    "fullName": "Store Admin",
    "email": "admin@example.com",
    "password": "StrongPassword123!"
  }
}
```

Required: `company.name`, `admin.fullName`, `admin.email`, `admin.password` (8-128 characters). Company email, phone, country, currency, and timezone are optional.

**Response data:** `{ user, company, accessToken, refreshToken }`.

**Errors:** `400 VALIDATION_ERROR`; `409` if company/admin uniqueness conflicts; `500 INTERNAL_SERVER_ERROR`.

### `POST /auth/login`

**Auth:** Public  
**Success:** `200`

```json
{
  "companyId": "uuid",
  "email": "admin@example.com",
  "password": "StrongPassword123!"
}
```

**Response data:** `{ user, company, accessToken, refreshToken }`.

**Errors:**

| Status | Code | Message |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Invalid request |
| `401` | `INVALID_CREDENTIALS` | Invalid email or password |
| `401` | `USER_INACTIVE` | User is inactive |

### `POST /auth/refresh`

**Auth:** Public, but requires a valid refresh token.  
**Success:** `200`

```json
{ "refreshToken": "<refreshToken>" }
```

**Response data:** `{ accessToken, refreshToken }`. Refresh rotates the session token.

| Status | Code | Message |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Invalid request |
| `401` | `INVALID_REFRESH_TOKEN` | Invalid refresh token |
| `401` | `SESSION_REVOKED` | Session has been revoked |
| `401` | `SESSION_EXPIRED` | Session has expired |
| `401` | `USER_INACTIVE` | User is inactive |

### `POST /auth/logout`

**Auth:** Required  
**Success:** `200`

```json
{ "refreshToken": "<refreshToken>" }
```

Response:

```json
{ "success": true, "message": "Logged out successfully" }
```

`logout` is idempotent for an unknown or already-revoked refresh token.

### `GET /auth/me`

**Auth:** Required  
**Success:** `200`  
**Response data:** `{ user, company }`.

Errors: `401 UNAUTHORIZED` — `Authentication required` or `User is inactive or no longer exists`.

### `PATCH /auth/change-password`

**Auth:** Required  
**Success:** `200`

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

Response message: `Password changed successfully`. Existing user sessions are revoked, so the frontend must use the newly issued login/refresh flow afterwards.

Errors: `400 PASSWORD_MISMATCH` — `Current password is incorrect`; `400 VALIDATION_ERROR`.

## 3. Company and administration

Permission names used below are values from the `Access` enum: `SETTINGS`, `USERS_ROLES`.

### `GET /company`

**Auth:** Required; `SETTINGS`  
**Success:** `200`  
**Response data:** Company profile/settings object.

Errors: `404 COMPANY_NOT_FOUND` — `Company not found`.

### `PATCH /company`

**Auth:** Required; `SETTINGS`  
**Success:** `200`

Accepts any subset of:

```json
{
  "name": "Harbor & Pine Market",
  "phone": "+27 11 555 0100",
  "email": "owner@example.com",
  "logoKey": "companies/<companyId>/logo/logo.png",
  "addressLine1": "1 Main Street",
  "addressLine2": "Suite 2",
  "city": "Johannesburg",
  "state": "GP",
  "postalCode": "2001",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "timezone": "Africa/Johannesburg",
  "defaultTaxRate": 15,
  "dateFormat": "yyyy-MM-dd",
  "timeFormat": "24",
  "lowStockAlerts": true,
  "showProductImages": true,
  "autoGenerateInvoiceNumber": true,
  "autoPrintInvoice": false,
  "takealotSellerId": "seller-id",
  "takealotApiKey": "secret"
}
```

Errors: `400 VALIDATION_ERROR`; `404 COMPANY_NOT_FOUND`.

### `GET /company/users?page=1&limit=20`

**Auth:** Required; `USERS_ROLES`  
**Success:** `200`  
**Response data:** `{ items: User[], pagination: { page, limit, total, totalPages } }`.

`page` is at least `1`; `limit` is `1-100`.

### `POST /company/users`

**Auth:** Required; `USERS_ROLES`  
**Success:** `201`

```json
{
  "fullName": "Cashier One",
  "email": "cashier@example.com",
  "phone": "+27 82 000 0000",
  "password": "Password123!",
  "roleName": "Cashier",
  "accesses": ["POS", "PRODUCTS"]
}
```

`fullName`, `email`, `password`, `roleName`, and at least one `accesses` value are required.

Errors: `400 VALIDATION_ERROR`; `409 EMAIL_ALREADY_EXISTS` — `Email already exists`.

### `PATCH /company/users/:userId`

**Auth:** Required; `USERS_ROLES`  
**Success:** `200`

```json
{
  "fullName": "Updated Name",
  "phone": "+27 82 000 0000",
  "roleName": "Manager",
  "accesses": ["POS", "REPORT_SALES"],
  "isActive": true
}
```

All fields are optional. Errors: `400 VALIDATION_ERROR`; `403 FORBIDDEN` — `The final active Admin cannot be deactivated`; `404 USER_NOT_FOUND` — `User not found`.

### `DELETE /company/users/:userId`

**Auth:** Required; `USERS_ROLES`  
**Success:** `200`

```json
{ "success": true, "message": "User deactivated successfully" }
```

Errors: `403 FORBIDDEN` — final active Admin cannot be deactivated; `404 USER_NOT_FOUND`.

### `GET /company/accesses`

**Auth:** Required; `USERS_ROLES`  
**Success:** `200`  
**Response data:** Array of all predefined `Access` permission strings.

## 4. Catalog

Permission names: categories use `CATEGORIES`; brands use `BRANDS`; products and product media use `PRODUCTS`.

### Category endpoints

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/catalog/categories` | 200 | `page`, `limit`, `search`, `parentId`, `includeChildren=true|false` | `{ items: Category[], pagination }` |
| `GET` | `/catalog/categories/:id` | 200 | UUID path parameter | `Category` |
| `POST` | `/catalog/categories` | 201 | `{ name, description?, parentId? }` | Created `Category` |
| `PATCH` | `/catalog/categories/:id` | 200 | Any subset of create fields | Updated `Category` |
| `DELETE` | `/catalog/categories/:id` | 200 | UUID path parameter | Message `Category deleted successfully` |

Category fields: `name` is required and max 150 characters; `description` max 1000; `parentId` is nullable UUID.

### Category logo endpoints

| Method | Path | Success | Payload | Response |
|---|---|---:|---|---|
| `POST` | `/catalog/categories/:id/logo/upload-url` | 200 | `{ "contentType": "image/jpeg" }` | Presigned upload URL/key object |
| `PATCH` | `/catalog/categories/:id/logo` | 200 | `{ "logoKey": "companies/<id>/categories/<id>/logo.png" }` | Updated category |
| `DELETE` | `/catalog/categories/:id/logo` | 200 | None | Message `Category logo removed successfully` |

Allowed image types: `image/jpeg`, `image/png`, `image/webp`.

### Brand endpoints

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/catalog/brands` | 200 | `page`, `limit`, `search`, `sortBy=name|createdAt`, `sortOrder=asc|desc` | `{ items: Brand[], pagination }` |
| `GET` | `/catalog/brands/:id` | 200 | UUID path parameter | `Brand` |
| `POST` | `/catalog/brands` | 201 | `{ name, description? }` | Created `Brand` |
| `PATCH` | `/catalog/brands/:id` | 200 | Any subset of brand fields | Updated `Brand` |
| `DELETE` | `/catalog/brands/:id` | 200 | UUID path parameter | Message `Brand deleted successfully` |

### Brand logo endpoints

| Method | Path | Success | Payload | Response |
|---|---|---:|---|---|
| `POST` | `/catalog/brands/:id/logo/upload-url` | 200 | `{ "contentType": "image/jpeg" }` | Presigned upload URL/key object |
| `PATCH` | `/catalog/brands/:id/logo` | 200 | `{ "logoKey": "companies/<id>/brands/<id>/logo.png" }` | Updated brand |
| `DELETE` | `/catalog/brands/:id/logo` | 200 | None | Message `Brand logo removed successfully` |

### Product endpoints

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/catalog/products` | 200 | `page`, `limit`, `search`, `categoryId`, `brandId`, `supplierId`, `lowStock=true|false`, `sortBy=name|sellingPrice|stockQuantity|createdAt`, `sortOrder=asc|desc`, `includeInactive=true|false` | `{ items: Product[], pagination }` |
| `GET` | `/catalog/products/:id` | 200 | UUID path parameter | `Product` |
| `POST` | `/catalog/products` | 201 | Product create payload | Created `Product` |
| `PATCH` | `/catalog/products/:id` | 200 | Any subset of product create fields | Updated `Product` |
| `DELETE` | `/catalog/products/:id` | 200 | UUID path parameter | Message `Product deleted successfully` |

Product create payload:

```json
{
  "name": "USB-C Charger",
  "sku": "CHG-001",
  "barcode": "6001234567890",
  "description": "65W fast charger",
  "categoryId": "uuid",
  "brandId": "uuid",
  "supplierId": "uuid",
  "rrp": 499.99,
  "sellingPrice": 399.99,
  "purchaseCost": 250,
  "lowStockThreshold": 5,
  "warrantyMonths": 12,
  "productCode": "CHG-001",
  "takealotProductId": "6001234567890",
  "takealotSync": false
}
```

Required: `name`, `sku`, `categoryId`, `rrp`, `sellingPrice`, `purchaseCost`. Prices are non-negative. `warrantyMonths` is `0-1200`.
`takealotProductId` stores the selected Takealot offer's barcode, even when the offer was found by SKU or offer ID.

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/catalog/takealot/offers` | 200 | `type=BARCODE|SKU|OFFER_ID`, `query` (minimum 3 characters) | Matching offer's title, barcode, SKU, offer ID, price, RRP, image preview URL, Takealot URL, and merchant stock; `null` if not found |
| `GET` | `/catalog/takealot/offers/image` | 200 | `imageUrl` (URL returned by the offer lookup) | Offer image binary (`image/jpeg`, `image/png`, or `image/webp`); image bytes are validated before import |

### Product image endpoints

| Method | Path | Success | Payload | Response |
|---|---|---:|---|---|
| `POST` | `/catalog/products/:id/images/upload-urls` | 200 | `{ "contentTypes": ["image/jpeg", "image/png"] }` | `{ uploads: [...] }` |
| `POST` | `/catalog/products/:id/images` | 200 | `{ "imageKeys": ["companies/<id>/products/<id>/file.jpg"] }` | Updated image keys/product |
| `PATCH` | `/catalog/products/:id/images` | 200 | `{ "imageKeys": ["existing-key-1", "existing-key-2"] }` | Reordered image keys/product |
| `DELETE` | `/catalog/products/:id/images` | 200 | `{ "imageKey": "companies/<id>/products/<id>/file.jpg" }` | Updated image keys/product |
| `GET` | `/catalog/products/:id/images/:imageIndex/url` | 200 | `imageIndex` is zero-based integer | `{ url, expiresIn? }` or media URL object |

`imageKeys` must contain storage keys, not Unsplash URLs. The frontend should use the generated URL endpoint for private S3 media.

## 5. Customers

Permission: `CUSTOMERS`.

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/customers` | 200 | `page`, `limit`, `search`, `isWalkIn=true|false`, `hasBalance=true|false`, `includeInactive=true|false`, `sortBy=name|createdAt|creditBalance`, `sortOrder=asc|desc` | `{ items: Customer[], pagination }` |
| `GET` | `/customers/:id` | 200 | UUID path parameter | `Customer` |
| `POST` | `/customers` | 201 | Customer create payload | Created `Customer` |
| `PATCH` | `/customers/:id` | 200 | Any subset of create fields | Updated `Customer` |
| `DELETE` | `/customers/:id` | 200 | UUID path parameter | Message `Customer deleted successfully` |
| `POST` | `/customers/:id/profile/upload-url` | 200 | `{ "contentType": "image/jpeg" }` | Presigned upload URL/key |
| `PATCH` | `/customers/:id/profile` | 200 | `{ "profileImageKey": "companies/<id>/customers/<id>/profile.jpg" }` | Updated customer |
| `DELETE` | `/customers/:id/profile` | 200 | None | Message `Profile image removed successfully` |
| `GET` | `/customers/:id/profile/url` | 200 | None | Profile media URL object |
| `POST` | `/customers/:id/payments` | 201 | Customer payment payload | Created payment |
| `GET` | `/customers/:id/payments` | 200 | `page`, `limit`, `from`, `to` ISO datetimes | `{ items: Payment[], pagination }` |

Customer create payload:

```json
{
  "name": "Jane Customer",
  "phone": "+27 82 000 0000",
  "email": "jane@example.com",
  "customerType": "Retail",
  "addressLine1": "1 Main Street",
  "addressLine2": null,
  "city": "Johannesburg",
  "state": "GP",
  "postalCode": "2001",
  "creditLimit": 2500
}
```

Customer payment payload:

```json
{
  "invoiceId": "sale-uuid",
  "amount": 500,
  "paymentMethod": "CASH",
  "reference": "RECEIPT-1001",
  "notes": "Payment received"
}
```

Allowed customer payment methods: `CASH`, `CARD`.

## 6. Inventory

Permission: `INVENTORY`.

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/inventory` | 200 | `page`, `limit`, `search`, `categoryId`, `brandId`, `lowStock=true|false`, `outOfStock=true|false`, `sortBy=name|stockQuantity|createdAt`, `sortOrder=asc|desc` | `{ items: InventoryItem[], pagination }` |
| `GET` | `/inventory/summary` | 200 | None | `{ totalProducts, totalUnits, lowStockProducts, outOfStockProducts, inventoryValue }` |
| `GET` | `/inventory/:productId` | 200 | UUID path parameter | `InventoryItem` |
| `GET` | `/inventory/:productId/movements` | 200 | `page`, `limit`, `movementType`, `from`, `to` ISO datetimes | `{ items: Movement[], pagination }` |
| `POST` | `/inventory/opening-stock` | 201 | Opening stock payload | Created movement/product inventory |
| `POST` | `/inventory/adjust` | 201 | Adjustment payload | Created movements and updated inventory |

Opening stock:

```json
{
  "productId": "uuid",
  "quantity": 50,
  "unitCost": 125.5,
  "note": "Initial count"
}
```

Adjustment:

```json
{
  "items": [
    {
      "productId": "uuid",
      "action": "ADD",
      "quantity": 5,
      "unitCost": 125.5,
      "reason": "Stock correction",
      "note": "Counted in store"
    }
  ]
}
```

`action` is `ADD` or `REMOVE`; adjustment quantity must be greater than zero. Removing more stock than available returns a module business error.

## 7. Sales

Permissions: POS operations use `POS`; reading sales/invoices uses both `POS` and `INVOICES`; returns use `RETURNS`.

### Sale lifecycle

1. Create a draft with `POST /sales/drafts`.
2. Modify it with `PATCH /sales/:id/draft`.
3. Complete it with `POST /sales/:id/complete`.
4. Read it with `GET /sales/:id`.
5. Cancel a draft with `POST /sales/:id/cancel`.

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `POST` | `/sales/drafts` | 201 | Sale draft payload | Sale draft |
| `PATCH` | `/sales/:id/draft` | 200 | Partial sale draft payload | Updated sale draft |
| `GET` | `/sales` | 200 | `page`, `limit`, `search`, `customerId`, `paymentStatus`, `status`, `source`, `from`, `to`, `sortBy=soldAt|invoiceNumber|total|createdAt`, `sortOrder=asc|desc` | `{ items: Sale[], pagination }` |
| `GET` | `/sales/:id` | 200 | UUID path parameter | Sale with items/payments |
| `POST` | `/sales/:id/complete` | 200 | Completion payload | Completed sale/invoice |
| `POST` | `/sales/:id/cancel` | 200 | UUID path parameter | Cancelled sale |

Sale draft payload:

```json
{
  "source": "POS",
  "customerId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ],
  "taxRate": 15,
  "discountType": "PERCENT",
  "discountValue": 10,
  "notes": "Customer note"
}
```

`source` defaults to `POS`; `customerId` may be `null`; items must contain at least one item with positive quantities.

Completion payload:

```json
{
  "taxRate": 15,
  "discountType": "PERCENT",
  "discountValue": 10,
  "payments": [
    {
      "paymentMethod": "CARD",
      "amount": 500,
      "reference": "CARD-1001"
    }
  ],
  "customerId": "uuid",
  "notes": "Paid at counter"
}
```

Payment methods are Prisma enum values, normally `CASH`, `CARD`, or `STORE_CREDIT`; the completion validator accepts all current `PaymentMethod` enum values. Discount types are `PERCENT` or `FIXED`.

Errors include: `400 VALIDATION_ERROR`, `400 DISCOUNT_EXCEEDS_TOTAL` — `Discount cannot exceed total`, insufficient stock/state-transition errors, `404` sale/product not found, and `409` conflicts when a sale is already completed/cancelled.

### Returns

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/sales/returns` | 200 | `page`, `limit`, `search`, `refundType`, `from`, `to` | `{ items: Return[], pagination }` |
| `GET` | `/sales/:id/returnable-items` | 200 | Sale UUID | Returnable sale items |
| `POST` | `/sales/:id/returns` | 201 | Return payload | Created return |
| `GET` | `/sales/:id/returns` | 200 | Sale UUID | Returns for sale |

Return payload:

```json
{
  "refundType": "CASH",
  "reason": "Damaged item",
  "notes": "Customer returned packaging",
  "items": [
    { "saleItemId": "uuid", "quantity": 1 }
  ]
}
```

`refundType` is a Prisma `RefundType` enum value. Duplicate sale-item entries are aggregated before validation. Returning more than the remaining returnable quantity returns a `400` business error.

## 8. Purchases and suppliers

Permissions: suppliers use `SUPPLIERS`; purchase orders/payments use `PURCHASES`.

### Supplier endpoints

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `GET` | `/purchases/suppliers` | 200 | `page`, `limit`, `search`, `includeInactive=true|false` | `{ items: Supplier[], pagination }` |
| `GET` | `/purchases/suppliers/:id` | 200 | Supplier UUID | `Supplier` |
| `POST` | `/purchases/suppliers` | 201 | Supplier create payload | Created `Supplier` |
| `PATCH` | `/purchases/suppliers/:id` | 200 | Partial supplier payload | Updated `Supplier` |
| `DELETE` | `/purchases/suppliers/:id` | 200 | Supplier UUID | Message `Supplier deleted successfully` |

Supplier payload fields: `name` required; optional `contactPerson`, `phone`, `email`, `website`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `paymentTermsDays`, `creditLimit`, `bankName`, `accountName`, and `accountNumber`.

### Purchase order endpoints

| Method | Path | Success | Request/query | Response |
|---|---|---:|---|---|
| `POST` | `/purchases` | 201 | Purchase create payload | Created purchase order |
| `PATCH` | `/purchases/:id` | 200 | Partial purchase payload | Updated purchase order |
| `GET` | `/purchases` | 200 | `page`, `limit`, `search`, `supplierId`, `status`, `from`, `to`, `sortBy=orderDate|poNumber|total|createdAt`, `sortOrder=asc|desc` | `{ items: PurchaseOrder[], pagination }` |
| `GET` | `/purchases/:id` | 200 | Purchase UUID | Purchase order with items |
| `POST` | `/purchases/:id/receive` | 200 | Receive payload | Updated purchase order/inventory |
| `POST` | `/purchases/:id/cancel` | 200 | Purchase UUID | Cancelled purchase order |
| `GET` | `/purchases/:id/payments` | 200 | `page`, `limit` | `{ items: SupplierPayment[], pagination }` |
| `POST` | `/purchases/:id/payments` | 201 | Supplier payment payload | Created supplier payment |

Purchase create payload:

```json
{
  "supplierId": "uuid",
  "expectedDate": "2026-10-15",
  "taxRate": 15,
  "notes": "October replenishment",
  "items": [
    { "productId": "uuid", "quantity": 20, "unitCost": 125.5 }
  ]
}
```

Receive payload:

```json
{
  "items": [
    { "purchaseOrderItemId": "uuid", "quantityReceived": 20 }
  ],
  "notes": "Received in good condition"
}
```

Supplier payment payload:

```json
{
  "amount": 2500,
  "paymentMethod": "BANK_TRANSFER",
  "reference": "BANK-1001",
  "notes": "Payment against PO"
}
```

Purchase statuses: `DRAFT`, `PENDING`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`. Supplier payment methods: `CASH`, `CARD`, `BANK_TRANSFER`, `OTHER`.

## 9. Reports

All report endpoints require `Authorization`, plus one report permission:

| Report area | Permission |
|---|---|
| Sales | `REPORT_SALES` |
| Inventory/customer | `REPORT_INVENTORY_CUSTOMER` |
| Profit/loss | `REPORT_PROFIT_LOSS` |

Common dashboard query parameters:

| Parameter | Format | Default |
|---|---|---|
| `from` | `YYYY-MM-DD` | 29 days before today |
| `to` | `YYYY-MM-DD` | Today |
| `categoryId` | UUID | None |
| `paymentMethod` | `CASH`, `CARD`, `STORE_CREDIT` | None |
| `customerType` | String | None |
| `granularity` | `DAY`, `WEEK`, `MONTH` | `DAY` |

Paginated report endpoints also accept `page` (`1+`), `limit` (`1-100`), and `search`.

| Method | Path | Success | Response |
|---|---|---:|---|
| `GET` | `/reports/sales` | 200 | Sales KPIs, trend, category/payment breakdowns, top products, recent sales |
| `GET` | `/reports/sales/transactions` | 200 | `{ items, pagination }` |
| `GET` | `/reports/sales/export` | 200 | CSV attachment `sales.csv` |
| `GET` | `/reports/inventory-customer` | 200 | Inventory KPIs and stock status |
| `GET` | `/reports/inventory-customer/low-stock` | 200 | `{ items, pagination }` |
| `GET` | `/reports/inventory-customer/top-customers` | 200 | `{ items }` |
| `GET` | `/reports/inventory-customer/recent-customers` | 200 | `{ items }` |
| `GET` | `/reports/inventory-customer/export` | 200 | CSV attachment `inventory-customer.csv` |
| `GET` | `/reports/profit-loss` | 200 | Revenue, cost, expenses, net profit, expense breakdown |
| `GET` | `/reports/profit-loss/top-products` | 200 | `{ items }` |
| `GET` | `/reports/profit-loss/top-expenses` | 200 | Expense breakdown array |
| `GET` | `/reports/profit-loss/recent-expenses` | 200 | `{ items }` |
| `GET` | `/reports/profit-loss/export` | 200 | CSV attachment `profit-loss.csv` |

If `from` is later than `to`, the endpoint returns `400 VALIDATION_ERROR` with message `REPORT_INVALID_DATE_RANGE`. Invalid date format returns `400 VALIDATION_ERROR`.

## 10. Response models and frontend handling

### Pagination

All list endpoints use:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### IDs and dates

- All entity IDs are UUID strings.
- Query UUIDs and path UUIDs must be valid UUIDs.
- Report dates are `YYYY-MM-DD`.
- Customer payment and inventory movement date filters use ISO datetime strings.
- JSON timestamps are serialized by Express/Prisma as ISO date-time strings.

### Money and quantities

The service converts Prisma decimal values to JavaScript numbers in response views. Treat monetary values as numbers for the current API, but format them in the frontend using the company currency. Inventory quantities may be fractional.

### Media

The database fields `imageKeys`, `logoKey`, and `profileImageKey` are storage keys. They are not browser URLs. Use the relevant upload-url endpoint, upload the binary to the returned presigned URL, save the returned key, and then request a download URL:

```text
POST upload-url -> PUT file to presigned URL -> PATCH resource with key -> GET .../url
```

Do not store Unsplash URLs in `imageKeys`.

## 11. Error handling example

```ts
const response = await fetch(`${API_BASE_URL}/catalog/products`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

const body = await response.json();

if (!response.ok || body.success === false) {
  const code = body.error?.code ?? "UNKNOWN_ERROR";
  const message = body.error?.message ?? "Request failed";
  throw new Error(`${code}: ${message}`);
}
```

## 12. Current implementation caveats

These are important for integration and should be fixed before production:

1. For local testing, `TEST_AUTH_BYPASS=true` injects the fixed test identity into every protected route and grants every `Access` permission. The bypass is disabled automatically when `NODE_ENV=production`, unless the environment is misconfigured to explicitly enable it; production deployments must set `TEST_AUTH_BYPASS=false`.
2. The intended production contract is still Bearer-token authentication with tenant scoping and permission checks. The testing bypass must not be treated as production behavior.
3. The API currently has no generated OpenAPI/Swagger document. This Markdown file is manually derived from the route and Zod schemas.

## 13. Complete route index

The following is the complete current route index:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/change-password

GET    /api/company
PATCH  /api/company
GET    /api/company/users
POST   /api/company/users
PATCH  /api/company/users/:userId
DELETE /api/company/users/:userId
GET    /api/company/accesses

GET    /api/catalog/categories
GET    /api/catalog/categories/:id
POST   /api/catalog/categories
PATCH  /api/catalog/categories/:id
DELETE /api/catalog/categories/:id
POST   /api/catalog/categories/:id/logo/upload-url
PATCH  /api/catalog/categories/:id/logo
DELETE /api/catalog/categories/:id/logo
GET    /api/catalog/brands
GET    /api/catalog/brands/:id
POST   /api/catalog/brands
PATCH  /api/catalog/brands/:id
DELETE /api/catalog/brands/:id
POST   /api/catalog/brands/:id/logo/upload-url
PATCH  /api/catalog/brands/:id/logo
DELETE /api/catalog/brands/:id/logo
GET    /api/catalog/products
GET    /api/catalog/products/:id
POST   /api/catalog/products
PATCH  /api/catalog/products/:id
DELETE /api/catalog/products/:id
POST   /api/catalog/products/:id/images/upload-urls
POST   /api/catalog/products/:id/images
PATCH  /api/catalog/products/:id/images
DELETE /api/catalog/products/:id/images
GET    /api/catalog/products/:id/images/:imageIndex/url

GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PATCH  /api/customers/:id
DELETE /api/customers/:id
POST   /api/customers/:id/profile/upload-url
PATCH  /api/customers/:id/profile
DELETE /api/customers/:id/profile
GET    /api/customers/:id/profile/url
POST   /api/customers/:id/payments
GET    /api/customers/:id/payments

GET    /api/inventory
GET    /api/inventory/summary
GET    /api/inventory/:productId
GET    /api/inventory/:productId/movements
POST   /api/inventory/opening-stock
POST   /api/inventory/adjust

POST   /api/sales/drafts
PATCH  /api/sales/:id/draft
GET    /api/sales
GET    /api/sales/:id
POST   /api/sales/:id/complete
POST   /api/sales/:id/cancel
GET    /api/sales/returns
GET    /api/sales/:id/returnable-items
POST   /api/sales/:id/returns
GET    /api/sales/:id/returns

GET    /api/purchases/suppliers
GET    /api/purchases/suppliers/:id
POST   /api/purchases/suppliers
PATCH  /api/purchases/suppliers/:id
DELETE /api/purchases/suppliers/:id
POST   /api/purchases
PATCH  /api/purchases/:id
GET    /api/purchases
GET    /api/purchases/:id
POST   /api/purchases/:id/receive
POST   /api/purchases/:id/cancel
GET    /api/purchases/:id/payments
POST   /api/purchases/:id/payments

GET    /api/reports/sales
GET    /api/reports/sales/transactions
GET    /api/reports/sales/export
GET    /api/reports/inventory-customer
GET    /api/reports/inventory-customer/low-stock
GET    /api/reports/inventory-customer/top-customers
GET    /api/reports/inventory-customer/recent-customers
GET    /api/reports/inventory-customer/export
GET    /api/reports/profit-loss
GET    /api/reports/profit-loss/top-products
GET    /api/reports/profit-loss/top-expenses
GET    /api/reports/profit-loss/recent-expenses
GET    /api/reports/profit-loss/export
```
