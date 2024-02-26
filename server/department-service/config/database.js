// MongoDB connection (database "woreda", replica set rs0) and index creation for owned models.
import mongoose from "mongoose";
import { config } from "./index.js";
import { Department } from "../models/department.model.js";
import { PublicService } from "../models/publicService.model.js";

export async function connectDatabase() {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Department.init(), PublicService.init()]); // builds the indexes
}

export const disconnectDatabase = () => mongoose.disconnect();
