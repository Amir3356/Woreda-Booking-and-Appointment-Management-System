// Citizen profile, staff account and system settings use cases (the Go service + repository).
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey, newId } from "./lib/index.js";
import { SETTINGS_DEFAULTS, Settings, User, departments } from "./models.js";
import {
  cursorMeta, pageParams, roleLabel, settingsView, validateProfile, validateProvision, validateSettings,
} from "./validation.js";

const BCRYPT_COST = 10; // bcrypt.DefaultCost
const DUPLICATE = "email or national ID already registered";

/** ILIKE '%search%' as a case-insensitive regex (% and _ keep their LIKE meaning). */
export function ilikeContains(search) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(escaped, "i");
}

export class Users {
  async profile(userId) {
    const u = await User.findOne({ _id: userId, role: "CITIZEN" }).lean();
    if (!u) throw new NotFoundError();
    return { fullName: u.fullName, phone: u.phone, email: u.email, nationalId: u.nationalId, address: u.address ?? "" };
  }

  async updateProfile(userId, input) {
    const p = validateProfile(input);
    let res;
    try {
      res = await User.updateOne(
        { _id: userId, role: "CITIZEN" },
        { $set: { fullName: p.fullName, phone: p.phone, email: p.email, nationalId: p.nationalId, address: p.address } },
      );
    } catch (err) {
      throw isDuplicateKey(err) ? new ConflictError(DUPLICATE) : err;
    }
    if (res.matchedCount === 0) throw new NotFoundError();
    return p;
  }

  async listStaff(search, cursorRaw, pageSizeRaw) {
    const { cursor, pageSize } = pageParams(cursorRaw, pageSizeRaw);
    const s = String(search ?? "").trim();
    const filter = { role: { $ne: "CITIZEN" } };
    if (s !== "") {
      const re = ilikeContains(s);
      filter.$or = [{ fullName: re }, { email: re }];
    }
    const [total, rows] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter, { fullName: 1, email: 1, role: 1, departmentId: 1, isActive: 1 })
        .sort({ createdAt: -1, _id: 1 }).skip(cursor).limit(pageSize).lean(),
    ]);
    const deptIds = [...new Set(rows.map((r) => r.departmentId).filter(Boolean))];
    const names = new Map();
    if (deptIds.length > 0) {
      for (const d of await departments().find({ _id: { $in: deptIds } }, { projection: { name: 1 } }).toArray()) {
        names.set(d._id, d.name);
      }
    }
    const items = rows.map((r) => ({
      id: r._id,
      fullName: r.fullName,
      email: r.email,
      role: roleLabel(r.role),
      departmentId: r.departmentId ?? null,
      departmentName: r.departmentId ? (names.get(r.departmentId) ?? null) : null,
      isActive: r.isActive,
    }));
    return { items, cursor: cursorMeta(cursor, pageSize, total) };
  }

  async provision(input) {
    const req = validateProvision(input);
    // Was a foreign key to departments(id).
    if (req.departmentId !== null && !(await departments().findOne({ _id: req.departmentId }, { projection: { _id: 1 } }))) {
      throw new ValidationError().add("departmentId", "Department does not exist.");
    }
    const hash = await bcrypt.hash(req.password, BCRYPT_COST);
    const id = newId("usr");
    try {
      await User.create({
        _id: id, fullName: req.fullName, email: req.email, phone: "", passwordHash: hash,
        nationalId: `ET-EMP-${id.slice(4)}`, role: req.role, departmentId: req.departmentId,
        counterNumber: null, address: null, isActive: true,
      });
    } catch (err) {
      throw isDuplicateKey(err) ? new ConflictError(DUPLICATE) : err;
    }
    return id;
  }

  async toggleStaffStatus(id) {
    // Aggregation-pipeline update flips the flag atomically (UPDATE ... SET is_active = NOT is_active).
    const u = await User.findOneAndUpdate(
      { _id: id, role: { $ne: "CITIZEN" } },
      [{ $set: { isActive: { $not: ["$isActive"] }, updatedAt: "$$NOW" } }],
      { new: true, projection: { isActive: 1 }, lean: true, timestamps: false },
    );
    if (!u) throw new NotFoundError();
    return u.isActive;
  }

  async deleteStaff(id) {
    const res = await User.deleteOne({ _id: id, role: { $ne: "CITIZEN" } });
    if (res.deletedCount === 0) throw new NotFoundError();
  }

  async settings() {
    // The SQL table had column defaults; create the row with them when it is missing.
    const d = await Settings.findOneAndUpdate(
      { _id: "primary" },
      { $setOnInsert: { ...SETTINGS_DEFAULTS, updatedAt: new Date() } },
      { upsert: true, new: true, lean: true, setDefaultsOnInsert: false, timestamps: false },
    );
    return settingsView(d);
  }

  async updateSettings(input) {
    const s = validateSettings(input);
    await Settings.updateOne(
      { _id: "primary" },
      {
        $set: {
          woredaName: s.woredaName, cityRegion: s.cityRegion, hotline: s.hotline, receptionPhone: s.emergencyPhone,
          smsGatewayActive: s.smsGatewayActive, autoApproveBookings: s.autoApproveBookings,
          advanceBookingDays: s.advanceBookingDays, cancellationCutoffHours: s.cancellationCutoffHours,
          maxParallelSlots: s.maxParallelSlots,
        },
      },
      { upsert: true, setDefaultsOnInsert: false },
    );
    return s;
  }
}
