// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TrustChain} from "../src/TrustChain.sol";
import {ColdChainMonitor} from "../src/ColdChainMonitor.sol";
import {ITrustChain} from "../src/interfaces/ITrustChain.sol";

abstract contract BaseTest is Test {
    TrustChain internal tc;
    ColdChainMonitor internal monitor;

    address internal owner = makeAddr("owner");
    address internal admin = makeAddr("admin");
    address internal manufacturer = makeAddr("manufacturer");
    address internal manufacturer2 = makeAddr("manufacturer2");
    address internal distributor = makeAddr("distributor");
    address internal distributor2 = makeAddr("distributor2");
    address internal pharmacy = makeAddr("pharmacy");
    address internal doctor = makeAddr("doctor");
    address internal patient = makeAddr("patient");
    address internal stranger = makeAddr("stranger");

    uint256 internal deviceKey = 0xDE71CE;
    address internal device;

    uint64 internal constant ONE_YEAR = 365 days;

    function setUp() public virtual {
        vm.warp(1_750_000_000);
        device = vm.addr(deviceKey);

        tc = new TrustChain(owner);
        monitor = new ColdChainMonitor(ITrustChain(address(tc)));

        vm.startPrank(owner);
        tc.setMonitor(address(monitor));
        tc.registerParticipant(admin, TrustChain.Role.Admin, "Drug Regulator", "Delhi", "CDSCO");
        vm.stopPrank();

        vm.startPrank(admin);
        tc.registerParticipant(manufacturer, TrustChain.Role.Manufacturer, "Acme Pharma", "Baddi", "MFG-001");
        tc.registerParticipant(manufacturer2, TrustChain.Role.Manufacturer, "Other Pharma", "Pune", "MFG-002");
        tc.registerParticipant(distributor, TrustChain.Role.Distributor, "FastLogistics", "Delhi", "DST-001");
        tc.registerParticipant(distributor2, TrustChain.Role.Distributor, "Regional Dist", "Bhopal", "DST-002");
        tc.registerParticipant(pharmacy, TrustChain.Role.Pharmacy, "City Pharmacy", "Mumbai", "PH-001");
        tc.registerParticipant(doctor, TrustChain.Role.Doctor, "Dr. Rao", "Mumbai", "MCI-12345");
        monitor.registerDevice(device, "Box-001");
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ helpers

    function _cond() internal pure returns (ITrustChain.StorageConditions memory) {
        // 2.0°C .. 8.0°C, max 60.0 %RH
        return ITrustChain.StorageConditions({minTempX10: 20, maxTempX10: 80, maxHumidityX10: 600});
    }

    function _secret(uint256 batchSalt, uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encode("strip", batchSalt, i));
    }

    function _codeHash(bytes32 secret) internal pure returns (bytes32) {
        return keccak256(abi.encode(secret));
    }

    function _createBatch(uint32 qty, bool rxOnly) internal returns (uint256 batchId) {
        vm.prank(manufacturer);
        batchId = tc.createBatch(
            "Insulin Glargine",
            "TC-IN-2025-0007731",
            qty,
            uint64(block.timestamp) + ONE_YEAR,
            rxOnly,
            _cond(),
            bytes32("meta")
        );
    }

    function _registerStrips(uint256 batchId, uint256 count) internal returns (bytes32[] memory secrets) {
        secrets = new bytes32[](count);
        bytes32[] memory hashes = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            secrets[i] = _secret(batchId, i);
            hashes[i] = _codeHash(secrets[i]);
        }
        vm.prank(manufacturer);
        tc.registerStrips(batchId, hashes);
    }

    function _ship(address from, address to, uint256 batchId, uint32 qty, address dev) internal returns (uint256 id) {
        vm.prank(from);
        id = tc.createShipment(batchId, to, qty, dev);
    }

    function _receive(address to, uint256 shipmentId) internal {
        vm.prank(to);
        tc.receiveShipment(shipmentId);
    }

    /// Batch of `qty` strips moved Manufacturer → Distributor → Pharmacy.
    function _stockPharmacy(uint32 qty, bool rxOnly) internal returns (uint256 batchId, bytes32[] memory secrets) {
        batchId = _createBatch(qty, rxOnly);
        secrets = _registerStrips(batchId, qty);
        _receive(distributor, _ship(manufacturer, distributor, batchId, qty, address(0)));
        _receive(pharmacy, _ship(distributor, pharmacy, batchId, qty, address(0)));
    }

    function _one(bytes32 x) internal pure returns (bytes32[] memory arr) {
        arr = new bytes32[](1);
        arr[0] = x;
    }
}
