# Project Plan

## 1. Problem

Build a clinic booking service that lets patients see appointment availability and book a slot, with a simple web page using the API. The service must match the Koya Academy Clinic Booking API contract and be deployed.

## 2. Users

- Patients who need to view available appointment slots and book one.
- API clients that call the booking service using its API key.
- The clinic or deployment operator that configures and operates the service.

## 3. Features

- List appointment slots, create bookings, look up bookings, and provide a patient booking page.
- Protect API routes with an API key and validate booking details.
- Prevent concurrent double-booking and allow cancellation.
- Support idempotent booking retries and cursor-paginated booking lookup.
- Limit booking attempts per email.
- Deploy the API and web page.

## 4. Data

- Slots: string ID, provider name, start and end date-time, with availability derived from active bookings.
- Bookings: generated string ID, slot ID, patient name, normalized email, confirmed or cancelled status, and creation date-time.
- Idempotency records and rate-limit attempt state as required by the corresponding API levels.

## 5. Tech

- **Node.js and TypeScript** - application runtime and language.
- **Express** - HTTP API framework.
- **MongoDB** - persistent booking and slot storage; deployment must use a shared database that supports atomic updates and required uniqueness constraints.
- **Vercel** - host for the API and patient web page.

## 6. Monetization

No monetization requirements are defined for this assessment.

## 7. UI/UX

Provide a simple, accessible patient page to load available slots, select one, enter name and email, submit a booking, and view confirmation. Show loading, empty, validation, conflict, and unexpected-error feedback. No visual reference or specific design system has been selected.

## 8. Deployment

Deploy both the API and web page to Vercel using Node.js and TypeScript. Use MongoDB for persistent shared storage suitable for concurrent requests. Configure the API key as a server-side secret, never expose it to browser code. MongoDB provider, domain, build and deployment commands, health check, and deployment pipeline remain undecided.

## 9. Usage model and constraints

The API uses an API key for request authorization; patients do not have an account or authenticated identity in the contract. Booking data includes patient names and email addresses. Expected scale, tenant model, hosting reachability, compliance requirements, availability objectives, and retention policy are not specified.
