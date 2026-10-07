#!/usr/bin/env bash
# One-shot local demo chain for testing a real ESP32 (or the emulator) without spending testnet gas.
#
#   anvil                    # terminal 1
#   backend/scripts/local-demo.sh 0xDEVICE  # terminal 2: deploy, seed, register device, create a monitored shipment
#   cd backend && npm start                 # terminal 3 (uses backend/.env)
set -euo pipefail
DEVICE=${1:?usage: local-demo.sh <device-address printed by the tracker or emulator>}
RPC=http://127.0.0.1:8545
export PATH="$HOME/.foundry/bin:$PATH"

# anvil's well-known dev keys (never use these anywhere else)
K_OWNER=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
K_MFG=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
DISTRIBUTOR=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

cd "$(dirname "$0")/../../blockchain"
forge script script/Deploy.s.sol --rpc-url $RPC --private-key $K_OWNER --broadcast > /dev/null
forge script script/SeedDemo.s.sol --rpc-url $RPC --broadcast > /dev/null
TC=$(jq -r .trustChain deployments/31337.json)
MON=$(jq -r .coldChainMonitor deployments/31337.json)

cast send "$MON" "registerDevice(address,string)" "$DEVICE" "SmartBox (local demo)" --private-key $K_OWNER --rpc-url $RPC > /dev/null
# Room-temperature product (store 15-30 C, <= 90 %RH) so a real box reads "normal" indoors
# and a warm hand / breath on the DHT22 triggers a breach.
EXPIRY=$(( $(date +%s) + 365 * 24 * 3600 ))
cast send "$TC" "createBatch(string,string,uint32,uint64,bool,(int16,int16,uint16),bytes32)" \
  "Paracetamol 500mg" "TC-IN-2025-0007732" 100 $EXPIRY false "(150,300,900)" 0x$(printf '0%.0s' {1..64}) \
  --private-key $K_MFG --rpc-url $RPC > /dev/null
BATCH=$(cast call "$TC" "batchCount()(uint256)" --rpc-url $RPC)
cast send "$TC" "createShipment(uint256,address,uint32,address)" "$BATCH" $DISTRIBUTOR 50 "$DEVICE" --private-key $K_MFG --rpc-url $RPC > /dev/null
SHIPMENT=$(cast call "$TC" "shipmentCount()(uint256)" --rpc-url $RPC)

rm -f ../backend/data/trustchain.db*   # fresh chain -> fresh index
echo "TrustChain:        $TC"
echo "ColdChainMonitor:  $MON"
echo "Device $DEVICE registered and assigned to shipment #$SHIPMENT"
echo "(batch $BATCH: Paracetamol 500mg, allowed 15.0-30.0 C, humidity <= 90%)"
echo
echo "Now start the backend:  cd backend && npm start"
