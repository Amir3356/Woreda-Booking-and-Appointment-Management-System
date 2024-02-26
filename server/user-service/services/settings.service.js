// System settings rules: Go-style decoding, validation and the API <-> stored field mapping.
import { ValidationError } from "../utils/errors.js";
import { decodeStruct } from "../utils/decode.js";
import * as settings from "../repositories/settings.repository.js";

export const decodeSettings = (input) =>
  decodeStruct(input, "Settings", {
    woredaName: "string", cityRegion: "string", hotline: "string", emergencyPhone: "string",
    smsGatewayActive: "bool", autoApproveBookings: "bool",
    advanceBookingDays: "int", cancellationCutoffHours: "int", maxParallelSlots: "int",
  });

/** PUT /admin/settings rules: woredaName required, maxParallelSlots <= 0 falls back to 3. */
export function validateSettings(s) {
  const v = new ValidationError();
  if (s.woredaName.trim() === "") v.add("woredaName", "Woreda name is required.");
  const out = { ...s, maxParallelSlots: s.maxParallelSlots <= 0 ? 3 : s.maxParallelSlots };
  v.throwIfAny();
  return out;
}

/** Stored settings document -> API shape (receptionPhone is exposed as emergencyPhone). */
export const settingsView = (d) => ({
  woredaName: d.woredaName, cityRegion: d.cityRegion, hotline: d.hotline, emergencyPhone: d.receptionPhone,
  smsGatewayActive: d.smsGatewayActive, autoApproveBookings: d.autoApproveBookings,
  advanceBookingDays: d.advanceBookingDays, cancellationCutoffHours: d.cancellationCutoffHours,
  maxParallelSlots: d.maxParallelSlots,
});

export function createSettingsService() {
  return {
    async get() {
      return settingsView(await settings.findOrCreate());
    },

    /** input: the JSON request body. Returns the saved settings in API shape. */
    async update(input) {
      const s = validateSettings(decodeSettings(input));
      await settings.upsert({
        woredaName: s.woredaName, cityRegion: s.cityRegion, hotline: s.hotline, receptionPhone: s.emergencyPhone,
        smsGatewayActive: s.smsGatewayActive, autoApproveBookings: s.autoApproveBookings,
        advanceBookingDays: s.advanceBookingDays, cancellationCutoffHours: s.cancellationCutoffHours,
        maxParallelSlots: s.maxParallelSlots,
      });
      return s;
    },
  };
}
