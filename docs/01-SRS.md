# Document A: Software Requirements Specification (SRS)

**Project:** Inventory Management System (backend)
**Version:** 0.1 (draft for review) **Date:** 2026-10-14
**Companion documents:** `02-API-Specification.md`, `03-Free-Tools-and-Infrastructure.md`, `04-Implementation-Roadmap.md`
**Baseline reference:** `Inventory-DB-Review-and-ERD.md` (29 tables: your 28 plus `InventoryAdjustmentItem`)

---

## 0. How to read this document

### 0.1 Source tags

Every requirement, rule, or decision carries one of these tags so you can see where it came from.

| Tag | Meaning |
|---|---|
| **[D]** | Derived from your design: a table or field in your Excalidraw design or in the reviewed ERD (`Inventory-DB-Review-and-ERD.md`). |
| **[R]** | My recommendation, added by this SRS. Each has a reason stated next to it. |
| **[A]** | An assumption I made because the design was silent. Listed in section 4; please confirm or change it. |
| **[F]** | Optional future enhancement. Outside the mandatory scope. |

### 0.2 Requirement IDs and phases

IDs look like `FR-INV-04` (functional), `INV-07` (business invariant), `NFR-SEC-02` (non-functional), `AC-12` (acceptance criterion). The **Ph** column gives the implementation phase from `04-Implementation-Roadmap.md`. **The MVP is Phases 0 to 5.**

### 0.3 What "baseline" means

Your design is treated as the baseline. The database review proposed corrections (typed foreign keys, uniqueness, CHECK constraints, snapshots). This SRS **assumes those corrections are accepted** and builds on the reviewed ERD. Nothing from your original entity list has been dropped. Where this SRS needs something the ERD does not have, it is listed in section 5.2 ("schema deltas"), and there are only three.

---

## 1. Project overview

### 1.1 Purpose

A backend system that models realistic warehouse-based inventory operations: buying stock from suppliers, holding it in one or more warehouses, moving it between warehouses, selling and shipping it to customers, taking payments and refunds, and handling returns. Every change to stock is recorded in an append-only ledger so any quantity can be explained and audited.

### 1.2 Objectives

| ID | Objective | Why it matters |
|---|---|---|
| O1 | Stock quantities are always correct: never negative, never oversold, always explainable by the ledger. | This is the core promise of an inventory system and the strongest engineering signal in the project. |
| O2 | Multi-step business flows (receive, reserve, ship, transfer, return, refund) are transactional and safe under concurrency. | Demonstrates transaction management, which basic CRUD does not. |
| O3 | Duplicate requests and replayed webhooks never create duplicate effects. | Real clients retry; payment providers retry. |
| O4 | Access is role-based and enforced on the backend. | An inventory system holds sensitive business data. |
| O5 | History stays understandable after master data changes (price, name, address). | Needed for audit and customer disputes. |
| O6 | The whole project costs **zero** to build, test, document, and demonstrate. | Your hard budget constraint. |
| O7 | API contracts are stable and documented before the frontend is built. | Lets the frontend be built separately. |
| O8 | The project works fully locally even if every free hosted tier disappears. | Hosted free tiers change terms. |

### 1.3 Target users

| User | What they do | Role (section 9) |
|---|---|---|
| System administrator | Manages users, warehouses, approves purchase orders, can do everything. | ADMIN |
| Inventory / warehouse manager | Adjusts stock, runs transfers, receives goods, reconciles. | INVENTORY_MANAGER |
| Procurement officer | Manages suppliers and purchase orders, receives goods. | PROCUREMENT |
| Fulfillment / sales officer | Manages customers, sales orders, shipments, payments, returns. | FULFILLMENT |
| Read-only user | Views everything except audit logs and user administration. | VIEWER |
| Frontend client (future) | A separate web app calling this API. | n/a |
| Payment provider simulator | Sends signed webhook events during development. | n/a (signature auth) |

### 1.4 Expected outcome

A running, tested, documented backend with an OpenAPI contract, a migration-managed PostgreSQL schema, and an automated test suite that proves the invariants in section 8, including concurrency tests against a real PostgreSQL database.

---

## 2. Scope and exclusions

### 2.1 In scope

Authentication and staff user administration; product catalog and categories; warehouses; suppliers; customers and addresses; inventory balances, ledger, adjustments, reservations, reconciliation; procurement (purchase orders, goods receipts); warehouse transfers; sales orders and fulfillment (shipments); payments and refunds (manual and simulated); returns; audit logging; idempotency; observability basics.

### 2.2 Explicitly out of scope (kept out on purpose)

| Excluded | Reason |
|---|---|
| Customer self-service login, storefront, shopping cart | `User` is staff only **[D]**. Customers are records, not accounts. |
| Public self-registration | Inventory systems are internal. See FR-AUTH-01. |
| Real payment processing | Cannot be verified free and risks being mistaken for real money handling. Simulated and manual payments only (section 6.9). |
| Email, SMS, push notifications | Paid providers excluded; no password-reset emails (admin resets passwords). |
| Taxes, multi-currency, promotions | Not justified by the core goal **[F]**. One currency, discounts as plain amounts. |
| Backorders, partial reservation | An order is reserved in full or not at all **[A]**. |
| Batch/lot, expiry, serial numbers, bin locations | **[F]** from the DB review section 2.3. |
| Reorder points, demand forecasting | **[F]** |
| Carrier integrations, label printing, geocoding | Paid or key-gated APIs excluded. `carrier` and `trackingNo` are free text. |
| Supplier-product price catalog | **[F]**. PO lines carry `unitCost` directly. |
| Microservices, Redis, message broker, Kubernetes | No demonstrated need. Modular monolith. |
| Frontend | Built separately later. |

---

## 3. Stakeholders

| Stakeholder | Interest |
|---|---|
| Project owner (you) | A portfolio-grade backend with explainable engineering decisions, at zero cost. |
| Reviewers / hiring managers | Evidence of transaction design, concurrency safety, testing, security, documentation. |
| Warehouse, procurement, sales staff (modelled by roles) | Correct stock, simple workflows. |
| Future frontend developer (you, later) | Stable, consistent, documented API. |

---

## 4. Assumptions and unresolved decisions

The first seven rows are your open decisions from the DB review (section 7). I state a provisional assumption for each so work is not blocked. **Please confirm or change any row**; the "if changed" column shows the cost.

| ID | Decision | Provisional assumption | Tag | If you change it |
|---|---|---|---|---|
| D-01 | IDs, currency, money type | UUID IDs. One system currency (configurable code, default `USD` in examples). Money is `Int` in minor units; totals capped at about 21.4 million major units, which is plenty for a portfolio. | [A] | Moving to `BigInt` means changing Prisma types and JSON serialization (BigInt does not serialize to JSON natively). |
| D-02 | Same product twice on one order or PO | **Not allowed.** One line per product per document (composite unique). | [A] | Drop the composite unique; change eligibility math to per-line (already per-line). |
| D-03 | Over-receiving against a PO | **Not allowed.** Cumulative **accepted** quantity must not exceed ordered quantity. Rejected units do not count toward fulfillment. | [A] | Add an `overReceiptTolerancePercent` setting and relax the CHECK. |
| D-04 | Receipt warehouse | A goods receipt must go to the PO's warehouse. | [A] | Allow override with a permission; no schema change. |
| D-05 | Transfer shortages (dispatched ≠ received) | Closing a transfer with a shortage requires choosing **WRITE_OFF** (stock is lost in transit, no further stock change) or **RETURN_TO_SOURCE** (shortage is re-added to the source warehouse). No schema change; shortage is derived. | [A] | Add an in-transit loss entity if you need loss accounting. |
| D-06 | Customer email, customer login | `Customer.email` unique. Customers do not log in. | [A] | Login would need a credentials table. |
| D-07 | Reservation expiry | Reservations expire after a configurable TTL (default 24 h) **only while the order is not fully paid**. Feature flag `RESERVATION_EXPIRY_ENABLED`, **default off until Phase 7** (payments exist). | [A] | Disable permanently, or exempt orders by customer. |
| D-08 | Authentication mechanism | **Opaque server-side sessions stored in PostgreSQL** (one new table, `UserSession`), sent as `Authorization: Bearer`. See section 6.1. | [R] | JWT alternative described in 6.1. |
| D-09 | Registration | No public registration. First ADMIN created by a seed command; ADMIN creates all other users. | [R] | n/a |
| D-10 | Approvals | Required for: purchase orders (ADMIN approves) and inventory adjustments (ADMIN or INVENTORY_MANAGER approves). Approver must differ from creator, always. Not required for transfers, refunds, returns in the initial scope. | [A] | Transfer and refund approval are listed as **[F]**. |
| D-11 | Order stock allocation | Reservation happens at order **confirmation**, not creation. All-or-nothing. If no `warehouseId` is given, each line is allocated from active warehouses in descending available quantity and may be split across warehouses. | [A] | Backorders would need a new status and partial-reservation rules. |
| D-12 | Shipped and returned counters | No cached counters on `SalesOrderItem`. Caps are enforced by locking the order line row and summing child rows. | [A] | Cached counters allow CHECK-constraint backstops at the cost of two more columns kept in sync. |
| D-13 | Stock leaves the warehouse | At **shipment dispatch**, not at shipment creation. Shipment creation (PENDING) only validates and holds quantity against the order line. | [R] | Matches `Shipment.dispatchedAt` **[D]** and allows cancelling a packed shipment without reversing stock. |
| D-14 | Return refund entitlement | Returned units that pass inspection are refundable at `floor(lineTotal × quantityReceived ÷ quantity)` per line, regardless of whether they are restocked. | [A] | Tie refunds to restocked quantity only. |
| D-15 | Return window | Returns must be requested within `RETURN_WINDOW_DAYS` (default 30) of the shipment delivery date. | [A] | Remove the check. |
| D-16 | Category depth | Maximum 5 levels. | [A] | Raise the constant. |
| D-17 | Inactive records | Inactive product/supplier/customer/warehouse cannot be used on **new** documents. Existing documents continue. Stock-correcting operations on existing stock (adjustments, transfers, returns) are still allowed for inactive products. | [A] | Tighten or relax in service-level checks. |
| D-18 | Goods receipt lifecycle | A receipt is created and posted in one atomic step (status `POSTED`). No draft state. Mistakes are fixed with an adjustment. | [A] | Add DRAFT and a post endpoint. |
| D-19 | Document numbers | Server-generated from PostgreSQL sequences, format `PREFIX-YYYY-NNNNNN` (e.g. `PO-2026-000012`). Gaps are acceptable. | [R] | Gapless numbering needs a counter table with row locking. |
| D-20 | Stock movement for reservations | Reservations do not write ledger rows; only on-hand changes do **[D]** (DB review assumption 7). | [D] | n/a |

---

## 5. Domain model summary

### 5.1 Entities by module

All entities are **[D]** unless marked.

| Module | Entities |
|---|---|
| A. Users and catalog | `User`, `ProductCategory`, `Product`, `Warehouse`, `Supplier`, `Customer`, `CustomerAddress` |
| B. Inventory | `InventoryBalance`, `StockMovement`, `Reservation`, `InventoryAdjustment`, `InventoryAdjustmentItem` (new in DB review) |
| C. Transfers | `WarehouseTransfer`, `WarehouseTransferItem` |
| D. Procurement | `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem` |
| E. Sales | `SalesOrder`, `SalesOrderItem`, `Shipment`, `ShipmentItem` |
| F. Payments | `Payment`, `Refund`, `PaymentWebhookEvent` |
| G. Returns | `Return`, `ReturnItem` |
| H. Reliability | `IdempotencyRecord`, `AuditLog` |
| Security **[R]** | `UserSession` (new) |

### 5.2 Schema deltas introduced by this SRS (on top of the reviewed ERD)

| # | Change | Reason | Tag |
|---|---|---|---|
| 1 | **New table `UserSession`**: `id`, `userId` FK, `tokenHash` (unique), `createdAt`, `expiresAt`, `lastUsedAt`. | Server-side sessions give instant revocation (disable user, logout, password change) without Redis. | [R] |
| 2 | `AuditLog.requestId` (nullable string, indexed). | Links every audit row to the request log line for debugging. | [R] |
| 3 | `User.lastLoginAt` (nullable timestamptz). | Operational visibility; optional. | [R] |

Other recommended **database-level** items, all raw SQL in migrations (Prisma cannot express them):

| Item | Reason |
|---|---|
| CHECK `PurchaseOrderItem.receivedQuantity BETWEEN 0 AND orderedQuantity`; document: `receivedQuantity` means cumulative **accepted** quantity. | Backstop for D-03. The name is misleading, so document it in the Prisma schema comment. |
| Trigger on `StockMovement` and `AuditLog` that raises an exception on UPDATE or DELETE. | Makes "append-only" true in the database, not just by convention. |
| Sequences `po_no_seq`, `receipt_no_seq`, `order_no_seq`, `shipment_no_seq`, `return_no_seq`. | D-19. |
| All CHECKs, partial uniques, and indexes listed in the DB review section 7. | Already specified there; not repeated here. |

### 5.3 Proposed enum values (reconcile with your DBML)

I have not seen your `inventory-schema.dbml` enums in this session; the values below are what this SRS requires. If your DBML differs, align one to the other before writing the Prisma schema.

| Enum | Values |
|---|---|
| `User.role` | `ADMIN`, `INVENTORY_MANAGER`, `PROCUREMENT`, `FULFILLMENT`, `VIEWER` |
| `User.status` | `ACTIVE`, `DISABLED` |
| `productStatus`, `warehouseStatus`, `supplierStatus`, `customerStatus` | `ACTIVE`, `INACTIVE` |
| `movementType` | `PURCHASE_IN`, `SHIPMENT_OUT`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`, `RETURN_IN` |
| `inventoryAdjustmentStatus` | `PENDING_APPROVAL`, `POSTED`, `REJECTED`, `CANCELLED` |
| Adjustment `reasonCode` | `OPENING_BALANCE`, `COUNT_CORRECTION`, `DAMAGE`, `LOSS`, `FOUND`, `OTHER` |
| `reservationStatus` | `ACTIVE`, `CONSUMED`, `RELEASED`, `EXPIRED` |
| `warehouseTransferStatus` | `DRAFT`, `IN_TRANSIT`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`, `CANCELLED` |
| `purchaseOrderStatus` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`, `CANCELLED` |
| `goodsReceiptStatus` | `POSTED` (`DRAFT` reserved for future) |
| `orderStatus` | `DRAFT`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| Sales `paymentStatus` | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` |
| Sales `fulfillmentStatus` | `UNFULFILLED`, `PARTIALLY_SHIPPED`, `SHIPPED`, `DELIVERED` |
| `shipmentStatus` | `PENDING`, `DISPATCHED`, `DELIVERED`, `CANCELLED` |
| Payment `provider` | `MANUAL`, `SIMULATED` (a real provider could be added later **[F]**) |
| Payment `paymentStatus` | `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| `refundStatus` | `PENDING`, `SUCCEEDED`, `FAILED` |
| Webhook `eventType` | `payment.succeeded`, `payment.failed`, `refund.succeeded`, `refund.failed` |
| Webhook `processingStatus` | `RECEIVED`, `PROCESSED`, `FAILED`, `IGNORED` |
| `returnStatus` | `REQUESTED`, `APPROVED`, `REJECTED`, `RECEIVED`, `COMPLETED`, `CANCELLED` |
| `inspectionStatus` | `PENDING`, `PASSED`, `FAILED` |
| `disposition` | `RESTOCK`, `SCRAP` |
| `idempotencyRecordStatus` | `IN_PROGRESS`, `COMPLETED` |

---

## 6. Functional requirements

Phase column **Ph**: 0 foundations, 1 auth/audit/idempotency, 2 master data, 3 inventory core, 4 procurement, 5 sales and shipping, 6 transfers, 7 payments and refunds, 8 returns, 9 hardening.

### 6.1 Authentication and authorization

**Design decision: sessions versus JWT [R].**

| | Opaque DB-backed sessions | Stateless JWT |
|---|---|---|
| Revocation (logout, disable user, role change) | Immediate: delete the row | Hard: token valid until expiry unless you add a deny-list or refresh-token table |
| Infrastructure | One table, no Redis | None for access tokens, but a safe design still needs refresh tokens, which means a table anyway |
| Per-request cost | One indexed lookup | Signature check (but you still look up the user to honor DISABLED status) |
| Fit for this project | **Strong.** You already hit the database on every request, and instant revocation matters for an admin-heavy system. | Better for multi-service or edge setups, which you excluded |
| Risks | Token theft until logout or expiry | Same, plus longer revocation lag |

**Recommendation:** use sessions only, not both. A 256-bit random token is returned once at login; only its SHA-256 hash is stored. Clients send it as `Authorization: Bearer <token>`. This works for Swagger UI, curl, and a future SPA. If a browser frontend later prefers an `HttpOnly` cookie, the same session table works unchanged **[F]**.

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-AUTH-01 | There is no public registration. The first ADMIN is created by a CLI seed command reading credentials from environment variables. All other users are created by an ADMIN. | [R] | 1 |
| FR-AUTH-02 | `POST /auth/login` verifies email and password and returns a session token, its expiry, and the user profile. | [R] | 1 |
| FR-AUTH-03 | Logout revokes the current session. | [R] | 1 |
| FR-AUTH-04 | Passwords are hashed with argon2id via `Bun.password` (Bun's built-in, no dependency). Plaintext passwords and hashes are never logged, audited, or returned. Minimum length 12, maximum 128. | [D] `passwordHash`, [R] | 1 |
| FR-AUTH-05 | Each user has exactly one role from `User.role`. | [D] | 1 |
| FR-AUTH-06 | `User.status` is `ACTIVE` or `DISABLED`. Disabled users cannot log in; disabling deletes all their sessions in the same transaction. | [D] | 1 |
| FR-AUTH-07 | Every endpoint except login, health checks, and payment webhooks requires a valid, unexpired session whose user is ACTIVE. | [R] | 1 |
| FR-AUTH-08 | Each route declares the permission it needs; a middleware checks the user's role against a static permission map (section 9). Rule-based checks (for example approver is not creator) are enforced again inside the service. | [R] | 1 |
| FR-AUTH-09 | Login failures return the same generic `INVALID_CREDENTIALS` response for unknown email, wrong password, and disabled account. A dummy hash is verified for unknown emails to equalize timing. | [R] | 1 |
| FR-AUTH-10 | Login is rate limited: 5 failed attempts per email+IP in 15 minutes returns 429. | [R] | 1 |
| FR-AUTH-11 | A user can change their own password (requires current password); an ADMIN can reset another user's password. Either revokes all other sessions. | [R] | 1 |
| FR-AUTH-12 | The last ACTIVE ADMIN cannot be disabled or demoted. An ADMIN cannot disable or change the role of themselves. | [R] | 1 |
| FR-AUTH-13 | Session lifetime: absolute expiry 12 hours (configurable). Expired sessions are purged by the periodic cleanup job. | [R] | 1 |
| FR-AUTH-14 | User creation, role change, enable/disable, and password reset are audit logged (without secrets). | [D] AuditLog, [R] | 1 |

### 6.2 Product catalog

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-CAT-01 | Categories form a tree via `parentId`; `slug` is unique; maximum depth 5 (D-16). Moving a category must not create a cycle (checked in application code; the database cannot prevent it). | [D] | 2 |
| FR-CAT-02 | A category can be deleted only if it has no child categories and no products; otherwise 409 `RESOURCE_IN_USE`. | [R] | 2 |
| FR-CAT-03 | Products are created and updated with `sku`, `name`, `description`, `categoryId`, `unitPrice`. `sku` is unique, normalized to uppercase, and **immutable** after creation. | [D], [A] | 2 |
| FR-CAT-04 | `unitPrice` is an integer in minor units, `>= 0`. Changing it never changes existing orders (they snapshot price). | [D], [R] | 2 |
| FR-CAT-05 | Product list supports search (name or SKU, case-insensitive substring), filter by category (optionally including descendants), status, price range; sort by an allow-list of fields; offset pagination. | [R] | 2 |
| FR-CAT-06 | Products are activated and deactivated, never deleted. Inactive products cannot be added to new sales orders or purchase order lines (D-17). | [D] `productStatus`, [R] | 2 |
| FR-CAT-07 | Deactivating a product that still has on-hand stock is allowed and returns a `warnings` entry in the response. | [A] | 2 |

### 6.3 Warehouses and suppliers

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-WH-01 | Warehouses have a unique `code`, name, address fields, and status. | [D] | 2 |
| FR-WH-02 | A warehouse cannot be deactivated while any balance has `reservedQuantity > 0`, or while it is on an open purchase order, open transfer, or pending shipment. On-hand stock may remain but is flagged in the response. | [R] | 2 |
| FR-WH-03 | An inactive warehouse cannot be the target of new reservations, receipts, transfers-in, or new documents. | [R] | 2 |
| FR-SUP-01 | Suppliers have name, contact fields (email, phone), address, and status. | [D] | 2 |
| FR-SUP-02 | An inactive supplier cannot receive new purchase orders; existing POs continue normally. | [R] | 2 |
| FR-SUP-03 | The supplier detail response includes its recent purchase orders (via the PO list filtered by `supplierId`). | [D] relation | 4 |

### 6.4 Customers and addresses

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-CUS-01 | Customers have name, unique email, phone, status. | [D], [A] D-06 | 2 |
| FR-CUS-02 | A customer has any number of saved addresses (`label`, `recipientName`, `phone`, address lines, `city`, `state`, `country`, `postalCode`, `isDefault`). | [D] | 2 |
| FR-CUS-03 | At most one default address per customer (partial unique index). The first address is automatically default. Setting a new default clears the old one in the same transaction. Deleting the default promotes the most recently created remaining address, if any. | [D], [R] | 2 |
| FR-CUS-04 | Address validation: required `recipientName`, `addressLine1`, `city`, `country` (ISO 3166-1 alpha-2), `postalCode`; length limits; phone pattern. No external geocoding (free-only rule). | [R] | 2 |
| FR-CUS-05 | Sales orders copy the chosen address into eight snapshot fields; later edits or deletion of the saved address do not change the order. `shippingAddressId` becomes `NULL` if the address is deleted. | [D] via review | 5 |
| FR-CUS-06 | An inactive customer cannot be used on new orders. | [R] | 2 |

### 6.5 Inventory management (most important module)

#### 6.5.1 Quantity definitions

| Term | Definition | Stored? |
|---|---|---|
| **On-hand** (`onHandQuantity`) | Units physically in the warehouse. Excludes units in transit. | Yes, per (product, warehouse) |
| **Reserved** (`reservedQuantity`) | On-hand units promised to confirmed sales orders and not yet shipped or released. They are still on the shelf. | Yes |
| **Available** | `onHand - reserved`. What can still be promised. Never negative. | **No.** Always computed. |
| **In transit** | Transfer units dispatched but not yet received (or resolved). In no warehouse's on-hand. | No. Derived from transfer items. |
| **On order** | `orderedQuantity - receivedQuantity` summed over approved or partially received PO lines. Informational. | No. Derived. |

#### 6.5.2 Where each rule is enforced

| Concern | Database constraint | Transaction | Application logic |
|---|---|---|---|
| No duplicate (product, warehouse) row | Unique (productId, warehouseId) | Upsert `ON CONFLICT` | None needed |
| `onHand >= 0`, `reserved >= 0`, `reserved <= onHand` | CHECK constraints (backstop) | **Conditional atomic UPDATE** inside the transaction (the real mechanism) | Translate "0 rows updated" to `INSUFFICIENT_STOCK` |
| No overselling under concurrency | CHECK only as last resort | Conditional UPDATE `WHERE onHand - reserved >= qty` | Lines processed in sorted order; retry on deadlock |
| Ledger consistent with balance | `StockMovement` typed FKs, exactly one source (`num_nonnulls = 1`), `quantityDelta <> 0` | Balance update and ledger insert in the **same** transaction | Single `InventoryService` is the only code path that writes either |
| Ledger cannot be edited | Trigger blocks UPDATE and DELETE | n/a | n/a |
| Reservation accounting | CHECK `consumed + released <= quantity` | Guarded UPDATE `WHERE status='ACTIVE'` | Status derived when remaining reaches 0 |
| Cap checks (shipped, returned, refunded, received) | CHECK where a cached column exists | Row lock (`FOR UPDATE`) on the parent row, then aggregate, then insert | Error `422` with the remaining eligible quantity |
| Approver is not creator | None | n/a | Service check |
| Reconciliation | None | Read-only query | `onHand` must equal the sum of the ledger |

Request validation alone (Zod) cannot protect against concurrent updates. Two requests can each read "5 available" and both pass validation. Only the atomic conditional UPDATE or row locks inside a transaction prevent the oversell.

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-INV-01 | There is exactly one `InventoryBalance` row per (product, warehouse). A missing row means zero stock. | [D] | 3 |
| FR-INV-02 | **No endpoint writes `onHandQuantity` or `reservedQuantity` directly.** Balances change only as a side effect of documents (receipt, shipment dispatch, transfer, adjustment, return inspection, reservation, release). | [R] | 3 |
| FR-INV-03 | All on-hand changes go through one internal function (`InventoryService.applyMovement`) that updates the balance and inserts a `StockMovement` in the caller's transaction. A lint rule forbids touching the balance model elsewhere. | [R] | 3 |
| FR-INV-04 | Movement types: `PURCHASE_IN`, `SHIPMENT_OUT`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`, `RETURN_IN`. Each row has exactly one typed source FK. | [D] via review | 3 |
| FR-INV-05 | Reservations change `reservedQuantity` only and never write ledger rows (D-20). | [D] | 5 |
| FR-INV-06 | Manual adjustments have a header (warehouse, reason code, description) and one or more lines (product, signed non-zero `quantityDelta`). They start as `PENDING_APPROVAL` and are posted only when approved by a **different** user. Opening stock is entered as an adjustment with reason `OPENING_BALANCE`. | [D] via review, [R] | 3 |
| FR-INV-07 | An adjustment may not drive on-hand below the current reserved quantity: `onHand + delta >= reserved`. | [R] | 3 |
| FR-INV-08 | Negative inventory is **not allowed** (stated policy). | [A] | 3 |
| FR-INV-09 | Read APIs: balances list/detail, per-product summary across warehouses (on-hand, reserved, available, on-order), movement history with filters and cursor pagination. | [R] | 3 |
| FR-INV-10 | Traceability: every movement links to its source document line; every document detail shows its movements. | [D] | 3 |
| FR-INV-11 | A reconciliation endpoint compares, per (product, warehouse), `onHand` with the sum of `quantityDelta`, and `reserved` with the sum of remaining ACTIVE reservations. It only **reports**; corrections go through an adjustment. | [R] | 3 |
| FR-INV-12 | Reservation expiry (D-07): a periodic job (and a lazy sweep at the start of each reserve operation) releases ACTIVE reservations past `expiresAt` for orders not fully paid, and cancels those orders with reason `RESERVATION_EXPIRED`. Guarded so a reservation is released at most once. | [D] `expiresAt`, [A] | 5/7 |
| FR-INV-13 | Reservations are read-only through the API (list, detail, by order). There is no standalone create or release, because that would let reservations drift from their orders. | [R] | 5 |

### 6.6 Procurement

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-PO-01 | A purchase order has a supplier, destination warehouse, expected date, and lines (product, `orderedQuantity`, `unitCost` snapshot). `totalAmount` is computed by the server as the sum of `orderedQuantity × unitCost`. | [D] | 4 |
| FR-PO-02 | Lifecycle: `DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_RECEIVED → RECEIVED`, plus `CANCELLED` and `CLOSED` (section 7). Reject returns the PO to `DRAFT` and records the reason in the audit log. | [D] statuses, [R] | 4 |
| FR-PO-03 | Approval requires the `po:approve` permission and an approver different from the creator. Approval sets `approvedById` and `orderedAt`. Sending the order to the supplier happens outside the system (no email). | [D], [A] | 4 |
| FR-PO-04 | Only DRAFT POs can be edited. Lines are replaced as a set. | [R] | 4 |
| FR-PO-05 | A PO can be cancelled before any receipt exists. After a partial receipt it can only be `CLOSED` (short-closed). | [R] | 4 |
| FR-GR-01 | A goods receipt references one PO and a warehouse (must equal the PO's warehouse, D-04) and an optional `supplierReference`. | [D] | 4 |
| FR-GR-02 | Each receipt line references a PO line and carries `quantityReceived`, `quantityAccepted`, `quantityRejected`, optional `rejectionReason`. Rule: `received = accepted + rejected`; rejection reason required when `rejected > 0`. | [D] | 4 |
| FR-GR-03 | Only **accepted** units enter inventory (`PURCHASE_IN` movement of `+accepted`, skipped when 0). | [D] | 4 |
| FR-GR-04 | Cumulative accepted quantity per PO line may not exceed `orderedQuantity` (D-03). Enforced by locking the PO line rows; CHECK on the cached column is the backstop. | [R] | 4 |
| FR-GR-05 | Receiving is allowed only against POs in `APPROVED` or `PARTIALLY_RECEIVED`. PO status is recomputed in the same transaction: `RECEIVED` when every line has accepted = ordered, else `PARTIALLY_RECEIVED`. | [R] | 4 |
| FR-GR-06 | A PO may have many receipts (partial deliveries). | [D] | 4 |

### 6.7 Warehouse transfers

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-XF-01 | A transfer has distinct source and destination warehouses (CHECK) and lines (product, `quantityRequested`). | [D] | 6 |
| FR-XF-02 | No approval step in the initial scope (D-10). | [A] | 6 |
| FR-XF-03 | **Dispatch** (`DRAFT → IN_TRANSIT`): for each line, source on-hand decreases only if `onHand - reserved >= qty`; movement `TRANSFER_OUT`. Quantity dispatched may be less than requested. Stock is now in transit. | [D] via review | 6 |
| FR-XF-04 | **Receive** (`IN_TRANSIT/PARTIALLY_RECEIVED → PARTIALLY_RECEIVED/RECEIVED`): destination on-hand increases by the received quantity; movement `TRANSFER_IN`. Cumulative received may not exceed dispatched. Multiple receipts allowed. | [D] | 6 |
| FR-XF-05 | **Close with discrepancy** when received < dispatched: resolution `WRITE_OFF` or `RETURN_TO_SOURCE` per D-05. Requires a reason. | [A] | 6 |
| FR-XF-06 | Cancellation is allowed only in `DRAFT`. After dispatch, stock is physical and in motion; cancelling would hide it, so the only exits are receive and close. | [R] | 6 |
| FR-XF-07 | **No stock is created or lost:** for each transfer line, `-dispatched + received + returnedToSource = -writtenOff`, where write-off is the explicit shortage resolution (invariant INV-08). | [R] | 6 |

### 6.8 Sales orders and fulfillment

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-SO-01 | An order belongs to one customer and has lines (product, quantity, price snapshot, `productNameSnapshot`, `skuSnapshot`, line discount, `lineTotal`). One line per product (D-02). | [D] + review | 5 |
| FR-SO-02 | The server sets `unitPrice` from the product at creation and ignores any client-supplied price. Totals: `lineTotal = qty × unitPrice − discount`; `subtotal = Σ lineTotal`; `total = subtotal − orderDiscount + shipping`. All `>= 0`. | [D] formulas | 5 |
| FR-SO-03 | Shipping address is copied into the order (FR-CUS-05). The request supplies either `shippingAddressId` or an inline address. | [D] | 5 |
| FR-SO-04 | Order creation requires an `Idempotency-Key`; replays return the original order. | [D] `idempotencyKey` | 5 |
| FR-SO-05 | A new order is `DRAFT` and can be edited (address, shipping amount, lines). No stock is reserved yet. | [A] D-11 | 5 |
| FR-SO-06 | **Confirm** reserves stock for all lines atomically (all-or-nothing) and moves to `CONFIRMED`. If any line lacks availability, nothing is reserved and the response lists each short line. | [D] | 5 |
| FR-SO-07 | **Cancel** (from DRAFT or CONFIRMED): releases the remaining reservations, sets `cancelledAt` and `cancellationReason`. If some units already shipped, only the unshipped remainder is released and the order stays visible as `CANCELLED` with `fulfillmentStatus = PARTIALLY_SHIPPED`. Refunds are separate. | [D], [R] | 5 |
| FR-SO-08 | `paymentStatus` and `fulfillmentStatus` are cached, derived values, always updated in the same transaction as the event that changes them. | [D] via review | 5 |
| FR-SH-01 | A shipment is for one order and one warehouse and carries lines (`salesOrderItemId`, `quantity`). `shipmentNo` is generated. | [D] | 5 |
| FR-SH-02 | A shipment line's quantity may not exceed the order line's **eligible** quantity: `quantity − Σ(non-cancelled shipment lines)`, and it must also be covered by the remaining ACTIVE reservation in the shipment's warehouse. | [R] | 5 |
| FR-SH-03 | Creating a shipment (`PENDING`) moves no stock. **Dispatch** consumes the reservation (`quantityConsumed`), decreases `onHand` and `reserved`, writes `SHIPMENT_OUT`, sets `dispatchedAt`, optional `carrier` and `trackingNo`. | [D], D-13 | 5 |
| FR-SH-04 | **Deliver** sets `deliveredAt`. When all order quantity is delivered the order becomes `COMPLETED` and `fulfillmentStatus = DELIVERED`. | [D] | 5 |
| FR-SH-05 | A `PENDING` shipment can be cancelled; dispatched shipments cannot. | [R] | 5 |
| FR-SH-06 | Partial shipments: an order can have many shipments over time and from several warehouses. | [D] | 5 |

### 6.9 Payments and refunds

**Payment model [R].** The core project never touches real money. Two providers exist:

| Provider | Meaning | Honesty rule |
|---|---|---|
| `MANUAL` | Staff record a payment received outside the system (cash, bank transfer, a reference number). The payment is created as `SUCCEEDED`. | It is a bookkeeping record, not a transaction the system performed. |
| `SIMULATED` | An internal fake provider. The payment is created `PENDING`; a development-only simulator then sends a **signed webhook** to the real webhook handler, exactly as a real provider would. | Never presented as real. Every simulated record is labelled `provider = SIMULATED`, and the simulator endpoint is disabled unless `ENABLE_PAYMENT_SIMULATOR=true`. |

A real provider is **optional and out of scope** **[F]**. If you add one later, use only its sandbox/test mode, verify its pricing yourself, and never make it a required dependency.

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-PAY-01 | Payments reference an order, an amount (`> 0`), a provider, an optional `providerReference`, and an idempotency key. Payments are recorded only against `CONFIRMED` orders. | [D] | 7 |
| FR-PAY-02 | Overpayment is prevented: `Σ(SUCCEEDED + PENDING payments) <= order total`, enforced under a row lock on the order. | [R] | 7 |
| FR-PAY-03 | Every attempt is kept: failed and cancelled payments are never deleted. An order can have several payments. | [D] | 7 |
| FR-PAY-04 | Webhook endpoint accepts provider events, verifies an HMAC-SHA256 signature and timestamp tolerance, stores the raw payload in `PaymentWebhookEvent` with unique (`provider`, `providerEventId`), then processes it. | [D] + review | 7 |
| FR-PAY-05 | **Webhook replay safety:** a duplicate event ID is acknowledged with 200 and does nothing. Processing is claimed with a guarded UPDATE (`WHERE processingStatus IN ('RECEIVED','FAILED')`), so concurrent duplicates process once. | [R] | 7 |
| FR-PAY-06 | Payment transitions are monotonic: `PENDING → SUCCEEDED/FAILED/CANCELLED`. A late `failed` after `succeeded` is `IGNORED` and logged. Unmatched events are stored with `paymentId = NULL` and marked `IGNORED`. | [R] | 7 |
| FR-PAY-07 | After any payment or refund state change, the order's `paymentStatus` is recomputed in the same transaction (INV-17). | [D] | 7 |
| FR-REF-01 | A refund is made against one payment (`paymentId`), optionally linked to a return (`returnId`), with amount `> 0`, reason, status, idempotency key. | [D] | 7 |
| FR-REF-02 | Refund cap: `Σ(PENDING + SUCCEEDED refunds on a payment) + new amount <= payment.amount`, enforced under a row lock on the payment. If `returnId` is set, a second cap applies (D-14). | [R] | 7/8 |
| FR-REF-03 | `MANUAL` refunds are created `SUCCEEDED`; `SIMULATED` refunds are `PENDING` until a signed `refund.succeeded` or `refund.failed` event. A `FAILED` refund no longer counts toward the cap. | [R] | 7 |
| FR-REF-04 | Only `SUCCEEDED` payments can be refunded. | [R] | 7 |

### 6.10 Returns

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-RET-01 | A return is requested against one order and its lines (`salesOrderItemId`, `quantityRequested`). `customerId` is derived from the order, never trusted from the client (`Return.customerId` is kept per your design). | [D], [R] | 8 |
| FR-RET-02 | **Eligibility:** only units on shipments with status `DELIVERED`, within the return window (D-15), minus units in non-rejected, non-cancelled returns. `returnable = deliveredQty − Σ(quantityRequested in active returns)`. | [A], [R] | 8 |
| FR-RET-03 | **Concurrency:** creating a return locks the affected `SalesOrderItem` rows (`FOR UPDATE`, ordered by id), recomputes eligibility, then inserts. Two simultaneous requests cannot together exceed the eligible quantity. | [R] | 8 |
| FR-RET-04 | Lifecycle: `REQUESTED → APPROVED/REJECTED → RECEIVED → COMPLETED`, plus `CANCELLED` before receipt. | [D] | 8 |
| FR-RET-05 | **Receive** records `quantityReceived` per line (`<= quantityRequested`). No stock changes yet. | [D] | 8 |
| FR-RET-06 | **Inspect** sets per line `inspectionStatus` (`PASSED`/`FAILED`), `disposition` (`RESTOCK`/`SCRAP`), `quantityRestocked` (`<= quantityReceived`) and `restockWarehouseId` (required when restocking). Restocked units increase on-hand with a `RETURN_IN` movement. The return becomes `COMPLETED` when all lines are inspected. | [D], [R] | 8 |
| FR-RET-07 | Refunds relate to returns through `Refund.returnId` (optional). A refund can exist without a return (for example a cancelled order). | [D] | 8 |
| FR-RET-08 | `GET /sales-orders/{id}/returnable-items` returns the eligible quantity per line so clients never guess. | [R] | 8 |

### 6.11 Auditability and reliability

| ID | Requirement | Tag | Ph |
|---|---|---|---|
| FR-REL-01 | **Audit log:** every state transition of every document, every master-data create/update/status change, all user administration, manual job runs, and webhook processing failures write an `AuditLog` row (`actorUserId`, `action`, `entityType`, `entityId`, `beforeData`, `afterData`, `requestId`) **in the same transaction** as the change. Secrets (`passwordHash`, tokens) are redacted. | [D], [R] | 1+ |
| FR-REL-02 | Audit logs are append-only (trigger) and readable only with `audit:read` (ADMIN). | [R] | 1 |
| FR-REL-03 | **Idempotency:** `Idempotency-Key` is required on document-creating and repeatable stock/money-affecting POSTs (rule in `02-API-Specification.md`, section 2.9). Same key and same request returns the stored response with header `Idempotent-Replayed: true`; same key with a different request returns 422 `IDEMPOTENCY_KEY_REUSED`. Records expire after 24 hours. | [D] `IdempotencyRecord` | 1 |
| FR-REL-04 | **Idempotency implementation:** the `IdempotencyRecord` insert, the business changes, and the response save all happen in **one** transaction. A concurrent duplicate blocks on the unique index until the first commits, then replays its response. Rolled-back (failed) requests leave no record, so the client may safely retry with the same key. | [R] | 1 |
| FR-REL-05 | **Correlation IDs:** each request has an `X-Request-Id` (valid client value, or a generated UUID), echoed in the response, attached to every log line, error body, and audit row. | [R] | 0 |
| FR-REL-06 | **Error logging:** structured JSON via Pino. 5xx logged with stack at `error`; 4xx at `info` or `warn`. Sensitive fields redacted. | [R] | 0 |
| FR-REL-07 | **Transactions:** every operation that touches more than one table runs in a single database transaction. No network calls (none exist besides the database) happen inside a transaction. | [R] | 3+ |
| FR-REL-08 | **Transient failure handling:** transactions that fail with serialization or deadlock errors (`40001`, `40P01`) are retried up to 3 times with jittered backoff; other errors are not retried. | [R] | 3 |
| FR-REL-09 | **Recovery from partial failure:** because each business operation is one transaction, a crash leaves either the full effect or none. Webhook events are stored first, then processed, so an interrupted event is retried by the provider or the simulator. The expiry job is idempotent. Drift is detectable through reconciliation (FR-INV-11). | [R] | 3+ |
| FR-REL-10 | **Health:** `GET /health/live` (process up) and `GET /health/ready` (database reachable within 2 s). | [R] | 0 |
| FR-REL-11 | **Housekeeping job:** purges expired sessions and idempotency records; runs reservation expiry when enabled. Runs in-process on an interval, safe if two instances run (uses `FOR UPDATE SKIP LOCKED`). | [R] | 5 |

---

## 7. State machines and transition guards

Each transition is performed by exactly one endpoint (see `02-API-Specification.md`) and is guarded in a single transaction with `WHERE status = <expected>`. An illegal transition returns 409 `INVALID_STATE`.

| Document | From | Action | To | Guard |
|---|---|---|---|---|
| User | ACTIVE | disable | DISABLED | not last ADMIN, not self |
| User | DISABLED | enable | ACTIVE | n/a |
| Adjustment | PENDING_APPROVAL | approve | POSTED | approver ≠ creator; every line keeps `onHand + delta >= reserved` |
| Adjustment | PENDING_APPROVAL | reject | REJECTED | reason required |
| Adjustment | PENDING_APPROVAL | cancel | CANCELLED | creator or ADMIN |
| Purchase order | DRAFT | submit | PENDING_APPROVAL | ≥ 1 line; supplier and warehouse active |
| Purchase order | PENDING_APPROVAL | approve | APPROVED | approver ≠ creator |
| Purchase order | PENDING_APPROVAL | reject | DRAFT | reason (audit) |
| Purchase order | DRAFT, PENDING_APPROVAL, APPROVED | cancel | CANCELLED | no goods receipts exist |
| Purchase order | APPROVED, PARTIALLY_RECEIVED | goods receipt | PARTIALLY_RECEIVED or RECEIVED | caps; automatic |
| Purchase order | PARTIALLY_RECEIVED | close | CLOSED | receipts exist |
| Goods receipt | (new) | create | POSTED | terminal |
| Transfer | DRAFT | dispatch | IN_TRANSIT | source available ≥ dispatched |
| Transfer | DRAFT | cancel | CANCELLED | n/a |
| Transfer | IN_TRANSIT, PARTIALLY_RECEIVED | receive | PARTIALLY_RECEIVED or RECEIVED | cumulative received ≤ dispatched |
| Transfer | IN_TRANSIT, PARTIALLY_RECEIVED | close | CLOSED | shortage exists; resolution given |
| Sales order | DRAFT | confirm | CONFIRMED | customer and products active; stock available |
| Sales order | DRAFT, CONFIRMED | cancel | CANCELLED | reservations released |
| Sales order | CONFIRMED | all delivered | COMPLETED | automatic |
| Shipment | PENDING | dispatch | DISPATCHED | reservation covers the quantity; stock decremented |
| Shipment | DISPATCHED | deliver | DELIVERED | n/a |
| Shipment | PENDING | cancel | CANCELLED | n/a |
| Reservation | ACTIVE | ship all / release / expire | CONSUMED / RELEASED / EXPIRED | closes when remaining reaches 0 |
| Payment | PENDING | webhook success / failure / cancel | SUCCEEDED / FAILED / CANCELLED | monotonic |
| Refund | PENDING | webhook success / failure | SUCCEEDED / FAILED | monotonic |
| Return | REQUESTED | approve / reject | APPROVED / REJECTED | n/a |
| Return | REQUESTED, APPROVED | cancel | CANCELLED | not received |
| Return | APPROVED | receive | RECEIVED | `received <= requested` |
| Return | RECEIVED | inspect (last line) | COMPLETED | all lines inspected |
| Webhook event | RECEIVED, FAILED | process | PROCESSED, FAILED or IGNORED | claim via guarded UPDATE |
| Idempotency record | (new) | complete | COMPLETED | same transaction as the business change |

**Derived order status.** Let `paid = Σ SUCCEEDED payments` and `refunded = Σ SUCCEEDED refunds`. If `refunded = 0`: `UNPAID` (paid = 0), `PARTIALLY_PAID` (0 < paid < total), `PAID` (paid = total). If `refunded > 0`: `REFUNDED` when refunded = paid, otherwise `PARTIALLY_REFUNDED`. `fulfillmentStatus`: `UNFULFILLED` (nothing dispatched), `PARTIALLY_SHIPPED` (some but not all units dispatched), `SHIPPED` (all dispatched), `DELIVERED` (all shipments delivered).


---

## 8. Critical business invariants

Each invariant states why it matters, which API operations it touches, which database features help, which transaction or application checks are required, and how to test it. Tests live in the suites defined in section 11 and should carry the invariant ID in their name (for example `INV-04 concurrent confirms never over-reserve`).

### INV-01 Inventory never goes negative
- **Why:** negative stock means the ledger and reality disagree and orders were promised that cannot be fulfilled.
- **Operations:** order confirm, shipment dispatch, transfer dispatch, adjustment approve, return inspect (increase only).
- **Database:** CHECK `onHandQuantity >= 0`, `reservedQuantity >= 0`, `reservedQuantity <= onHandQuantity`. These are the last line of defence, not the mechanism.
- **Transaction/app:** every decrease is a conditional UPDATE whose WHERE clause contains the guard (for example `onHand - reserved >= qty`). Zero rows updated becomes `INSUFFICIENT_STOCK`. Policy FR-INV-08 forbids negatives.
- **Tests:** unit-level guard tests; DB constraint tests that raw-insert violating rows and expect SQLSTATE `23514`; API tests that try to dispatch or adjust below zero.

### INV-02 Available stock is always `onHand − reserved`
- **Why:** two stored copies of "available" would drift.
- **Operations:** all inventory read endpoints, order confirm.
- **Database:** none (not stored). The CHECK `reserved <= onHand` guarantees the result is never negative.
- **Transaction/app:** a single shared helper or SQL expression computes it; no endpoint accepts it as input.
- **Tests:** read endpoints compared against balances after random operations; schema test asserts no `available` column exists.

### INV-03 One balance row per (product, warehouse)
- **Why:** duplicates split stock across rows and make every sum wrong.
- **Operations:** goods receipt, transfer receive, return inspect, adjustment (all may create the first row).
- **Database:** unique (`productId`, `warehouseId`).
- **Transaction/app:** create rows only with `INSERT … ON CONFLICT (productId, warehouseId) DO UPDATE`.
- **Tests:** 20 concurrent first-time receipts for the same pair yield exactly one row with the correct sum.

### INV-04 Concurrent orders cannot reserve beyond available stock
- **Why:** this is the overselling bug.
- **Operations:** `POST /sales-orders/{id}/confirm`, reservation expiry (release side).
- **Database:** CHECK `reserved <= onHand` (backstop).
- **Transaction/app:** one transaction per order; lines processed in sorted (productId, warehouseId) order; each line runs `UPDATE … SET reserved = reserved + q WHERE onHand - reserved >= q`; `rowCount = 0` rolls back the whole order. Retry on deadlock (`40P01`). Validation of "enough stock" before the update does **not** count as protection.
- **Tests:** balance on-hand 25, 100 parallel confirms of 1 unit each against a real PostgreSQL: exactly 25 succeed, 75 receive 409, `reserved = 25`, `reserved <= onHand` throughout. Repeat with multi-line orders in opposite line order to provoke deadlocks.

### INV-05 Stock movements are recorded consistently with inventory changes
- **Why:** an unexplained on-hand change cannot be audited.
- **Operations:** receipt, dispatch (shipment, transfer), receive (transfer), adjustment approve, return inspect.
- **Database:** `StockMovement` has exactly one typed source FK (`num_nonnulls(...) = 1`), `quantityDelta <> 0`; trigger blocks UPDATE and DELETE.
- **Transaction/app:** only `InventoryService.applyMovement` changes `onHandQuantity`, and it inserts the ledger row in the same transaction. A lint rule bans direct model access elsewhere.
- **Tests:** after every inventory API test, assert `onHand = Σ delta`; fault-injection test throws after the balance update and asserts both balance and ledger are unchanged.

### INV-06 Duplicate requests do not create duplicate orders or stock changes
- **Why:** clients retry on timeouts; the first attempt may have succeeded.
- **Operations:** every endpoint marked Idempotency "Required" in the API spec.
- **Database:** unique (`scope`, `idempotencyKey`) on `IdempotencyRecord`; unique `idempotencyKey` columns on `SalesOrder`, `Payment`, `Refund`, `InventoryAdjustment` as secondary backstops.
- **Transaction/app:** record insert, business effect, and response save in one transaction; request hash comparison detects key reuse with a different body.
- **Tests:** same request twice yields one resource and identical responses; 10 simultaneous identical requests create one resource; same key with a different body returns 422; a request that fails with 4xx leaves no record.

### INV-07 Purchase receipts obey purchase order and receiving rules
- **Why:** over-receiving or receiving against the wrong PO corrupts stock and cost.
- **Operations:** `POST /goods-receipts`.
- **Database:** CHECK `received = accepted + rejected`, all `>= 0`; CHECK `receivedQuantity BETWEEN 0 AND orderedQuantity` on `PurchaseOrderItem`; unique (`goodsReceiptId`, `purchaseOrderItemId`).
- **Transaction/app:** lock PO line rows (`FOR UPDATE`, ordered by id); verify PO status, warehouse equals PO's, each line belongs to the PO, accepted fits remaining; update cached `receivedQuantity`, PO status, balances, ledger together.
- **Tests:** partial receipts across two receipts; accepted above remaining returns 422 `EXCEEDS_ORDERED_QUANTITY`; two concurrent receipts that together exceed the order: one succeeds, one fails; rejected units never touch stock.

### INV-08 Warehouse transfers preserve inventory
- **Why:** moving stock must not create or destroy units.
- **Operations:** transfer dispatch, receive, close.
- **Database:** CHECK source ≠ destination; CHECK `quantityReceived <= quantityDispatched`; CHECK `quantityDispatched <= quantityRequested` (recommended).
- **Transaction/app:** dispatch decrements the source only if `onHand - reserved >= qty` and writes `TRANSFER_OUT`; receive increments the destination and writes `TRANSFER_IN`; closing with a shortage requires explicit `WRITE_OFF` or `RETURN_TO_SOURCE` (the latter writes `TRANSFER_IN` at the source).
- **Tests:** conservation check per line: `-dispatched + received + returnedToSource = -writtenOff`; system-wide `Σ onHand + Σ in-transit` unchanged by dispatch and receive; dispatch while stock is reserved fails.

### INV-09 A shipment cannot exceed what the order line allows
- **Why:** shipping more than ordered loses stock and money.
- **Operations:** `POST /shipments`, shipment dispatch.
- **Database:** CHECK `quantity > 0`; FK from shipment line to order line.
- **Transaction/app:** lock the `SalesOrderItem` row, compute `eligible = quantity − Σ(non-cancelled shipment lines)`, require `<=` eligible and `<=` remaining ACTIVE reservation in the shipment warehouse; dispatch uses a guarded reservation UPDATE.
- **Tests:** ship 3 of 5 then 3 more fails; two concurrent shipments of 3 against an order line of 5, only one succeeds; dispatch of a cancelled shipment returns 409.

### INV-10 Returns cannot exceed the quantity eligible for return
- **Why:** returning units that were never delivered, or returning the same units twice, creates stock and refunds from nothing.
- **Operations:** `POST /returns`, approve (re-check not required, quantities fixed), receive, inspect.
- **Database:** CHECK `quantityReceived <= quantityRequested`, `quantityRestocked <= quantityReceived`; unique (`returnId`, `salesOrderItemId`).
- **Transaction/app:** lock `SalesOrderItem` rows ordered by id; `returnable = deliveredQty − Σ(requested in non-rejected, non-cancelled returns)`; insert only if within.
- **Tests:** return more than delivered fails; two concurrent returns of 3 against 5 delivered: one succeeds; a rejected return frees its quantity; returnable-items endpoint matches.

### INV-11 Refunds cannot exceed the refundable amount
- **Why:** over-refunding is direct monetary loss.
- **Operations:** `POST /refunds`, webhook `refund.*` events.
- **Database:** CHECK `amount > 0`; (cap needs aggregation, so it cannot be a plain CHECK).
- **Transaction/app:** lock the `Payment` row; `refundable = payment.amount − Σ(PENDING + SUCCEEDED refunds)`; with `returnId`, also `<= Σ floor(lineTotal × quantityReceived ÷ quantity)` of its lines minus refunds already linked to that return. Only SUCCEEDED payments are refundable.
- **Tests:** refund above remaining returns 422 `EXCEEDS_REFUNDABLE_AMOUNT`; two concurrent half-plus refunds: one fails; a FAILED refund frees its amount.

### INV-12 Historical order information stays understandable
- **Why:** price, name, and address edits must not rewrite history.
- **Operations:** order create, product update, address update or delete.
- **Database:** snapshot columns on `SalesOrderItem` (`unitPrice`, `productNameSnapshot`, `skuSnapshot`) and `SalesOrder` (eight shipping fields, totals); `shippingAddressId` ON DELETE SET NULL; ON DELETE RESTRICT elsewhere.
- **Transaction/app:** order creation copies values inside its transaction; order read models use snapshots only, never join to the live product price.
- **Tests:** rename the product, change its price, delete the address, then read the order: original values unchanged.

### INV-13 Payment webhooks are safe to process more than once
- **Why:** providers retry and deliver out of order.
- **Operations:** `POST /webhooks/payments/{provider}`.
- **Database:** unique (`provider`, `providerEventId`); payment status transitions guarded by `WHERE paymentStatus = 'PENDING'`.
- **Transaction/app:** store event, claim via guarded UPDATE, apply effect and recompute order status in one transaction; duplicates return 200 without effect; invalid signature returns 401 and stores nothing.
- **Tests:** same event posted 5 times (sequentially and concurrently) yields one state change; `failed` after `succeeded` is IGNORED; unknown payment reference is stored and IGNORED.

### INV-14 Ledger and audit log are append-only
- **Why:** an editable ledger is not a ledger.
- **Operations:** all. No endpoint updates or deletes these rows.
- **Database:** triggers raising an exception on UPDATE or DELETE of `StockMovement` and `AuditLog`.
- **Transaction/app:** no code path or API for modification.
- **Tests:** raw UPDATE and DELETE fail; schema test confirms the triggers exist.

### INV-15 Reservation accounting is consistent
- **Why:** `reserved` on the balance must equal what reservations still hold.
- **Operations:** confirm, cancel, shipment dispatch, expiry.
- **Database:** CHECK `quantity > 0`, `consumed >= 0`, `released >= 0`, `consumed + released <= quantity`; partial unique: one ACTIVE reservation per (`salesOrderItemId`, `warehouseId`).
- **Transaction/app:** release and consume use guarded UPDATEs (`WHERE status = 'ACTIVE' AND remaining >= q`) so a release cannot run twice; balance `reserved` changes in the same transaction.
- **Tests:** after any sequence, `balance.reserved = Σ remaining(ACTIVE reservations)`; double cancel and double expiry release once; expiry racing a shipment never double counts.

### INV-16 On-hand equals the ledger sum
- **Why:** the strongest end-to-end check that no code path changed stock silently.
- **Operations:** reconciliation endpoint; all inventory operations.
- **Database:** none directly; relies on INV-05 and INV-14.
- **Transaction/app:** reconciliation query compares per (product, warehouse).
- **Tests:** property-based test (fast-check) runs random valid operation sequences then asserts INV-01, INV-02, INV-15, INV-16 together.

### INV-17 Order totals and payment status are consistent; no overpayment
- **Why:** money fields must agree with each other.
- **Operations:** order create or edit, payment record, webhook, refund.
- **Database:** CHECK `total = subtotal − discount + shipping`; CHECK `lineTotal = quantity × unitPrice − discount`; all amounts `>= 0`; `Payment.amount > 0`.
- **Transaction/app:** server computes all totals and ignores client values; payment creation locks the order row and checks `Σ(SUCCEEDED + PENDING) + amount <= total`; status recomputed in the same transaction.
- **Tests:** client-supplied totals ignored; concurrent payments that together overpay: one fails; statuses follow the derivation rule in section 7.

### INV-18 Approvals are made by someone other than the creator
- **Why:** separation of duties for stock corrections and purchasing.
- **Operations:** adjustment approve, purchase order approve.
- **Database:** none (needs both IDs and a role check).
- **Transaction/app:** service compares `approvedById` to `createdById`, always.
- **Tests:** creator approving own document returns 422 `SELF_APPROVAL_NOT_ALLOWED`; second user succeeds; double approval concurrently posts the adjustment once (guarded UPDATE).

### INV-19 Document numbers are unique
- **Why:** staff and customers refer to documents by number.
- **Operations:** all document creates.
- **Database:** unique on `orderNo`, `purchaseOrderNo`, `receiptNo`, `shipmentNo`, `returnNo`; values from sequences.
- **Transaction/app:** never generated client-side or by `MAX()+1`.
- **Tests:** 50 concurrent creates produce 50 distinct numbers.

---

## 9. Roles and permissions

### 9.1 Initial roles (required) **[R]**, consistent with `User.role` **[D]**

| Role | Purpose |
|---|---|
| `ADMIN` | Full access, user administration, PO approval, audit logs, operations endpoints. |
| `INVENTORY_MANAGER` | Stock operations: adjustments (create and approve), transfers, reconciliation, goods receipt, catalog maintenance, return processing. |
| `PROCUREMENT` | Suppliers and purchase orders (not approval), goods receipt. |
| `FULFILLMENT` | Customers, sales orders, shipments, payments, refunds, returns. |
| `VIEWER` | Read-only on everything except audit logs and user administration. |

### 9.2 Permission matrix

✔ = allowed. "Rule" notes extra conditions enforced in the service.

| Permission | Covers | ADMIN | INVENTORY_MANAGER | PROCUREMENT | FULFILLMENT | VIEWER |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `auth:self` | login, logout, `me`, change own password | ✔ | ✔ | ✔ | ✔ | ✔ |
| `user:manage` | list, create, update, enable/disable, reset password | ✔ | | | | |
| `catalog:read` | products, categories | ✔ | ✔ | ✔ | ✔ | ✔ |
| `catalog:write` | create/update/activate products, categories | ✔ | ✔ | | | |
| `warehouse:read` | read warehouses | ✔ | ✔ | ✔ | ✔ | ✔ |
| `warehouse:write` | create/update/activate warehouses | ✔ | | | | |
| `supplier:read` | read suppliers | ✔ | ✔ | ✔ | ✔ | ✔ |
| `supplier:write` | create/update/activate suppliers | ✔ | | ✔ | | |
| `customer:read` | read customers and addresses | ✔ | ✔ | ✔ | ✔ | ✔ |
| `customer:write` | create/update customers and addresses | ✔ | | | ✔ | |
| `document:read` | read all transactional documents, balances, movements, reservations | ✔ | ✔ | ✔ | ✔ | ✔ |
| `adjustment:create` | create and cancel adjustments | ✔ | ✔ | | | |
| `adjustment:approve` | approve or reject adjustments (rule: not creator) | ✔ | ✔ | | | |
| `inventory:reconcile` | run reconciliation report | ✔ | ✔ | | | |
| `transfer:manage` | create, dispatch, receive, close, cancel transfers | ✔ | ✔ | | | |
| `po:manage` | create, edit, submit, cancel, close purchase orders | ✔ | | ✔ | | |
| `po:approve` | approve or reject purchase orders (rule: not creator) | ✔ | | | | |
| `receipt:create` | create goods receipts | ✔ | ✔ | ✔ | | |
| `salesorder:manage` | create, edit, confirm, cancel sales orders | ✔ | | | ✔ | |
| `shipment:manage` | create, dispatch, deliver, cancel shipments | ✔ | | | ✔ | |
| `payment:record` | record and cancel payments | ✔ | | | ✔ | |
| `refund:create` | create refunds | ✔ | | | ✔ | |
| `return:manage` | create, approve, reject, cancel returns | ✔ | | | ✔ | |
| `return:process` | receive and inspect returns | ✔ | ✔ | | ✔ | |
| `audit:read` | read audit log | ✔ | | | | |
| `ops:run` | housekeeping jobs, webhook event viewer, payment simulator | ✔ | | | | |

### 9.3 Enforcement (backend, not frontend)

1. Each route is registered with a required permission, for example `route('POST', '/sales-orders/:id/confirm', requirePermission('salesorder:manage'), handler)`.
2. A static map (`role → permission[]`) lives in code. It is reviewed in git like any other change. No role tables are needed in the initial scope.
3. A route without a declared permission fails a startup/CI test (NFR-SEC-04), so a forgotten check cannot ship.
4. A generated test loops over every route × every role and compares the actual status (2xx or 403) with the matrix.
5. Rule-based checks that need data (approver ≠ creator, last admin, only creator cancels) live in services, because middleware cannot know them.
6. `GET /auth/me` returns the permission list so a future frontend can hide buttons, but hiding is cosmetic; the backend always re-checks.

### 9.4 Future enhancements **[F]** (not in initial scope)

Per-warehouse role scoping; approval thresholds by amount; custom roles in the database; two-person refund approval; field-level permissions.

---

## 10. Non-functional requirements

Targets are **development and demonstration targets**, not claims about internet-scale capacity. Reference dataset **DS-M**: 5,000 products, 3 warehouses, 15,000 balances, 200,000 movements, 20,000 orders, generated by a seed script, measured on a developer laptop against local PostgreSQL.

| ID | Category | Requirement | Measure | Verified by |
|---|---|---|---|---|
| NFR-SEC-01 | Security | Passwords hashed with argon2id; plaintext and hashes never appear in responses, logs, or audit rows. | 0 occurrences | Test that logs in, creates and resets users, then greps captured logs and audit rows |
| NFR-SEC-02 | Security | Session tokens are 256-bit random, stored only as SHA-256 hash, expire after 12 h (configurable), and are revoked on logout, disable, role change, password change. | Revocation takes effect on the next request | Auth integration tests |
| NFR-SEC-03 | Security | Every route except login, health, and webhooks rejects missing or invalid tokens. | 100% of routes | Route-table test asserts 401 without token |
| NFR-SEC-04 | Security | Every route declares a permission. | 100% of routes | Startup/CI test fails on undeclared |
| NFR-SEC-05 | Security | Bodies are validated by Zod `.strict()` schemas; unknown fields rejected; JSON body limit 100 KB (webhook raw body 256 KB). | Violations return 400 | Validation tests |
| NFR-SEC-06 | Security | No string-built SQL. Raw SQL only through Prisma tagged templates with parameters. | 0 uses of `$queryRawUnsafe` or concatenated SQL | CI grep gate and review |
| NFR-SEC-07 | Security | Secrets only through validated environment variables; `.env` gitignored; `.env.example` has no real values. | 0 secrets in git history | Pre-commit or CI secret scan (free OSS scanner) |
| NFR-SEC-08 | Security | `helmet` headers, explicit CORS allow-list, per-IP rate limit (default 100 requests/min) and login limiter. | 429 with `Retry-After` when exceeded | Rate limit tests |
| NFR-SEC-09 | Security | **Supabase exposure:** tables in the `public` schema are reachable through Supabase's auto-generated REST Data API with the public anon key unless protected. Enable Row Level Security on every table with no policies (the backend's direct `postgres` connection is unaffected) or disable the Data API in project settings. Verify against current Supabase docs when you set it up. | Anonymous REST call to any table returns no data | Manual check after each hosted migration, documented in README |
| NFR-SEC-10 | Security | Dependency vulnerability scanning in CI and GitHub Dependabot alerts. | 0 known high/critical vulnerabilities at release | CI step (use `bun audit` if your Bun version supports it, else `npm audit`) |
| NFR-INT-01 | Integrity | Reconciliation reports zero discrepancies after every test and after seed. | 0 rows | Reconciliation query in test teardown |
| NFR-INT-02 | Integrity | All inventory changes go through `InventoryService`. | 0 direct model writes elsewhere | ESLint `no-restricted-imports` or syntax rule |
| NFR-INT-03 | Integrity | Ledger and audit tables reject UPDATE and DELETE. | 100% | DB trigger tests |
| NFR-INT-04 | Integrity | Every multi-table write is one transaction; failure leaves no partial state. | Rollback test per module | Fault-injection tests |
| NFR-INT-05 | Integrity | All CHECKs, unique constraints, partial indexes in the DB review section 7 exist. | 100% listed constraints present | Constraint tests plus a schema-inspection test |
| NFR-MNT-01 | Maintainability | Modular monolith: one folder per module (`routes`, `service`, `schemas`, `repository`); modules call each other only through service interfaces. | 0 cross-module repository imports | dependency-cruiser or ESLint boundaries rule (free OSS) |
| NFR-MNT-02 | Maintainability | TypeScript `strict`; no untyped `any` without a justification comment. | CI typecheck passes | CI |
| NFR-MNT-03 | Maintainability | Schema changes only via Prisma migrations; raw SQL (CHECKs, triggers, partial indexes) lives in migration files. | `prisma migrate` applies to an empty DB in CI | CI |
| NFR-MNT-04 | Maintainability | Key decisions recorded as short ADRs in `docs/adr/` (sessions vs JWT, ledger design, idempotency, reservation model). | ≥ 4 ADRs by end of Phase 3 | Review |
| NFR-REL-01 | Reliability | Graceful shutdown on SIGTERM: stop accepting, drain in-flight requests ≤ 10 s, disconnect Prisma. | No dropped in-flight request in test | Integration test |
| NFR-REL-02 | Reliability | `/health/ready` verifies the database within 2 s. | Returns 503 when the DB is down | Test with stopped DB |
| NFR-REL-03 | Reliability | Transient transaction errors (`40001`, `40P01`) retried ≤ 3 times with jitter. | Concurrency suite passes without flaky failures over 20 consecutive runs | CI repeat run |
| NFR-REL-04 | Reliability | Interactive transaction timeout 10 s; slow statements surface as 503 `SERVICE_UNAVAILABLE`, not hangs. | Timeout test | Integration test |
| NFR-REL-05 | Reliability | Idempotent replay returns identical status and body within 24 h. | 100% identical | Idempotency tests |
| NFR-PERF-01 | Performance | List and read endpoints on DS-M. | p95 ≤ 200 ms local; ≤ 500 ms on free hosting excluding cold start | Load script (free tool such as autocannon, MIT) plus `EXPLAIN` review |
| NFR-PERF-02 | Performance | Order confirm with ≤ 10 lines. | p95 ≤ 300 ms local | Load script |
| NFR-PERF-03 | Performance | Goods receipt with ≤ 50 lines. | p95 ≤ 500 ms local | Load script |
| NFR-PERF-04 | Performance | Ledger query by (product, warehouse, date range) uses the composite index. | Index scan in `EXPLAIN` | Test that inspects the plan |
| NFR-PERF-05 | Performance | 100 concurrent reserve attempts complete correctly. | 100% correct, completes in < 10 s | Concurrency suite |
| NFR-SCL-01 | Scalability | Single stateless API instance is the target. Sessions live in the database, so a second instance would work; the in-memory rate limiter and interval job are per instance (the job is safe to duplicate). | Documented, no multi-instance SLO | Design review |
| NFR-SCL-02 | Scalability | Hosted demo data stays within the free database cap (500 MB on the verified Supabase plan; 0.5 GB per project on Neon). Seed profile for hosted demos ≤ 100,000 movements; measure size with `pg_database_size`. | Size < 60% of cap | Documented check script |
| NFR-TST-01 | Testability | Every invariant INV-01 to INV-19 has at least one automated test named with its ID. | 19/19 | Test-name listing script |
| NFR-TST-02 | Testability | Coverage ≥ 85% lines on service layers; coverage is a floor, not the goal. | Vitest coverage report | CI |
| NFR-LOG-01 | Logging | JSON logs (Pino) include `requestId`, `userId`, method, route template, status, `durationMs`. Sensitive keys redacted (`authorization`, `password`, `token`, `passwordHash`). | 100% of requests | Log test |
| NFR-LOG-02 | Logging | Level via `LOG_LEVEL`; pretty output only in development. | n/a | Config test |
| NFR-DOC-01 | Documentation | OpenAPI document is generated from the same Zod schemas used for validation, served at `/openapi.json`, UI at `/docs`. | CI validates the document | CI |
| NFR-DOC-02 | Documentation | Every endpoint has summary, examples, error responses, permission, and idempotency note in OpenAPI. | 100% | Spec lint |
| NFR-BCK-01 | Backup | Free tiers are treated as **having no provider backups** (not verified). A script produces `pg_dump` files; hosted demo RPO ≤ 7 days; local data is reproducible from seed. | One restore drill completed | Documented drill |
| NFR-BCK-02 | Recovery | RTO ≤ 30 minutes: `migrate deploy` plus seed recreates a working demo. | Timed once | Documented drill |
| NFR-API-01 | Frontend access | CORS allow-list from env; exposed headers `X-Request-Id`, `Idempotent-Replayed`, `Retry-After`, `RateLimit-*`; no cookies required; stable error codes; ISO timestamps; typed client generatable from OpenAPI (for example `openapi-typescript`, MIT). | Generated client compiles | CI step (optional) |

---

## 11. Testing strategy

### 11.1 Principles

1. Business correctness lives in services, so service logic is tested with real PostgreSQL, not mocks. Mocking the database would hide exactly the bugs this project is about (locks, constraints, concurrency).
2. Pure logic (money arithmetic, state-machine guards, permission map, request hashing) is unit tested without a database.
3. Every invariant has a named test (NFR-TST-01).
4. Tests never run against hosted or shared data (section 11.3).

### 11.2 Test suites (all free: Vitest, Supertest, and optionally fast-check)

| Suite | Needs real PostgreSQL | What it covers |
|---|:-:|---|
| **Unit** | No | Totals and snapshot calculation; state-transition guard tables; quantity validators; permission map; idempotency request-hash canonicalization; pagination/sort allow-lists; webhook signature verification |
| **Validation** | No (HTTP layer only, DB stubbed) | Each Zod schema: required fields, bounds, unknown-field rejection, error format |
| **API integration** | Yes | Supertest against the Express app: status codes, response shapes, permissions, filters, pagination |
| **AuthN/AuthZ** | Yes | Generated route × role matrix; 401 without token; disabled user blocked immediately; session revocation; login throttling; last-admin protection |
| **Database constraints** | Yes | Raw SQL inserts that must fail: negative balances, duplicate (product, warehouse), movement without exactly one source, source = destination transfer, receipt arithmetic, UPDATE/DELETE on ledger and audit, second default address |
| **Transaction rollback** | Yes | A test-only fault hook throws after step N of receipt, dispatch, reserve, return inspect, adjustment approve; assert no balance, ledger, document, or idempotency change |
| **Idempotency** | Yes | Replay, key reuse with a different body, 10 concurrent identical requests, 4xx leaves no record, expired record behavior |
| **Inventory concurrency** | Yes | INV-04 (oversell), INV-03 (first-row race), INV-07 (receipt cap), INV-09 (shipment cap), INV-10 (return cap), INV-11 (refund cap), INV-17 (overpay), INV-18 (double approve), transfer dispatch versus reservation, expiry versus shipment |
| **Workflow** | Yes | Partial goods receipts over two deliveries with rejects; partial shipments from two warehouses; cancellation and reservation release (draft, confirmed, partially shipped); transfer with shortage (both resolutions); return with partial restock and refund |
| **Payments and webhooks** | Yes | Signature validation; replay x5; out-of-order events; unmatched events; refund events; order `paymentStatus` derivation |
| **Property-based** (optional **[R]**) | Yes | fast-check generates operation sequences; afterwards assert INV-01, 02, 15, 16 |
| **Load smoke** | Yes | autocannon scripts for NFR-PERF items; run manually, not in CI |

### 11.3 Test database safety (never damage development or production data)

1. Tests use a **separate database** named `inventory_test`, configured by `DATABASE_URL_TEST`. The application's `DATABASE_URL` is never read by tests.
2. A guard in the Vitest `globalSetup` refuses to run unless the database name ends in `_test` **and** the host is `localhost`, `127.0.0.1`, or the CI service hostname. A hosted Supabase or Neon URL fails the guard by design.
3. `globalSetup` runs `prisma migrate deploy` once against the test database (including the raw-SQL constraint migrations, so constraint tests are real).
4. Between tests, a helper truncates all tables (`TRUNCATE … RESTART IDENTITY CASCADE`), disabling the append-only triggers for that statement only inside the test helper using a dedicated test role or `session_replication_role`. Truncation is never available to the application.
5. Integration files run serially (`fileParallelism: false`) so they do not truncate under each other. Concurrency tests create parallelism **inside** a test with `Promise.all`.
6. Test data comes from small factory functions, not a shared fixture file, so each test states its own preconditions.
7. Never run destructive tests against hosted data. If you want a hosted check, use a separate empty project and run only the read-only smoke script.

### 11.4 Running locally and in CI

| Where | How |
|---|---|
| Local | PostgreSQL via a Docker Compose file (or a native PostgreSQL install) on a non-default port; `bun run test:unit` (no database), `bun run test:integration` (needs `DATABASE_URL_TEST`) |
| CI | GitHub Actions workflow with a PostgreSQL service container; steps: install, typecheck, lint, migrate, unit, integration, OpenAPI validation. Free for public repositories; private repositories have a monthly allowance (see Document C). |

### 11.5 Verifying performance and concurrency requirements

Concurrency is verified by tests (INV-04 and friends) that assert exact counts, not by "it seemed fine". Performance targets are verified by a repeatable seed (DS-M) plus an autocannon script and `EXPLAIN` checks for the indexes; numbers are recorded in a `docs/perf.md` file with the machine description so results are comparable.

---

## 12. Dependencies and integrations

| Dependency | Required? | Notes |
|---|---|---|
| PostgreSQL | Required | Local for development and testing; Supabase or Neon free tier optional for a hosted demo. |
| Prisma ORM | Required | Migrations and typed queries; raw SQL for conditional updates, locks, constraints. |
| Bun | Required | Runtime, package manager, `Bun.password`. Verify Prisma compatibility on your installed versions when you set up. |
| External payment provider | **No** | Out of scope. Simulated and manual only. |
| Email, SMS, AI, geocoding, error-monitoring SaaS | **No** | Excluded by the zero-cost rule. |
| Hosting | Optional | Local demonstration is sufficient (Document C). |

---

## 13. Acceptance criteria (system level)

Phase-level criteria are in `04-Implementation-Roadmap.md`. These are the MVP and full-system criteria.

| ID | Criterion |
|---|---|
| AC-01 | Given no users, when the seed command runs, then exactly one ADMIN exists and no public registration endpoint exists. |
| AC-02 | Given a VIEWER, when they call any write endpoint, then the response is 403 and nothing changes. |
| AC-03 | Given a disabled user with a live session, when they call any endpoint, then the response is 401. |
| AC-04 | Given a balance with on-hand 25, when 100 clients concurrently confirm 1-unit orders, then exactly 25 succeed and `reserved = 25`. |
| AC-05 | Given an approved PO line of 100, when receipts of 60 (5 rejected → 55 accepted) and then 50 are posted, then the second is rejected at 45 accepted; balances and ledger match; PO is `RECEIVED` after accepted = 100. |
| AC-06 | Given a confirmed order of 5, when 3 are shipped and the order is cancelled, then 2 reservation units are released, on-hand dropped by 3, and the ledger shows one `SHIPMENT_OUT −3`. |
| AC-07 | Given the same `Idempotency-Key` and body sent twice, then one order exists and both responses are identical with the second flagged `Idempotent-Replayed: true`. |
| AC-08 | Given a product renamed after an order, then the order still shows the original name, SKU, and price. |
| AC-09 | Given a transfer of 10 units with 8 received, when closed with `WRITE_OFF`, then source decreased by 10, destination increased by 8, and no other balance changed. |
| AC-10 | Given a payment webhook posted five times, then the payment changes state once and the order status is correct. |
| AC-11 | Given a return of more units than delivered, then the response is 422 and no return exists. |
| AC-12 | Given a refund above the remaining refundable amount, then the response is 422 and no refund row exists. |
| AC-13 | Given a failure injected mid-receipt, then no balance, ledger, document, or idempotency row changed. |
| AC-14 | Given any state after the full test suite, then the reconciliation endpoint reports zero discrepancies. |
| AC-15 | Given a fresh clone, `migrate`, `seed`, and `test` succeed locally with no paid service and no internet beyond package installation. |
| AC-16 | The OpenAPI document validates, and Swagger UI can execute login and an authenticated read call. |

---

## Appendix A: Traceability matrix

| Module | Entities | Endpoint prefix (Document B) | Permissions | Invariants | Phase |
|---|---|---|---|---|---|
| Auth and users | `User`, `UserSession` | `/auth`, `/users` | `auth:self`, `user:manage` | n/a | 1 |
| Audit | `AuditLog` | `/audit-logs` | `audit:read` | INV-14 | 1 |
| Idempotency | `IdempotencyRecord` | (header-based) | n/a | INV-06 | 1 |
| Catalog | `ProductCategory`, `Product` | `/product-categories`, `/products` | `catalog:*` | n/a | 2 |
| Warehouses, suppliers | `Warehouse`, `Supplier` | `/warehouses`, `/suppliers` | `warehouse:*`, `supplier:*` | n/a | 2 |
| Customers | `Customer`, `CustomerAddress` | `/customers` | `customer:*` | INV-12 | 2 |
| Inventory | `InventoryBalance`, `StockMovement`, `InventoryAdjustment(+Item)` | `/inventory`, `/inventory-adjustments` | `document:read`, `adjustment:*`, `inventory:reconcile` | INV-01 to 05, 14, 16, 18 | 3 |
| Procurement | `PurchaseOrder(+Item)`, `GoodsReceipt(+Item)` | `/purchase-orders`, `/goods-receipts` | `po:*`, `receipt:create` | INV-07, 18, 19 | 4 |
| Sales, reservations, shipping | `SalesOrder(+Item)`, `Reservation`, `Shipment(+Item)` | `/sales-orders`, `/reservations`, `/shipments` | `salesorder:manage`, `shipment:manage` | INV-04, 09, 12, 15, 17, 19 | 5 |
| Transfers | `WarehouseTransfer(+Item)` | `/warehouse-transfers` | `transfer:manage` | INV-08 | 6 |
| Payments, refunds | `Payment`, `Refund`, `PaymentWebhookEvent` | `/payments`, `/refunds`, `/webhooks` | `payment:record`, `refund:create`, `ops:run` | INV-11, 13, 17 | 7 |
| Returns | `Return`, `ReturnItem` | `/returns` | `return:manage`, `return:process` | INV-10 | 8 |
| Operations | n/a | `/health`, `/config`, `/admin/jobs` | `ops:run` | n/a | 0 and 5 |

## Appendix B: Items needing your confirmation

Decisions D-01 to D-20 in section 4 are provisional. The ones with the largest effect on implementation if you change them: **D-11** (reservation at confirm and all-or-nothing), **D-13** (stock leaves at dispatch), **D-05** (transfer shortage handling), **D-07** (expiry rule), **D-10** (which approvals exist).
