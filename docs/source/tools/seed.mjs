// Sample data for the documentation screenshots (throwaway database woreda_doc_test).
const API = "http://localhost:18080/api/v1";
async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await r.json().catch(() => null);
  if (r.status >= 400) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(json)}`);
  return json.data;
}
const pad = (n) => String(n).padStart(2, "0");
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Next weekday on or after today + n
const weekday = (n) => { const d = new Date(); d.setDate(d.getDate() + n); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const admin = (await api("POST", "/auth/login", { body: { email: "admin@woreda.test", password: "Admin#2026" } })).token;
const settings = await api("GET", "/admin/settings", { token: admin });
await api("PUT", "/admin/settings", { token: admin, body: { ...settings, woredaName: "Woreda 03 Public Administration", cityRegion: "Addis Ababa City Administration", hotline: "9840" } });

const dept = async (name, code, room, phone, description) =>
  api("POST", "/departments", { token: admin, body: { name, code, buildingRoom: room, contactPhone: phone, description } });
const crv = await dept("Civil Registration and Vital Events", "CRV", "Block A, Room 101", "+251111234501", "Birth, marriage and residence records.");
const rev = await dept("Revenue and Tax", "REV", "Block B, Room 204", "+251111234502", "Tax clearance and business licensing.");
const lnd = await dept("Land Administration", "LND", "Block C, Room 012", "+251111234503", "Land holding certificates and transfers.");

const svc = async (departmentId, name, code, fee, days, docs) =>
  api("POST", "/services", { token: admin, body: { departmentId, name, code, durationMinutes: 30, dailyQuota: 40, feeETB: fee, processingDays: days, requiredDocuments: docs } });
const birth = await svc(crv.id, "Birth Certificate Issuance", "BCI", 50, "Same day", ["Kebele ID", "Hospital birth notification"]);
const marriage = await svc(crv.id, "Marriage Certificate", "MRC", 100, "Same day", ["Kebele IDs of both spouses", "Two witnesses"]);
const residence = await svc(crv.id, "Residence ID Renewal", "RID", 30, "Same day", ["Old residence ID", "Two passport photos"]);
const tax = await svc(rev.id, "Tax Clearance Certificate", "TCC", 0, "1 day", ["TIN certificate", "Business license"]);
const license = await svc(rev.id, "Business License Renewal", "BLR", 250, "2 days", ["Previous license", "Tax clearance"]);
const land = await svc(lnd.id, "Land Holding Certificate", "LHC", 150, "5 days", ["Kebele ID", "Site plan"]);

await api("POST", "/schedules", { token: admin, body: {
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], openingTime: "08:30", closingTime: "17:00", lunchStart: "12:30", lunchEnd: "13:30",
  slotIntervalMinutes: 30, dailyCapacity: 40, effectiveStartDate: iso(0), status: "Active",
  serviceCapacities: [
    { serviceId: birth.id, dailyCapacity: 20 }, { serviceId: marriage.id, dailyCapacity: 10 }, { serviceId: residence.id, dailyCapacity: 15 },
    { serviceId: tax.id, dailyCapacity: 15 }, { serviceId: license.id, dailyCapacity: 10 }, { serviceId: land.id, dailyCapacity: 8 },
  ],
} });
await api("POST", "/schedules/exceptions", { token: admin, body: { type: "PUBLIC_HOLIDAY", title: "Ethiopian Christmas (Genna)", startDate: "2027-01-07", scope: "ALL" } });
await api("POST", "/schedules/exceptions", { token: admin, body: { type: "NON_WORKING_DAY", title: "Land records audit", description: "Annual audit of land holding records.", startDate: weekday(9), endDate: weekday(9), scope: "DEPARTMENT", departmentIds: [lnd.id] } });

await api("POST", "/admin/users/provision", { token: admin, body: { fullName: "Hana Tesfaye", phone: "+251911000201", email: "hana@woreda.test", password: "Officer#2026", role: "Department Officer", departmentId: crv.id, serviceIds: [birth.id, marriage.id, residence.id] } });
await api("POST", "/admin/users/provision", { token: admin, body: { fullName: "Dawit Bekele", phone: "+251911000202", email: "dawit@woreda.test", password: "Officer#2026", role: "Department Officer", departmentId: rev.id, serviceIds: [tax.id, license.id] } });
const hana = (await api("POST", "/auth/login", { body: { email: "hana@woreda.test", password: "Officer#2026" } })).token;
const dawit = (await api("POST", "/auth/login", { body: { email: "dawit@woreda.test", password: "Officer#2026" } })).token;

const citizens = {};
for (const [name, phone] of [["Almaz Hailu", "+251911000301"], ["Yonas Abebe", "+251911000302"], ["Selam Girma", "+251911000303"], ["Kebede Alemu", "+251911000304"], ["Meron Tadesse", "+251911000305"], ["Dani Belay", "+251911000306"]]) {
  await api("POST", "/auth/register", { body: { fullName: name, phone, password: "Citizen#2026", location: "Bole", woreda: "Woreda 03", kebele: "Kebele 05" } });
  citizens[name] = (await api("POST", "/auth/login", { body: { phone, password: "Citizen#2026" } })).token;
}
const book = (who, serviceId, date, timeSlot, citizenNotes) => api("POST", "/appointments", { token: citizens[who], body: { serviceId, date, timeSlot, citizenNotes } });
const approve = (t, id) => api("PATCH", `/appointments/${id}/status`, { token: t, body: { status: "APPROVED" } });

const D1 = weekday(1), D2 = weekday(2), D3 = weekday(3);
// Birth certificate queue on D1
const a1 = await book("Almaz Hailu", birth.id, D1, "09:00 AM", "Newborn registration for my daughter.");
const a2 = await book("Yonas Abebe", birth.id, D1, "08:30 AM");
const a3 = await book("Selam Girma", birth.id, D1, "09:30 AM");
const a4 = await book("Kebede Alemu", birth.id, D1, "10:00 AM");
for (const a of [a1, a2, a3, a4]) await approve(hana, a.id);
for (const a of [a2, a1, a3]) await api("POST", "/queue/verify-checkin", { token: hana, body: { appointmentId: a.id } });
// Yonas served, Almaz called to counter 2
const firstCall = await api("POST", "/queue/call-next", { token: hana, body: { counterNumber: 1 } });
await api("PATCH", `/queue/${firstCall.appointmentId}/status`, { token: hana, body: { status: "COMPLETED" } });
await api("POST", "/queue/call-next", { token: hana, body: { counterNumber: 2 } });
// Other outcomes
const m1 = await book("Meron Tadesse", marriage.id, D2, "10:30 AM", "Both witnesses will attend.");
await api("PATCH", `/appointments/${m1.id}/status`, { token: hana, body: { status: "REJECTED", rejectionReason: "Witness IDs were not provided." } });
const r1 = await book("Dani Belay", residence.id, D2, "02:00 PM");
await approve(hana, r1.id);
await api("POST", `/appointments/${r1.id}/reschedule`, { token: hana, body: { newDate: D3, newTimeSlot: "02:30 PM", reason: "Officer on leave" } });
const r2 = await book("Kebede Alemu", residence.id, D3, "09:00 AM");
await api("POST", `/appointments/${r2.id}/cancel`, { token: citizens["Kebede Alemu"] });
await book("Almaz Hailu", marriage.id, D3, "11:00 AM");                      // pending
await book("Dani Belay", tax.id, D2, "09:30 AM");                          // pending (Revenue)
const t1 = await book("Selam Girma", license.id, D2, "10:00 AM");
await approve(dawit, t1.id);
await book("Yonas Abebe", land.id, D3, "03:00 PM");                        // pending (Land)
console.log(JSON.stringify({ D1, D2, D3, almazBirthRef: a1.referenceNumber }));
