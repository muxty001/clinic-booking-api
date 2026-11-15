import { randomUUID, createHash } from "node:crypto";
import { connectDatabase } from "./mongodb";
import { SlotModel } from "../models/Slot";
import { BookingModel } from "../models/Booking";
import { IdempotencyModel } from "../models/Idempotency";
import { RateLimitModel } from "../models/RateLimit";

export interface Slot { id: string; provider: string; start: string; end: string }
export interface AvailableSlot extends Slot { available: boolean }
export interface Booking {
  id: string; slot_id: string; name: string; email: string;
  status: "confirmed" | "cancelled"; created_at: string;
}
export interface CreateBookingInput { slot_id: string; name: string; email: string }
export class BookingConflictError extends Error {}
export class SlotNotFoundError extends Error {}
export class SlotStartedError extends Error {}
export class AlreadyCancelledError extends Error {}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isCreateBookingInput(value: unknown): value is CreateBookingInput {
  return record(value) && typeof value.slot_id === "string" && !!value.slot_id.trim() &&
    typeof value.name === "string" && !!value.name.trim() &&
    typeof value.email === "string" && !!value.email.trim() && validEmail(value.email.trim());
}

export function isResetInput(value: unknown): value is { slots: Slot[] } {
  if (!record(value) || !Array.isArray(value.slots)) return false;
  const ids = new Set<string>();
  return value.slots.every((slot) => {
    if (!record(slot) || typeof slot.id !== "string" || !slot.id.trim() ||
      typeof slot.provider !== "string" || !slot.provider.trim() ||
      typeof slot.start !== "string" || !Number.isFinite(Date.parse(slot.start)) ||
      typeof slot.end !== "string" || !Number.isFinite(Date.parse(slot.end)) ||
      Date.parse(slot.end) <= Date.parse(slot.start) || ids.has(slot.id)) return false;
    ids.add(slot.id);
    return true;
  });
}

async function ready() {
  await connectDatabase();
  await Promise.all([SlotModel.init(), BookingModel.init(), IdempotencyModel.init(), RateLimitModel.init()]);
}

function asBooking(doc: { id: string; slot_id: string; name: string; email: string; status: "confirmed" | "cancelled"; created_at: string }): Booking {
  return { id: doc.id, slot_id: doc.slot_id, name: doc.name, email: doc.email, status: doc.status, created_at: doc.created_at };
}

export async function listAvailableSlots(provider?: string | null): Promise<AvailableSlot[]> {
  await ready();
  const slots = await SlotModel.find(provider == null ? {} : { provider }).lean();
  const booked = await BookingModel.find({ status: "confirmed" }).select({ slot_id: 1, _id: 0 }).lean();
  const bookedIds = new Set(booked.map((booking) => booking.slot_id));
  return slots.map((slot) => ({ id: slot.id, provider: slot.provider, start: slot.start, end: slot.end, available: !bookedIds.has(slot.id) }))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  await ready();
  const slot = await SlotModel.findOne({ id: input.slot_id }).lean();
  if (!slot) throw new SlotNotFoundError();
  if (Date.parse(slot.start) <= Date.now()) throw new SlotStartedError();
  const booking: Booking = {
    id: randomUUID(), slot_id: input.slot_id, name: input.name.trim(),
    email: input.email.trim().toLowerCase(), status: "confirmed", created_at: new Date().toISOString(),
  };
  try {
    await BookingModel.create(booking);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) throw new BookingConflictError();
    throw error;
  }
  return booking;
}

export async function findBooking(id: string): Promise<Booking | null> {
  await ready();
  const doc = await BookingModel.findOne({ id }).lean();
  return doc ? asBooking(doc) : null;
}

export async function cancelBooking(id: string): Promise<Booking> {
  await ready();
  const result = await BookingModel.findOneAndUpdate(
    { id, status: "confirmed" }, { $set: { status: "cancelled" } }, { new: true },
  ).lean();
  if (result) return asBooking(result);
  const existing = await BookingModel.findOne({ id }).lean();
  if (!existing) throw new SlotNotFoundError();
  throw new AlreadyCancelledError();
}

export async function listBookings(email: string, limit: number, cursor?: string | null) {
  await ready();
  const normalizedEmail = email.trim().toLowerCase();
  const after = cursor ? await BookingModel.findOne({ id: cursor, email: normalizedEmail }).lean() : null;
  if (cursor && !after) return { invalidCursor: true as const };
  const query: Record<string, unknown> = { email: normalizedEmail };
  if (after) query.created_at = { $gte: after.created_at };
  let docs = await BookingModel.find(query).sort({ created_at: 1, id: 1 }).limit(limit + (cursor ? 1 : 0)).lean();
  if (after) docs = docs.filter((doc) => doc.created_at > after.created_at || (doc.created_at === after.created_at && doc.id > after.id));
  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);
  return { bookings: page.map(asBooking), next_cursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export async function replaceSlotsAndClearBookings(slots: Slot[]) {
  await ready();
  await BookingModel.deleteMany({});
  await SlotModel.deleteMany({});
  if (slots.length) await SlotModel.insertMany(slots);
}

export function hashRequest(input: CreateBookingInput) {
  return createHash("sha256").update(JSON.stringify({ slot_id: input.slot_id, name: input.name, email: input.email })).digest("hex");
}

export async function reserveIdempotency(key: string, input: CreateBookingInput) {
  await ready();
  const requestHash = hashRequest(input);
  try {
    const doc = await IdempotencyModel.create({ key, requestHash, state: "pending", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    return { owner: true as const, id: String(doc._id), requestHash };
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    const existing = await IdempotencyModel.findOne({ key }).lean();
    if (!existing) throw error;
    if (existing.requestHash !== requestHash) return { conflict: true as const };
    return { owner: false as const, response: existing.state === "complete" ? existing.response : null, statusCode: existing.statusCode ?? null };
  }
}

export async function completeIdempotency(key: string, statusCode: number, response: unknown) {
  await IdempotencyModel.updateOne({ key }, { $set: { state: "complete", statusCode, response } });
}

export async function recordBookingAttempt(email: string) {
  await ready();
  const normalized = email.trim().toLowerCase();
  const now = Date.now();
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const key = `${normalized}:${windowStart}`;
  let doc;
  try {
    doc = await RateLimitModel.findOneAndUpdate({ key }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + 60_000) },
    }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    doc = await RateLimitModel.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true }).lean();
  }
  return { limited: (doc?.count ?? 0) > 5, retryAfter: Math.max(1, Math.ceil((windowStart + 60_000 - now) / 1000)) };
}
