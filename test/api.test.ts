import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());
process.env.MONGODB_DB = "clinic_booking_api_test";
process.env.API_KEY = "clinic-test-key";

let getSlots: (request: Request) => Promise<Response>;
let reset: (request: Request) => Promise<Response>;
let getBookings: (request: Request) => Promise<Response>;
let postBooking: (request: Request) => Promise<Response>;
let getBooking: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let deleteBooking: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

const apiKey = "clinic-test-key";
const future = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const slots = Array.from({ length: 9 }, (_, index) => ({
  id: `test-slot-${index + 1}`, provider: index % 2 ? "Dr B" : "Dr A",
  start: future(30 + index * 30), end: future(60 + index * 30),
}));
function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "X-API-Key": apiKey, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function payload<T>(response: Response): Promise<T> { return await response.json() as T; }

before(async () => {
  ({ GET: getSlots } = await import("../src/app/slots/route"));
  ({ POST: reset } = await import("../src/app/reset/route"));
  ({ GET: getBookings, POST: postBooking } = await import("../src/app/bookings/route"));
  ({ GET: getBooking, DELETE: deleteBooking } = await import("../src/app/bookings/[id]/route"));
  const response = await reset(request("/reset", "POST", { slots }));
  assert.equal(response.status, 200);
});
after(async () => { await mongoose.disconnect(); });

test("assessment API contract and concurrency", async (t) => {
  await t.test("requires the API key on every route", async () => {
    const noKey = await getSlots(new Request("http://localhost/slots"));
    const wrongKey = await getSlots(request("/slots", "GET", undefined, { "X-API-Key": "wrong" }));
    assert.equal(noKey.status, 401);
    assert.equal(wrongKey.status, 401);
    assert.deepEqual(await payload(noKey), { error: "Unauthorized." });
  });

  await t.test("reset and slots response shape/filter/sort", async () => {
    const all = await payload<{ slots: { id: string; available: boolean }[] }>(await getSlots(request("/slots")));
    assert.equal(all.slots.length, slots.length);
    assert.equal(all.slots[0].id, slots[0].id);
    assert.ok(all.slots.every((slot) => slot.available));
    const filtered = await payload<{ slots: { provider: string }[] }>(await getSlots(request("/slots?provider=Dr%20B")));
    assert.ok(filtered.slots.length > 0);
    assert.ok(filtered.slots.every((slot) => slot.provider === "Dr B"));
  });

  await t.test("validates fields, email, unknown slot, and started slot", async () => {
    assert.equal((await postBooking(request("/bookings", "POST", { slot_id: "", name: " ", email: "bad" }))).status, 400);
    assert.equal((await postBooking(request("/bookings", "POST", { slot_id: "no-such-slot", name: "Ada", email: "ada@example.com" }))).status, 404);
    await reset(request("/reset", "POST", { slots: [...slots, { id: "started-slot", provider: "Dr A", start: new Date(Date.now() - 60_000).toISOString(), end: new Date(Date.now() + 60_000).toISOString() }] }));
    const started = await postBooking(request("/bookings", "POST", { slot_id: "started-slot", name: "Ada", email: "started@example.com" }));
    assert.equal(started.status, 400);
    await reset(request("/reset", "POST", { slots }));
  });

  await t.test("only one simultaneous booking succeeds for a slot", async () => {
    const attempts = await Promise.all(Array.from({ length: 12 }, (_, index) => postBooking(request("/bookings", "POST", {
      slot_id: slots[0].id, name: `Patient ${index}`, email: `race-${index}@example.com`,
    }))));
    assert.equal(attempts.filter((response) => response.status === 201).length, 1);
    assert.equal(attempts.filter((response) => response.status === 409).length, 11);
  });

  await t.test("reads, cancels, frees, and rebooks a slot", async () => {
    const created = await postBooking(request("/bookings", "POST", { slot_id: slots[1].id, name: "Ada Obi", email: "ADA@example.com" }));
    assert.equal(created.status, 201);
    const booking = await payload<{ id: string; email: string; status: string }>(created);
    assert.equal(booking.email, "ada@example.com");
    assert.equal((await getBooking(request(`/bookings/${booking.id}`), { params: Promise.resolve({ id: booking.id }) })).status, 200);
    assert.equal((await deleteBooking(request(`/bookings/${booking.id}`, "DELETE"), { params: Promise.resolve({ id: booking.id }) })).status, 200);
    assert.equal((await deleteBooking(request(`/bookings/${booking.id}`, "DELETE"), { params: Promise.resolve({ id: booking.id }) })).status, 409);
    const available = await payload<{ slots: { id: string; available: boolean }[] }>(await getSlots(request("/slots")));
    assert.equal(available.slots.find((slot) => slot.id === slots[1].id)?.available, true);
    assert.equal((await postBooking(request("/bookings", "POST", { slot_id: slots[1].id, name: "Ada Obi", email: "ada@example.com" }))).status, 201);
  });

  await t.test("persists idempotency and rejects changed request bodies", async () => {
    const body = { slot_id: slots[2].id, name: "Grace Obi", email: "grace@example.com" };
    const first = await postBooking(request("/bookings", "POST", body, { "Idempotency-Key": "test-idem-1" }));
    const firstData = await payload<{ id: string }>(first);
    const retry = await postBooking(request("/bookings", "POST", body, { "Idempotency-Key": "test-idem-1" }));
    const retryData = await payload<{ id: string }>(retry);
    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.equal(retryData.id, firstData.id);
    assert.equal((await postBooking(request("/bookings", "POST", { ...body, name: "Changed" }, { "Idempotency-Key": "test-idem-1" }))).status, 422);
  });

  await t.test("supports email lookup and cursor pagination", async () => {
    for (const slot of slots.slice(3, 6)) {
      await postBooking(request("/bookings", "POST", { slot_id: slot.id, name: "Page Patient", email: "page@example.com" }));
    }
    assert.equal((await getBookings(request("/bookings?email=PAGE%40example.com&limit=0"))).status, 400);
    const first = await payload<{ bookings: { id: string }[]; next_cursor: string | null }>(await getBookings(request("/bookings?email=PAGE%40example.com&limit=2")));
    assert.equal(first.bookings.length, 2);
    assert.ok(first.next_cursor);
    const second = await payload<{ bookings: { id: string }[]; next_cursor: string | null }>(await getBookings(request(`/bookings?email=page%40example.com&limit=2&cursor=${first.next_cursor}`)));
    assert.equal(second.bookings.length, 1);
    assert.equal(second.next_cursor, null);
  });

  await t.test("limits a sixth attempt per normalized email per minute", async () => {
    for (let index = 0; index < 5; index++) {
      assert.equal((await postBooking(request("/bookings", "POST", { slot_id: "missing", name: "Rate", email: "rate@example.com" }))).status, 404);
    }
    const sixth = await postBooking(request("/bookings", "POST", { slot_id: "missing", name: "Rate", email: "RATE@example.com" }));
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers.get("Retry-After")) >= 1);
    assert.deepEqual(await payload(sixth), { error: "Too many booking attempts." });
  });
});
