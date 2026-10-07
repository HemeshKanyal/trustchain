#!/usr/bin/env bash
# Fresh local stack for UI tests: anvil (state on disk), contracts + demo data, smart boxes, backend.
#   e2e/reset-chain.sh [0xREAL_BOX_ADDRESS]
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STATE=${TMPDIR:-/tmp}/trustchain-anvil-state.json
K0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EMULATOR=0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

pkill -f "^anvil" || true
pkill -f "^node src/server.js" || true
sleep 1
rm -f "$STATE"
# START_DAYS_AGO=N starts the chain N days in the past (for seeding realistic history with time warps).
TS_ARGS=()
if [ -n "${START_DAYS_AGO:-}" ]; then TS_ARGS=(--timestamp $(( $(date +%s) - START_DAYS_AGO * 86400 ))); fi
setsid nohup anvil --silent --state "$STATE" --state-interval 10 "${TS_ARGS[@]}" > /dev/null 2>&1 < /dev/null &
sleep 2

cd "$ROOT/blockchain"
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key $K0 --broadcast > /dev/null 2>&1
forge script script/SeedDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast > /dev/null 2>&1
MON=$(jq -r .coldChainMonitor deployments/31337.json)
if [ -n "${1:-}" ]; then
  cast send "$MON" "registerDevice(address,string)" "$1" "SmartBox-001 (ESP32)" --private-key $K0 > /dev/null
fi
cast send "$MON" "registerDevice(address,string)" $EMULATOR "Emulator box" --private-key $K0 > /dev/null

cd "$ROOT/backend"
rm -f data/trustchain.db*
setsid nohup node src/server.js > ${TMPDIR:-/tmp}/trustchain-backend.log 2>&1 < /dev/null &
for _ in $(seq 1 20); do curl -sf localhost:4000/api/health > /dev/null && break; sleep 0.5; done
echo "local stack ready"
