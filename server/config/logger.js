// Structured JSON logs (pino).
import pino from "pino";
import { config } from "./index.js";

export const logger = pino({ level: config.logLevel, base: { service: "woreda-server" } });
