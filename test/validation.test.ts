import test from "node:test";
import assert from "node:assert/strict";
import { unauthorized } from "../src/lib/auth";
import { apiError } from "../src/lib/api-response";
import { isCreateBookingInput, isResetInput } from "../src/lib/booking-store";

test("API key guard returns JSON 401 for missing and incorrect keys", async () => {
  process.env.API_KEY = "unit-test-key";
  const missing = unauthorized(new Request("http://localhost/slots"));
  const wrong = unauthorized(new Request("http://localhost/slots", { headers: { "X-API-Key": "wrong" } }));
  assert.equal(missing?.status, 401);
  assert.deepEqual(await awaitJson(missing!), { error: "Unauthorized." });
  assert.equal(wrong?.status, 401);
});

test("booking and reset validators reject invalid inputs", () => {
  assert.equal(isCreateBookingInput({ slot_id: "s1", name: "Ada", email: "ada@example.com" }), true);
  assert.equal(isCreateBookingInput({ slot_id: "s1", name: "Ada", email: "not-email" }), false);
  assert.equal(isCreateBookingInput({ slot_id: " ", name: "Ada", email: "ada@example.com" }), false);
  assert.equal(isResetInput({ slots: [{ id: "s1", provider: "Dr A", start: "2026-12-10T09:00:00Z", end: "2026-12-10T09:30:00Z" }] }), true);
  assert.equal(isResetInput({ slots: [{ id: "s1", provider: "Dr A", start: "bad", end: "bad" }] }), false);
});

function awaitJson(response: Response) {
  assert.equal(response.headers.get("content-type"), "application/json");
  return response.json();
}

test("API error helper always emits JSON", async () => {
  const response = apiError("bad request", 400);
  assert.equal(response.status, 400);
  assert.deepEqual(await awaitJson(response), { error: "bad request" });
});
