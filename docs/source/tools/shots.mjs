// Screenshots of the running system (sample data) for the documentation.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const WEB = "http://localhost:5173";
const OUT = new URL("../img/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const shot = async (page, name, opts = {}) => { await wait(opts.wait ?? 1200); await page.screenshot({ path: `${OUT}${name}.png`, fullPage: Boolean(opts.full) }); console.log("saved", name); };

async function session(phoneLocal, password) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.25 });
  if (phoneLocal) {
    await page.goto(`${WEB}/login`, { waitUntil: "networkidle2" });
    await page.type("#signin-identifier", phoneLocal);
    await page.type("#signin-password", password);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click("button.auth-submit")]);
  }
  return { ctx, page };
}

try {
  // ---- public ----
  let { ctx, page } = await session(null);
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle2" }); await shot(page, "pub-login");
  await page.goto(`${WEB}/register`, { waitUntil: "networkidle2" }); await shot(page, "pub-register");
  await page.goto(`${WEB}/services`, { waitUntil: "networkidle2" }); await shot(page, "pub-services");
  await page.goto(`${WEB}/track`, { waitUntil: "networkidle2" });
  const trackInput = await page.$("input");
  if (trackInput) { await trackInput.type("+251911000301"); await page.keyboard.press("Enter"); }
  await shot(page, "pub-track", { wait: 2500 });
  await ctx.close();

  // ---- citizen (Almaz) ----
  ({ ctx, page } = await session("911000301", "Citizen#2026"));
  await page.goto(`${WEB}/citizen/book`, { waitUntil: "networkidle2" });
  await shot(page, "cit-appointment", { wait: 2500 });
  await shot(page, "cit-appointment-full", { full: true, wait: 300 });
  // booking form
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Book Slot"))?.click());
  await page.waitForSelector("#citizen-appointment-date", { timeout: 10000 }).catch(() => {});
  await wait(1500);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^\d{1,2}:\d{2} (AM|PM)/.test(b.textContent.trim()) && !b.disabled)?.click());
  await shot(page, "cit-booking-form", { wait: 1500 });
  await page.keyboard.press("Escape");
  await page.goto(`${WEB}/citizen/queue`, { waitUntil: "networkidle2" });
  await shot(page, "cit-myqueue", { wait: 2500 });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: "networkidle2" });
  await shot(page, "cit-myqueue-mobile", { wait: 2500 });
  await ctx.close();

  // ---- officer (Hana) ----
  ({ ctx, page } = await session("911000201", "Officer#2026"));
  await page.goto(`${WEB}/officer/appointments`, { waitUntil: "networkidle2" }); await shot(page, "off-appointments", { wait: 2500 });
  await page.goto(`${WEB}/officer/queue`, { waitUntil: "networkidle2" }); await shot(page, "off-queue", { wait: 2500 });
  await ctx.close();

  // ---- admin ----
  ({ ctx, page } = await session("911000100", "Admin#2026"));
  for (const [path, name, full] of [
    ["/admin/account-provision", "adm-accounts"], ["/admin/citizens", "adm-citizens"], ["/admin/departments", "adm-departments"],
    ["/admin/services", "adm-services"], ["/admin/schedule/hours", "adm-hours", true], ["/admin/schedule/exceptions", "adm-exceptions"],
    ["/admin/audit", "adm-audit"],
  ]) {
    await page.goto(`${WEB}${path}`, { waitUntil: "networkidle2" });
    await shot(page, name, { wait: 2500, full });
  }
  await ctx.close();
} finally {
  await browser.close();
}
