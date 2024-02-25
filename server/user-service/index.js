// user-service: citizen profiles, staff provisioning and system settings (REST :8082).
import mongoose from "mongoose";
import { createApp, createLogger, serve } from "./lib/index.js";
import { Settings, User } from "./models.js";
import { Users } from "./users.js";
import { userRoutes } from "./routes.js";
import { config } from "./config.js";
import { seed } from "./seed.js";

const logger = createLogger("user-service");

try {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([User.init(), Settings.init()]); // builds the indexes
  await seed(logger);
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const users = new Users();
const app = createApp({ logger, jwtSecret: config.jwtSecret, routes: (a) => a.use(userRoutes(users)) });

serve(app, { port: config.port, logger, onShutdown: [() => mongoose.disconnect()] });
