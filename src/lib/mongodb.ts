import mongoose from "mongoose";
import { SlotModel } from "../models/Slot";
import { BookingModel } from "../models/Booking";
import { IdempotencyModel } from "../models/Idempotency";
import { RateLimitModel } from "../models/RateLimit";

type MongooseGlobal = typeof globalThis & {
  mongoosePromise?: Promise<typeof mongoose>;
};

const cached = globalThis as MongooseGlobal;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cached.mongoosePromise) {
    cached.mongoosePromise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || undefined,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
  }
  try {
    const connection = await cached.mongoosePromise;
    await Promise.all([SlotModel.init(), BookingModel.init(), IdempotencyModel.init(), RateLimitModel.init()]);
    return connection;
  } catch (error) {
    console.log(error)
    cached.mongoosePromise = undefined;
    throw error;
  }
}
