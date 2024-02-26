// MongoDB connection (database "woreda", replica set rs0) and index creation for owned models.
import mongoose from "mongoose";
import { config } from "./index.js";
import { User } from "../models/user.model.js";
import { Settings } from "../models/settings.model.js";

export async function connectDatabase() {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([User.init(), Settings.init()]); // builds the indexes
}

export const disconnectDatabase = () => mongoose.disconnect();
