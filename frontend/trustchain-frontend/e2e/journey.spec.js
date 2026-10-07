// Full medicine journey through the redesigned UI, on the local chain.
// Every role signs in the real way: Portals → find the organisation → wallet check → sign message.
// Run: npm run build && npx next start -p 3100 &  then  E2E_BOX=0x… npm run e2e
import { test, expect } from "@playwright/test";

const A = {
  admin: { addr: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", search: "Network Owner", role: "admin", home: "/admin" },
  maker: { addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", search: "Acme", role: "manufacturer", home: "/manufacturer" },
  dist: { addr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", search: "FastCold", role: "distributor", home: "/distributor" },
  pharm: { addr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", search: "City Care", role: "pharmacy", home: "/pharmacy" },
  doctor: { addr: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", search: "Rao", role: "doctor", home: "/doctor" },
  patient: { addr: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" },
  newbie: { addr: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720" },
};

const LOT = `TC-E2E-${Date.now().toString().slice(-6)}`;
const shot = (page, name) => page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });

/** Portal sign-in as a registered organisation, switching to its demo wallet when needed. */
async function signInAs(page, who) {
  await page.goto(`/portal/${who.role}`);
  await page.getByTestId("directory-search").fill(who.search);
  await page.getByTestId(`org-${who.addr}`).click();
  const panel = page.getByTestId("signin-panel");
  await expect(panel).toBeVisible();
  const deadline = Date.now() + 30_000;
  while (!new URL(page.url()).pathname.startsWith(who.home)) {
    if (Date.now() > deadline) throw new Error(`could not sign in as ${who.search}`);
    const demo = panel.getByTestId("use-demo");
    const submit = panel.getByTestId("signin-submit");
    if (await submit.isVisible().catch(() => false)) await submit.click();
    else if (await demo.isVisible().catch(() => false)) await demo.click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId("workspace-org").first()).toBeVisible();
}

/** Connect a demo wallet from a page that shows the dev-account picker. */
async function connectDemo(page, addr) {
  const picker = page.getByTestId("dev-account").first();
  await picker.selectOption(addr);
  // Pages swap the connect box for their content once a wallet is connected, so the picker may vanish.
  await expect(async () => {
    const gone = !(await picker.isVisible().catch(() => false));
    expect(gone || (await picker.inputValue()) === addr).toBe(true);
  }).toPass({ timeout: 15_000 });
}

/** Run a click that sends one transaction; wait for the sheet to show it sealed. */
async function tx(page, click) {
  const sheet = page.getByTestId("tx-sheet");
  if (await sheet.isVisible().catch(() => false)) await expect(sheet).toBeHidden({ timeout: 10_000 });
  await click();
  await expect(sheet).toHaveAttribute("data-state", "done", { timeout: 30_000 });
}

async function choose(select, text) {
  const labels = await select.locator("option").allInnerTexts();
  const label = labels.find((l) => l.includes(text));
  if (!label) throw new Error(`no option containing "${text}" in [${labels.join(" | ")}]`);
  await select.selectOption({ label });
}

test.describe.configure({ mode: "serial" });

test("medicine journey through the redesigned UI", async ({ page }) => {
  let batchId;
  let secrets;
  let rxId;

  await test.step("home, portals menu and directory", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Is it real/ })).toBeVisible();
    await expect(page.getByText("Batches on-chain")).toBeVisible();
    await shot(page, "01-home");
    await page.getByTestId("portals-menu").first().click();
    for (const k of ["manufacturer", "distributor", "pharmacy", "doctor", "admin", "patient"]) await expect(page.getByTestId(`portal-${k}`).first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/02-portals-menu.png" });
    await page.goto("/portal/manufacturer");
    await expect(page.getByTestId(`org-${A.maker.addr}`)).toContainText("Acme Pharma Ltd");
    await shot(page, "03-directory");
  });

  await test.step("a new pharmacy applies; the regulator approves", async () => {
    await page.goto("/portal/apply");
    await connectDemo(page, A.newbie.addr);
    await page.getByTestId("apply-role").selectOption("4");
    await page.getByTestId("apply-name").fill("Green Cross Pharmacy");
    await page.getByTestId("apply-location").fill("Pune, MH");
    await page.getByTestId("apply-next").click();
    await page.getByTestId("apply-license").fill("PH-MH-9001");
    await page.getByTestId("apply-next").click();
    await tx(page, () => page.getByTestId("apply-submit").click());
    await expect(page.getByTestId("application-pending")).toBeVisible();

    await signInAs(page, A.admin);
    await shot(page, "04-admin-overview");
    await page.goto("/admin/applications");
    const row = page.getByTestId("application-row").filter({ hasText: "Green Cross Pharmacy" });
    await tx(page, () => row.getByTestId("approve").click());
    await expect(row).toHaveCount(0);
    await page.goto("/portal/pharmacy");
    await expect(page.getByText("Green Cross Pharmacy").first()).toBeVisible();
  });

  await test.step("wrong wallet is refused at sign-in", async () => {
    await page.goto("/portal/manufacturer");
    await page.getByTestId(`org-${A.maker.addr}`).click();
    await expect(page.getByTestId("signin-panel")).toContainText("Wrong wallet");
    await page.screenshot({ path: "e2e/screenshots/05-wrong-wallet.png" });
  });

  await test.step("manufacturer creates a batch with the wizard", async () => {
    await signInAs(page, A.maker);
    await page.goto("/manufacturer/batches/new");
    await page.getByTestId("nb-product").fill("Azithromycin 500mg tablets");
    await page.getByTestId("nb-next").click();
    await page.getByTestId("nb-lot").fill(LOT);
    await page.getByTestId("nb-qty").fill("6");
    await page.getByTestId("nb-next").click();
    await page.getByTestId("nb-min").fill("0");
    await page.getByTestId("nb-max").fill("50");
    await page.getByTestId("nb-hum").fill("95");
    await page.getByTestId("nb-next").click();
    await page.getByTestId("nb-next").click();
    await shot(page, "06-wizard-review");
    await page.getByTestId("nb-submit").click();
    await expect(page.getByTestId("nb-labels")).toBeVisible({ timeout: 60_000 });
    batchId = Number((await page.getByTestId("nb-result").innerText()).match(/Batch #(\d+)/)[1]);
    await shot(page, "07-wizard-done");
    await page.getByTestId("nb-labels").click();
    await expect(page.locator("img[alt^='QR for strip']")).toHaveCount(6);
    secrets = await page.evaluate((id) => JSON.parse(localStorage.getItem(`trustchain:strips:31337:${id}`)), batchId);
    expect(secrets).toHaveLength(6);
  });

  await test.step("ship to the distributor in a smart box", async () => {
    await page.goto("/manufacturer/batches");
    const card = page.getByTestId(`batch-card-${batchId}`);
    await expect(card).toContainText(LOT);
    await shot(page, "08-batches");
    await card.getByTestId(`ship-batch-${batchId}`).click();
    await choose(page.getByTestId("ship-to"), "FastCold Logistics");
    await page.getByTestId("ship-qty").fill("6");
    const box = page.getByTestId("ship-device");
    const opts = await box.locator("option").allInnerTexts();
    await choose(box, opts.some((o) => o.includes("SmartBox-001")) ? "SmartBox-001" : "Emulator box");
    await tx(page, () => page.getByTestId("ship-submit").click());
  });

  await test.step("distributor proves arrival by scanning a strip, then ships on", async () => {
    await signInAs(page, A.dist);
    await shot(page, "09-distributor-board");
    const card = page.locator('[data-testid^="shipment-card-"]').filter({ hasText: "Azithromycin" }).first();
    await card.getByRole("button", { name: "Receive" }).click();
    const dialog = page.getByTestId("receive-dialog");
    await expect(dialog.getByTestId("receive-confirm")).toBeDisabled();
    await dialog.getByTestId("receive-code").fill(`TC1:0x${"ab".repeat(32)}`);
    await dialog.getByTestId("receive-check").click();
    await expect(dialog).toContainText("not registered");
    await dialog.getByTestId("receive-code").fill(`TC1:${secrets[0]}`);
    await dialog.getByTestId("receive-check").click();
    await expect(dialog).toContainText(`matches batch #${batchId}`);
    await page.screenshot({ path: "e2e/screenshots/10-receive-proof.png" });
    await tx(page, () => dialog.getByTestId("receive-confirm").click());

    await page.goto("/distributor/inventory");
    await page.getByTestId(`ship-batch-${batchId}`).click();
    await choose(page.getByTestId("ship-to"), "City Care Pharmacy");
    await page.getByTestId("ship-qty").fill("6");
    await tx(page, () => page.getByTestId("ship-submit").click());
  });

  await test.step("pharmacy receives", async () => {
    await signInAs(page, A.pharm);
    await page.goto("/pharmacy/arriving");
    await page.locator('[data-testid^="shipment-card-"]').filter({ hasText: "Azithromycin" }).first().getByRole("button", { name: "Receive" }).click();
    const dialog = page.getByTestId("receive-dialog");
    await dialog.getByTestId("receive-code").fill(`TC1:${secrets[1]}`);
    await dialog.getByTestId("receive-check").click();
    await tx(page, () => dialog.getByTestId("receive-confirm").click());
  });

  await test.step("doctor writes a prescription with a QR card", async () => {
    await signInAs(page, A.doctor);
    await page.getByTestId("rx-patient").fill(A.patient.addr);
    await page.getByTestId("rx-medicine").fill("Azithromycin 500mg tablets");
    await page.getByTestId("rx-dose").fill("1 tablet daily for 3 days");
    await page.getByTestId("rx-allowance").fill("2");
    await tx(page, () => page.getByTestId("rx-submit").click());
    rxId = Number((await page.getByTestId("rx-issued-id").innerText()).match(/Rx #(\d+)/)[1]);
    await expect(page.getByTestId("rx-printable").getByTestId("qr-image")).toBeVisible();
    await shot(page, "11-doctor-rx");
  });

  await test.step("anyone verifies: genuine, then a counterfeit that gets reported", async () => {
    await page.goto("/verify");
    await shot(page, "12-verify-empty");
    await page.getByTestId("verify-input").fill(`TC1:${secrets[0]}`);
    await page.getByTestId("verify-submit").click();
    await expect(page.getByTestId("verify-result")).toHaveAttribute("data-verdict", "genuine");
    await expect(page.getByTestId("verify-result")).toContainText("Azithromycin 500mg tablets");
    await expect(page.getByTestId("risk-panel")).toBeVisible();
    await shot(page, "13-verify-genuine");
    await page.getByTestId("verify-input").fill(`TC1:0x${"cd".repeat(32)}`);
    await page.getByTestId("verify-submit").click();
    await expect(page.getByTestId("verify-result")).toHaveAttribute("data-verdict", "unknown");
    await page.getByTestId("report-open").click();
    await page.getByLabel("Where did you get it?").fill("Roadside stall, Pune");
    await page.getByTestId("report-send").click();
    await expect(page.getByText("The regulator has your report")).toBeVisible();
    await shot(page, "14-verify-counterfeit");
  });

  await test.step("pharmacy counter: prescription-only is blocked, then sold with the prescription", async () => {
    await signInAs(page, A.pharm);
    await page.getByTestId("dispense-code").fill(`TC1:${secrets[0]}`);
    await page.getByTestId("dispense-add").click();
    await expect(page.getByTestId("dispense-strip")).toContainText("Genuine");
    await expect(page.getByText("Prescription-only medicine in the basket")).toBeVisible();
    await expect(page.getByTestId("dispense-submit")).toBeDisabled();
    await page.getByTestId("dispense-code").fill(`TC1:${secrets[1]}`);
    await page.getByTestId("dispense-add").click();
    await page.getByTestId("dispense-rx").fill(`TCRX:${rxId}`);
    await expect(page.getByTestId("rx-details")).toContainText("Azithromycin 500mg tablets");
    await page.getByRole("button", { name: "Use this patient" }).click();
    await shot(page, "15-pharmacy-counter");
    await tx(page, () => page.getByTestId("dispense-submit").click());
    await expect(page.getByTestId("receipt")).toBeVisible();
    await shot(page, "16-receipt");
    await page.getByTestId("new-sale").click();
    await page.goto("/pharmacy/forecast");
    await expect(page.getByTestId("forecast-chart")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("forecast-tiles")).toContainText("Next 7 days");
  });

  await test.step("copied QR shows already sold", async () => {
    await page.goto("/verify");
    await page.getByTestId("verify-input").fill(`TC1:${secrets[0]}`);
    await page.getByTestId("verify-submit").click();
    await expect(page.getByTestId("verify-result")).toHaveAttribute("data-verdict", "dispensed");
    await expect(page.getByTestId("verify-result")).toContainText("City Care Pharmacy");
  });

  await test.step("patient opens their cabinet", async () => {
    await page.goto("/portal/patient");
    await connectDemo(page, A.patient.addr);
    await page.getByTestId("patient-signin").click();
    await page.waitForURL("**/me");
    await expect(page.getByTestId("patient-strip")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByTestId("patient-strip").first()).toContainText("Good standing");
    await shot(page, "17-patient-cabinet");
    await page.goto("/me/qr");
    await expect(page.getByTestId("qr-image")).toBeVisible();
  });

  await test.step("manufacturer recalls; the counter blocks the sale; the patient is warned", async () => {
    await signInAs(page, A.maker);
    await page.goto("/manufacturer/batches");
    await page.getByTestId(`recall-${batchId}`).click();
    await page.getByTestId("recall-reason").fill("Impurity above limit in stability test");
    await expect(page.getByTestId("recall-submit")).toBeDisabled();
    await page.getByTestId("recall-lot").fill(LOT);
    await tx(page, () => page.getByTestId("recall-submit").click());

    await signInAs(page, A.pharm);
    await page.getByTestId("dispense-code").fill(`TC1:${secrets[2]}`);
    await page.getByTestId("dispense-add").click();
    await expect(page.getByTestId("dispense-strip")).toContainText("Recalled");
    await expect(page.getByText("can't be sold")).toBeVisible();
    await expect(page.getByTestId("dispense-submit")).toBeDisabled();

    await page.goto("/portal/patient");
    await connectDemo(page, A.patient.addr);
    await page.getByTestId("patient-signin").click();
    await page.waitForURL("**/me");
    await expect(page.getByText("A medicine you received has been recalled")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("patient-strip").first()).toContainText("Recalled");
    await shot(page, "18-patient-recall");
  });

  await test.step("regulator sees exactly who is affected, and the public report", async () => {
    await signInAs(page, A.admin);
    await page.goto("/admin/alerts");
    const alert = page.getByTestId("alert-item").filter({ hasText: `batch #${batchId}` }).filter({ hasText: "Batch recalled" });
    await expect(alert).toContainText("Patients affected: 1");
    await expect(alert).toContainText("City Care Pharmacy (4)");
    await expect(page.getByTestId("public-reports")).toContainText("Roadside stall, Pune");
    await shot(page, "19-admin-alerts");
    await page.goto("/admin/ai");
    const recalled = page.getByTestId("ai-batches").locator(".card").filter({ hasText: `#${batchId} ` });
    await expect(recalled).toContainText("high risk", { timeout: 30_000 });
    await expect(recalled).toContainText("Recalled by the manufacturer or regulator.");
    await shot(page, "19b-admin-ai");
  });

  await test.step("public journey, network profile and live map", async () => {
    await page.goto(`/batch/${batchId}`);
    for (const t of ["Manufactured by Acme Pharma Ltd", "6 strips serialised", "Received by FastCold Logistics", "Received by City Care Pharmacy", "dispensed by City Care Pharmacy", "Recalled by Acme Pharma Ltd"]) {
      await expect(page.getByText(t).first()).toBeVisible();
    }
    await shot(page, "20-batch-journey");
    await page.goto(`/network/${A.maker.addr}`);
    await expect(page.getByText("Batches made")).toBeVisible();
    await shot(page, "21-org-profile");
    await page.goto("/live");
    await expect(page.getByTestId("route-map")).toBeVisible();
    await shot(page, "22-live-map");
  });

  await test.step("signing out locks the workspace", async () => {
    await signInAs(page, A.pharm);
    await page.getByTestId("sign-out").click();
    await page.goto("/pharmacy");
    await page.waitForURL("**/portal/pharmacy**");
  });
});
