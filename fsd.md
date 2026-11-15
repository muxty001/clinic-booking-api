# Functional Specification: Clinic Booking API

**Status:** Draft  
**Source contract:** [Koya Academy Clinic Booking API](https://koyaacademy.com/assessment-api) (OpenAPI 3.0.3, version 1.0)

## 1. Purpose

Provide a JSON API for clinic appointment slots and bookings, plus a simple web page where a patient can view available slots, book one, and see confirmation. Deliver the API and web page to a deployment environment.

Work through the assessment's five levels in order. A level is complete only when its required behavior and response contract are verified. It is acceptable to stop at a fully verified level; do not claim later levels are complete until their requirements pass.

## 2. Users and actors

- **Patient:** Uses the web page to find a slot, submit their name and email, and view the resulting confirmation.
- **API client:** Calls the JSON endpoints with the required API key.
- **Deployment operator:** Supplies the API key and operates the deployed service. No operator interface is specified.

The API has no patient account or login contract. Do not imply that an email address is an authenticated identity.

## 3. Scope

### In scope

- List appointment slots and their current availability.
- Create and retrieve bookings.
- Enforce the API key and booking validation requirements.
- Prevent concurrent bookings of the same slot and allow cancellation.
- Support booking idempotency and cursor-paginated booking lookup.
- Limit booking attempts per email.
- Provide the patient web flow for slot selection, booking, and confirmation.
- Deploy the API and web page.

### Out of scope

- Patient accounts, login, and identity verification.
- Provider scheduling or slot creation UI.
- Email, SMS, or calendar notifications.
- Payment, insurance, or medical-record workflows.
- A patient-facing cancellation or booking-history UI; those API capabilities are specified below, but the requested page flow does not require these screens.

## 4. Delivery levels and acceptance criteria

### Level 1: Core booking

- `GET /slots` lists every slot ordered by earliest start time, with an `available` boolean.
- `POST /bookings` creates a confirmed booking and returns HTTP `201` with the booking.
- `GET /bookings/{id}` returns the booking or a JSON `404` error.
- The web page can display slots, submit a booking, and show its confirmation.

### Level 2: API key and validation

- Every API request requires `X-API-Key`; a missing or incorrect key returns HTTP `401`.
- Booking requests require non-empty `slot_id`, `name`, and `email`; invalid or missing values return HTTP `400`.
- Invalid email returns HTTP `400`. Trim `name` and `email`, and store email in lowercase.
- An unknown slot returns HTTP `404`.
- A slot whose start time has passed cannot be booked and returns HTTP `400`.

### Level 3: Concurrency and cancellation

- Concurrent attempts to book one slot can result in at most one confirmed booking. A slot already confirmed as booked returns HTTP `409`.
- `DELETE /bookings/{id}` changes the booking status to `cancelled` and frees its slot.
- Cancelling a missing booking returns HTTP `404`; cancelling an already cancelled booking returns HTTP `409`.

### Level 4: Idempotency and pagination

- `POST /bookings` accepts optional `Idempotency-Key`.
- Repeating the same key with the same body returns the same status, booking ID, and response without creating a second booking.
- Reusing a key with a different body returns HTTP `422`.
- `GET /bookings?email=...` returns that email's bookings, oldest first, with case-insensitive email matching.
- Pagination uses `cursor`, `limit` (default `10`, valid range `1` through `50`), and `next_cursor`. The final page returns `next_cursor: null`; an invalid limit returns HTTP `400`.

### Level 5: Booking attempt rate limit

- Allow at most five booking attempts per email per minute, counting failed attempts.
- The sixth attempt in that period returns HTTP `429` and a whole-seconds `Retry-After` header.
- Attempts for one email must not throttle other emails.

## 5. Web user flow

1. The page requests the slot list and shows loading, empty, error, and loaded states.
2. The patient chooses an available slot and enters their name and email.
3. The page submits the booking request and prevents duplicate submissions while waiting.
4. On success, the page displays the confirmation details returned by the API, including booking ID and status.
5. On failure, the page shows a clear, actionable message and preserves the form values where appropriate. A slot-conflict response refreshes slot availability so the patient can choose again.

The page must label form fields, associate validation feedback with the relevant field, and make submission results perceivable to assistive technology. Client-side checks are usability aids only; the API remains authoritative. Do not expose the API key in browser code, HTML, or client-visible configuration. Route browser requests through a server-side component that can read the deployment secret.

## 6. API contract

All request and response bodies use JSON. Every error response has this shape:

```json
{ "error": "<message>" }
```

### Data shapes

**Slot**

```json
{
  "id": "s1",
  "provider": "Dr Ade",
  "start": "2026-12-10T09:00:00Z",
  "end": "2026-12-10T09:30:00Z"
}
```

`start` and `end` are date-time strings. Slot IDs are strings.

**Slot with availability**

The slot fields plus `available: boolean`. It is `false` while the slot has a confirmed booking. Cancelled bookings do not keep a slot unavailable.

**Booking**

```json
{
  "id": "<generated unique string>",
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com",
  "status": "confirmed",
  "created_at": "<date-time string>"
}
```

`status` is `confirmed` or `cancelled`. A created booking has status `confirmed`.

### Endpoints

Every endpoint below is protected by `X-API-Key` from Level 2 onward. The key is implementation-selected and must be configured as a secret in deployment.

| Method and path | Level | Contract |
|---|---:|---|
| `POST /reset` | 1 | Accepts `{ "slots": [Slot, ...] }`. Deletes every booking and replaces all slots, including slots in the past. Returns `200`; no response body is specified. |
| `GET /slots` | 1 | Optional `provider` query filters by exact match. Returns `200` with `{ "slots": [SlotWithAvailability, ...] }`, ordered by earliest `start`. |
| `POST /bookings` | 1-5 | Accepts `{ "slot_id": string, "name": string, "email": string }` and optional `Idempotency-Key`. Returns `201` with a `Booking`; applicable error statuses are `400`, `401`, `404`, `409`, `422`, and `429`. |
| `GET /bookings/{id}` | 1 | Returns `200` with a `Booking`, or `404` if no booking has that ID. |
| `DELETE /bookings/{id}` | 3 | Cancels the booking and frees its slot. Returns `200` with the cancelled `Booking`, `404` if missing, or `409` if already cancelled. |
| `GET /bookings` | 4 | Requires `email`; accepts optional `limit`, `cursor`. Returns `200` with `{ "bookings": [Booking, ...], "next_cursor": string or null }`; an invalid limit returns `400`. |

`/reset` is destructive by contract. It must not be exposed as an unauthenticated browser action.

## 7. Data and integrity requirements

- Persist slots and bookings so deployed instances share the same state.
- Enforce one active confirmed booking per slot atomically, not with a check-then-write sequence that can race.
- Cancellation changes the booking's status; it does not erase the booking.
- Keep slot availability consistent with confirmed bookings and cancellations.
- Persist idempotency results sufficiently to return the same response for a retry.
- Apply rate limits to normalized email values (trimmed and lowercased as booking input is normalized), and ensure failed booking attempts count.
- `/reset` removes all bookings and replaces the slot set as defined by the contract.

The persistence technology and retention durations are not defined by the source contract.

## 8. Security and privacy

- Enforce the API key on all API routes, including `/reset`; return `401` for missing or incorrect keys.
- Keep the API key server-side and out of client-visible assets and logs.
- Treat names and email addresses as personal data. Do not log request bodies or expose them outside the API responses required by the contract.
- Validate all request data on the server and return the specified status codes and JSON error shape.
- Use an atomic persistence operation or database constraint to preserve slot uniqueness under concurrent requests.
- Do not add a patient identity or ownership guarantee: the contract only defines API-key protection and email-based booking lookup.

## 9. Deployment and operations

Deploy both the API and web page. The deployment must provide persistent shared state suitable for concurrency, configure the API key as a secret, and serve the web page without exposing that secret. The host, runtime, database, domain, and deployment pipeline have not been selected.

The contract does not define a health-check route, availability objective, backups, or data-retention policy. Do not represent any of these as requirements until they are decided.

## 10. Verification

For each level, verify its API response status, exact JSON shape, and error behavior against the linked OpenAPI contract. Include checks for:

- Slot ordering, provider filtering, and availability before and after booking/cancellation.
- Missing and invalid API keys, malformed booking details, unknown slots, and past slots.
- Simultaneous bookings of one slot, with exactly one confirmed result.
- Cancellation and repeat cancellation.
- Same-key retries, conflicting idempotency bodies, and booking pagination.
- Six booking attempts for one email, including failed attempts, and an unaffected second email.
- The browser flow from loading slots through successful confirmation, plus validation, empty, conflict, and server-error feedback.
- Deployment behavior with the configured secret and persistent shared state.

No test runner or deployment target is currently configured in the workspace.

## 11. Open decisions

- Select the MongoDB provider and confirm the Next.js deployment shape on Vercel.
- Confirm whether `/reset` must be available in the deployed assessment environment. The OpenAPI contract includes it and requires API-key authentication; any stricter restriction may affect compatibility.
- Clarify rate-limit window semantics and whether an idempotent replay counts as an attempt; the contract does not specify these edge cases.
- Clarify idempotency-key scope and how request bodies are compared; the contract specifies same-key/same-body replay and same-key/different-body rejection but not key lifetime or scope.
- Define deployment operations not covered by the contract, including health checks, backups, and retention, if required.