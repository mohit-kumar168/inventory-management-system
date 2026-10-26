# Document B: API Specification

**Project:** Inventory Management System (backend) **Version:** 0.1 (draft) **Date:** 2026-10-14
**Base path:** `/api/v1` (health endpoints live outside the version prefix)
**Depends on:** `01-SRS.md` (requirement IDs `FR-*`, invariants `INV-*`, decisions `D-*`, permissions)

---

## 1. How to read this document

1. Section 2 defines the conventions that apply to **every** endpoint. Endpoint tables do not repeat them.
2. Section 3 is the endpoint catalogue, one subsection per module. Each module has three tables:
   - **Catalogue:** method, path, purpose, permission, success status, transaction, idempotency.
   - **Request and validation:** path and query parameters, body fields, validation rules, endpoint-specific errors.
   - **Business rules and side effects:** what the operation does beyond the HTTP shape, with references to the SRS.
3. Section 4 has request and response examples. Section 5 is the OpenAPI plan.

**Implicit on every authenticated endpoint** (not repeated in tables): `401 UNAUTHENTICATED` (missing, expired, or revoked token), `403 FORBIDDEN` (role lacks the permission), `429 RATE_LIMITED`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`. Endpoints with a body or query add `400 VALIDATION_ERROR`. Endpoints with a path ID add `404 NOT_FOUND`. The error columns list only what is specific to the endpoint.

**Column legend**

| Column | Values |
|---|---|
| Permission | A permission key from SRS section 9.2, or `public`, or `signature` (webhook HMAC). Any key other than `public` and `signature` implies a valid Bearer session. |
| Tx | **Y** = runs in one database transaction (several writes, locks, or a consistent multi-row read). **N** = single read or single-statement write. |
| Idem | **Req** = `Idempotency-Key` header required (missing returns 400 `IDEMPOTENCY_KEY_REQUIRED`). **Opt** = honored if sent. **–** = not applicable (reads, or naturally safe). |

**Source tags:** endpoints and rules are **[R]** unless they map directly to your entities, in which case the SRS requirement ID is cited.

---

## 2. API conventions

### 2.1 Transport and JSON

- JSON only. Request `Content-Type: application/json` (webhooks read the raw body for signature checking). Responses are UTF-8 JSON.
- Field names are `camelCase` and match the Prisma model fields from your design.
- **Success envelope:** single resource `{ "data": { ... } }`; list `{ "data": [ ... ], "meta": { ... } }`. Optional top-level `"warnings": [{ "code": "...", "message": "..." }]` for non-fatal notices.
- **Errors:** `{ "error": { ... } }` (section 2.10). Never mixed with `data`.
- `201 Created` includes a `Location` header with the new resource path. `204 No Content` has no body.
- Unknown request fields are **rejected** (400), not ignored, so typos fail loudly.

### 2.2 Resource naming

- Plural, lowercase, kebab-case nouns: `/products`, `/product-categories`, `/purchase-orders`, `/goods-receipts`, `/warehouse-transfers`.
- Path IDs are UUIDs: `/products/{productId}`.
- Sub-collections where ownership is clear: `/customers/{customerId}/addresses`, `/sales-orders/{orderId}/shipments`.
- **State changes are `POST` actions on the resource** (`/sales-orders/{orderId}/confirm`), not `PATCH status`. Reason: each transition has its own permission, guard, side effects, and audit entry, and a client must not be able to set a status to an arbitrary value.
- **Inventory balances have no create, update, or delete endpoint.** They change only as side effects of documents (FR-INV-02).
- No hard-delete endpoints except category and customer address (both unreferenced by history).

### 2.3 Authentication

- `Authorization: Bearer <token>` obtained from `POST /auth/login`.
- Public endpoints: `POST /auth/login`, `GET /health/*`, `GET /openapi.json`, `GET /docs`, and webhooks (`signature`).
- Token is shown once at login; the server stores only its hash (FR-AUTH-02, NFR-SEC-02).

### 2.4 Pagination

**Offset pagination (default for master data and documents):**

| Query | Default | Limits |
|---|---|---|
| `page` | 1 | integer ≥ 1 |
| `pageSize` | 20 | 1 to 100 |

Response `meta`: `{ "page": 1, "pageSize": 20, "totalItems": 134, "totalPages": 7 }`.

**Cursor pagination (append-only, potentially large: stock movements, audit logs):**

| Query | Default | Limits |
|---|---|---|
| `limit` | 50 | 1 to 200 |
| `cursor` | none | opaque string from the previous response |

Ordering is newest first with a stable tie-break (`createdAt DESC, id DESC`). Response `meta`: `{ "limit": 50, "nextCursor": "eyJ..." | null }`. Cursor pagination avoids `OFFSET` scans on large tables and is not affected by inserts during paging.

### 2.5 Filtering and sorting

- Filters are query parameters named after fields: `status=ACTIVE`, `productId=<uuid>`. Multi-value uses commas: `purchaseOrderStatus=APPROVED,PARTIALLY_RECEIVED`.
- Text search is `search=` (case-insensitive substring over documented fields).
- Date ranges: `createdFrom` (inclusive) and `createdTo` (exclusive), ISO 8601 timestamps.
- Sorting: `sort=-createdAt,name` (leading `-` is descending). Each endpoint documents an **allow-list**; other fields return 400. Default `-createdAt`.
- Invalid enum values and malformed UUIDs return 400 with field details.

### 2.6 Dates and timestamps

- All timestamps are ISO 8601 in UTC with milliseconds and `Z`: `2026-10-14T09:30:00.000Z`. Stored as `timestamptz`.
- Clients convert to local time for display. The API never returns local times or epoch numbers.

### 2.7 Monetary values and currency

- Money is a JSON **integer in minor units** (for `USD`, cents). Never floats. Example: `unitPrice: 129900` means 1,299.00.
- One system currency (D-01). `GET /config` returns `{ "currency": "USD", "minorUnitExponent": 2 }`.
- Per-field limit: 0 to 1,000,000,000 minor units (the database is `Int`, max 2,147,483,647). Totals that would overflow return 422 `AMOUNT_TOO_LARGE`.
- The server computes every total and ignores client-supplied totals (INV-17).

### 2.8 Quantities

- Integers (no fractional units, D-01 assumption). Per-line maximum 1,000,000.
- Inventory fields: `onHandQuantity`, `reservedQuantity`, and computed `availableQuantity = onHandQuantity − reservedQuantity` (read-only, never accepted as input).
- Adjustment lines use signed `quantityDelta` (non-zero). All other quantities are positive unless stated.

### 2.9 Idempotency

**Header:** `Idempotency-Key: <string>`, 16 to 64 characters from `A-Za-z0-9_-` (a UUID works). Clients generate a **new key per logical operation** and reuse it only when retrying that same operation.

**Which endpoints require it:**

| Rule | Endpoints |
|---|---|
| **Required** on every `POST` that creates a business document | purchase orders, goods receipts, adjustments, transfers, sales orders, shipments, payments, refunds, returns |
| **Required** on repeatable stock-affecting actions | transfer receive |
| **Optional** (honored if sent) on state-guarded transitions | approve, reject, cancel, confirm, dispatch, deliver, submit, close, return receive and inspect |
| Not used | master-data creation (protected by unique constraints), user administration, reads |

For state-guarded transitions a repeat without a key is already safe (the second call returns `409 INVALID_STATE` because the first moved the state). Sending a key makes the retry return the **original success response** instead of a 409, which is friendlier to clients.

**Server behavior (FR-REL-03, FR-REL-04):**

1. Scope = `<userId>:<METHOD> <route template>`. Uniqueness is on (`scope`, `key`).
2. Request hash = SHA-256 of canonical JSON (sorted keys) of path params, query, and body.
3. The record insert, the business effect, and the response save happen in **one transaction**.
4. Outcomes:

| Situation | Result |
|---|---|
| New key | Process; store status and body; respond normally |
| Same key, same hash, already completed | Replay stored status and body; add `Idempotent-Replayed: true` |
| Same key, different hash | `422 IDEMPOTENCY_KEY_REUSED` |
| Same key arriving while the first is still running | The second blocks on the unique index until the first commits, then replays. If the wait exceeds 10 s: `409 IDEMPOTENCY_IN_PROGRESS` with `Retry-After: 2` |
| First attempt failed with 4xx/5xx and rolled back | No record exists; retrying with the same key runs fresh |

5. Records expire after 24 hours (`expiresAt`); a purge job removes them. Stored response bodies exclude secrets (no endpoint returns any).

### 2.10 Error format and catalogue

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "requestId": "8f14e45f-ceea-467a-9575-1c1e0b5c1f2a",
    "details": [
      { "field": "items[0].quantity", "code": "too_small", "message": "Quantity must be at least 1." }
    ]
  }
}
```

- `code`: stable machine-readable string. `message`: human-readable, safe to display. `requestId`: matches `X-Request-Id` and the log line. `details`: optional array; `field` uses a JSON path; for business rules `code` is the specific rule and extra keys (such as `requested`, `available`) are allowed.
- Never included: stack traces, SQL, table or constraint names, file paths, or other internal detail. Authentication errors never reveal whether an email exists.

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body, query, or path failed schema validation (including unknown fields, cross-field rules like received = accepted + rejected) |
| 400 | `MALFORMED_JSON` | Body is not valid JSON |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Header missing on a required endpoint |
| 401 | `UNAUTHENTICATED` | Missing, malformed, expired, or revoked token; user disabled |
| 401 | `INVALID_CREDENTIALS` | Login failed (same response for wrong email, wrong password, disabled account) |
| 401 | `INVALID_SIGNATURE` | Webhook signature or timestamp invalid |
| 403 | `FORBIDDEN` | Authenticated, but the role lacks the permission |
| 404 | `NOT_FOUND` | Path resource does not exist (also returned for unknown webhook provider) |
| 409 | `DUPLICATE_RESOURCE` | Unique constraint conflict (SKU, email, code, slug) |
| 409 | `INVALID_STATE` | Document is not in a state that allows this action |
| 409 | `INSUFFICIENT_STOCK` | Not enough available (or on-hand) stock; `details` lists each short line |
| 409 | `RESOURCE_IN_USE` | Cannot delete or deactivate because other records depend on it |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | See 2.9 |
| 409 | `CONCURRENT_MODIFICATION` | Transient lock/serialization conflict persisted after retries; safe to retry |
| 422 | `BUSINESS_RULE_VIOLATION` | A rule is violated. `details[].code` names it (list below) |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Same key, different request |
| 429 | `RATE_LIMITED` | Too many requests; `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Unexpected; details only in server logs |
| 503 | `SERVICE_UNAVAILABLE` | Database unreachable or statement timeout |

**Why 409 versus 422:** `409` means the request is well-formed and valid in general but conflicts with the **current state** (document state, stock, duplicates). `422` means the request is well-formed but breaks a **business rule** regardless of retry timing (limits, ownership, self-approval). Concurrency-sensitive limits (such as returnable quantity) are `422` because retrying the same request will still fail until the data changes.

**`BUSINESS_RULE_VIOLATION` detail codes:** `REFERENCE_NOT_FOUND`, `INACTIVE_RESOURCE`, `SELF_APPROVAL_NOT_ALLOWED`, `SELF_CHANGE_NOT_ALLOWED`, `LAST_ADMIN`, `INVALID_CURRENT_PASSWORD`, `CATEGORY_CYCLE`, `MAX_DEPTH_EXCEEDED`, `SAME_WAREHOUSE`, `WAREHOUSE_MISMATCH`, `LINE_NOT_IN_DOCUMENT`, `EXCEEDS_ORDERED_QUANTITY`, `EXCEEDS_DISPATCHED_QUANTITY`, `EXCEEDS_SHIPPABLE_QUANTITY`, `NOT_RESERVED_IN_WAREHOUSE`, `EXCEEDS_RETURNABLE_QUANTITY`, `EXCEEDS_REQUESTED_QUANTITY`, `NOT_DELIVERED`, `RETURN_WINDOW_EXPIRED`, `EXCEEDS_REFUNDABLE_AMOUNT`, `RETURN_MISMATCH`, `OVERPAYMENT`, `HAS_RECEIPTS`, `ADDRESS_NOT_OWNED`, `AMOUNT_TOO_LARGE`, `IMMUTABLE_FIELD`.

**Rule for references inside a body:** a path ID that does not exist is `404`; an ID **inside a body** that does not exist is `422` with `REFERENCE_NOT_FOUND` and `field` pointing at it.

### 2.11 Status code summary

`200` read or action success; `201` created; `204` deleted or logout; `400` shape problems; `401` identity; `403` permission; `404` missing path resource; `409` state conflict; `422` business rule; `429` throttled; `5xx` server.

### 2.12 Rate limiting

Free, in-memory `express-rate-limit` (per process, adequate for a single instance).

| Scope | Limit | Notes |
|---|---|---|
| Global per IP | 100 requests/minute (configurable) | Standard `RateLimit-*` headers; `Retry-After` on 429 |
| `POST /auth/login` | 5 failed attempts per email+IP per 15 minutes | Successful logins do not count |
| Webhooks | 600/minute per IP | Signature is verified before any processing; body capped at 256 KB |

### 2.13 Versioning

- Path versioning: `/api/v1`. Additive changes (new optional fields, new endpoints, new enum values clients can ignore) stay in v1. Breaking changes (removed or renamed fields, changed semantics) require `/api/v2` with v1 kept during a deprecation period. Clients must ignore unknown response fields.

### 2.14 Request correlation

- Clients may send `X-Request-Id` (8 to 64 chars `A-Za-z0-9_-`); otherwise the server generates a UUID. It is echoed in the response header, included in every log line, error body, and `AuditLog.requestId`.

### 2.15 Common response fragments

- Every persisted resource includes `id`, `createdAt`, and `updatedAt` where the table has them. Append-only resources (movements, audit logs) have `createdAt` only.
- Documents include `status` fields under their design names (`purchaseOrderStatus`, `orderStatus`, and so on).
- Computed fields are marked read-only in the catalogue.

---

## 3. Endpoint catalogue

### 3.1 System and operations

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| SYS-01 | GET | `/health/live` | Process is up | public | 200 | N | – |
| SYS-02 | GET | `/health/ready` | Database reachable within 2 s | public | 200 / 503 | N | – |
| SYS-03 | GET | `/api/v1/config` | System currency, minor-unit exponent, reservation TTL and expiry flag, return window | `auth:self` | 200 | N | – |
| SYS-04 | GET | `/openapi.json` | OpenAPI document | public | 200 | N | – |
| SYS-05 | GET | `/docs` | Swagger UI | public | 200 | N | – |
| SYS-06 | POST | `/api/v1/admin/jobs/housekeeping` | Run housekeeping now: expire reservations (if enabled), purge expired sessions and idempotency records | `ops:run` | 200 | Y (per batch) | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| SYS-06 | none | none | none | none |

| ID | Business rules and side effects |
|---|---|
| SYS-02 | Returns 503 with `{ "status": "unavailable" }` if the database check fails or exceeds 2 s (NFR-REL-02). |
| SYS-06 | Same code the interval job runs (FR-REL-11). Uses `FOR UPDATE SKIP LOCKED` in batches of 100. Response: `{ "data": { "reservationsExpired": 3, "sessionsPurged": 12, "idempotencyRecordsPurged": 40 } }`. Writes an audit row. Useful because a free host may sleep and skip interval runs. |

### 3.2 Authentication

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| AUTH-01 | POST | `/api/v1/auth/login` | Verify credentials, create session | public | 200 | Y | – |
| AUTH-02 | POST | `/api/v1/auth/logout` | Revoke current session | `auth:self` | 204 | N | – |
| AUTH-03 | GET | `/api/v1/auth/me` | Current user, role, permission list | `auth:self` | 200 | N | – |
| AUTH-04 | POST | `/api/v1/auth/change-password` | Change own password, revoke other sessions | `auth:self` | 204 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| AUTH-01 | none | `email`, `password` | email valid, lowercased, ≤ 254; password 1 to 128 (no minimum check on login) | 401 `INVALID_CREDENTIALS`, 429 |
| AUTH-02 | none | none | none | none |
| AUTH-03 | none | none | none | none |
| AUTH-04 | none | `currentPassword`, `newPassword` | new 12 to 128 chars and different from current | 422 `INVALID_CURRENT_PASSWORD` |

| ID | Business rules and side effects |
|---|---|
| AUTH-01 | FR-AUTH-02, 09, 10. Always verifies a hash (dummy hash for unknown email). Creates `UserSession` (hashed token, 12 h expiry), sets `lastLoginAt`. Response data: `token`, `tokenType: "Bearer"`, `expiresAt`, `user { id, name, email, role }`. Failed attempts are logged (not audited) with email hash and IP. |
| AUTH-02 | Deletes the session row. Safe to call twice (second call is 401 since the token is gone). |
| AUTH-03 | Returns `user` and `permissions: string[]` derived from the role map (FR-AUTH-08). |
| AUTH-04 | FR-AUTH-11. Updates `passwordHash`, deletes all **other** sessions of the user, writes audit row (no secrets). |

### 3.3 User administration

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| USR-01 | GET | `/api/v1/users` | List users | `user:manage` | 200 | N | – |
| USR-02 | POST | `/api/v1/users` | Create staff user | `user:manage` | 201 | Y | – |
| USR-03 | GET | `/api/v1/users/{userId}` | User detail | `user:manage` | 200 | N | – |
| USR-04 | PATCH | `/api/v1/users/{userId}` | Update name or role | `user:manage` | 200 | Y | – |
| USR-05 | POST | `/api/v1/users/{userId}/disable` | Disable account, revoke sessions | `user:manage` | 200 | Y | – |
| USR-06 | POST | `/api/v1/users/{userId}/enable` | Re-enable account | `user:manage` | 200 | Y | – |
| USR-07 | POST | `/api/v1/users/{userId}/password-reset` | Admin sets a new password | `user:manage` | 204 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| USR-01 | query `role`, `status`, `search` (name or email), `sort` (`name`, `email`, `createdAt`), `page`, `pageSize` | none | enum checks | none |
| USR-02 | none | `name`, `email`, `password`, `role` | name 1 to 100; email valid unique; password 12 to 128; role in enum | 409 `DUPLICATE_RESOURCE` |
| USR-04 | path `userId` | `name?`, `role?` (at least one) | as above | 422 `LAST_ADMIN`, 422 `SELF_CHANGE_NOT_ALLOWED` |
| USR-05 | path `userId` | `reason?` (≤ 500) | none | 409 `INVALID_STATE` (already disabled), 422 `LAST_ADMIN`, 422 `SELF_CHANGE_NOT_ALLOWED` |
| USR-06 | path `userId` | none | none | 409 `INVALID_STATE` |
| USR-07 | path `userId` | `newPassword` | 12 to 128 | none |

| ID | Business rules and side effects |
|---|---|
| USR-02 | FR-AUTH-01. Password hashed with argon2id. Response never includes `passwordHash`. Audit row. |
| USR-04 | FR-AUTH-12. A role change deletes the user's sessions so the new role applies on next login. Audit with before and after role. |
| USR-05 | Sets `status = DISABLED` and deletes all sessions in the same transaction (FR-AUTH-06). Audit. |
| USR-07 | FR-AUTH-11. No email is sent (zero-cost rule); the admin communicates the password out of band. Deletes all of the user's sessions. Audit (no secret). |

### 3.4 Product categories

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| CTG-01 | GET | `/api/v1/product-categories` | List categories (flat, or nested with `tree=true`) | `catalog:read` | 200 | N | – |
| CTG-02 | POST | `/api/v1/product-categories` | Create category | `catalog:write` | 201 | N | – |
| CTG-03 | GET | `/api/v1/product-categories/{categoryId}` | Category with parent and direct children | `catalog:read` | 200 | N | – |
| CTG-04 | PATCH | `/api/v1/product-categories/{categoryId}` | Update or move category | `catalog:write` | 200 | Y | – |
| CTG-05 | DELETE | `/api/v1/product-categories/{categoryId}` | Delete leaf category without products | `catalog:write` | 204 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| CTG-01 | query `parentId` (UUID or `root`), `search`, `tree` (bool; ignores pagination), `page`, `pageSize` | none | none | none |
| CTG-02 | none | `name`, `slug?`, `description?`, `parentId?` | name 1 to 100; slug `^[a-z0-9]+(-[a-z0-9]+)*$` ≤ 100 (derived from name if omitted); description ≤ 1000 | 409 `DUPLICATE_RESOURCE` (slug), 422 `REFERENCE_NOT_FOUND` (parent), 422 `MAX_DEPTH_EXCEEDED` |
| CTG-04 | path `categoryId` | any of the create fields | as above | 409 `DUPLICATE_RESOURCE`, 422 `CATEGORY_CYCLE`, 422 `MAX_DEPTH_EXCEEDED` |
| CTG-05 | path `categoryId` | none | none | 409 `RESOURCE_IN_USE` (has children or products) |

| ID | Business rules and side effects |
|---|---|
| CTG-04 | FR-CAT-01. Cycle check walks ancestors of the new parent inside the transaction; depth ≤ 5 includes the moved subtree height. Audit. |
| CTG-05 | FR-CAT-02. The only hard delete among catalog data. Audit. |

### 3.5 Products

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| PRD-01 | GET | `/api/v1/products` | Search, filter, sort, paginate | `catalog:read` | 200 | N | – |
| PRD-02 | POST | `/api/v1/products` | Create product | `catalog:write` | 201 | N | – |
| PRD-03 | GET | `/api/v1/products/{productId}` | Product detail with category | `catalog:read` | 200 | N | – |
| PRD-04 | PATCH | `/api/v1/products/{productId}` | Update name, description, category, price | `catalog:write` | 200 | Y | – |
| PRD-05 | POST | `/api/v1/products/{productId}/activate` | Set ACTIVE | `catalog:write` | 200 | Y | – |
| PRD-06 | POST | `/api/v1/products/{productId}/deactivate` | Set INACTIVE | `catalog:write` | 200 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| PRD-01 | query `search` (name or SKU), `categoryId`, `includeSubcategories` (bool, default false), `productStatus`, `minPrice`, `maxPrice`, `sort` (`name`, `sku`, `unitPrice`, `createdAt`), `page`, `pageSize` | none | `minPrice ≤ maxPrice`; integers | none |
| PRD-02 | none | `sku`, `name`, `description?`, `categoryId`, `unitPrice`, `productStatus?` (default ACTIVE) | sku `^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$`, uppercased by the server; name 1 to 200; description ≤ 2000; unitPrice integer 0 to 1,000,000,000 | 409 `DUPLICATE_RESOURCE` (SKU), 422 `REFERENCE_NOT_FOUND` (category) |
| PRD-04 | path `productId` | `name?`, `description?`, `categoryId?`, `unitPrice?` | as above; `sku` is not accepted (400, "sku cannot be changed") | 422 `REFERENCE_NOT_FOUND` |
| PRD-05 / 06 | path `productId` | none | none | 409 `INVALID_STATE` if already in that status |

| ID | Business rules and side effects |
|---|---|
| PRD-02 | FR-CAT-03, 04. SKU uniqueness is enforced by the database unique index; the 409 is mapped from SQLSTATE `23505`. Audit. |
| PRD-04 | A price change does not affect existing documents (INV-12). Audit with before and after values. |
| PRD-06 | FR-CAT-06, 07. If the product has on-hand stock the response includes `warnings: [{ code: "HAS_STOCK" }]`. Existing documents are unaffected. Audit. |

### 3.6 Warehouses

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| WHS-01 | GET | `/api/v1/warehouses` | List warehouses | `warehouse:read` | 200 | N | – |
| WHS-02 | POST | `/api/v1/warehouses` | Create warehouse | `warehouse:write` | 201 | N | – |
| WHS-03 | GET | `/api/v1/warehouses/{warehouseId}` | Detail | `warehouse:read` | 200 | N | – |
| WHS-04 | PATCH | `/api/v1/warehouses/{warehouseId}` | Update (code immutable) | `warehouse:write` | 200 | N | – |
| WHS-05 | POST | `/api/v1/warehouses/{warehouseId}/activate` | Set ACTIVE | `warehouse:write` | 200 | N | – |
| WHS-06 | POST | `/api/v1/warehouses/{warehouseId}/deactivate` | Set INACTIVE (guarded) | `warehouse:write` | 200 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| WHS-01 | query `search` (code or name), `warehouseStatus`, `sort` (`code`, `name`), `page`, `pageSize` | none | none | none |
| WHS-02 | none | `code`, `name`, `addressLine1`, `addressLine2?`, `city`, `state?`, `country`, `postalCode` | code `^[A-Z0-9-]{2,20}$`; name 1 to 100; lines ≤ 200; country ISO 3166-1 alpha-2; postalCode ≤ 20 | 409 `DUPLICATE_RESOURCE` (code) |
| WHS-04 | path `warehouseId` | any of the above except `code` | as above | none |
| WHS-06 | path `warehouseId` | none | none | 409 `RESOURCE_IN_USE` (reserved stock, open POs, open transfers, pending shipments), 409 `INVALID_STATE` |

| ID | Business rules and side effects |
|---|---|
| WHS-06 | FR-WH-02. Response lists blockers in `details` when refused. On success, `warnings: [{ code: "HAS_STOCK" }]` if on-hand remains. Audit. |

### 3.7 Suppliers

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| SUP-01 | GET | `/api/v1/suppliers` | List suppliers | `supplier:read` | 200 | N | – |
| SUP-02 | POST | `/api/v1/suppliers` | Create supplier | `supplier:write` | 201 | N | – |
| SUP-03 | GET | `/api/v1/suppliers/{supplierId}` | Detail | `supplier:read` | 200 | N | – |
| SUP-04 | PATCH | `/api/v1/suppliers/{supplierId}` | Update | `supplier:write` | 200 | N | – |
| SUP-05 | POST | `/api/v1/suppliers/{supplierId}/activate` | Set ACTIVE | `supplier:write` | 200 | N | – |
| SUP-06 | POST | `/api/v1/suppliers/{supplierId}/deactivate` | Set INACTIVE | `supplier:write` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| SUP-01 | query `search` (name, email), `supplierStatus`, `sort` (`name`, `createdAt`), `page`, `pageSize` | none | none | none |
| SUP-02 | none | `name`, `email?`, `phone?`, `addressLine1?`, `addressLine2?`, `city?`, `state?`, `country?`, `postalCode?` | name 1 to 200; email valid; phone `^\+?[0-9 ()-]{7,20}$`; country ISO alpha-2 | none |
| SUP-04 | path `supplierId` | any create field | as above | none |
| SUP-05 / 06 | path `supplierId` | none | none | 409 `INVALID_STATE` |

| ID | Business rules and side effects |
|---|---|
| SUP-06 | FR-SUP-02. Existing POs continue; new POs are blocked. Audit. Supplier name is not unique (SRS section 6.3), so two suppliers may share a name. |

### 3.8 Customers and addresses

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| CUS-01 | GET | `/api/v1/customers` | List customers | `customer:read` | 200 | N | – |
| CUS-02 | POST | `/api/v1/customers` | Create customer | `customer:write` | 201 | N | – |
| CUS-03 | GET | `/api/v1/customers/{customerId}` | Detail with default address | `customer:read` | 200 | N | – |
| CUS-04 | PATCH | `/api/v1/customers/{customerId}` | Update | `customer:write` | 200 | N | – |
| CUS-05 | POST | `/api/v1/customers/{customerId}/activate` | Set ACTIVE | `customer:write` | 200 | N | – |
| CUS-06 | POST | `/api/v1/customers/{customerId}/deactivate` | Set INACTIVE | `customer:write` | 200 | N | – |
| ADR-01 | GET | `/api/v1/customers/{customerId}/addresses` | List saved addresses | `customer:read` | 200 | N | – |
| ADR-02 | POST | `/api/v1/customers/{customerId}/addresses` | Add address | `customer:write` | 201 | Y | – |
| ADR-03 | GET | `/api/v1/customers/{customerId}/addresses/{addressId}` | Address detail | `customer:read` | 200 | N | – |
| ADR-04 | PATCH | `/api/v1/customers/{customerId}/addresses/{addressId}` | Update address | `customer:write` | 200 | N | – |
| ADR-05 | DELETE | `/api/v1/customers/{customerId}/addresses/{addressId}` | Delete address | `customer:write` | 204 | Y | – |
| ADR-06 | POST | `/api/v1/customers/{customerId}/addresses/{addressId}/set-default` | Make default | `customer:write` | 200 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| CUS-01 | query `search` (name, email, phone), `customerStatus`, `sort` (`name`, `createdAt`), `page`, `pageSize` | none | none | none |
| CUS-02 | none | `name`, `email`, `phone?` | name 1 to 200; email valid lowercased, unique; phone pattern | 409 `DUPLICATE_RESOURCE` (email) |
| CUS-04 | path `customerId` | `name?`, `email?`, `phone?` | as above | 409 `DUPLICATE_RESOURCE` |
| CUS-05 / 06 | path `customerId` | none | none | 409 `INVALID_STATE` |
| ADR-02 | path `customerId` | `label?`, `recipientName`, `phone?`, `addressLine1`, `addressLine2?`, `city`, `state?`, `country`, `postalCode`, `isDefault?` | recipientName 1 to 200; lines ≤ 200; city ≤ 100; country ISO alpha-2; postalCode ≤ 20; label ≤ 50 | none |
| ADR-04 | path ids | any ADR-02 field except `isDefault` | as above | none |
| ADR-05 | path ids | none | none | none |
| ADR-06 | path ids | none | none | none |

| ID | Business rules and side effects |
|---|---|
| ADR-02 | FR-CUS-03. First address becomes default automatically; `isDefault: true` clears the previous default in the same transaction (the partial unique index is the backstop). |
| ADR-04 | Editing an address never changes existing orders (INV-12, FR-CUS-05). |
| ADR-05 | FR-CUS-03. Orders referencing it keep their snapshot; `shippingAddressId` becomes NULL via ON DELETE SET NULL. If the deleted address was default, the most recently created remaining address is promoted. |
| CUS-06 | FR-CUS-06. Existing orders continue; new orders are blocked. |

### 3.9 Inventory: balances, movements, reconciliation (read-only)

There is deliberately **no** `POST`, `PUT`, `PATCH`, or `DELETE` on balances or movements. Stock changes only through documents (receipts, shipments, transfers, adjustments, returns) and reservations (FR-INV-02).

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| BAL-01 | GET | `/api/v1/inventory/balances` | Balances by product and warehouse with computed available | `document:read` | 200 | N | – |
| BAL-02 | GET | `/api/v1/inventory/balances/{balanceId}` | One balance | `document:read` | 200 | N | – |
| BAL-03 | GET | `/api/v1/products/{productId}/inventory` | Totals and per-warehouse breakdown for a product | `document:read` | 200 | N | – |
| BAL-04 | GET | `/api/v1/inventory/reconciliation` | Compare on-hand with ledger sum and reserved with reservations | `inventory:reconcile` | 200 | Y (read-only snapshot) | – |
| MOV-01 | GET | `/api/v1/inventory/movements` | Ledger history, cursor paginated | `document:read` | 200 | N | – |
| MOV-02 | GET | `/api/v1/inventory/movements/{movementId}` | One movement with its source document line | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| BAL-01 | query `productId`, `warehouseId`, `categoryId`, `minAvailable`, `maxAvailable`, `nonZeroOnly` (bool, default false), `sort` (`sku`, `onHandQuantity`, `reservedQuantity`, `availableQuantity`), `page`, `pageSize` | none | integers; UUIDs | none |
| BAL-03 | path `productId` | none | none | none |
| BAL-04 | query `productId?`, `warehouseId?`, `limit` (default 200, max 1000) | none | none | none |
| MOV-01 | query `productId`, `warehouseId`, `movementType` (comma list), `createdFrom`, `createdTo`, `limit`, `cursor` | none | `createdFrom < createdTo` | none |

| ID | Business rules and side effects |
|---|---|
| BAL-01 | Each item: `id`, `productId`, `sku`, `productName`, `warehouseId`, `warehouseCode`, `onHandQuantity`, `reservedQuantity`, `availableQuantity` (computed, INV-02), `updatedAt`. A (product, warehouse) pair with no row is simply absent (zero). |
| BAL-03 | `totals { onHandQuantity, reservedQuantity, availableQuantity, onOrderQuantity }` plus `warehouses[]`. `onOrderQuantity = Σ(orderedQuantity − receivedQuantity)` over APPROVED or PARTIALLY_RECEIVED PO lines (derived, informational). |
| BAL-04 | FR-INV-11, INV-16. Runs in a `REPEATABLE READ` read-only transaction so the comparison sees one consistent snapshot. Reports `onHandQuantity` versus `Σ quantityDelta`, and `reservedQuantity` versus `Σ remaining` of ACTIVE reservations. Returns `discrepancies: []` when healthy. **Reports only; it never repairs.** Repairs go through an adjustment so the ledger stays truthful. |
| MOV-01 | Each item: `id`, `productId`, `warehouseId`, `movementType`, `quantityDelta`, `createdAt`, `createdById`, and exactly one of `goodsReceiptItemId`, `shipmentItemId`, `transferItemId`, `adjustmentItemId`, `returnItemId` (FR-INV-10). Uses index (productId, warehouseId, createdAt) (NFR-PERF-04). |
| MOV-02 | Adds a `source` object with the document header ID and number so clients can link straight to it. |

### 3.10 Inventory adjustments

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| ADJ-01 | GET | `/api/v1/inventory-adjustments` | List adjustments | `document:read` | 200 | N | – |
| ADJ-02 | POST | `/api/v1/inventory-adjustments` | Create adjustment with lines (pending approval) | `adjustment:create` | 201 | Y | **Req** |
| ADJ-03 | GET | `/api/v1/inventory-adjustments/{adjustmentId}` | Detail with lines and, once posted, movements | `document:read` | 200 | N | – |
| ADJ-04 | POST | `/api/v1/inventory-adjustments/{adjustmentId}/approve` | Approve and post | `adjustment:approve` | 200 | Y | Opt |
| ADJ-05 | POST | `/api/v1/inventory-adjustments/{adjustmentId}/reject` | Reject | `adjustment:approve` | 200 | Y | Opt |
| ADJ-06 | POST | `/api/v1/inventory-adjustments/{adjustmentId}/cancel` | Cancel (creator or ADMIN) | `adjustment:create` | 200 | Y | Opt |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| ADJ-01 | query `warehouseId`, `inventoryAdjustmentStatus`, `reasonCode`, `createdById`, `createdFrom`, `createdTo`, `sort` (`createdAt`, `postedAt`), `page`, `pageSize` | none | none | none |
| ADJ-02 | header `Idempotency-Key` | `warehouseId`, `reasonCode`, `reasonDesc?`, `items[] { productId, quantityDelta }` | reasonCode in enum; reasonDesc required when `OTHER`, ≤ 500; 1 to 100 items, unique `productId`; `quantityDelta` non-zero integer, absolute value ≤ 1,000,000 | 422 `REFERENCE_NOT_FOUND`, 422 `INACTIVE_RESOURCE` (warehouse) |
| ADJ-04 | path `adjustmentId` | none | none | 409 `INVALID_STATE`, 422 `SELF_APPROVAL_NOT_ALLOWED`, 409 `INSUFFICIENT_STOCK` (a decrease would push on-hand below reserved; `details` per line) |
| ADJ-05 | path `adjustmentId` | `reason` | 1 to 500 | 409 `INVALID_STATE`, 422 `SELF_APPROVAL_NOT_ALLOWED` |
| ADJ-06 | path `adjustmentId` | `reason?` | ≤ 500 | 409 `INVALID_STATE`, 403 if neither creator nor ADMIN |

| ID | Business rules and side effects |
|---|---|
| ADJ-02 | FR-INV-06. Status starts `PENDING_APPROVAL`; **no stock changes yet**. Inactive products are allowed (D-17). Stock sufficiency is checked at approval, not creation, because stock can change in between. Opening stock uses reason `OPENING_BALANCE`. Audit. |
| ADJ-04 | FR-INV-06, 07, INV-05, INV-18. In one transaction, for each line in sorted (productId) order: upsert the balance and apply the delta with guard `onHand + delta >= reserved`; insert an `ADJUSTMENT` movement per line (`adjustmentItemId`); set `approvedById`, `postedAt`, status `POSTED`. Status update is guarded `WHERE status = 'PENDING_APPROVAL'`, so two concurrent approvals post once. Audit. |
| ADJ-05 | Sets `REJECTED`; reason stored in the audit log. No stock effect. |

### 3.11 Reservations (read-only)

Reservations are created by order confirmation and closed by shipment dispatch, order cancellation, or expiry. There is no standalone create or release (FR-INV-13).

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| RSV-01 | GET | `/api/v1/reservations` | List reservations | `document:read` | 200 | N | – |
| RSV-02 | GET | `/api/v1/reservations/{reservationId}` | Detail | `document:read` | 200 | N | – |
| RSV-03 | GET | `/api/v1/sales-orders/{orderId}/reservations` | Reservations of one order | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| RSV-01 | query `salesOrderId`, `productId`, `warehouseId`, `reservationStatus`, `expiresBefore`, `page`, `pageSize` | none | none | none |

| ID | Business rules and side effects |
|---|---|
| RSV-01 to 03 | Each item includes computed `quantityRemaining = quantity − quantityConsumed − quantityReleased`. Status meaning: ACTIVE (remaining > 0), CONSUMED (fully shipped), RELEASED (cancelled, or partly shipped then remainder released), EXPIRED. |

### 3.12 Warehouse transfers

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| TRF-01 | GET | `/api/v1/warehouse-transfers` | List transfers | `document:read` | 200 | N | – |
| TRF-02 | POST | `/api/v1/warehouse-transfers` | Create draft transfer | `transfer:manage` | 201 | Y | **Req** |
| TRF-03 | GET | `/api/v1/warehouse-transfers/{transferId}` | Detail with lines, movements, shortage | `document:read` | 200 | N | – |
| TRF-04 | POST | `/api/v1/warehouse-transfers/{transferId}/dispatch` | Send stock (leaves source) | `transfer:manage` | 200 | Y | Opt |
| TRF-05 | POST | `/api/v1/warehouse-transfers/{transferId}/receive` | Receive (fully or partly) at destination | `transfer:manage` | 200 | Y | **Req** |
| TRF-06 | POST | `/api/v1/warehouse-transfers/{transferId}/close` | Close with a shortage resolution | `transfer:manage` | 200 | Y | Opt |
| TRF-07 | POST | `/api/v1/warehouse-transfers/{transferId}/cancel` | Cancel a draft | `transfer:manage` | 200 | N | Opt |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| TRF-01 | query `sourceWarehouseId`, `destinationWarehouseId`, `warehouseTransferStatus`, `createdFrom`, `createdTo`, `page`, `pageSize` | none | none | none |
| TRF-02 | header `Idempotency-Key` | `sourceWarehouseId`, `destinationWarehouseId`, `items[] { productId, quantityRequested }` | 1 to 100 items; unique `productId`; quantity 1 to 1,000,000 | 422 `SAME_WAREHOUSE`, 422 `INACTIVE_RESOURCE`, 422 `REFERENCE_NOT_FOUND` |
| TRF-04 | path `transferId` | `items[]? { itemId, quantityDispatched }` (default: dispatch full requested quantity) | `0 ≤ quantityDispatched ≤ quantityRequested`; at least one line > 0 | 409 `INVALID_STATE`, 409 `INSUFFICIENT_STOCK`, 422 `LINE_NOT_IN_DOCUMENT` |
| TRF-05 | path `transferId`, header `Idempotency-Key` | `items[] { itemId, quantityReceived }`, `note?` | `quantityReceived ≥ 1`; unique `itemId` | 409 `INVALID_STATE`, 422 `EXCEEDS_DISPATCHED_QUANTITY`, 422 `INACTIVE_RESOURCE` (destination), 422 `LINE_NOT_IN_DOCUMENT` |
| TRF-06 | path `transferId` | `resolution` (`WRITE_OFF` or `RETURN_TO_SOURCE`), `reason` | reason 1 to 500 | 409 `INVALID_STATE` (no shortage, or already closed) |
| TRF-07 | path `transferId` | `reason?` | ≤ 500 | 409 `INVALID_STATE` (not DRAFT) |

| ID | Business rules and side effects |
|---|---|
| TRF-04 | FR-XF-03, INV-08. Per line in sorted (productId) order: decrement source on-hand only if `onHand − reserved >= quantityDispatched`; insert `TRANSFER_OUT` (`−quantity`, `transferItemId`); set `quantityDispatched`; status `IN_TRANSIT`; `dispatchedAt`. Stock now exists only in transit. Lines with 0 dispatched are left alone. |
| TRF-05 | FR-XF-04. Upsert destination balance `+quantityReceived`; insert `TRANSFER_IN`; cumulative received ≤ dispatched (CHECK is backstop; service checks with a row lock on the transfer lines). Status becomes `RECEIVED` when every line is fully received, else `PARTIALLY_RECEIVED`; sets `receivedAt` when fully received. |
| TRF-06 | FR-XF-05, D-05. `shortage = dispatched − received − returnedToSource` per line. `WRITE_OFF`: no stock change; shortage recorded in the audit log and visible in TRF-03. `RETURN_TO_SOURCE`: upsert source balance `+shortage`, insert `TRANSFER_IN` at the source. Status `CLOSED`. |
| TRF-07 | FR-XF-06. Only DRAFT. After dispatch the only exits are receive and close. |

### 3.13 Purchase orders

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| PO-01 | GET | `/api/v1/purchase-orders` | List purchase orders | `document:read` | 200 | N | – |
| PO-02 | POST | `/api/v1/purchase-orders` | Create draft PO with lines | `po:manage` | 201 | Y | **Req** |
| PO-03 | GET | `/api/v1/purchase-orders/{purchaseOrderId}` | Detail with lines, receipts summary | `document:read` | 200 | N | – |
| PO-04 | PATCH | `/api/v1/purchase-orders/{purchaseOrderId}` | Edit a DRAFT PO | `po:manage` | 200 | Y | – |
| PO-05 | POST | `/api/v1/purchase-orders/{purchaseOrderId}/submit` | Submit for approval | `po:manage` | 200 | N | Opt |
| PO-06 | POST | `/api/v1/purchase-orders/{purchaseOrderId}/approve` | Approve | `po:approve` | 200 | N | Opt |
| PO-07 | POST | `/api/v1/purchase-orders/{purchaseOrderId}/reject` | Return to DRAFT with reason | `po:approve` | 200 | N | Opt |
| PO-08 | POST | `/api/v1/purchase-orders/{purchaseOrderId}/cancel` | Cancel (no receipts) | `po:manage` | 200 | Y | Opt |
| PO-09 | POST | `/api/v1/purchase-orders/{purchaseOrderId}/close` | Short-close a partly received PO | `po:manage` | 200 | N | Opt |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| PO-01 | query `supplierId`, `warehouseId`, `purchaseOrderStatus` (comma list), `search` (PO number), `expectedFrom`, `expectedTo`, `createdFrom`, `createdTo`, `sort` (`createdAt`, `expectedAt`, `totalAmount`), `page`, `pageSize` | none | none | none |
| PO-02 | header `Idempotency-Key` | `supplierId`, `warehouseId`, `expectedAt?`, `items[] { productId, orderedQuantity, unitCost }` | 1 to 200 items; unique `productId`; `orderedQuantity` 1 to 1,000,000; `unitCost` integer 0 to 1,000,000,000; `expectedAt` not in the past | 422 `INACTIVE_RESOURCE` (supplier, warehouse, product), 422 `REFERENCE_NOT_FOUND`, 422 `AMOUNT_TOO_LARGE` |
| PO-04 | path `purchaseOrderId` | `supplierId?`, `warehouseId?`, `expectedAt?`, `items[]?` (replaces the whole set) | as PO-02 | 409 `INVALID_STATE` (not DRAFT), 422 as PO-02 |
| PO-05 | path `purchaseOrderId` | none | none | 409 `INVALID_STATE`, 422 `INACTIVE_RESOURCE`, 400 if no lines |
| PO-06 | path `purchaseOrderId` | none | none | 409 `INVALID_STATE`, 422 `SELF_APPROVAL_NOT_ALLOWED` |
| PO-07 | path `purchaseOrderId` | `reason` | 1 to 500 | 409 `INVALID_STATE` |
| PO-08 | path `purchaseOrderId` | `reason?` | ≤ 500 | 409 `INVALID_STATE`, 422 `HAS_RECEIPTS` |
| PO-09 | path `purchaseOrderId` | `reason` | 1 to 500 | 409 `INVALID_STATE` |

| ID | Business rules and side effects |
|---|---|
| PO-02 | FR-PO-01. `purchaseOrderNo` from `po_no_seq`; `totalAmount = Σ orderedQuantity × unitCost` computed server-side; `createdById` from the session; status `DRAFT`. Audit. |
| PO-05 | FR-PO-02. Status `PENDING_APPROVAL`. Audit. |
| PO-06 | FR-PO-03, INV-18. Guarded `WHERE status = 'PENDING_APPROVAL'`; sets `approvedById`, `orderedAt`; status `APPROVED`. Audit. |
| PO-07 | Status back to `DRAFT`; `approvedById` stays null; reason is in the audit log. |
| PO-08 | FR-PO-05. Locks the PO row and checks no receipt exists. Audit. |
| PO-09 | FR-PO-05. Status `CLOSED`; remaining ordered quantity is abandoned. No stock effect. Audit. |

### 3.14 Goods receipts

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| GRN-01 | GET | `/api/v1/goods-receipts` | List receipts | `document:read` | 200 | N | – |
| GRN-02 | POST | `/api/v1/goods-receipts` | Receive goods against a PO and update stock | `receipt:create` | 201 | Y | **Req** |
| GRN-03 | GET | `/api/v1/goods-receipts/{goodsReceiptId}` | Detail with lines and movements | `document:read` | 200 | N | – |
| GRN-04 | GET | `/api/v1/purchase-orders/{purchaseOrderId}/goods-receipts` | Receipts of one PO | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| GRN-01 | query `purchaseOrderId`, `warehouseId`, `supplierReference`, `createdFrom`, `createdTo`, `page`, `pageSize` | none | none | none |
| GRN-02 | header `Idempotency-Key` | `purchaseOrderId`, `warehouseId?`, `supplierReference?`, `items[] { purchaseOrderItemId, quantityReceived, quantityAccepted, quantityRejected, rejectionReason? }` | 1 to 200 items; unique `purchaseOrderItemId`; all quantities ≥ 0; `quantityReceived ≥ 1`; **`quantityReceived = quantityAccepted + quantityRejected`** (cross-field, 400); `rejectionReason` required (≤ 500) when `quantityRejected > 0`; `supplierReference` ≤ 100 | 409 `INVALID_STATE` (PO not APPROVED or PARTIALLY_RECEIVED), 422 `WAREHOUSE_MISMATCH`, 422 `LINE_NOT_IN_DOCUMENT`, 422 `EXCEEDS_ORDERED_QUANTITY`, 422 `INACTIVE_RESOURCE` (warehouse) |

| ID | Business rules and side effects |
|---|---|
| GRN-02 | FR-GR-01 to 06, INV-07, INV-05, INV-03. One transaction: (1) lock the PO row and its line rows `FOR UPDATE` in id order; (2) check status, warehouse equals the PO's (D-04), each line belongs to the PO, and `quantityAccepted <= orderedQuantity − receivedQuantity`; (3) create `GoodsReceipt` (`receiptNo` from sequence, status `POSTED`) and `GoodsReceiptItem` rows; (4) per line with `quantityAccepted > 0`: upsert balance `+accepted` and insert `PURCHASE_IN` movement (`goodsReceiptItemId`); rejected units never touch stock; (5) increment `PurchaseOrderItem.receivedQuantity` by accepted; (6) recompute PO status (`RECEIVED` if every line has `receivedQuantity = orderedQuantity`, else `PARTIALLY_RECEIVED`); (7) audit. Two concurrent receipts that together exceed the order: the second fails with 422 after the first commits. Response: receipt plus `purchaseOrder { id, purchaseOrderStatus }` and the created movement IDs. |

### 3.15 Sales orders

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| SO-01 | GET | `/api/v1/sales-orders` | List orders | `document:read` | 200 | N | – |
| SO-02 | POST | `/api/v1/sales-orders` | Create draft order with price and address snapshots | `salesorder:manage` | 201 | Y | **Req** |
| SO-03 | GET | `/api/v1/sales-orders/{orderId}` | Detail with lines, snapshot address, statuses | `document:read` | 200 | N | – |
| SO-04 | PATCH | `/api/v1/sales-orders/{orderId}` | Edit a DRAFT order | `salesorder:manage` | 200 | Y | – |
| SO-05 | POST | `/api/v1/sales-orders/{orderId}/confirm` | Reserve stock and confirm | `salesorder:manage` | 200 | Y | Opt |
| SO-06 | POST | `/api/v1/sales-orders/{orderId}/cancel` | Cancel and release remaining reservations | `salesorder:manage` | 200 | Y | Opt |
| SO-07 | GET | `/api/v1/sales-orders/{orderId}/returnable-items` | Eligible return quantity per line | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| SO-01 | query `customerId`, `orderStatus`, `paymentStatus`, `fulfillmentStatus` (each comma list), `search` (order number), `createdFrom`, `createdTo`, `sort` (`createdAt`, `totalAmount`), `page`, `pageSize` | none | none | none |
| SO-02 | header `Idempotency-Key` | `customerId`, **exactly one of** `shippingAddressId` or `shippingAddress { recipientName, phone?, addressLine1, addressLine2?, city, state?, country, postalCode }`, `items[] { productId, quantity, discountAmount? }`, `discountAmount?`, `shippingAmount?` | 1 to 100 items; unique `productId`; `quantity` 1 to 1,000,000; line `discountAmount` 0 to `quantity × unitPrice`; order `discountAmount` 0 to subtotal; `shippingAmount` ≥ 0; client prices and totals are **not accepted** | 422 `REFERENCE_NOT_FOUND`, 422 `INACTIVE_RESOURCE` (customer or product), 422 `ADDRESS_NOT_OWNED`, 422 `AMOUNT_TOO_LARGE` |
| SO-04 | path `orderId` | same optional fields as SO-02 (items replace the set) | as SO-02 | 409 `INVALID_STATE` (not DRAFT), 422 as SO-02 |
| SO-05 | path `orderId` | `warehouseId?` | UUID | 409 `INVALID_STATE`, 409 `INSUFFICIENT_STOCK` (`details[] { productId, sku, requested, available }`), 422 `INACTIVE_RESOURCE` (customer, a product, or the warehouse), 409 `CONCURRENT_MODIFICATION` |
| SO-06 | path `orderId` | `reason` | 1 to 500 | 409 `INVALID_STATE` (already CANCELLED or COMPLETED) |

| ID | Business rules and side effects |
|---|---|
| SO-02 | FR-SO-01 to 05, INV-12, INV-17. Copies product price, name, and SKU into each line; computes `lineTotal = quantity × unitPrice − discountAmount`, `subtotal`, `totalAmount = subtotal − discountAmount + shippingAmount`; copies the address into the eight `shipping…` fields (from the saved address or the inline one); sets `shippingAddressId` if a saved address was used; `orderNo` from sequence; status `DRAFT`, `UNPAID`, `UNFULFILLED`. **No stock is reserved.** Replayed requests return the first response. Audit. |
| SO-04 | Re-snapshots prices for replaced lines at edit time. Audit. |
| SO-05 | FR-SO-06, D-11, INV-04, INV-15. First runs a lazy sweep of expired reservations. Then, in one transaction: validate active customer, products, warehouse; build the allocation list (given warehouse, or per line from active warehouses by descending available quantity, allowing a split); sort by (productId, warehouseId); for each: `UPDATE InventoryBalance SET reservedQuantity = reservedQuantity + q WHERE … AND onHandQuantity − reservedQuantity >= q`; 0 rows means roll back everything and return `INSUFFICIENT_STOCK` listing **all** short lines (computed from a read after the failure); insert `Reservation` rows (`ACTIVE`, `expiresAt = now + TTL` when D-07 expiry is enabled); status `CONFIRMED`. Retries on `40P01`. Audit. |
| SO-06 | FR-SO-07. In one transaction: lock the order; for each ACTIVE reservation do guarded `quantityReleased += remaining`, balance `reservedQuantity −= remaining`, close the reservation; cancel PENDING shipments (their quantity was only held, not shipped); set `cancelledAt`, `cancellationReason`, status `CANCELLED`. Already dispatched shipments are untouched; `fulfillmentStatus` stays as is. Money is not refunded automatically; staff create a refund (RFD-02). Audit. |
| SO-07 | FR-RET-08. Per line: `deliveredQuantity`, `activeReturnQuantity`, `returnableQuantity`, `returnWindowEndsAt`. Read-only helper so clients do not guess eligibility. |

### 3.16 Shipments

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| SHP-01 | GET | `/api/v1/shipments` | List shipments | `document:read` | 200 | N | – |
| SHP-02 | POST | `/api/v1/shipments` | Create a pending shipment (no stock movement) | `shipment:manage` | 201 | Y | **Req** |
| SHP-03 | GET | `/api/v1/shipments/{shipmentId}` | Detail with lines | `document:read` | 200 | N | – |
| SHP-04 | POST | `/api/v1/shipments/{shipmentId}/dispatch` | Stock leaves the warehouse | `shipment:manage` | 200 | Y | Opt |
| SHP-05 | POST | `/api/v1/shipments/{shipmentId}/deliver` | Mark delivered | `shipment:manage` | 200 | Y | Opt |
| SHP-06 | POST | `/api/v1/shipments/{shipmentId}/cancel` | Cancel a pending shipment | `shipment:manage` | 200 | N | Opt |
| SHP-07 | GET | `/api/v1/sales-orders/{orderId}/shipments` | Shipments of one order | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| SHP-01 | query `salesOrderId`, `warehouseId`, `shipmentStatus`, `trackingNo`, `createdFrom`, `createdTo`, `page`, `pageSize` | none | none | none |
| SHP-02 | header `Idempotency-Key` | `salesOrderId`, `warehouseId`, `items[] { salesOrderItemId, quantity }`, `carrier?`, `trackingNo?` | 1 to 100 items; unique `salesOrderItemId`; `quantity` ≥ 1; carrier ≤ 100; trackingNo ≤ 100 | 409 `INVALID_STATE` (order not CONFIRMED), 422 `LINE_NOT_IN_DOCUMENT`, 422 `EXCEEDS_SHIPPABLE_QUANTITY`, 422 `NOT_RESERVED_IN_WAREHOUSE` |
| SHP-04 | path `shipmentId` | `carrier?`, `trackingNo?` | as above | 409 `INVALID_STATE`, 409 `INSUFFICIENT_STOCK` (reservation no longer covers the quantity) |
| SHP-05 | path `shipmentId` | `deliveredAt?` | not in the future, not before `dispatchedAt` | 409 `INVALID_STATE` |
| SHP-06 | path `shipmentId` | `reason?` | ≤ 500 | 409 `INVALID_STATE` (not PENDING) |

| ID | Business rules and side effects |
|---|---|
| SHP-02 | FR-SH-01, 02, INV-09, D-13. Locks the `SalesOrderItem` rows (ordered by id); `eligible = quantity − Σ(non-cancelled shipment lines)`; also requires `quantity ≤ remaining ACTIVE reservation in the shipment warehouse` minus other PENDING shipments in that warehouse for the same line. Creates `Shipment` (`shipmentNo` from sequence, `PENDING`) and `ShipmentItem` rows. **No balance or ledger change.** Audit. |
| SHP-04 | FR-SH-03, INV-05, INV-15. In one transaction per line in sorted order: guarded reservation UPDATE `quantityConsumed += q WHERE status = 'ACTIVE' AND quantity − consumed − released >= q`; balance `UPDATE … SET onHand = onHand − q, reserved = reserved − q WHERE reserved >= q AND onHand >= q`; insert `SHIPMENT_OUT` (`−q`, `shipmentItemId`); close reservations that reach zero remaining; set status `DISPATCHED`, `dispatchedAt`, carrier, tracking; recompute `fulfillmentStatus` (`PARTIALLY_SHIPPED` or `SHIPPED`). Audit. |
| SHP-05 | FR-SH-04. Status `DELIVERED`, `deliveredAt`. If all lines of all order items are delivered: `fulfillmentStatus = DELIVERED` and `orderStatus = COMPLETED`. Audit. |
| SHP-06 | FR-SH-05. Frees the held quantity; no stock reversal needed because none moved. |

### 3.17 Payments

Payments are **manual records or a simulated provider** (SRS 6.9). Nothing here moves real money.

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| PAY-01 | GET | `/api/v1/payments` | List payments | `document:read` | 200 | N | – |
| PAY-02 | POST | `/api/v1/payments` | Record a manual payment, or start a simulated one | `payment:record` | 201 | Y | **Req** |
| PAY-03 | GET | `/api/v1/payments/{paymentId}` | Detail with refunds and webhook events | `document:read` | 200 | N | – |
| PAY-04 | POST | `/api/v1/payments/{paymentId}/cancel` | Cancel a pending payment | `payment:record` | 200 | Y | Opt |
| PAY-05 | GET | `/api/v1/sales-orders/{orderId}/payments` | Payments of one order | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| PAY-01 | query `salesOrderId`, `paymentStatus`, `provider`, `createdFrom`, `createdTo`, `page`, `pageSize` | none | none | none |
| PAY-02 | header `Idempotency-Key` | `salesOrderId`, `amount`, `provider` (`MANUAL` or `SIMULATED`), `providerReference?` | amount integer 1 to 1,000,000,000; `providerReference` allowed only for `MANUAL` (≤ 100, free-text receipt or bank reference); for `SIMULATED` the server generates `sim_pay_…` and a client value is rejected | 409 `INVALID_STATE` (order not CONFIRMED), 422 `OVERPAYMENT`, 422 `REFERENCE_NOT_FOUND` |
| PAY-04 | path `paymentId` | `reason?` | ≤ 500 | 409 `INVALID_STATE` (not PENDING) |

| ID | Business rules and side effects |
|---|---|
| PAY-02 | FR-PAY-01, 02, 03, 07, INV-17. Locks the order row; `Σ(SUCCEEDED + PENDING) + amount ≤ totalAmount` else `OVERPAYMENT`. `MANUAL`: payment created `SUCCEEDED` with `completedAt`, order `paymentStatus` recomputed; response states `"provider": "MANUAL"`. `SIMULATED`: created `PENDING`; outcome arrives via a signed webhook (use WHK-04 in development). If the order becomes fully paid, reservation `expiresAt` is cleared (D-07). Audit. |
| PAY-04 | Status `CANCELLED`; failed and cancelled attempts remain as history (FR-PAY-03). |

### 3.18 Payment webhooks and the development simulator

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| WHK-01 | POST | `/api/v1/webhooks/payments/{provider}` | Receive a provider event (`provider` = `simulated` in this project) | signature | 200 | Y | – (event ID is the idempotency key) |
| WHK-02 | GET | `/api/v1/payment-webhook-events` | Inspect received events | `ops:run` | 200 | N | – |
| WHK-03 | GET | `/api/v1/payment-webhook-events/{eventId}` | Event with raw payload | `ops:run` | 200 | N | – |
| WHK-04 | POST | `/api/v1/dev/payment-simulator/payments/{paymentId}/events` | Generate and deliver a signed simulated event for a payment | `ops:run` | 200 | Y | – |
| WHK-05 | POST | `/api/v1/dev/payment-simulator/refunds/{refundId}/events` | Same for a refund | `ops:run` | 200 | Y | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| WHK-01 | path `provider`; headers `X-Webhook-Timestamp` (Unix seconds), `X-Webhook-Signature` (`sha256=<hex>`) | `id` (provider event ID), `type`, `createdAt`, `data { reference, amount?, failureReason? }` | `type` in `payment.succeeded`, `payment.failed`, `refund.succeeded`, `refund.failed`; id 1 to 100; `reference` 1 to 100; raw body ≤ 256 KB | 401 `INVALID_SIGNATURE` (bad HMAC or timestamp older than 5 minutes), 404 unknown provider, 400 bad payload |
| WHK-02 | query `provider`, `processingStatus`, `eventType`, `receivedFrom`, `receivedTo`, `page`, `pageSize` | none | none | none |
| WHK-04 / 05 | path `paymentId` or `refundId` | `outcome` (`SUCCEEDED` or `FAILED`), `eventId?`, `repeat?` (0 to 5 extra deliveries of the same event) | `repeat` integer 0 to 5 | 404 when the simulator is disabled (route not mounted unless `ENABLE_PAYMENT_SIMULATOR=true`), 409 `INVALID_STATE` |

| ID | Business rules and side effects |
|---|---|
| WHK-01 | FR-PAY-04 to 07, INV-13. Signature = HMAC-SHA256 over `"<timestamp>.<raw body>"` with `PAYMENT_WEBHOOK_SECRET`, compared in constant time; the route reads the **raw** body before JSON parsing. Steps: (1) verify signature and timestamp; (2) `INSERT PaymentWebhookEvent … ON CONFLICT (provider, providerEventId) DO NOTHING`; if the row already existed and is `PROCESSED` or `IGNORED`, respond `200 { "received": true, "result": "DUPLICATE" }` with no effect; (3) claim with `UPDATE … SET processingStatus = 'RECEIVED' WHERE id = ? AND processingStatus IN ('RECEIVED','FAILED') RETURNING` and match `data.reference` to a payment or refund by `providerReference`; (4) apply the transition guarded on `PENDING`; recompute the order `paymentStatus` in the same transaction; mark `PROCESSED`. A late `failed` after `succeeded` is `IGNORED`; an unknown reference stores the event with `paymentId = NULL` and marks it `IGNORED`. If processing throws, the event is marked `FAILED` (separate transaction), the response is 500, and the provider's retry reprocesses it. Responses: `result` is `PROCESSED`, `DUPLICATE`, or `IGNORED`. Audit row only for state changes and failures. |
| WHK-04 | Builds the exact payload a provider would send, signs it with the shared secret, and calls the same handler as WHK-01 in-process. `repeat` re-delivers the same event ID to demonstrate replay safety. Labelled in every response as `"simulated": true`. Disabled by default; never enable it on a public demo that should look like real processing. |

### 3.19 Refunds

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| RFD-01 | GET | `/api/v1/refunds` | List refunds | `document:read` | 200 | N | – |
| RFD-02 | POST | `/api/v1/refunds` | Create refund against a payment | `refund:create` | 201 | Y | **Req** |
| RFD-03 | GET | `/api/v1/refunds/{refundId}` | Detail | `document:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| RFD-01 | query `paymentId`, `returnId`, `refundStatus`, `createdFrom`, `createdTo`, `page`, `pageSize` | none | none | none |
| RFD-02 | header `Idempotency-Key` | `paymentId`, `amount`, `reason`, `returnId?`, `providerReference?` | amount integer ≥ 1; reason 1 to 500; `providerReference` only for MANUAL payments | 409 `INVALID_STATE` (payment not SUCCEEDED), 422 `EXCEEDS_REFUNDABLE_AMOUNT`, 422 `RETURN_MISMATCH` (return belongs to a different order), 422 `REFERENCE_NOT_FOUND` |

| ID | Business rules and side effects |
|---|---|
| RFD-02 | FR-REF-01 to 04, INV-11. Locks the `Payment` row `FOR UPDATE`; `refundable = payment.amount − Σ(PENDING + SUCCEEDED refunds)`; `amount ≤ refundable` else 422 with `details { requested, refundable }`. With `returnId`: the return must belong to the payment's order, and `amount ≤ Σ floor(lineTotal × quantityReceived ÷ quantity)` over its PASSED lines minus refunds already linked to that return (D-14). `MANUAL` payment → refund created `SUCCEEDED` immediately (bookkeeping record); `SIMULATED` payment → `PENDING`, resolved by signed events (WHK-05). Recomputes the order `paymentStatus` in the same transaction. A `FAILED` refund stops counting toward the cap. Audit. |

### 3.20 Returns

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| RET-01 | GET | `/api/v1/returns` | List returns | `document:read` | 200 | N | – |
| RET-02 | POST | `/api/v1/returns` | Request a return | `return:manage` | 201 | Y | **Req** |
| RET-03 | GET | `/api/v1/returns/{returnId}` | Detail with lines and linked refunds | `document:read` | 200 | N | – |
| RET-04 | POST | `/api/v1/returns/{returnId}/approve` | Approve the request | `return:manage` | 200 | N | Opt |
| RET-05 | POST | `/api/v1/returns/{returnId}/reject` | Reject the request | `return:manage` | 200 | N | Opt |
| RET-06 | POST | `/api/v1/returns/{returnId}/cancel` | Cancel before receipt | `return:manage` | 200 | N | Opt |
| RET-07 | POST | `/api/v1/returns/{returnId}/receive` | Record physically received quantities | `return:process` | 200 | Y | Opt |
| RET-08 | POST | `/api/v1/returns/{returnId}/inspect` | Inspect lines, decide disposition, restock | `return:process` | 200 | Y | Opt |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| RET-01 | query `salesOrderId`, `customerId`, `returnStatus`, `createdFrom`, `createdTo`, `page`, `pageSize` | none | none | none |
| RET-02 | header `Idempotency-Key` | `salesOrderId`, `reason` (≤ 500), `items[] { salesOrderItemId, quantityRequested }` | 1 to 100 items; unique `salesOrderItemId`; `quantityRequested` ≥ 1; **`customerId` is not accepted** (derived from the order) | 422 `NOT_DELIVERED`, 422 `RETURN_WINDOW_EXPIRED`, 422 `EXCEEDS_RETURNABLE_QUANTITY` (`details { salesOrderItemId, requested, returnable }`), 422 `LINE_NOT_IN_DOCUMENT` |
| RET-05 | path `returnId` | `reason` | 1 to 500 | 409 `INVALID_STATE` |
| RET-07 | path `returnId` | `items[] { returnItemId, quantityReceived }` (all lines) | `0 ≤ quantityReceived ≤ quantityRequested` | 409 `INVALID_STATE` (not APPROVED), 422 `EXCEEDS_REQUESTED_QUANTITY` |
| RET-08 | path `returnId` | `items[] { returnItemId, inspectionStatus, disposition, quantityRestocked, restockWarehouseId? }` (any subset of uninspected lines) | `PASSED` + `RESTOCK`: `1 ≤ quantityRestocked ≤ quantityReceived` and `restockWarehouseId` required; `PASSED` + `SCRAP`: `quantityRestocked = 0`; `FAILED`: disposition `SCRAP`, `quantityRestocked = 0` | 409 `INVALID_STATE` (not RECEIVED, or line already inspected), 422 `INACTIVE_RESOURCE` (warehouse), 422 `LINE_NOT_IN_DOCUMENT` |

| ID | Business rules and side effects |
|---|---|
| RET-02 | FR-RET-01 to 03, INV-10. One transaction: lock the `SalesOrderItem` rows `FOR UPDATE` ordered by id (same lock as shipment creation, same order, so no deadlock); `deliveredQty = Σ quantity of DELIVERED shipment lines`; `returnable = deliveredQty − Σ quantityRequested in returns not REJECTED or CANCELLED`; each request ≤ returnable; window check against the latest `deliveredAt` (D-15). Creates `Return` (`returnNo` from sequence, `REQUESTED`, `customerId` from the order) and lines with `inspectionStatus = PENDING`. Audit. |
| RET-04 / 05 | FR-RET-04. Reject frees the requested quantity for future returns; reason in the audit log. |
| RET-06 | Only `REQUESTED` or `APPROVED`. Frees the quantity. |
| RET-07 | FR-RET-05. Sets `quantityReceived` per line and `receivedAt`; status `RECEIVED`. **No stock change yet**, because goods are not yet accepted. |
| RET-08 | FR-RET-06, INV-05. Per inspected line: set `inspectionStatus`, `disposition`, `quantityRestocked`, `restockWarehouseId`; for `quantityRestocked > 0`: upsert the balance `+quantityRestocked` and insert `RETURN_IN` (`returnItemId`). When every line is inspected, status `COMPLETED` and `completedAt` set. PASSED lines become refundable (D-14); refund creation is separate (RFD-02). Audit. |

### 3.21 Audit history

| ID | Method | Path | Purpose | Permission | Success | Tx | Idem |
|---|---|---|---|---|---|---|---|
| AUD-01 | GET | `/api/v1/audit-logs` | Search audit history, cursor paginated | `audit:read` | 200 | N | – |
| AUD-02 | GET | `/api/v1/audit-logs/{auditLogId}` | One entry with before and after data | `audit:read` | 200 | N | – |

| ID | Params | Body | Validation | Specific errors |
|---|---|---|---|---|
| AUD-01 | query `entityType`, `entityId`, `actorUserId`, `action`, `requestId`, `createdFrom`, `createdTo`, `limit`, `cursor` | none | `createdFrom < createdTo` | none |

| ID | Business rules and side effects |
|---|---|
| AUD-01 / 02 | FR-REL-01, 02, INV-14. Read-only; there is no write or delete API. `beforeData` and `afterData` are JSON snapshots with secrets already redacted at write time. Index (`entityType`, `entityId`, `createdAt`). The drill-down for one document is `?entityType=SalesOrder&entityId=<uuid>`. |

### 3.22 Endpoint count and what was deliberately not created

124 endpoints across 22 groups, most of them small reads and master-data operations. Not created on purpose:

| Not created | Reason |
|---|---|
| `PUT/PATCH/DELETE /inventory/balances` | Violates FR-INV-02. |
| `POST/DELETE /reservations` | Would let reservations drift from orders (FR-INV-13). |
| Separate line-item CRUD (`/purchase-orders/{id}/items`, `/sales-orders/{id}/items`) | Lines are replaced as a set while the document is DRAFT; fewer endpoints, simpler invariants. |
| `PATCH …/status` generic setters | Each transition is its own guarded action. |
| Delete endpoints for products, customers, suppliers, warehouses, documents | History must remain; use deactivate or cancel. |
| Public registration, password-reset-by-email | Excluded by SRS scope. |
| Reports and dashboards | Out of initial scope. The read endpoints plus filters cover backend needs. |

---

## 4. Request and response examples

All values are fictional. Money is in minor units (USD cents). IDs are shortened UUIDs for readability; real IDs are full UUIDs. Tokens and signatures are placeholders, not credentials.

### 4.1 Login (AUTH-01)

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "ops.admin@example.com", "password": "<your password>" }
```

```json
HTTP/1.1 200 OK
{
  "data": {
    "token": "<256-bit random token, shown once>",
    "tokenType": "Bearer",
    "expiresAt": "2026-10-15T01:30:00.000Z",
    "user": { "id": "u-1a2b", "name": "Ops Admin", "email": "ops.admin@example.com", "role": "ADMIN" }
  }
}
```

### 4.2 Validation error (PRD-02 with bad input)

```http
POST /api/v1/products
Authorization: Bearer <token>

{ "sku": "x", "name": "", "categoryId": "not-a-uuid", "unitPrice": -5, "color": "grey" }
```

```json
HTTP/1.1 400 Bad Request
X-Request-Id: 8f14e45f-ceea-467a-9575-1c1e0b5c1f2a
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "requestId": "8f14e45f-ceea-467a-9575-1c1e0b5c1f2a",
    "details": [
      { "field": "sku", "code": "invalid_format", "message": "SKU must be 2 to 64 characters: letters, digits, '.', '_' or '-'." },
      { "field": "name", "code": "too_small", "message": "Name must not be empty." },
      { "field": "categoryId", "code": "invalid_uuid", "message": "Must be a valid UUID." },
      { "field": "unitPrice", "code": "too_small", "message": "Must be 0 or greater." },
      { "field": "color", "code": "unrecognized_key", "message": "Unknown field." }
    ]
  }
}
```

### 4.3 Create product (PRD-02)

```json
// Request
{ "sku": "lap-14-gry", "name": "14-inch Laptop, Grey", "categoryId": "c-77aa", "unitPrice": 129900 }
```
```json
// 201 Created   Location: /api/v1/products/p-3c91
{
  "data": {
    "id": "p-3c91", "sku": "LAP-14-GRY", "name": "14-inch Laptop, Grey", "description": null,
    "categoryId": "c-77aa", "unitPrice": 129900, "productStatus": "ACTIVE",
    "createdAt": "2026-10-14T09:30:00.000Z", "updatedAt": "2026-10-14T09:30:00.000Z"
  }
}
```

### 4.4 Create sales order (SO-02)

```http
POST /api/v1/sales-orders
Idempotency-Key: 6b0f2c64-3a7e-4f9d-8a41-5d9b7e2c1a10
```
```json
{
  "customerId": "cu-91d2",
  "shippingAddressId": "ad-55e1",
  "items": [
    { "productId": "p-3c91", "quantity": 2, "discountAmount": 5000 },
    { "productId": "p-8e04", "quantity": 3 }
  ],
  "shippingAmount": 1500
}
```
```json
// 201 Created
{
  "data": {
    "id": "so-0042", "orderNo": "SO-2026-000042", "customerId": "cu-91d2",
    "orderStatus": "DRAFT", "paymentStatus": "UNPAID", "fulfillmentStatus": "UNFULFILLED",
    "subtotal": 262297, "discountAmount": 0, "shippingAmount": 1500, "totalAmount": 263797,
    "shippingAddressId": "ad-55e1",
    "shippingRecipientName": "Asha Verma", "shippingPhone": "+91 98765 43210",
    "shippingAddressLine1": "12 Lake Road", "shippingAddressLine2": null,
    "shippingCity": "Udaipur", "shippingState": "Rajasthan", "shippingCountry": "IN", "shippingPostalCode": "313001",
    "items": [
      { "id": "si-1", "productId": "p-3c91", "skuSnapshot": "LAP-14-GRY", "productNameSnapshot": "14-inch Laptop, Grey",
        "quantity": 2, "unitPrice": 129900, "discountAmount": 5000, "lineTotal": 254800 },
      { "id": "si-2", "productId": "p-8e04", "skuSnapshot": "MSE-WL-BLK", "productNameSnapshot": "Wireless Mouse, Black",
        "quantity": 3, "unitPrice": 2499, "discountAmount": 0, "lineTotal": 7497 }
    ],
    "createdAt": "2026-10-14T09:41:00.000Z"
  }
}
```

Check: `2×129900 − 5000 = 254800`; `3×2499 = 7497`; `subtotal = 262297`; `total = 262297 − 0 + 1500 = 263797`.

### 4.5 Confirm order: success and insufficient stock (SO-05)

```json
// 200 OK (abridged)
{
  "data": {
    "order": { "id": "so-0042", "orderStatus": "CONFIRMED" },
    "reservations": [
      { "id": "r-1", "productId": "p-3c91", "warehouseId": "w-main", "quantity": 2, "quantityRemaining": 2,
        "reservationStatus": "ACTIVE", "expiresAt": null },
      { "id": "r-2", "productId": "p-8e04", "warehouseId": "w-main", "quantity": 3, "quantityRemaining": 3,
        "reservationStatus": "ACTIVE", "expiresAt": null }
    ]
  }
}
```
```json
// 409 Conflict: nothing was reserved
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough available stock for 1 line. No stock was reserved.",
    "requestId": "2d4c...",
    "details": [
      { "code": "INSUFFICIENT_STOCK", "field": "items[0]", "productId": "p-3c91", "sku": "LAP-14-GRY", "requested": 2, "available": 1 }
    ]
  }
}
```

### 4.6 Partial goods receipt with rejects (GRN-02)

PO line `po-item-9` orders 100 units. First delivery: 60 arrive, 5 are damaged.

```http
POST /api/v1/goods-receipts
Idempotency-Key: 0c9e4f2a-7d11-4b3e-9a5f-2e8d6c4b1a77
```
```json
{
  "purchaseOrderId": "po-0007",
  "supplierReference": "DN-88213",
  "items": [
    { "purchaseOrderItemId": "po-item-9", "quantityReceived": 60, "quantityAccepted": 55,
      "quantityRejected": 5, "rejectionReason": "Cracked casing on arrival" }
  ]
}
```
```json
// 201 Created
{
  "data": {
    "id": "gr-0003", "receiptNo": "GR-2026-000003", "goodsReceiptStatus": "POSTED", "warehouseId": "w-main",
    "items": [ { "purchaseOrderItemId": "po-item-9", "quantityReceived": 60, "quantityAccepted": 55, "quantityRejected": 5 } ],
    "purchaseOrder": { "id": "po-0007", "purchaseOrderStatus": "PARTIALLY_RECEIVED" },
    "movements": [ { "id": "m-501", "movementType": "PURCHASE_IN", "quantityDelta": 55 } ]
  }
}
```

Receiving 50 more later would make cumulative accepted 105, over the ordered 100:

```json
// 422 Unprocessable Entity
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION", "message": "Accepted quantity exceeds the remaining ordered quantity.", "requestId": "a1b2...",
    "details": [ { "code": "EXCEEDS_ORDERED_QUANTITY", "field": "items[0].quantityAccepted",
                   "purchaseOrderItemId": "po-item-9", "ordered": 100, "alreadyAccepted": 55, "remaining": 45, "requested": 50 } ]
  }
}
```

### 4.7 Transfer: dispatch, partial receive, close with shortage (TRF-04, 05, 06)

```json
// POST /warehouse-transfers/t-0012/dispatch  -> 200
{ "data": { "id": "t-0012", "warehouseTransferStatus": "IN_TRANSIT",
            "items": [ { "id": "ti-1", "productId": "p-8e04", "quantityRequested": 20, "quantityDispatched": 20, "quantityReceived": 0 } ] } }

// POST /warehouse-transfers/t-0012/receive   (Idempotency-Key required)
{ "items": [ { "itemId": "ti-1", "quantityReceived": 17 } ] }
// -> 200  warehouseTransferStatus: "PARTIALLY_RECEIVED"

// POST /warehouse-transfers/t-0012/close
{ "resolution": "WRITE_OFF", "reason": "3 units lost in transit, carrier claim opened" }
// -> 200  warehouseTransferStatus: "CLOSED"; source decreased by 20, destination increased by 17
```

### 4.8 Simulated payment and webhook replay (PAY-02, WHK-01)

```json
// POST /payments   (Idempotency-Key required)
{ "salesOrderId": "so-0042", "amount": 263797, "provider": "SIMULATED" }
// 201
{ "data": { "id": "pay-0021", "paymentStatus": "PENDING", "provider": "SIMULATED",
            "providerReference": "sim_pay_9f3a2c", "amount": 263797, "simulated": true } }
```

A provider (or the development simulator, WHK-04) then posts:

```http
POST /api/v1/webhooks/payments/simulated
X-Webhook-Timestamp: 1791970000
X-Webhook-Signature: sha256=<hex HMAC of "1791970000." + raw body>
```
```json
{ "id": "evt_sim_0001", "type": "payment.succeeded", "createdAt": "2026-10-14T09:50:00.000Z",
  "data": { "reference": "sim_pay_9f3a2c", "amount": 263797 } }
```
```json
// 200 OK first delivery
{ "received": true, "result": "PROCESSED" }
// 200 OK every repeat delivery of evt_sim_0001: no state change
{ "received": true, "result": "DUPLICATE" }
// 401 if the signature or timestamp is invalid
{ "error": { "code": "INVALID_SIGNATURE", "message": "Webhook signature is invalid.", "requestId": "..." } }
```

### 4.9 Return, inspection, and refund limit (RET-02, RET-08, RFD-02)

```json
// POST /returns   (Idempotency-Key required)
{ "salesOrderId": "so-0042", "reason": "Screen flicker",
  "items": [ { "salesOrderItemId": "si-1", "quantityRequested": 1 } ] }
// 201  returnStatus: "REQUESTED", returnNo "RT-2026-000005"; customerId derived from the order

// POST /returns/rt-0005/inspect
{ "items": [ { "returnItemId": "ri-1", "inspectionStatus": "PASSED", "disposition": "RESTOCK",
               "quantityRestocked": 1, "restockWarehouseId": "w-main" } ] }
// 200  returnStatus: "COMPLETED"; movement RETURN_IN +1 at w-main
```

Refundable for that line: `floor(254800 × 1 ÷ 2) = 127400`.

```json
// POST /refunds   { "paymentId": "pay-0021", "returnId": "rt-0005", "amount": 130000, "reason": "Return rt-0005" }
// 422
{ "error": { "code": "BUSINESS_RULE_VIOLATION", "message": "Refund exceeds the refundable amount.", "requestId": "c3d4...",
  "details": [ { "code": "EXCEEDS_REFUNDABLE_AMOUNT", "field": "amount", "requested": 130000, "refundable": 127400 } ] } }
```

### 4.10 Idempotent replay and key reuse

```http
POST /api/v1/sales-orders   (same body, same Idempotency-Key, second time)
```
```
HTTP/1.1 201 Created
Idempotent-Replayed: true
Location: /api/v1/sales-orders/so-0042
(body identical to the first response)
```
```json
// Same key, different body -> 422
{ "error": { "code": "IDEMPOTENCY_KEY_REUSED",
             "message": "This Idempotency-Key was already used with a different request.", "requestId": "e5f6..." } }
```

---

## 5. OpenAPI plan

### 5.1 Approach (zero cost)

1. Define every request, response, and error shape **once** as a Zod schema. The same schema validates requests at runtime and feeds the OpenAPI generator, so the spec cannot drift from the code (NFR-DOC-01). A library such as `@asteasolutions/zod-to-openapi` (open source) does this; confirm its current Zod version support when you install it.
2. Register each route (method, path, permission, schemas, examples) in one registry. That same registry is the **permission map** that the middleware and the route × role test use, which gives you NFR-SEC-03 and NFR-SEC-04 for free.
3. Serve the document at `GET /openapi.json` and the UI at `GET /docs` using `swagger-ui-express` (open source).
4. In CI, validate the generated document with an open-source OpenAPI linter, and optionally generate a typed client with `openapi-typescript`.
5. Use custom `x-` fields to carry what OpenAPI cannot express natively: `x-permission`, `x-transaction`, `x-idempotency` (`required`, `optional`, `none`), `x-business-rules`. Swagger UI ignores unknown `x-` fields, so they act as documentation.

### 5.2 Tags (one per module)

`System`, `Auth`, `Users`, `Product Categories`, `Products`, `Warehouses`, `Suppliers`, `Customers`, `Customer Addresses`, `Inventory`, `Inventory Adjustments`, `Reservations`, `Warehouse Transfers`, `Purchase Orders`, `Goods Receipts`, `Sales Orders`, `Shipments`, `Payments`, `Webhooks`, `Refunds`, `Returns`, `Audit`.

### 5.3 Skeleton (convert the catalogue into this shape)

```yaml
openapi: 3.1.0
info:
  title: Inventory Management API
  version: 0.1.0
  description: >
    Backend for an inventory management system. Money is integer minor units.
    Timestamps are ISO 8601 UTC. See the API Specification document for conventions.
servers:
  - url: http://localhost:3000
    description: Local development
security:
  - bearerAuth: []
tags:
  - name: Sales Orders
  - name: Inventory
  # ... one per module in 5.2

paths:
  /api/v1/sales-orders/{orderId}/confirm:
    post:
      tags: [Sales Orders]
      operationId: confirmSalesOrder
      summary: Reserve stock and confirm the order
      description: >
        Reserves stock for every line in one transaction (all or nothing).
        Returns 409 INSUFFICIENT_STOCK listing every short line; nothing is reserved on failure.
      x-permission: salesorder:manage
      x-transaction: true
      x-idempotency: optional
      parameters:
        - $ref: '#/components/parameters/OrderId'
        - $ref: '#/components/parameters/IdempotencyKeyOptional'
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              properties:
                warehouseId: { type: string, format: uuid }
      responses:
        '200':
          description: Order confirmed and stock reserved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ConfirmSalesOrderResponse' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }
        '409': { $ref: '#/components/responses/Conflict' }
        '422': { $ref: '#/components/responses/RuleViolation' }

components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, description: Opaque session token from POST /auth/login }
  parameters:
    OrderId: { name: orderId, in: path, required: true, schema: { type: string, format: uuid } }
    IdempotencyKeyRequired:
      name: Idempotency-Key
      in: header
      required: true
      schema: { type: string, minLength: 16, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' }
    IdempotencyKeyOptional:
      name: Idempotency-Key
      in: header
      required: false
      schema: { type: string, minLength: 16, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' }
    Page:     { name: page,     in: query, schema: { type: integer, minimum: 1, default: 1 } }
    PageSize: { name: pageSize, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
    Limit:    { name: limit,    in: query, schema: { type: integer, minimum: 1, maximum: 200, default: 50 } }
    Cursor:   { name: cursor,   in: query, schema: { type: string } }
  schemas:
    ErrorDetail:
      type: object
      additionalProperties: true
      required: [code]
      properties:
        field:   { type: string }
        code:    { type: string }
        message: { type: string }
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, requestId]
          properties:
            code:      { type: string, example: INSUFFICIENT_STOCK }
            message:   { type: string }
            requestId: { type: string }
            details:   { type: array, items: { $ref: '#/components/schemas/ErrorDetail' } }
    PageMeta:
      type: object
      required: [page, pageSize, totalItems, totalPages]
      properties:
        page: { type: integer }
        pageSize: { type: integer }
        totalItems: { type: integer }
        totalPages: { type: integer }
    CursorMeta:
      type: object
      required: [limit, nextCursor]
      properties:
        limit: { type: integer }
        nextCursor: { type: [string, 'null'] }
    # Money: integer minor units
    MoneyMinor: { type: integer, minimum: 0, maximum: 1000000000, description: Minor currency units }
  responses:
    ValidationError: { description: Validation failed,        content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    Unauthenticated: { description: Missing or invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    Forbidden:       { description: Role lacks permission,    content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    NotFound:        { description: Resource not found,       content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    Conflict:        { description: State or stock conflict,  content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    RuleViolation:   { description: Business rule violated,   content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
```

### 5.4 Registration sketch (the permission registry)

```ts
// One definition drives validation, authorization, docs, and the route x role test.
registerRoute({
  method: 'post',
  path: '/sales-orders/:orderId/confirm',
  permission: 'salesorder:manage',        // required; startup test fails if missing
  idempotency: 'optional',                // 'required' | 'optional' | 'none'
  transaction: true,
  request: { params: OrderIdParams, body: ConfirmOrderBody },
  responses: { 200: ConfirmOrderResponse /* , error schemas shared */ },
  handler: salesOrderController.confirm,
});
```

### 5.5 Conversion checklist

- [ ] One Zod schema per request body, query, and response; shared `Error`, `PageMeta`, `CursorMeta`.
- [ ] Every route registered with permission and idempotency mode (matches section 3 tables).
- [ ] Every endpoint documents its specific error codes with examples from section 4.
- [ ] `servers` lists only localhost and, optionally, your hosted demo URL.
- [ ] CI fails if the generated document is invalid or if a route is missing from the registry.
