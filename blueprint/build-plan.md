# Build Plan

List the features that make up your project, high level and in rough build order.
Keep each item to one line; the details come later in `/feature`.

Plain bullets are fine. When both planning docs are ready, run `/overview`.
It adds tracking numbers and checkboxes to your feature list before generating
the project overview.

Run `/feature` to spec the next unchecked item, or `/feature 2` to pick one.
Keep completed items checked and append new features as the project grows.
Do not renumber completed features; their archived specs refer to those IDs.

Scaffolding the app and prototyping its look are pre-build steps, not features.
Start with your first real slice of functionality.

## Features

- [ ] 1. **Level 1 booking API and patient page** - List slots, create and look up bookings, and provide the patient booking and confirmation flow.
- [ ] 2. **Level 2 API security and validation** - Require the API key and validate booking inputs, slot existence, and booking time.
- [ ] 3. **Level 3 concurrency and cancellation** - Prevent concurrent double-booking and allow bookings to be cancelled.
- [ ] 4. **Level 4 idempotency and pagination** - Replay idempotent booking requests and page through a person's bookings.
- [ ] 5. **Level 5 rate limiting** - Limit booking attempts per email and return the specified retry response.
- [ ] 6. **Deployment** - Deploy the API and patient web page with configured secrets and persistent shared storage.
