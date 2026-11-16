// Same-day queue scenario for the queue screenshots (citizens booked, approved and checked in today).
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
const TODAY = iso(0);

const admin = (await api("POST", "/auth/login", { body: { email: "admin@woreda.test", password: "Admin#2026" } })).token;
const crv = await api("POST", "/departments", { token: admin, body: { name: "Civil Registration and Vital Events", code: "CRV", buildingRoom: "Block A, Room 101", contactPhone: "+251111234501" } });
const birth = await api("POST", "/services", { token: admin, body: { departmentId: crv.id, name: "Birth Certificate Issuance", code: "BCI", feeETB: 50, requiredDocuments: ["Kebele ID"] } });
const marriage = await api("POST", "/services", { token: admin, body: { departmentId: crv.id, name: "Marriage Certificate", code: "MRC", feeETB: 100 } });
await api("POST", "/schedules", { token: admin, body: { workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], openingTime: "00:00", closingTime: "23:59", slotIntervalMinutes: 15, dailyCapacity: 60, effectiveStartDate: TODAY, status: "Active" } });
await api("POST", "/admin/users/provision", { token: admin, body: { fullName: "Hana Tesfaye", phone: "+251911000201", email: "hana@woreda.test", password: "Officer#2026", role: "Department Officer", departmentId: crv.id, serviceIds: [birth.id, marriage.id] } });
const hana = (await api("POST", "/auth/login", { body: { email: "hana@woreda.test", password: "Officer#2026" } })).token;
const tok = {};
for (const [name, phone] of [["Almaz Hailu", "+251911000301"], ["Yonas Abebe", "+251911000302"], ["Selam Girma", "+251911000303"], ["Kebede Alemu", "+251911000304"], ["Meron Tadesse", "+251911000305"]]) {
  await api("POST", "/auth/register", { body: { fullName: name, phone, password: "Citizen#2026" } });
  tok[name] = (await api("POST", "/auth/login", { body: { phone, password: "Citizen#2026" } })).token;
}
const free = (await api("GET", `/schedules/availability?serviceId=${birth.id}&date=${TODAY}`)).slots.filter((s) => s.status === "Available").map((s) => s.timeSlot);
if (free.length < 4) throw new Error(`only ${free.length} slots left today`);
const book = (who, serviceId, date, slot) => api("POST", "/appointments", { token: tok[who], body: { serviceId, date, timeSlot: slot } });
const y = await book("Yonas Abebe", birth.id, TODAY, free[0]);
const a = await book("Almaz Hailu", birth.id, TODAY, free[1]);
const s = await book("Selam Girma", birth.id, TODAY, free[2]);
const k = await book("Kebede Alemu", birth.id, TODAY, free[3]);
for (const x of [y, a, s, k]) await api("PATCH", `/appointments/${x.id}/status`, { token: hana, body: { status: "APPROVED" } });
for (const x of [y, a, s]) await api("POST", "/queue/verify-checkin", { token: hana, body: { appointmentId: x.id } });
const first = await api("POST", "/queue/call-next", { token: hana, body: { counterNumber: 1 } });
await api("PATCH", `/queue/${first.appointmentId}/status`, { token: hana, body: { status: "COMPLETED" } });
await api("POST", "/queue/call-next", { token: hana, body: { counterNumber: 2 } });           // Almaz at counter 2
await book("Almaz Hailu", marriage.id, iso(2), "10:00 AM");                                   // pending, later day
await book("Meron Tadesse", birth.id, iso(1), "09:00 AM");                                    // pending for officer view
console.log("slots used:", free.slice(0, 4).join(", "));
