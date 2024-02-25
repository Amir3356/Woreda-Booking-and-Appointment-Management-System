// The seven Woreda departments, created on startup when missing (existing ones are left as they are).
// IDs match DEFAULT_DEPARTMENTS in client/context/store.js.
import { Department } from "./models.js";

const DEPARTMENTS = [
  ["dept-1", "KBL", "Kebele Administration & Vital Events", "Citizen registration, residence identification, birth/marriage certificates, and neighborhood civil records.", "Building A, Ground Floor, Room 102", "+251 11 551 2341"],
  ["dept-2", "LND", "Land Administration & Urban Development", "Landholding rights documentation, residential plot verifications, property transfer oversight, and urban zoning.", "Building B, 2nd Floor, Room 204", "+251 11 551 8892"],
  ["dept-3", "TRD", "Trade, Industry & Enterprise Development", "Business registrations, commercial licenses, micro-enterprise support, and commercial practice verifications.", "Building A, 1st Floor, Room 115", "+251 11 551 4421"],
  ["dept-4", "REV", "Revenues & Tax Assessment", "Local tax assessment, business revenue verification, trade levy collections, and municipal tariff processing.", "Building B, Ground Floor, Room 108", "+251 11 551 7733"],
  ["dept-5", "SOC", "Social Affairs & Labor Welfare", "Social safety net enrollment, vulnerable community support, disability assistance, and pension documentation.", "Building C, 1st Floor, Room 105", "+251 11 551 6612"],
  ["dept-6", "HLT", "Public Health & Environmental Sanitation", "Community health verifications, sanitation inspections, food handler certificates, and hygiene permits.", "Building C, Ground Floor, Room 101", "+251 11 551 9901"],
  ["dept-7", "AUD", "Code Enforcement & Municipal Audit", "Building regulation enforcement, municipal code compliance, public land protection, and community grievance resolution.", "Building A, 2nd Floor, Room 210", "+251 11 551 3345"],
];

export async function seedDepartments(logger) {
  const now = new Date();
  const res = await Department.collection.bulkWrite(
    DEPARTMENTS.map(([_id, code, name, description, buildingRoom, contactPhone]) => ({
      updateOne: {
        filter: { _id },
        update: { $setOnInsert: { code, name, description, buildingRoom, contactPhone, isActive: true, createdAt: now, updatedAt: now } },
        upsert: true,
      },
    })),
  );
  if (res.upsertedCount > 0) logger.info({ created: res.upsertedCount }, "seeded departments");
}
