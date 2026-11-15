import { apiError } from "../../../lib/api-response";
import { unauthorized } from "../../../lib/auth";
import { AlreadyCancelledError, cancelBooking, findBooking } from "../../../lib/booking-store";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const denied = unauthorized(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const booking = await findBooking(id);
    return booking ? Response.json(booking) : apiError("Booking not found.", 404);
  } catch { return apiError("Unable to load booking.", 500); }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = unauthorized(request);
  if (denied) return denied;
  const { id } = await params;
  try { return Response.json(await cancelBooking(id)); }
  catch (error) {
    if (error instanceof AlreadyCancelledError) return apiError("Booking already cancelled.", 409);
    return apiError("Booking not found.", 404);
  }
}
