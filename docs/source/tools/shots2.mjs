// Queue screenshots on the same-day scenario (seed2.mjs).
import puppeteer from "puppeteer-core";

const WEB = "http://localhost:5173";
const OUT = new URL("../img/", import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const shot = async (page, name, w = 2500) => { await wait(w); await page.screenshot({ path: `${OUT}${name}.png` }); console.log("saved", name); };
async function session(phoneLocal, password) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.25 });
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle2" });
  await page.type("#signin-identifier", phoneLocal);
  await page.type("#signin-password", password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click("button.auth-submit")]);
  return { ctx, page };
}
try {
  let { ctx, page } = await session("911000301", "Citizen#2026");
  await page.goto(`${WEB}/citizen/queue`, { waitUntil: "networkidle2" });
  await shot(page, "cit-myqueue");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: "networkidle2" });
  await shot(page, "cit-myqueue-mobile");
  await ctx.close();
  ({ ctx, page } = await session("911000201", "Officer#2026"));
  await page.goto(`${WEB}/officer/appointments`, { waitUntil: "networkidle2" });
  await shot(page, "off-appointments");
  await page.goto(`${WEB}/officer/queue`, { waitUntil: "networkidle2" });
  await shot(page, "off-queue");
  await ctx.close();
} finally {
  await browser.close();
}
