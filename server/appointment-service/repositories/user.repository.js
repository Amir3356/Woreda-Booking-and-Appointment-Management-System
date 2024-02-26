// Reads "users" (owned by auth-service): appointments.citizenId must name a user.
import mongoose from "mongoose";

const users = () => mongoose.connection.collection("users");

export async function exists(id) {
  return Boolean(await users().findOne({ _id: id }, { projection: { _id: 1 } }));
}
