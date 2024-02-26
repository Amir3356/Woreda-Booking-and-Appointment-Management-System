// Data access for the single "system_settings" document (_id "primary").
import { SETTINGS_DEFAULTS, Settings } from "../models/settings.model.js";

const PRIMARY = { _id: "primary" };

/** The settings document; the SQL table had column defaults, so it is created with them when missing. */
export const findOrCreate = () =>
  Settings.findOneAndUpdate(
    PRIMARY,
    { $setOnInsert: { ...SETTINGS_DEFAULTS, updatedAt: new Date() } },
    { upsert: true, new: true, lean: true, setDefaultsOnInsert: false, timestamps: false },
  );

export const upsert = (fields) => Settings.updateOne(PRIMARY, { $set: fields }, { upsert: true, setDefaultsOnInsert: false });

/** Inserts the default settings unless the document exists; returns true when created. */
export async function insertDefaultsIfMissing(now) {
  const res = await Settings.collection.updateOne(PRIMARY, { $setOnInsert: { ...SETTINGS_DEFAULTS, updatedAt: now } }, { upsert: true });
  return res.upsertedCount > 0;
}
