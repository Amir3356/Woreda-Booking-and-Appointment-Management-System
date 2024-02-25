// Slot capacity without overbooking (replaces Go's pg_advisory_xact_lock + COUNT):
// one slot_reservations document per service/date/slot whose count only grows while below
// system_settings.maxParallelSlots, in a single atomic findOneAndUpdate.
import { AppError, isDuplicateKey } from "./lib/index.js";
import { SlotReservation, settings } from "./models.js";

export const DEFAULT_MAX_PARALLEL_SLOTS = 3;

export class SlotFullError extends AppError {
  constructor() {
    super(409, "SLOT_FULL", "Desired time slot capacity reached maximum parallel limit.");
  }
}

/** system_settings.maxParallelSlots, or 3 when unset (Go: COALESCE(..., 3)). */
export async function maxParallelSlots() {
  const s = await settings().findOne({ _id: "primary" }, { projection: { maxParallelSlots: 1 } });
  const max = s?.maxParallelSlots;
  return typeof max === "number" ? max : DEFAULT_MAX_PARALLEL_SLOTS;
}

/** Takes one place in the slot or throws SlotFullError. */
export async function reserve(key) {
  const max = await maxParallelSlots();
  try {
    await SlotReservation.collection.updateOne({ _id: key }, { $setOnInsert: { count: 0 } }, { upsert: true });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err; // a concurrent booking created it first
  }
  const doc = await SlotReservation.collection.findOneAndUpdate(
    { _id: key, count: { $lt: max } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  );
  if (!doc) throw new SlotFullError();
}

/** Gives one place back (never below 0). */
export async function release(key) {
  await SlotReservation.collection.updateOne({ _id: key, count: { $gt: 0 } }, { $inc: { count: -1 } });
}
