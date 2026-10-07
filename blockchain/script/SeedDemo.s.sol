// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TrustChain} from "../src/TrustChain.sol";
import {ColdChainMonitor} from "../src/ColdChainMonitor.sol";
import {ITrustChain} from "../src/interfaces/ITrustChain.sol";

/// Populates a LOCAL anvil deployment with a full demo flow. Uses anvil's well-known dev keys,
/// so it refuses to run on any other chain.
///
///   anvil
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key $ANVIL_KEY0 --broadcast
///   forge script script/SeedDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
/// Anvil accounts: 0 owner/admin, 1 manufacturer, 2 distributor, 3 pharmacy, 4 doctor, 5 patient, 6 IoT device.
contract SeedDemo is Script {
    string internal constant MNEMONIC = "test test test test test test test test test test test junk";
    uint32 internal constant STRIPS = 20;

    function run() external {
        require(block.chainid == 31337, "SeedDemo: local anvil only");

        string memory dep = vm.readFile("deployments/31337.json");
        TrustChain tc = TrustChain(vm.parseJsonAddress(dep, ".trustChain"));
        ColdChainMonitor monitor = ColdChainMonitor(vm.parseJsonAddress(dep, ".coldChainMonitor"));

        uint256 kOwner = vm.deriveKey(MNEMONIC, 0);
        uint256 kMfg = vm.deriveKey(MNEMONIC, 1);
        uint256 kDist = vm.deriveKey(MNEMONIC, 2);
        uint256 kPharm = vm.deriveKey(MNEMONIC, 3);
        uint256 kDoc = vm.deriveKey(MNEMONIC, 4);
        address patient = vm.addr(vm.deriveKey(MNEMONIC, 5));
        address device = vm.addr(vm.deriveKey(MNEMONIC, 6));

        address mfg = vm.addr(kMfg);
        address dist = vm.addr(kDist);
        address pharm = vm.addr(kPharm);

        // Admin: onboard participants and the IoT tracker.
        vm.startBroadcast(kOwner);
        tc.registerParticipant(mfg, TrustChain.Role.Manufacturer, "Acme Pharma Ltd", "Baddi, HP", "MFG-HP-0042");
        tc.registerParticipant(dist, TrustChain.Role.Distributor, "FastCold Logistics", "Delhi", "DST-DL-0107");
        tc.registerParticipant(pharm, TrustChain.Role.Pharmacy, "City Care Pharmacy", "Mumbai", "PH-MH-2231");
        tc.registerParticipant(vm.addr(kDoc), TrustChain.Role.Doctor, "Dr. Ananya Rao", "Mumbai", "MCI-58213");
        monitor.registerDevice(device, "SmartBox-001 (ESP32)");
        vm.stopBroadcast();

        // Manufacturer: batch + serialised strips.
        bytes32[] memory secrets = new bytes32[](STRIPS);
        bytes32[] memory hashes = new bytes32[](STRIPS);
        for (uint256 i; i < STRIPS; ++i) {
            secrets[i] = keccak256(abi.encode("trustchain-demo-strip", i));
            hashes[i] = keccak256(abi.encode(secrets[i]));
        }
        vm.startBroadcast(kMfg);
        uint256 batchId = tc.createBatch(
            "Insulin Glargine 100IU/ml",
            "TC-IN-2025-0007731",
            STRIPS,
            uint64(block.timestamp + 365 days),
            true,
            ITrustChain.StorageConditions({minTempX10: 20, maxTempX10: 80, maxHumidityX10: 700}),
            keccak256("demo-batch-metadata")
        );
        tc.registerStrips(batchId, hashes);
        uint256 s1 = tc.createShipment(batchId, dist, STRIPS, device);
        vm.stopBroadcast();

        vm.startBroadcast(kDist);
        tc.receiveShipment(s1);
        uint256 s2 = tc.createShipment(batchId, pharm, 10, device);
        vm.stopBroadcast();

        vm.broadcast(kPharm);
        tc.receiveShipment(s2);

        vm.broadcast(kDoc);
        uint256 rx = tc.issuePrescription(
            patient, keccak256("Insulin Glargine 10u OD x 30d"), uint64(block.timestamp + 30 days), 3
        );

        console.log("Batch:", batchId);
        console.log("Shipments:", s1, s2);
        console.log("Prescription:", rx);

        string memory obj = "strips";
        vm.serializeUint(obj, "batchId", batchId);
        string memory json = vm.serializeBytes32(obj, "secrets", secrets);
        vm.writeJson(json, "deployments/31337-demo-strips.json");
    }
}
