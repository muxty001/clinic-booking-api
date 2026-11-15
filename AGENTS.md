# Clinic Booking API

This project will provide a clinic appointment booking API and patient-facing
booking page. It uses Next.js with TypeScript, the App Router, and npm. MongoDB
and Vercel are planned for persistence and hosting.

## Proportional engineering

Build for established requirements, not hypothetical scale, threats, or future
flexibility. Reuse existing code, the standard library, native platform
features, and installed dependencies before adding machinery.

- Unknown scale or extensibility defaults to the smaller reversible design.
  Do not infer enterprise, multi-tenant, hostile-user, or compliance
  requirements.
- Derive trust and data-integrity boundaries from actual reachability: untrusted
  input, auth/session/ownership, shared persisted data, destructive operations,
  payments, secrets, and sensitive data.
- Ask only when an unknown materially changes behavior, architecture, persisted
  data, interoperability, a real security boundary, or cost.
- Add abstractions, dependencies, services, configuration surfaces,
  compatibility layers, or security mechanisms only for current requirements.
- Simplicity never removes real trust-boundary validation, data-loss prevention,
  accessibility, explicit security requirements, or configured tests.

## Commands

- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Production server: `npm run start`
- Lint: `npm run lint`
- Tests: No test command is configured.

## Testing

Testing is not currently a gate because no test runner or test command is
configured. When one is added, test logic with meaningful input/output edge
cases and document the exact command here.
