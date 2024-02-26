// Startup data for an empty database: the central administrator and the default system settings.
// Existing documents are left as they are, so changes made in the app survive restarts.
import { insertIfMissingByEmail } from "../repositories/user.repository.js";
import { insertDefaultsIfMissing } from "../repositories/settings.repository.js";
import { logger } from "./logger.js";

// Central administrator. Email amirsiraj1995@gmail.com, password AEHJSS36 (bcrypt hash below).
const ADMIN = {
  _id: "usr-admin",
  fullName: "Amir Siraj",
  email: "amirsiraj1995@gmail.com",
  phone: "+251911223344",
  passwordHash: "$2a$10$1MEQHYyfCdcr6deVZodQ0unZDCde5oxlwvugEzGHv1iRtPdaFeFUO",
  nationalId: "ET-ADM-9901",
  role: "ADMIN",
  departmentId: null,
  counterNumber: null,
  address: null,
  isActive: true,
};

export async function seedDefaults() {
  const now = new Date();
  if (await insertIfMissingByEmail(ADMIN, now)) logger.info({ email: ADMIN.email }, "seeded administrator");
  if (await insertDefaultsIfMissing(now)) logger.info("seeded default settings");
}
