# TrustChain

Medicines tracked from factory to patient: **blockchain custody**, **IoT cold-chain smart boxes**, and **targeted recalls**.
Story: https://trustchain.hemeshkanyal.com

```
 ESP32 smart box ──signed reports──▶ backend (verify, store, relay) ──▶ ColdChainMonitor ──breach──▶ quarantine
                                         │  indexer + alerts                                         │
 Next.js app (all roles + public verify) ◀──────── reads / writes ────────▶ TrustChain (custody, strips, Rx, recalls)
```

| Folder | What |
|---|---|
| [`blockchain/`](blockchain) | Foundry project: `TrustChain` + `ColdChainMonitor` contracts, tests, deploy and demo scripts |
| [`backend/`](backend) | Node service: telemetry ingest + relayer, chain indexer, alerts (incl. who is affected by a recall), device emulator, journey test |
| [`iot/`](iot) | ESP32 firmware (RC522, DHT22, NEO-6M, lid switch); signs reports on-device |
| [`frontend/trustchain-frontend/`](frontend/trustchain-frontend) | Next.js app for admins, manufacturers, distributors, pharmacies, doctors and patients |

## Quick start (local chain)

```bash
# 1. chain + contracts + demo data
anvil
cd blockchain && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
forge script script/SeedDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# 2. backend
cd ../backend && npm install && cp .env.example .env   # set RELAYER_PRIVATE_KEY (any anvil key)
npm start

# 3. frontend
cd ../frontend/trustchain-frontend && npm install && npm run sync && npm run dev
```

Open http://localhost:3000 and use the **Dev account** picker to act as each role.
No hardware? `cd backend && npm run emulator -- --scenario heat` plays a smart box.

## Tests

| | Command |
|---|---|
| Contracts (unit, fuzz, invariant) | `cd blockchain && forge test` |
| Backend | `cd backend && npm test` |
| Chain journey (factory → patient, with a smart box) | `cd backend && node scripts/journey.js 0x<box>` |
| UI journey (headless browser, every role) | `cd frontend/trustchain-frontend && npm run e2e` |

## Deploy to Sepolia

See [`blockchain/README.md`](blockchain/README.md). Then set `DEPLOYMENT=../blockchain/deployments/11155111.json` for the backend and `NEXT_PUBLIC_CHAIN_ID=11155111` + `npm run sync` for the frontend.
