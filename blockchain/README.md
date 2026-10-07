# TrustChain contracts

Foundry project for the TrustChain on-chain layer.

| Contract | Purpose |
|---|---|
| `TrustChain` | Participants, batches, serialised strips, two-step custody shipments, recalls/quarantine, prescriptions, dispensing, public verification |
| `ColdChainMonitor` | IoT device registry; accepts EIP-712-signed telemetry summaries and quarantines a batch on a temperature / humidity / tamper breach |

## Model

- **Roles**: `Admin`, `Manufacturer`, `Distributor`, `Pharmacy`, `Doctor`. The deployer is the owner (genesis admin). Only the owner can create admins; admins onboard everyone else, either directly (`registerParticipant`) or by approving a self-service `applyForRole`. Patients need no registration.
- **Custody**: each batch has per-holder balances. Stock moves only via `createShipment` → `receiveShipment` (or `cancelShipment`). Allowed routes: Manufacturer → Distributor → (Distributor)* → Pharmacy, Pharmacy → Distributor (returns), anyone → the batch's manufacturer (reverse logistics).
- **Strips**: the manufacturer generates a random 32-byte secret per strip, prints it in the QR code, and registers `keccak256(secret)`. `verify(codeHash)` is a free view call that needs no wallet. `dispense` reveals the secret and consumes the strip, so a cloned QR later verifies as `AlreadyDispensed`.
- **Recall / quarantine**: `Recalled` (manufacturer or admin, permanent) and `Quarantined` (monitor or admin; only an admin can release) both block onward shipping and dispensing. Affected stock can still be returned to the manufacturer.
- **Prescriptions**: issued by an active doctor for a patient address, with an expiry and a strip allowance. They are required for `rxOnly` batches and enforced in `dispense`.
- **Cold chain**: the shipment sender assigns a registered device. The device signs a `Report` per time window (min/max temp, max humidity, GPS, tamper flag, `dataHash` of the raw readings, monotonic `seq`). Anyone can relay it. Late reports for a window that ended before delivery are still accepted, so an offline tracker cannot hide an excursion.

Units: temperature in tenths of °C (`80` = 8.0°C), humidity in tenths of %RH, coordinates × 1e6.

## Develop

```bash
forge build
forge test            # unit + fuzz + invariant tests
forge coverage --ir-minimum --no-match-coverage "test|script"
```

## Local demo chain

```bash
anvil
# new terminal
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
forge script script/SeedDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

`SeedDemo` onboards anvil accounts 1-6 (manufacturer, distributor, pharmacy, doctor, patient, IoT device), creates a 20-strip batch, ships it to the pharmacy and issues a prescription. The strip secrets go to `deployments/31337-demo-strips.json`.

## Deploy to Sepolia

```bash
cp .env.example .env              # set SEPOLIA_RPC_URL and ETHERSCAN_API_KEY
source .env
cast wallet import deployer --interactive   # paste the deployer private key once; stored encrypted
forge script script/Deploy.s.sol --rpc-url sepolia --account deployer --broadcast --verify
```

Addresses and the deploy block are written to `deployments/11155111.json`. The deployer becomes the owner and genesis admin.
