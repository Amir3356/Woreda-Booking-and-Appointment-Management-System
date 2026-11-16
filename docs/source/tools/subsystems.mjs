// Layered subsystem decomposition drawn as SVG bands (overrides the Mermaid version).
import { writeFileSync } from "node:fs";
const OUT = new URL("../fig/", import.meta.url).pathname;
const W = 960;
const F = "Arial, Helvetica, sans-serif";
const parts = [];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function band(y, h, title, fill) {
  parts.push(`<rect x="10" y="${y}" width="${W - 20}" height="${h}" rx="8" fill="${fill}" stroke="#94a3b8"/>`);
  parts.push(`<text x="24" y="${y + 22}" font-family="${F}" font-size="15" font-weight="700" fill="#0f172a">${esc(title)}</text>`);
}
function box(x, y, w, h, label, opts = {}) {
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${opts.fill || "#eef2ff"}" stroke="${opts.stroke || "#1e3a8a"}" stroke-width="1.3"/>`);
  const lines = label.split("\n");
  lines.forEach((l, i) => parts.push(`<text x="${x + w / 2}" y="${y + h / 2 + 5 + (i - (lines.length - 1) / 2) * 16}" text-anchor="middle" font-family="${F}" font-size="${opts.size || 14}" fill="#0f172a">${esc(l)}</text>`));
}
function arrow(x1, y1, x2, y2, label) {
  parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#334155" stroke-width="1.6" marker-end="url(#a)"/>`);
  if (label) parts.push(`<text x="${(x1 + x2) / 2 + 8}" y="${(y1 + y2) / 2 + 4}" font-family="${F}" font-size="13" fill="#334155">${esc(label)}</text>`);
}
// Presentation
band(10, 150, "Presentation subsystems (client/)", "#f8fafc");
const pw = 205, pg = 18, px0 = 30;
["Public portal", "Citizen portal", "Officer service desk", "Administration console"].forEach((t, i) => box(px0 + i * (pw + pg), 40, pw, 44, t));
box(30, 100, W - 60, 44, "Shared client layer: REST API client, WebSocket client, Zustand store, UI components", { fill: "#e0f2fe", stroke: "#0369a1" });
// Security
arrow(W / 2 - 120, 160, W / 2 - 120, 200, "HTTPS REST /api/v1");
box(30, 200, W - 60, 46, "Security and request middleware: request id, logging, CORS, rate limit, JWT authentication, CSRF, CASL abilities, Zod validation", { fill: "#fef3c7", stroke: "#b45309", size: 13.5 });
arrow(W / 2 - 120, 246, W / 2 - 120, 280);
// Application
band(280, 210, "Application subsystems (server/): controllers, services, repositories", "#f8fafc");
const aw = 205, ag = 18;
const app = [
  "Authentication\nand sessions", "Catalog: departments\nand services", "Scheduling: hours,\nexceptions, availability", "Appointment\nmanagement",
  "Desk queue:\ncheck-in, call, finalize", "Reporting and\nCSV export", "Audit trail", "Staff, citizens,\nprofiles, settings",
];
app.forEach((t, i) => box(30 + (i % 4) * (aw + ag), 312 + Math.floor(i / 4) * 70, aw, 56, t));
box(30, 452, W - 60, 30, "Event service and realtime hub (WebSocket broadcast to open pages)", { fill: "#dcfce7", stroke: "#15803d", size: 13.5 });
// back to clients
parts.push(`<path d="M ${W - 40} 452 L ${W - 40} 260 Q ${W - 40} 170 ${W - 40} 146" fill="none" stroke="#15803d" stroke-width="1.6" stroke-dasharray="6 4" marker-end="url(#g)"/>`);
parts.push(`<text x="${W - 230}" y="268" font-family="${F}" font-size="13" fill="#15803d">WebSocket live notices</text>`);
// Data
arrow(W / 2 - 120, 490, W / 2 - 120, 530, "parameterized SQL");
band(530, 90, "Data management", "#f8fafc");
parts.push(`<ellipse cx="${W / 2}" cy="562" rx="120" ry="10" fill="#e2e8f0" stroke="#334155"/>`);
parts.push(`<rect x="${W / 2 - 120}" y="562" width="240" height="40" fill="#e2e8f0" stroke="none"/>`);
parts.push(`<line x1="${W / 2 - 120}" y1="562" x2="${W / 2 - 120}" y2="602" stroke="#334155"/><line x1="${W / 2 + 120}" y1="562" x2="${W / 2 + 120}" y2="602" stroke="#334155"/>`);
parts.push(`<ellipse cx="${W / 2}" cy="602" rx="120" ry="10" fill="#e2e8f0" stroke="#334155"/>`);
parts.push(`<text x="${W / 2}" y="588" text-anchor="middle" font-family="${F}" font-size="14" fill="#0f172a">PostgreSQL (13 tables)</text>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 630" width="${W}" height="630">
<defs><marker id="a" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#334155"/></marker>
<marker id="g" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#15803d"/></marker></defs>
${parts.join("\n")}</svg>`;
writeFileSync(`${OUT}subsystems.svg`, svg);
console.log("saved subsystems");
