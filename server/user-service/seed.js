// Startup data for an empty database: the central administrator and the default system settings.
// Existing documents are left as they are, so changes made in the app survive restarts.
import { SETTINGS_DEFAULTS, Settings, User } from "./models.js";

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

export async function seed(logger) {
  const now = new Date();
  const admin = await User.collection.updateOne(
    { email: ADMIN.email },
    { $setOnInsert: { ...ADMIN, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
  if (admin.upsertedCount > 0) logger.info({ email: ADMIN.email }, "seeded administrator");

  const settings = await Settings.collection.updateOne(
    { _id: "primary" },
    { $setOnInsert: { ...SETTINGS_DEFAULTS, updatedAt: now } },
    { upsert: true },
  );
  if (settings.upsertedCount > 0) logger.info("seeded default settings");
}
