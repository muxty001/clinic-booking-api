import { unauthorized } from "../../lib/auth";
import { apiError } from "../../lib/api-response";
import { isResetInput, replaceSlotsAndClearBookings } from "../../lib/booking-store";

export async function POST(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Request body must be valid JSON.", 400); }
  if (!isResetInput(body)) return apiError("Invalid slots.", 400);
  try {
    await replaceSlotsAndClearBookings(body.slots);
    return Response.json({});
  } catch { return apiError("Unable to reset booking data.", 500); }
}
