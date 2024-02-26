// Reads "system_settings" (owned by another service; document _id "primary").
import mongoose from "mongoose";

const settings = () => mongoose.connection.collection("system_settings");

/** The stored maxParallelSlots value (undefined when unset). */
export async function findMaxParallelSlots() {
  const s = await settings().findOne({ _id: "primary" }, { projection: { maxParallelSlots: 1 } });
  return s?.maxParallelSlots;
}
