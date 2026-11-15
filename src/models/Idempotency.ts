import { model, models, Schema } from "mongoose";

const idempotencySchema = new Schema({
  key: { type: String, required: true, unique: true },
  requestHash: { type: String, required: true },
  state: { type: String, enum: ["pending", "complete"], required: true },
  statusCode: Number,
  response: Schema.Types.Mixed,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false });

export const IdempotencyModel = models.Idempotency || model("Idempotency", idempotencySchema);
