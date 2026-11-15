# Clinic Booking API

A patient booking page and assessment API built as one Next.js App Router application. Next.js Route Handlers provide the REST API; MongoDB Atlas and Mongoose persist appointments, bookings, idempotency records, and rate-limit counters. Vercel hosts both the page and API.

## Features

- Browse provider appointment slots and current availability.
- Book, look up, list, and cancel appointments.
- Require `X-API-Key` on every API request.
- Prevent double booking with a MongoDB unique partial index.
- Persist idempotency keys and per-email rate-limit counters.
- Keep API credentials server-side while the patient page calls the same API handlers.
- Responsive interface with loading, validation, error, and confirmation states.

## Technology

- Next.js 16 App Router and TypeScript
- React 19
- Tailwind CSS 4 and existing CSS Modules
- MongoDB Atlas and Mongoose
- Vercel

## Project structure

```text
src/
  app/                 Patient page, server action, and route handlers
    bookings/          Booking create/list and booking id lookup/cancel
    reset/             Replace assessment slots
    slots/             List slots and availability
  lib/                 Database, API auth, internal API, and booking operations
  models/              Slot, booking, idempotency, and rate-limit schemas
test/                  MongoDB-backed API integration tests
```

## Requirements and local setup

- Node.js 20.9 or newer (Node 22.13+ avoids the engine warning from the installed lint toolchain)
- npm
- A MongoDB Atlas cluster and database user

```bash
npm install
Copy-Item .env.example .env
```

Set the values in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Atlas connection string. An `mongodb+srv://` URI must not include a port. |
| `MONGODB_DB` | No | Database name; defaults to the database encoded in the URI. |
| `API_KEY` | Yes | Secret expected in `X-API-Key` for API access. |
| `APP_URL` | No | Public application origin. For this production deployment, set it to `https://clinicbookingkoyaapi-hidq.vercel.app`. |

Start the application:

```bash
npm run dev
```

Open <http://localhost:3000>. Never prefix `API_KEY` with `NEXT_PUBLIC_` or include it in client code. `.env` is ignored by Git.

## MongoDB Atlas setup

1. Create an Atlas cluster and a database user with read/write access to the application database.
2. Add the Vercel deployment's outbound access according to your Atlas network-access policy. For development, allow the development machine's current IP.
3. Copy the Atlas application connection string to `MONGODB_URI`. For SRV strings, remove any `:port` after the cluster hostname.
4. Set `MONGODB_DB` if the connection string does not select the desired database.

Mongoose connection and index initialization are cached across warm serverless invocations. MongoDB creates a unique partial index allowing only one `confirmed` booking per slot. Cancellation changes the booking status, freeing the slot while retaining the booking record. Reset is an explicit API operation; application startup never clears records.

## API

All endpoints require `X-API-Key`. Requests and errors use JSON. Errors have the shape `{ "error": "message" }`.

| Method and path | Behavior |
| --- | --- |
| `POST /reset` | Replace all slots and clear bookings. Body: `{ "slots": [{ "id", "provider", "start", "end" }] }`. |
| `GET /slots?provider=...` | List slots, earliest first, with `available`; response is `{ "slots": [...] }`. Provider matching is exact. |
| `POST /bookings` | Create a booking. Body: `{ "slot_id", "name", "email" }`. Returns `201`; accepts optional `Idempotency-Key`. |
| `GET /bookings/{id}` | Retrieve one booking. |
| `DELETE /bookings/{id}` | Cancel a booking and free its slot. Repeated cancellation returns `409`. |
| `GET /bookings?email=...&limit=10&cursor=...` | List a person's bookings oldest first. Limit is 1–50; return `next_cursor` as the next `cursor`. |

Booking validation returns `400`; unknown slots return `404`; occupied slots return `409`; an idempotency key reused with a different request returns `422`. Booking attempts are limited to five per normalized email per minute; a sixth returns `429` and `Retry-After`.

The complete official [Koya OpenAPI specification](https://koyaacademy.com/assessment-api/openapi.json) is the source contract.

## Verification

```bash
npm run lint
npm test
npm run build
```

The integration suite loads `.env`, then overrides `MONGODB_DB` with `clinic_booking_api_test`. It creates and resets data only in that isolated test database. A reachable, valid MongoDB instance is required; it does not use in-memory persistence.

## Vercel deployment

1. Import this GitHub repository into Vercel as a Next.js project. Keep the default Next.js build and output settings.
2. In the Vercel project's Production (and Preview, if needed) environment variables, set `MONGODB_URI`, `MONGODB_DB` (optional), and `API_KEY`.
3. Configure Atlas network access and the database user for the deployed application.
4. Set `APP_URL=https://clinicbookingkoyaapi-hidq.vercel.app` in Vercel's Production environment variables. Preview deployments can use Vercel's `VERCEL_URL` when `APP_URL` is not set.
5. Deploy, then verify `GET https://<deployment>/slots` with the `X-API-Key` header and verify the patient page loads. Do not include the key in a browser request or public URL.

## Deployment and repository status

The project is prepared for a single-project Vercel deployment. No live deployment or GitHub push is performed from this workspace. The configured Git remote is `https://github.com/muxty001/clinic-booking-api.git`; inspect the current branch and working tree before committing because this checkout already contains unrelated staged deletions and other pre-existing changes.
