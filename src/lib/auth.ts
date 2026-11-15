import { apiError } from "./api-response";

export function unauthorized(request: Request): Response | null {
  const expected = process.env.API_KEY || process.env.BOOKING_API_KEY;
  if (!expected || request.headers.get("X-API-Key") !== expected) {
    return apiError("Unauthorized.", 401);
  }
  return null;
}
