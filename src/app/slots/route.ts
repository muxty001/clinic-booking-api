import { apiError } from "../../lib/api-response";
import { unauthorized } from "../../lib/auth";
import { listAvailableSlots } from "../../lib/booking-store";

export async function GET(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;
  const provider = new URL(request.url).searchParams.get("provider");
  try {
    console.log("testing")
    return Response.json({ slots: await listAvailableSlots(provider) });
  } catch {
    return apiError("Unable to load slots.", 500);
  }
}
