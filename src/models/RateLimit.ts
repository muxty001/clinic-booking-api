import { model, models, Schema } from "mongoose";

const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false });

export const RateLimitModel = models.RateLimit || model("RateLimit", rateLimitSchema);
