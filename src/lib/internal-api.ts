import "server-only";

function origin() {
  const configured = process.env.APP_URL;
  if (configured) {
    const url = configured.startsWith("http") ? configured : `https://${configured}`;
    if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
      throw new Error("APP_URL must use HTTPS in production.");
    }
    return url;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL or VERCEL_URL must be configured in production.");
  return "http://localhost:3000";
}

export function internalApiRequest(path: string, init: RequestInit = {}) {
  const key = process.env.API_KEY || process.env.BOOKING_API_KEY;
  if (!key) throw new Error("API_KEY is not configured.");
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", key);
  return fetch(new URL(path, origin()), { ...init, headers, cache: "no-store" });
}
