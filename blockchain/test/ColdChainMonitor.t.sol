// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {TrustChain} from "../src/TrustChain.sol";
import {ColdChainMonitor} from "../src/ColdChainMonitor.sol";

contract ColdChainMonitorTest is BaseTest {
    uint256 internal batchId;
    uint256 internal shipmentId;

    function setUp() public override {
        super.setUp();
        batchId = _createBatch(100, false);
        shipmentId = _ship(manufacturer, distributor, batchId, 50, device);
    }

    // ------------------------------------------------------------------ helpers

    function _report(uint64 seq, int16 minT, int16 maxT, uint16 maxH, bool tamper)
        internal
        view
        returns (ColdChainMonitor.Report memory r)
    {
        r = ColdChainMonitor.Report({
            shipmentId: shipmentId,
            windowStart: uint64(block.timestamp) - 300,
            windowEnd: uint64(block.timestamp),
            readings: 30,
            minTempX10: minT,
            maxTempX10: maxT,
            maxHumidityX10: maxH,
            latE6: 28_613_900,
            lonE6: 77_209_000,
            tamper: tamper,
            dataHash: keccak256(abi.encode("raw readings", seq)),
            seq: seq
        });
    }

    function _sign(uint256 key, ColdChainMonitor.Report memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, monitor.reportDigest(r));
        return abi.encodePacked(rr, s, v);
    }

    function _okReport(uint64 seq) internal view returns (ColdChainMonitor.Report memory) {
        return _report(seq, 40, 60, 450, false); // 4.0-6.0°C, 45%RH
    }

    // ------------------------------------------------------------------ tests

    function test_DigestMatchesIndependentEip712Encoding() public view {
        ColdChainMonitor.Report memory r = _okReport(1);
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("TrustChainColdChain"),
                keccak256("1"),
                block.chainid,
                address(monitor)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                monitor.REPORT_TYPEHASH(),
                r.shipmentId,
                r.windowStart,
                r.windowEnd,
                r.readings,
                r.minTempX10,
                r.maxTempX10,
                r.maxHumidityX10,
                r.latE6,
                r.lonE6,
                r.tamper,
                r.dataHash,
                r.seq
            )
        );
        bytes32 expected = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        assertEq(monitor.reportDigest(r), expected);
    }

    function test_ValidReportRecorded() public {
        ColdChainMonitor.Report memory r = _okReport(1);
        uint8 flags = monitor.submitReport(r, _sign(deviceKey, r));
        assertEq(flags, 0);

        ColdChainMonitor.ShipmentTelemetry memory t = monitor.getTelemetry(shipmentId);
        assertEq(t.reportCount, 1);
        assertEq(t.breachCount, 0);
        assertEq(t.lastSeq, 1);
        assertEq(t.minTempSeenX10, 40);
        assertEq(t.maxTempSeenX10, 60);
        assertEq(t.lastLatE6, 28_613_900);
        assertEq(uint8(tc.getBatch(batchId).status), uint8(TrustChain.BatchStatus.Active));
    }

    function test_AnyoneCanRelay() public {
        ColdChainMonitor.Report memory r = _okReport(1);
        bytes memory sig = _sign(deviceKey, r);
        vm.prank(stranger);
        monitor.submitReport(r, sig);
        assertEq(monitor.getTelemetry(shipmentId).reportCount, 1);
    }

    function test_TempHighQuarantinesBatch() public {
        ColdChainMonitor.Report memory r = _report(1, 40, 412, 450, false); // 41.2°C
        vm.expectEmit(true, true, false, true, address(monitor));
        emit ColdChainMonitor.BreachDetected(shipmentId, batchId, 2, 1);
        uint8 flags = monitor.submitReport(r, _sign(deviceKey, r));

        assertEq(flags, tc.REASON_TEMP_HIGH());
        assertEq(uint8(tc.getBatch(batchId).status), uint8(TrustChain.BatchStatus.Quarantined));
        assertEq(monitor.getTelemetry(shipmentId).breachCount, 1);
    }

    function test_AllBreachFlagsCombine() public {
        ColdChainMonitor.Report memory r = _report(1, -5, 90, 800, true);
        uint8 flags = monitor.submitReport(r, _sign(deviceKey, r));
        assertEq(flags, 1 | 2 | 4 | 8);
        assertTrue(monitor.getTelemetry(shipmentId).tamperDetected);
    }

    function test_BreachBlocksDispensingDownstream() public {
        bytes32[] memory secrets = _registerStrips(batchId, 50);
        ColdChainMonitor.Report memory r = _report(1, 40, 300, 450, false);
        monitor.submitReport(r, _sign(deviceKey, r));

        _receive(distributor, shipmentId);
        vm.prank(distributor);
        vm.expectRevert(
            abi.encodeWithSelector(TrustChain.BatchNotActive.selector, batchId, TrustChain.BatchStatus.Quarantined)
        );
        tc.createShipment(batchId, pharmacy, 10, address(0));
        assertEq(uint8(tc.verify(_codeHash(secrets[0])).verdict), uint8(TrustChain.Verdict.Quarantined));
    }

    function test_RevertWhen_SignedByOtherKey() public {
        ColdChainMonitor.Report memory r = _okReport(1);
        address imposter = vm.addr(0xBAD);
        bytes memory sig = _sign(0xBAD, r);
        vm.expectRevert(abi.encodeWithSelector(ColdChainMonitor.WrongDevice.selector, device, imposter));
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_ReportTamperedAfterSigning() public {
        ColdChainMonitor.Report memory r = _report(1, 40, 412, 450, false);
        bytes memory sig = _sign(deviceKey, r);
        r.maxTempX10 = 60; // relayer tries to hide the excursion
        vm.expectRevert(); // recovers a different signer
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_Replayed() public {
        ColdChainMonitor.Report memory r = _okReport(1);
        bytes memory sig = _sign(deviceKey, r);
        monitor.submitReport(r, sig);
        vm.expectRevert(abi.encodeWithSelector(ColdChainMonitor.StaleSequence.selector, 1, 1));
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_DeviceDeactivated() public {
        vm.prank(admin);
        monitor.setDeviceActive(device, false);
        ColdChainMonitor.Report memory r = _okReport(1);
        bytes memory sig = _sign(deviceKey, r);
        vm.expectRevert(abi.encodeWithSelector(ColdChainMonitor.UnknownDevice.selector, device));
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_ShipmentHasNoDevice() public {
        uint256 plain = _ship(manufacturer, distributor, batchId, 10, address(0));
        ColdChainMonitor.Report memory r = _okReport(1);
        r.shipmentId = plain;
        bytes memory sig = _sign(deviceKey, r);
        vm.expectRevert(abi.encodeWithSelector(ColdChainMonitor.ShipmentNotMonitorable.selector, plain));
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_WindowInFuture() public {
        ColdChainMonitor.Report memory r = _okReport(1);
        r.windowEnd = uint64(block.timestamp) + 1 hours;
        bytes memory sig = _sign(deviceKey, r);
        vm.expectRevert(ColdChainMonitor.InvalidWindow.selector);
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_WindowBeforeShipment() public {
        vm.warp(block.timestamp + 1 hours);
        ColdChainMonitor.Report memory r = _okReport(1);
        r.windowStart = uint64(block.timestamp) - 3 hours;
        r.windowEnd = uint64(block.timestamp) - 2 hours;
        bytes memory sig = _sign(deviceKey, r);
        vm.expectRevert(ColdChainMonitor.InvalidWindow.selector);
        monitor.submitReport(r, sig);
    }

    function test_LateReportAfterDeliveryStillQuarantines() public {
        vm.warp(block.timestamp + 2 hours);
        ColdChainMonitor.Report memory r = _report(1, 40, 350, 450, false); // window during transit
        _receive(distributor, shipmentId);
        vm.warp(block.timestamp + 1 hours); // device was offline, uploads later
        monitor.submitReport(r, _sign(deviceKey, r));
        assertEq(uint8(tc.getBatch(batchId).status), uint8(TrustChain.BatchStatus.Quarantined));
    }

    function test_RevertWhen_ReportWindowAfterDelivery() public {
        _receive(distributor, shipmentId);
        vm.warp(block.timestamp + 1 hours);
        ColdChainMonitor.Report memory r = _okReport(1);
        bytes memory sig = _sign(deviceKey, r);
        vm.expectRevert(abi.encodeWithSelector(ColdChainMonitor.ShipmentNotMonitorable.selector, shipmentId));
        monitor.submitReport(r, sig);
    }

    function test_RevertWhen_CancelledShipment() public {
        vm.prank(manufacturer);
        tc.cancelShipment(shipmentId);
        ColdChainMonitor.Report memory r = _okReport(1);
        bytes memory sig = _sign(deviceKey, r);
        vm.expectRevert(abi.encodeWithSelector(ColdChainMonitor.ShipmentNotMonitorable.selector, shipmentId));
        monitor.submitReport(r, sig);
    }

    function test_RunningExtremesAcrossReports() public {
        ColdChainMonitor.Report memory r1 = _report(1, 40, 60, 450, false);
        monitor.submitReport(r1, _sign(deviceKey, r1));
        vm.warp(block.timestamp + 300);
        ColdChainMonitor.Report memory r2 = _report(2, 30, 70, 500, false);
        monitor.submitReport(r2, _sign(deviceKey, r2));

        ColdChainMonitor.ShipmentTelemetry memory t = monitor.getTelemetry(shipmentId);
        assertEq(t.reportCount, 2);
        assertEq(t.minTempSeenX10, 30);
        assertEq(t.maxTempSeenX10, 70);
        assertEq(t.maxHumiditySeenX10, 500);
    }

    function test_RevertWhen_StrangerRegistersDevice() public {
        vm.prank(stranger);
        vm.expectRevert(ColdChainMonitor.NotAdmin.selector);
        monitor.registerDevice(stranger, "rogue");
    }

    function test_DeviceRegistry() public view {
        assertTrue(monitor.isActiveDevice(device));
        assertEq(monitor.getDevices().length, 1);
        assertEq(monitor.getDevice(device).label, "Box-001");
    }

    function testFuzz_BreachDetectionMatchesThresholds(int16 minT, int16 maxT, uint16 maxH) public {
        vm.assume(minT <= maxT);
        ColdChainMonitor.Report memory r = _report(1, minT, maxT, maxH, false);
        uint8 flags = monitor.submitReport(r, _sign(deviceKey, r));

        bool expectBreach = minT < 20 || maxT > 80 || maxH > 600;
        assertEq(flags != 0, expectBreach);
        assertEq(tc.getBatch(batchId).status == TrustChain.BatchStatus.Quarantined, expectBreach);
    }
}
