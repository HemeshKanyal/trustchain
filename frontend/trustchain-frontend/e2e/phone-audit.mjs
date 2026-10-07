// Phone-width audit: every page, every role. Reports horizontal overflow and the elements causing it.
//   node e2e/phone-audit.mjs [baseUrl]
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3100";
const ROLES = {
  admin: ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", ["/admin", "/admin/applications", "/admin/organisations", "/admin/batches", "/admin/alerts", "/admin/devices", "/admin/system", "/admin/simulation"]],
  manufacturer: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", ["/manufacturer", "/manufacturer/batches/new", "/manufacturer/batches", "/manufacturer/batches/1", "/manufacturer/shipments"]],
  distributor: ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", ["/distributor", "/distributor/arriving", "/distributor/inventory", "/distributor/road"]],
  pharmacy: ["0x90F79bf6EB2c4f870365E785982E1f101E93b906", ["/pharmacy", "/pharmacy/arriving", "/pharmacy/shelf", "/pharmacy/sales"]],
  doctor: ["0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", ["/doctor", "/doctor/prescriptions", "/doctor/patients"]],
};
const PUBLIC = ["/", "/verify", "/portal", "/portal/manufacturer", "/portal/apply", "/network", "/network/0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "/batch/1", "/shipment/1", "/live"];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
let problems = 0;
async function audit(path) {
  await p.goto(base + path);
  await p.waitForTimeout(1800);
  const r = await p.evaluate(() => {
    const W = 390; // the device width; mobile browsers zoom out (innerWidth grows) when content is wider
    const scrollable = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
    const bad = [...document.querySelectorAll("body *")].filter((el) => { const x = el.getBoundingClientRect(); return x.width > 0 && x.right > W + 1 && !scrollable(el); })
      .slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { overflow: Math.max(document.documentElement.scrollWidth, window.innerWidth) - W, bad };
  });
  const name = path.replace(/\//g, "_").replace(/^_/, "") || "home";
  await p.screenshot({ path: `e2e/phone/${name}.png`, fullPage: true });
  if (r.overflow > 0 || r.bad.length) problems++;
  console.log(`${r.overflow > 0 || r.bad.length ? "✗" : "✓"} ${path}  overflow=${r.overflow}px ${r.bad.join(" | ")}`);
}
for (const path of PUBLIC) await audit(path);
for (const [role, [addr, pages]] of Object.entries(ROLES)) {
  await p.goto(`${base}/portal/${role}`);
  await p.getByTestId(`org-${addr}`).click();
  for (let i = 0; i < 60 && !new URL(p.url()).pathname.startsWith(`/${role}`); i++) {
    const s = p.getByTestId("signin-submit"), d = p.getByTestId("use-demo");
    if (await s.isVisible().catch(() => false)) await s.click(); else if (await d.isVisible().catch(() => false)) await d.click();
    await p.waitForTimeout(400);
  }
  for (const path of pages) await audit(path);
}
console.log(`\n${problems} page(s) with problems`);
await b.close();
