// Builds the project documentation PDF:
//   1. assemble body.html from content-*.html (numbered figures/tables, inline SVG, page markers)
//   2. render body.pdf with Chrome (arabic page numbers from 1)
//   3. find the page of every heading, figure and table with pdftotext
//   4. build front.html (cover, TOC, lists, abbreviations) and render front.pdf (roman numbers)
//   5. merge front.pdf + body.pdf into the final PDF
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";

const DOC = new URL("../", import.meta.url).pathname;
const FINAL_DIR = new URL("../../", import.meta.url).pathname;
const FINAL = FINAL_DIR + "WoredaCare_Project_Documentation.pdf";
const TITLE = "WoredaCare: Woreda Booking and Appointment Management System";

const CSS = `
@page { size: A4; margin: 25mm 20mm 22mm 25mm;
  @top-right { content: "WoredaCare: Project Documentation"; font: 9pt "Liberation Serif", serif; color: #6b7280; }
  @bottom-center { content: counter(page); font: 10.5pt "Liberation Serif", serif; } }
@page land { size: A4 landscape; margin: 18mm 20mm 18mm 20mm;
  @top-right { content: "WoredaCare: Project Documentation"; font: 9pt "Liberation Serif", serif; color: #6b7280; }
  @bottom-center { content: counter(page); font: 10.5pt "Liberation Serif", serif; } }
@page cover { margin: 0; @top-right { content: none; } @bottom-center { content: none; } }
@page front { @top-right { content: none; } @bottom-center { content: counter(page, lower-roman); font: 10.5pt "Liberation Serif", serif; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Times New Roman", "Liberation Serif", serif; font-size: 12pt; line-height: 1.5; color: #111; margin: 0; }
p { margin: 0 0 8pt; text-align: justify; hyphens: auto; }
ul, ol { margin: 0 0 8pt 0; padding-left: 22pt; } li { margin-bottom: 3pt; }
h1 { font-size: 20pt; margin: 0 0 16pt; padding-bottom: 6pt; border-bottom: 2px solid #1e3a8a; color: #0f172a; line-height: 1.25; }
h2 { font-size: 15pt; margin: 18pt 0 8pt; color: #0f172a; break-after: avoid; }
h3 { font-size: 13pt; margin: 14pt 0 6pt; color: #1e293b; break-after: avoid; }
h4 { font-size: 12pt; margin: 12pt 0 5pt; font-style: italic; color: #1e293b; break-after: avoid; }
section.chapter { break-before: page; }
section.chapter:first-of-type { break-before: auto; }
code { font-family: "Liberation Mono", monospace; font-size: 10pt; background: #f1f5f9; padding: 0 2pt; border-radius: 2pt; }
.ph { background: #fef3c7; border: 1px dashed #d97706; padding: 0 3pt; font-style: italic; color: #78350f; }
p.note { font-size: 11pt; }
.small { font-size: 10.5pt; }
table.t { width: 100%; border-collapse: collapse; margin: 4pt 0 14pt; font-size: 10.5pt; line-height: 1.35; break-inside: auto; }
table.t th, table.t td { border: 1px solid #94a3b8; padding: 4pt 6pt; vertical-align: top; text-align: left; }
table.t thead th { background: #e2e8f0; font-weight: bold; }
table.t thead { display: table-header-group; }
table.t tr { break-inside: avoid; }
table.req td:first-child, table.api td:first-child { white-space: nowrap; font-weight: bold; }
table.api td:first-child { white-space: normal; font-family: "Liberation Mono", monospace; font-size: 9pt; font-weight: normal; width: 38%; }
table.small-t { font-size: 9.5pt; }
table.uc { font-size: 9.5pt; }
table.matrix td:not(:first-child), table.matrix th:not(:first-child) { text-align: center; }
table.gantt { font-size: 9pt; break-inside: avoid; } table.gantt th, table.gantt td { padding: 2pt 3pt; text-align: center; }
table.gantt td:first-child { text-align: left; width: 34%; } table.gantt td.on { background: #bfdbfe; color: #1e3a8a; }
table.gantt td.ms { background: #1e3a8a; color: #fff; }
.tcap { font-size: 10.5pt; font-weight: bold; margin: 10pt 0 3pt; break-after: avoid; text-align: left; }
figure { margin: 10pt 0 14pt; text-align: center; break-inside: avoid; }
figure .art svg { width: 100%; height: auto; max-height: 190mm; display: block; margin: 0 auto; }
figure.tall .art svg { max-height: 215mm; }
figure img { max-width: 100%; max-height: 170mm; border: 1px solid #cbd5e1; display: block; margin: 0 auto; }
figure.tall img { max-height: 215mm; } figure.narrow img { max-width: 48%; max-height: 200mm; }
figcaption { font-size: 10.5pt; margin-top: 5pt; font-weight: bold; }
.landpage { page: land; break-before: page; break-after: page; }
.landpage figure { margin: 4pt 0 0; } .landpage figure .art svg { max-height: 150mm; } .landpage p + figure .art svg { max-height: 132mm; }\n.landpage h3, .landpage h4 { margin-top: 0; }
ol.refs li { margin-bottom: 6pt; text-align: left; }
/* front matter */
.cover { page: cover; break-after: page; height: 297mm; padding: 30mm 25mm 25mm; display: flex; flex-direction: column; align-items: center; text-align: center; font-family: "Liberation Serif", serif; }
.cover .uni { font-size: 18pt; font-weight: bold; letter-spacing: .5pt; }
.cover .fac { font-size: 13pt; margin-top: 6pt; }
.cover .rule { width: 60%; border-top: 2px solid #1e3a8a; margin: 22mm 0 14mm; }
.cover .title { font-size: 24pt; font-weight: bold; color: #0f172a; line-height: 1.3; }
.cover .sub { font-size: 15pt; margin-top: 8mm; }
.cover .block { margin-top: 20mm; font-size: 12.5pt; line-height: 1.8; }
.cover .foot { margin-top: auto; font-size: 12.5pt; line-height: 1.7; }
.front { page: front; }
.front section { break-before: page; }
.front section:first-child { break-before: auto; }
.toc { width: 100%; border-collapse: collapse; font-size: 11.5pt; line-height: 1.55; }
.toc td { padding: 1pt 0; vertical-align: bottom; }
.toc td.pg { text-align: right; width: 12mm; }
.toc td.t1 { font-weight: bold; padding-top: 6pt; }
.toc td.t2 { padding-left: 7mm; } .toc td.t3 { padding-left: 14mm; font-size: 11pt; }
.toc .lead { display: flex; } .toc .lead span.dots { flex: 1; border-bottom: 1px dotted #64748b; margin: 0 4pt 4pt; }
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (tag, name) => { const m = new RegExp(`${name}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
const has = (tag, name) => new RegExp(`\\s${name}(\\s|>|=)`).test(tag);

function cleanSvg(svg) {
  // Let CSS size the SVG: drop fixed width/height and inline max-width.
  return svg
    .replace(/^<\?xml[^>]*>/, "")
    .replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1")
    .replace(/<svg([^>]*?)\sheight="[^"]*"/, "<svg$1")
    .replace(/<svg([^>]*?)\sstyle="[^"]*"/, "<svg$1");
}

// ---------- 1. assemble body ----------
let content = readFileSync(DOC + "content-1.html", "utf8") + readFileSync(DOC + "content-2.html", "utf8");
const entries = [];  // {kind:'h1'|'h2'|'h3'|'fig'|'tab', text, mk}
let mkN = 0;
const marker = () => `M${String(++mkN).padStart(3, "0")}`;
const sections = content.split(/(?=<section class="chapter">)/);
let out = "";
for (const sec of sections) {
  const chap = /<h1>Chapter (\d+):/.exec(sec);
  const n = chap ? chap[1] : null;
  let fig = 0, tab = 0;
  let s = sec;
  // headings h1-h3 (h4 not listed in TOC)
  s = s.replace(/<(h[123])>([\s\S]*?)<\/\1>/g, (_, h, text) => {
    const mk = marker();
    entries.push({ kind: h, text: text.replace(/<[^>]+>/g, ""), mk });
    return `<${h} id="${mk}">${text}</${h}>`;
  });
  // diagrams
  s = s.replace(/<fig [^>]*><\/fig>/g, (tag) => {
    const id = attr(tag, "id"), cap = attr(tag, "caption");
    const num = `${n}.${++fig}`, mk = marker();
    entries.push({ kind: "fig", text: `Figure ${num}: ${cap}`, mk });
    const svg = cleanSvg(readFileSync(`${DOC}fig/${id}.svg`, "utf8"));
    const cls = has(tag, "tall") ? "tall" : "";
    const f = `<figure class="${cls}"><div class="art">${svg}</div><figcaption id="${mk}">Figure ${num}: ${esc(cap)}</figcaption></figure>`;
    return has(tag, "land") ? `<div class="landpage">${f}</div>` : f;
  });
  // screenshots
  s = s.replace(/<shot [^>]*><\/shot>/g, (tag) => {
    const src = attr(tag, "src"), cap = attr(tag, "caption");
    const num = `${n}.${++fig}`, mk = marker();
    entries.push({ kind: "fig", text: `Figure ${num}: ${cap}`, mk });
    const cls = has(tag, "narrow") ? "narrow" : has(tag, "tall") ? "tall" : "";
    return `<figure class="${cls}"><img src="img/${src}.png" alt="${esc(cap)}"><figcaption id="${mk}">Figure ${num}: ${esc(cap)} (sample data)</figcaption></figure>`;
  });
  // landscape blocks: heading and lead-in text on the same landscape page as the figure
  s = s.replace(/<land>/g, '<div class="landpage">').replace(/<\/land>/g, "</div>");
  // tables
  s = s.replace(/<table ([^>]*?)data-cap="([^"]*)"([^>]*)>/g, (_, a, cap, b) => {
    const num = `${n}.${++tab}`, mk = marker();
    entries.push({ kind: "tab", text: `Table ${num}: ${cap}`, mk });
    return `<div class="tcap" id="${mk}">Table ${num}: ${esc(cap)}</div><table ${a}${b}>`;
  });
  out += s;
}
const linkBlock = `<div style="position:absolute;top:0;left:0;width:1px;height:1px;opacity:0.01">${entries.map((e) => `<a href="#${e.mk}" style="position:absolute;top:0;left:0;width:1px;height:1px;display:block"></a>`).join("")}</div>`;
const bodyHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title><style>${CSS}</style></head><body>${linkBlock}${out}</body></html>`;
writeFileSync(DOC + "body.html", bodyHtml);

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--allow-file-access-from-files"] });
async function render(htmlFile, pdfFile) {
  const page = await browser.newPage();
  await page.goto("file://" + htmlFile, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true });
  await page.close();
}

// ---------- 2. body.pdf ----------
await render(DOC + "body.html", DOC + "body.pdf");
const bodyPages = (await PDFDocument.load(readFileSync(DOC + "body.pdf"))).getPageCount();

// ---------- 3. page of each target from the PDF's named destinations ----------
const { PDFName } = await import("pdf-lib");
const bodyDoc = await PDFDocument.load(readFileSync(DOC + "body.pdf"));
const pageIndex = new Map(bodyDoc.getPages().map((pg, i) => [pg.ref.toString(), i + 1]));
const dests = bodyDoc.catalog.lookup(PDFName.of("Dests"));
const pageOf = {};
for (const e of entries) {
  const arr = dests && dests.lookup(PDFName.of(e.mk));
  const ref = arr && arr.get && arr.get(0);
  if (ref && pageIndex.has(ref.toString())) pageOf[e.mk] = pageIndex.get(ref.toString());
}
const missing = entries.filter((e) => !(e.mk in pageOf));
if (missing.length) console.log("WARNING targets not found:", missing.map((m) => m.text).join(" | "));
// remove the helper links from page 1
const p1 = bodyDoc.getPages()[0].node;
const annots = p1.Annots();
if (annots) {
  const keep = [];
  for (let i = 0; i < annots.size(); i++) {
    const an = bodyDoc.context.lookup(annots.get(i));
    const dest = an.get(PDFName.of("Dest"));
    if (!(dest && /^\/M\d{3}$/.test(dest.toString()))) keep.push(annots.get(i));
  }
  if (keep.length) p1.set(PDFName.of("Annots"), bodyDoc.context.obj(keep)); else p1.delete(PDFName.of("Annots"));
}
writeFileSync(DOC + "body-final.pdf", await bodyDoc.save());
const BODY = "body-final.pdf";

// ---------- 4. front matter ----------
const row = (cls, text, pg) => `<tr><td class="${cls}"><div class="lead"><span>${esc(text)}</span><span class="dots"></span></div></td><td class="pg">${pg ?? "?"}</td></tr>`;
const toc = entries.filter((e) => ["h1", "h2", "h3"].includes(e.kind)).map((e) => row({ h1: "t1", h2: "t2", h3: "t3" }[e.kind], e.text, pageOf[e.mk])).join("");
const lof = entries.filter((e) => e.kind === "fig").map((e) => row("t2", e.text, pageOf[e.mk])).join("");
const lot = entries.filter((e) => e.kind === "tab").map((e) => row("t2", e.text, pageOf[e.mk])).join("");
const abbreviations = [
  ["API", "Application Programming Interface"], ["CASL", "Isomorphic authorization library used for role-based access control"],
  ["CSRF", "Cross-Site Request Forgery"], ["CSV", "Comma-Separated Values"], ["ER", "Entity Relationship"],
  ["FR / NFR", "Functional / Non-Functional Requirement"], ["HTTP(S)", "Hypertext Transfer Protocol (Secure)"],
  ["JSON", "JavaScript Object Notation"], ["JWT", "JSON Web Token"], ["ODD", "Object Design Document"],
  ["RAD", "Requirement Analysis Document"], ["RBAC", "Role-Based Access Control"], ["REST", "Representational State Transfer"],
  ["SDD", "System Design Document"], ["SPA", "Single-Page Application"], ["SQL", "Structured Query Language"],
  ["SUS", "System Usability Scale"], ["UI", "User Interface"], ["UML", "Unified Modeling Language"],
].map(([a, b]) => `<tr><td style="width:28mm;font-weight:bold">${a}</td><td>${esc(b)}</td></tr>`).join("");
const frontHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title><style>${CSS}</style></head><body>
<div class="cover">
  <div class="uni">KOTEBE UNIVERSITY OF EDUCATION</div>
  <div class="fac"><span class="ph">[Faculty / College]</span></div>
  <div class="fac"><span class="ph">[Department]</span></div>
  <div class="rule"></div>
  <div class="title">WoredaCare:<br>Woreda Booking and Appointment<br>Management System</div>
  <div class="sub">Industrial Project Documentation</div>
  <div class="block">
    <b>Prepared by</b><br>
    <span class="ph">[Student name 1 &mdash; ID number]</span><br>
    <span class="ph">[Student name 2 &mdash; ID number]</span><br>
    <span class="ph">[Student name 3 &mdash; ID number]</span>
  </div>
  <div class="block" style="margin-top:12mm"><b>Advisor</b><br><span class="ph">[Advisor name]</span></div>
  <div class="foot">Addis Ababa, Ethiopia<br><span class="ph">[Month, Year of submission]</span></div>
</div>
<div class="front">
  <section><h1 style="border:none">Table of Contents</h1><table class="toc">${toc}</table></section>
  <section><h1 style="border:none">List of Figures</h1><table class="toc">${lof}</table></section>
  <section><h1 style="border:none">List of Tables</h1><table class="toc">${lot}</table></section>
  <section><h1 style="border:none">List of Abbreviations</h1><table class="t">${abbreviations}</table></section>
</div></body></html>`;
writeFileSync(DOC + "front.html", frontHtml);
await render(DOC + "front.html", DOC + "front.pdf");
await browser.close();

// ---------- 5. merge ----------
const merged = await PDFDocument.create();
for (const f of ["front.pdf", BODY]) {
  const src = await PDFDocument.load(readFileSync(DOC + f));
  const pages = await merged.copyPages(src, src.getPageIndices());
  pages.forEach((p) => merged.addPage(p));
}
merged.setTitle(TITLE);
merged.setSubject("Industrial project documentation (Kotebe University of Education guideline)");
merged.setKeywords(["woreda", "appointment", "booking", "queue", "SRS", "SDD", "ODD"]);
mkdirSync(FINAL_DIR, { recursive: true });
writeFileSync(FINAL, await merged.save());
const frontPages = (await PDFDocument.load(readFileSync(DOC + "front.pdf"))).getPageCount();
console.log(JSON.stringify({ frontPages, bodyPages, total: frontPages + bodyPages, figures: entries.filter((e) => e.kind === "fig").length, tables: entries.filter((e) => e.kind === "tab").length, final: FINAL }));
