// Slot capacity without overbooking (replaces Go's pg_advisory_xact_lock + COUNT):
// one slot_reservations document per service/date/slot whose count only grows while below
// system_settings.maxParallelSlots, in a single atomic findOneAndUpdate.
import { SlotFullError } from "../utils/errors.js";
import * as settings from "../repositories/settings.repository.js";
import * as slotReservations from "../repositories/slotReservation.repository.js";

export const DEFAULT_MAX_PARALLEL_SLOTS = 3;

export function createSlotService() {
  const service = {
    /** system_settings.maxParallelSlots, or 3 when unset (Go: COALESCE(..., 3)). */
    async maxParallelSlots() {
      const max = await settings.findMaxParallelSlots();
      return typeof max === "number" ? max : DEFAULT_MAX_PARALLEL_SLOTS;
    },

    /** Takes one place in the slot or throws SlotFullError. */
    async reserve(key) {
      const max = await service.maxParallelSlots();
      await slotReservations.ensure(key);
      if (!(await slotReservations.incrementBelow(key, max))) throw new SlotFullError();
    },

    /** Gives one place back (never below 0). */
    release(key) {
      return slotReservations.decrement(key);
    },
  };
  return service;
}
