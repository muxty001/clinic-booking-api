"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isCreateBookingInput } from "../lib/booking-store";
import { internalApiRequest } from "../lib/internal-api";
import type { BookingActionState, BookingFormValues } from "../lib/booking-form-state";

function getStringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function submitBooking(
  previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const values: BookingFormValues = {
    slot_id: getStringValue(formData, "slot_id"),
    name: getStringValue(formData, "name"),
    email: getStringValue(formData, "email"),
  };
  const idempotencyKey = getStringValue(formData, "idempotency_key");
  const fieldErrors: BookingActionState["fieldErrors"] = {};

  if (!values.slot_id.trim()) {
    fieldErrors.slot_id = "Choose an appointment time.";
  }
  if (!values.name.trim()) {
    fieldErrors.name = "Enter your name.";
  }
  if (!values.email.trim()) {
    fieldErrors.email = "Enter your email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      outcome: "validation",
      message: "Please complete the highlighted fields.",
      values,
      fieldErrors,
      revision: previousState.revision + 1,
    };
  }

  if (!isCreateBookingInput(values)) {
    return {
      outcome: "validation",
      message: "Please check your booking details.",
      values,
      fieldErrors,
      revision: previousState.revision + 1,
    };
  }

  try {
    const response = await internalApiRequest("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(values),
    });
    if (response.status === 409 || response.status === 404) {
      revalidatePath("/");
      return {
        outcome: "conflict",
        message: "That time is no longer available. Choose another appointment.",
        values,
        fieldErrors: { slot_id: "Choose an available appointment time." },
        idempotencyKey: randomUUID(),
        revision: previousState.revision + 1,
      };
    }
    if (!response.ok) throw new Error("Booking request failed.");
    const booking = await response.json() as { id: string; status: "confirmed" };
    revalidatePath("/");
    return {
      outcome: "success",
      message: "Your appointment is confirmed.",
      values,
      fieldErrors: {},
      booking: { id: booking.id, status: booking.status },
      revision: previousState.revision + 1,
    };
  } catch {
    return {
      outcome: "error",
      message: "We couldn't complete your booking. Please try again.",
      values,
      fieldErrors: {},
      revision: previousState.revision + 1,
    };
  }
}
