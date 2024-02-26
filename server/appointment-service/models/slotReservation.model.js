// Collection "slot_reservations" (owned by appointment-service): one document per service/date/slot,
// _id "<serviceId>|<date>|<timeSlot>", count = places taken. A booking increments it only while below
// system_settings.maxParallelSlots, so a slot is never overbooked.
import mongoose from "mongoose";

const slotReservationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { collection: "slot_reservations", versionKey: false },
);

export const SlotReservation = mongoose.model("SlotReservation", slotReservationSchema);
