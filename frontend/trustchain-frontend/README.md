# TrustChain frontend

Next.js 16 app for every participant in the medicine supply chain, plus a public verify page that needs no wallet.

**Public (no wallet):** `/` home with live globe and activity ticker · `/verify` scan or paste a strip QR · `/batch/[id]` journey · `/shipment/[id]` smart-box readings · `/live` cold-chain map · `/network` and `/network/[address]` organisation directory and profiles.

**Portal and sign-in:** `/portal` → choose a role → `/portal/[role]` search your organisation → the wallet must match its registered address → sign one free message (12 h session) → workspace. `/portal/apply` is the 3-step application wizard.

| Workspace | Screens |
|---|---|
| `/admin` | Overview (decisions inbox, globe), Applications (with licence documents), Organisations, Batches (hold / release / recall), Recalls & alerts (affected list, CSV, public reports), Smart boxes, System (pause, relayer gas) |
| `/manufacturer` | Overview (map of where stock is), New batch wizard (6 steps), Batches (distribution bars), Batch detail, Labels (print / CSV), Shipments |
| `/distributor` | Board (arriving / warehouse / on the road), Arriving (trip charts, scan-to-receive), Warehouse, On the road (map) |
| `/pharmacy` | Counter (basket, prescription QR, receipt), Arriving, Shelf, Sales |
| `/doctor` | New prescription (QR card), Prescriptions, Patients |
| `/me` | Patient cabinet with recall warnings, prescriptions with QR, wallet QR |

## Run locally

Needs the local stack: anvil + contracts (`../../blockchain`) and the backend (`../../backend`).

```bash
npm install
npm run sync           # copy ABIs + deployment addresses from ../../blockchain
npm run dev            # http://localhost:3000
```

On the local chain (31337) the sign-in panel offers **Use demo account**, and the patient and apply pages show a **Dev account** picker. These connect as anvil's unlocked accounts without MetaMask (`lib/devConnector.js`). They never appear on other chains.

## Configuration (`.env.local`)

| Variable | Default | |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `31337` | `11155111` for Sepolia |
| `NEXT_PUBLIC_RPC_URL` | chain default | e.g. an Alchemy/Infura Sepolia URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | the TrustChain backend |
| `NEXT_PUBLIC_WC_PROJECT_ID` | demo id | WalletConnect Cloud project id |

## Tests

```bash
npm run build && npx next start -p 3100 &
E2E_BOX=0x<optional real smart box> npm run e2e
```

`e2e/journey.spec.js` resets the local chain, then drives the whole journey through the UI with portal sign-in for every role: apply → approve → wrong wallet refused → batch wizard → ship in a smart box → scan-to-receive (fake strip rejected) → ship → receive → prescription with QR → verify genuine / counterfeit + public report → counter blocks prescription-only, then dispenses with the prescription → copied QR shows "already sold" → patient cabinet → recall (type the lot to confirm) → counter blocks the sale → patient warned → regulator sees exactly 1 affected patient → public journey, profile, live map → sign-out locks the workspace.

## Strip codes

Each strip's QR holds `TC1:<32-byte secret>`, generated in the manufacturer's browser. Only `keccak256(secret)` goes on-chain, and the secret is revealed only when a pharmacy dispenses the strip. Secrets are kept in that browser's local storage for printing labels (`/manufacturer/labels/[id]`, with CSV export). Export them before clearing browser data.
