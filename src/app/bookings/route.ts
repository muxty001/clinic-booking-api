import { apiError } from "../../lib/api-response";
import { unauthorized } from "../../lib/auth";
import {
  AlreadyCancelledError, BookingConflictError, completeIdempotency, createBooking,
  isCreateBookingInput, listBookings, recordBookingAttempt, reserveIdempotency,
  SlotNotFoundError, SlotStartedError, validEmail,
} from "../../lib/booking-store";
import type { CreateBookingInput } from "../../lib/booking-store";
import { IdempotencyModel } from "../../models/Idempotency";

function result(error: unknown): { payload: { error: string }; status: number } {
  if (error instanceof BookingConflictError) return { payload: { error: "slot already booked" }, status: 409 };
  if (error instanceof SlotNotFoundError) return { payload: { error: "slot not found" }, status: 404 };
  if (error instanceof SlotStartedError) return { payload: { error: "slot has already started" }, status: 400 };
  if (error instanceof AlreadyCancelledError) return { payload: { error: "booking already cancelled" }, status: 409 };
  return { payload: { error: "Unable to create booking." }, status: 500 };
}

async function waitForIdempotentResult(key: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const doc = await IdempotencyModel.findOne({ key }).lean();
    if (doc?.state === "complete") return { response: doc.response, status: doc.statusCode ?? 500 };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

export async function POST(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }

  const emailCandidate = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
    ? body.email.trim() : "";
  if (validEmail(emailCandidate)) {
    try {
      const limit = await recordBookingAttempt(emailCandidate);
      if (limit.limited) return Response.json({ error: "Too many booking attempts." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    } catch { return apiError("Unable to process booking request.", 500); }
  }
  if (!isCreateBookingInput(body)) return apiError("slot_id, name, and a valid email are required.", 400);

  const key = request.headers.get("Idempotency-Key");
  let ownsKey = false;
  if (key) {
    try {
      const reservation = await reserveIdempotency(key, body as CreateBookingInput);
      if ("conflict" in reservation) return apiError("Idempotency-Key was already used with a different request.", 422);
      if (!reservation.owner) {
        if (reservation.response !== null) return Response.json(reservation.response, { status: reservation.statusCode ?? 500 });
        const settled = await waitForIdempotentResult(key);
        return settled ? Response.json(settled.response, { status: settled.status }) : apiError("The original request is still processing. Retry with the same key.", 409);
      }
      ownsKey = true;
    } catch { return apiError("Unable to process idempotency key.", 500); }
  }

  try {
    const booking = await createBooking(body);
    if (ownsKey && key) await completeIdempotency(key, 201, booking);
    return Response.json(booking, { status: 201 });
  } catch (error) {
    const mapped = result(error);
    if (ownsKey && key) await completeIdempotency(key, mapped.status, mapped.payload);
    return Response.json(mapped.payload, { status: mapped.status });
  }
}

export async function GET(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const email = params.get("email");
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 10 : Number(rawLimit);
  if (!email) return apiError("email is required.", 400);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return apiError("limit must be between 1 and 50.", 400);
  try {
    const page = await listBookings(email, limit, params.get("cursor"));
    if ("invalidCursor" in page) return apiError("Invalid cursor.", 400);
    return Response.json(page);
  } catch { return apiError("Unable to list bookings.", 500); }
}
