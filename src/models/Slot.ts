import { model, models, Schema } from "mongoose";

const slotSchema = new Schema({
  id: { type: String, required: true, unique: true, trim: true },
  provider: { type: String, required: true, trim: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { versionKey: false });

export const SlotModel = models.Slot || model("Slot", slotSchema);
