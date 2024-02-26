// Collection "system_settings" (owned by user-service): one document, _id "primary".
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

// Defaults of the old system_settings table (migration 000001).
export const SETTINGS_DEFAULTS = Object.freeze({
  woredaName: "Woreda 03 Public Administration",
  cityRegion: "Addis Ababa City Administration",
  hotline: "9840",
  receptionPhone: "+251 11 551 0000",
  smsGatewayActive: true,
  autoApproveBookings: false,
  advanceBookingDays: 14,
  cancellationCutoffHours: 4,
  maxParallelSlots: 3,
});

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "primary" },
    woredaName: { type: String, default: SETTINGS_DEFAULTS.woredaName },
    cityRegion: { type: String, default: SETTINGS_DEFAULTS.cityRegion },
    hotline: { type: String, default: SETTINGS_DEFAULTS.hotline },
    receptionPhone: { type: String, default: SETTINGS_DEFAULTS.receptionPhone },
    smsGatewayActive: { type: Boolean, default: SETTINGS_DEFAULTS.smsGatewayActive },
    autoApproveBookings: { type: Boolean, default: SETTINGS_DEFAULTS.autoApproveBookings },
    advanceBookingDays: { type: Number, default: SETTINGS_DEFAULTS.advanceBookingDays },
    cancellationCutoffHours: { type: Number, default: SETTINGS_DEFAULTS.cancellationCutoffHours },
    maxParallelSlots: { type: Number, default: SETTINGS_DEFAULTS.maxParallelSlots },
  },
  { collection: "system_settings", timestamps: { createdAt: false, updatedAt: true }, versionKey: false, toJSON },
);

export const Settings = mongoose.model("Settings", settingsSchema);
