import { model, models, Schema } from "mongoose";

const bookingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  slot_id: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  status: { type: String, enum: ["confirmed", "cancelled"], required: true },
  created_at: { type: String, required: true },
}, { versionKey: false });
bookingSchema.index({ slot_id: 1 }, {
  unique: true,
  partialFilterExpression: { status: "confirmed" },
  name: "one_confirmed_booking_per_slot",
});
bookingSchema.index({ email: 1, created_at: 1 });

export const BookingModel = models.Booking || model("Booking", bookingSchema);
