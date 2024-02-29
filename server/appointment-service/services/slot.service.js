// Slot capacity without overbooking (replaces Go's pg_advisory_xact_lock + COUNT):
// one slot_reservations document per service/date/slot whose count only grows while below
// system_settings.maxParallelSlots, in a single atomic findOneAndUpdate.
import { DailyCapacityError, SlotFullError } from "../utils/errors.js";
import { dayKey, perTimeCapacity } from "../utils/schedule.js";
import * as settings from "../repositories/settings.repository.js";
import * as slotReservations from "../repositories/slotReservation.repository.js";
import * as appointments from "../repositories/appointment.repository.js";
import { counter } from "../config/metrics.js";

/** Bookings refused: DAILY_CAPACITY_REACHED, SLOT_FULL (here), SCHEDULE_CLOSED and TIME_PASSED (appointment service). */
export const bookingRefusals = counter("woreda_booking_refusals_total", "Bookings refused, by reason.", ["reason"]);

export const DEFAULT_MAX_PARALLEL_SLOTS = 3;

export function createSlotService() {
  const service = {
    /** system_settings.maxParallelSlots, or 3 when unset (Go: COALESCE(..., 3)). */
    async maxParallelSlots() {
      const max = await settings.findMaxParallelSlots();
      return typeof max === "number" ? max : DEFAULT_MAX_PARALLEL_SLOTS;
    },

    /**
     * Takes one place in the slot or throws SlotFullError. schedule (optional): the service's
     * schedule, whose daily capacity can raise the per-time limit (see perTimeCapacity).
     */
    async reserve(key, schedule = null) {
      const max = perTimeCapacity(schedule, await service.maxParallelSlots());
      await slotReservations.ensure(key);
      if (!(await slotReservations.incrementBelow(key, max))) {
        bookingRefusals.inc({ reason: "SLOT_FULL" });
        throw new SlotFullError();
      }
    },

    /** Gives one place back (never below 0). */
    release(key) {
      return slotReservations.decrement(key);
    },

    /**
     * Takes one of the day's places (the schedule's daily capacity) or throws DailyCapacityError.
     * The day counter is created from the bookings that already exist, so bookings made before
     * this counter existed are included.
     */
    async reserveDay(serviceId, date, capacity) {
      const key = dayKey(serviceId, date);
      await slotReservations.ensure(key, await appointments.countHoldingPlace(serviceId, date));
      if (!(await slotReservations.incrementBelow(key, capacity))) {
        bookingRefusals.inc({ reason: "DAILY_CAPACITY_REACHED" });
        throw new DailyCapacityError(capacity, date);
      }
    },

    /** Gives one of the day's places back. */
    releaseDay(serviceId, date) {
      return slotReservations.decrement(dayKey(serviceId, date));
    },
  };
  return service;
}
