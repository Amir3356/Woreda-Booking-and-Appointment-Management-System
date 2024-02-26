// MongoDB connection (database "woreda", replica set rs0) and index creation for the users model.
import mongoose from "mongoose";
import { config } from "./index.js";
import { User } from "../models/user.model.js";

export async function connectDatabase() {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await User.init(); // builds the users indexes (same definitions as user-service)
}

export const disconnectDatabase = () => mongoose.disconnect();
