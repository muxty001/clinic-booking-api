# Clinic Booking API - Project Overview

<!-- blueprint:source-hash eab9711381e6fa80bb2bc21c7177967c993f051087ac97a621e3d5cc43920f36 -->

> A clinic appointment booking API and patient web page, delivered to a deployment environment.

## Problem

Patients need to see appointment availability and book a clinic slot. The service and web page must follow the Koya Academy Clinic Booking API contract.

## Users

- **Patients** - view slots, book one, and see confirmation.
- **API clients** - call the service using its API key.
- **Clinic or deployment operator** - configure and operate the service.

No patient account or authenticated patient identity is defined.

## Usage model

The API uses an API key for request authorization. Patient names and email addresses are booking data. Expected scale, tenant model, hosting reachability, compliance, availability objectives, and retention are unspecified.

## Features

1. **Level 1 booking API and patient page** - List slots, create and look up bookings, and provide booking and confirmation flow.
2. **Level 2 API security and validation** - Require an API key and validate booking inputs, slot existence, and booking time.
3. **Level 3 concurrency and cancellation** - Prevent concurrent double-booking and allow cancellation.
4. **Level 4 idempotency and pagination** - Replay idempotent booking requests and page through bookings by email.
5. **Level 5 rate limiting** - Limit booking attempts per email and return a retry response.
6. **Deployment** - Deploy the API and patient page with secrets and persistent shared storage.

## Data model

### Slot

- `id` (string) - slot identifier.
- `provider` (string) - provider name.
- `start`, `end` (date-time strings) - appointment interval.
- `available` (boolean, derived) - false while a confirmed booking occupies the slot.

### Booking

- `id` (generated string) - unique booking identifier.
- `slot_id` (string) - the booked slot.
- `name` (string) - trimmed patient name.
- `email` (string) - trimmed and lowercased patient email.
- `status` (enum: `confirmed`, `cancelled`) - cancellation frees the slot but retains the booking.
- `created_at` (date-time string) - booking creation time.

One slot may have at most one confirmed booking. Atomic enforcement is required for concurrent requests.

### Idempotency and rate-limit state

Idempotency records support replaying the same response for the same key and request body, and rejecting a different body for a reused key. Rate-limit state tracks failed and successful booking attempts per normalized email. Storage shape and retention are undecided.

## Tech stack

- **Node.js and TypeScript** - application runtime and language.
- **Express** - HTTP API framework.
- **MongoDB** - persistent shared storage supporting atomic booking.
- **Vercel** - host for the API and patient web page.

## Monetization

No monetization requirements are defined for this assessment.

## UI/UX

Provide a simple accessible patient page to load slots, choose one, enter name and email, submit, and view confirmation. Include loading, empty, validation, conflict, and unexpected-error feedback. No visual reference or design system is selected.

## Deployment

Deploy the Node.js/TypeScript API and patient page to Vercel, using MongoDB for persistent shared state. Keep the API key in server-side configuration, never browser-visible code. MongoDB provider, domain, build/deployment commands, health check, and pipeline are not selected.

## Open questions

- Select the MongoDB provider and confirm Vercel's deployment shape for the Express app.
- Clarify rate-limit window boundaries and whether an idempotent replay counts as an attempt.
- Clarify idempotency-key scope, body comparison, and retention.
- Define deployment operations such as health checks, backups, and retention if required.
