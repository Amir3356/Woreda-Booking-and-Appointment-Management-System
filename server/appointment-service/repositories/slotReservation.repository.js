// slot_reservations counters: one document per service/date/slot (_id "<serviceId>|<date>|<timeSlot>").
import { SlotReservation } from "../models/slotReservation.model.js";
import { isDuplicateKey } from "../utils/errors.js";

/** Creates the counter at 0 when missing. */
export async function ensure(key) {
  try {
    await SlotReservation.collection.updateOne({ _id: key }, { $setOnInsert: { count: 0 } }, { upsert: true });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err; // a concurrent booking created it first
  }
}

/** Atomically adds one place while count < max; returns false when the slot is full. */
export async function incrementBelow(key, max) {
  const doc = await SlotReservation.collection.findOneAndUpdate(
    { _id: key, count: { $lt: max } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  );
  return Boolean(doc);
}

/** Gives one place back (never below 0). */
export async function decrement(key) {
  await SlotReservation.collection.updateOne({ _id: key, count: { $gt: 0 } }, { $inc: { count: -1 } });
}
