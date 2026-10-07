// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {TrustChain} from "../src/TrustChain.sol";
import {ITrustChain} from "../src/interfaces/ITrustChain.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ParticipantsTest is BaseTest {
    function test_OwnerIsGenesisAdmin() public view {
        assertTrue(tc.isAdmin(owner));
        TrustChain.Participant memory p = tc.getParticipant(owner);
        assertEq(uint8(p.role), uint8(TrustChain.Role.Admin));
        assertTrue(p.active);
    }

    function test_AdminCanRegisterNonAdminRoles() public view {
        TrustChain.Participant memory p = tc.getParticipant(pharmacy);
        assertEq(uint8(p.role), uint8(TrustChain.Role.Pharmacy));
        assertEq(p.name, "City Pharmacy");
        assertTrue(p.active);
    }

    function test_RevertWhen_StrangerRegisters() public {
        vm.prank(stranger);
        vm.expectRevert(TrustChain.NotAdmin.selector);
        tc.registerParticipant(stranger, TrustChain.Role.Manufacturer, "Fake", "", "");
    }

    function test_RevertWhen_AdminCreatesAdmin() public {
        vm.prank(admin);
        vm.expectRevert(TrustChain.NotOwnerForAdminRole.selector);
        tc.registerParticipant(stranger, TrustChain.Role.Admin, "Rogue", "", "");
    }

    function test_RevertWhen_RegisteringTwice() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.AlreadyRegistered.selector, pharmacy));
        tc.registerParticipant(pharmacy, TrustChain.Role.Manufacturer, "Switch", "", "");
    }

    function test_ApplyAndApprove() public {
        vm.prank(stranger);
        tc.applyForRole(TrustChain.Role.Doctor, "Dr. New", "Pune", "MCI-999");
        assertEq(uint8(tc.getApplication(stranger).role), uint8(TrustChain.Role.Doctor));
        // Applying does NOT grant the role.
        assertEq(uint8(tc.getParticipant(stranger).role), uint8(TrustChain.Role.None));

        vm.prank(admin);
        tc.approveApplication(stranger);
        TrustChain.Participant memory p = tc.getParticipant(stranger);
        assertEq(uint8(p.role), uint8(TrustChain.Role.Doctor));
        assertEq(p.licenseId, "MCI-999");
        assertEq(uint8(tc.getApplication(stranger).role), uint8(TrustChain.Role.None));
    }

    function test_RejectApplication() public {
        vm.prank(stranger);
        tc.applyForRole(TrustChain.Role.Pharmacy, "Shady Chemist", "", "");
        vm.prank(admin);
        tc.rejectApplication(stranger);
        assertEq(uint8(tc.getApplication(stranger).role), uint8(TrustChain.Role.None));
        assertEq(uint8(tc.getParticipant(stranger).role), uint8(TrustChain.Role.None));
    }

    function test_RevertWhen_ApplyingForAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(TrustChain.InvalidRole.selector);
        tc.applyForRole(TrustChain.Role.Admin, "Me", "", "");
    }

    function test_RevertWhen_RegisteredParticipantApplies() public {
        // Old bug: applyAsDoctor let anyone overwrite their own role.
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.AlreadyRegistered.selector, manufacturer));
        tc.applyForRole(TrustChain.Role.Doctor, "Dr. Acme", "", "");
    }

    function test_SuspendedParticipantCannotAct() public {
        vm.prank(admin);
        tc.setParticipantActive(manufacturer, false);
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.InactiveParticipant.selector, manufacturer));
        tc.createBatch("X", "L", 1, uint64(block.timestamp) + 1 days, false, _cond(), 0);
    }

    function test_RevertWhen_AdminSuspendsAdmin() public {
        vm.prank(owner);
        tc.registerParticipant(stranger, TrustChain.Role.Admin, "Admin 2", "", "");
        vm.prank(admin);
        vm.expectRevert(TrustChain.NotOwnerForAdminRole.selector);
        tc.setParticipantActive(stranger, false);
    }

    function test_RevertWhen_SuspendingOwner() public {
        vm.prank(owner);
        vm.expectRevert(TrustChain.InvalidInput.selector);
        tc.setParticipantActive(owner, false);
    }

    function test_SuspendedAdminLosesAdmin() public {
        vm.prank(owner);
        tc.setParticipantActive(admin, false);
        assertFalse(tc.isAdmin(admin));
    }

    function test_UpdateProfile() public {
        vm.prank(pharmacy);
        tc.updateProfile("City Pharmacy 24x7", "Mumbai West");
        assertEq(tc.getParticipant(pharmacy).name, "City Pharmacy 24x7");
    }

    function test_OwnershipTransferIsTwoStep() public {
        vm.prank(owner);
        tc.transferOwnership(admin);
        assertEq(tc.owner(), owner);
        vm.prank(admin);
        tc.acceptOwnership();
        assertEq(tc.owner(), admin);
    }

    function test_RevertWhen_NonOwnerSetsMonitor() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, admin));
        tc.setMonitor(stranger);
    }
}

contract BatchTest is BaseTest {
    function test_CreateBatch() public {
        uint256 id = _createBatch(100, true);
        assertEq(id, 1);
        TrustChain.Batch memory b = tc.getBatch(id);
        assertEq(b.manufacturer, manufacturer);
        assertEq(b.quantity, 100);
        assertTrue(b.rxOnly);
        assertEq(b.conditions.maxTempX10, 80);
        assertEq(tc.balanceOf(id, manufacturer), 100);
        assertEq(tc.getBatchesByManufacturer(manufacturer).length, 1);
    }

    function test_RevertWhen_NonManufacturerCreatesBatch() public {
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.WrongRole.selector, TrustChain.Role.Manufacturer));
        tc.createBatch("X", "L", 1, uint64(block.timestamp) + 1 days, false, _cond(), 0);
    }

    function test_RevertWhen_BadBatchInput() public {
        vm.startPrank(manufacturer);
        vm.expectRevert(TrustChain.InvalidInput.selector);
        tc.createBatch("X", "L", 0, uint64(block.timestamp) + 1 days, false, _cond(), 0);
        vm.expectRevert(TrustChain.InvalidInput.selector);
        tc.createBatch("X", "L", 1, uint64(block.timestamp), false, _cond(), 0);
        vm.expectRevert(TrustChain.InvalidInput.selector);
        tc.createBatch(
            "X", "L", 1, uint64(block.timestamp) + 1 days, false, ITrustChain.StorageConditions(80, 20, 0), 0
        );
        vm.stopPrank();
    }

    function test_RegisterStrips() public {
        uint256 id = _createBatch(3, false);
        bytes32[] memory secrets = _registerStrips(id, 3);
        assertEq(tc.getBatch(id).stripsRegistered, 3);
        TrustChain.Strip memory s = tc.getStrip(_codeHash(secrets[0]));
        assertEq(s.batchId, id);
        assertEq(uint8(s.status), uint8(TrustChain.StripStatus.Registered));
    }

    function test_RevertWhen_MoreStripsThanQuantity() public {
        uint256 id = _createBatch(2, false);
        bytes32[] memory hashes = new bytes32[](3);
        for (uint256 i; i < 3; ++i) {
            hashes[i] = keccak256(abi.encode(i));
        }
        vm.prank(manufacturer);
        vm.expectRevert(TrustChain.TooManyStrips.selector);
        tc.registerStrips(id, hashes);
    }

    function test_RevertWhen_DuplicateStrip() public {
        uint256 id = _createBatch(5, false);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256("a");
        hashes[1] = keccak256("a");
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.StripAlreadyRegistered.selector, hashes[0]));
        tc.registerStrips(id, hashes);
    }

    function test_RevertWhen_OtherManufacturerRegistersStrips() public {
        uint256 id = _createBatch(5, false);
        vm.prank(manufacturer2);
        vm.expectRevert(TrustChain.NotBatchManufacturer.selector);
        tc.registerStrips(id, _one(keccak256("x")));
    }

    function test_RecallByManufacturer() public {
        uint256 id = _createBatch(5, false);
        vm.prank(manufacturer);
        tc.recallBatch(id, "Contamination");
        assertEq(uint8(tc.getBatch(id).status), uint8(TrustChain.BatchStatus.Recalled));
    }

    function test_RecallByAdmin() public {
        uint256 id = _createBatch(5, false);
        vm.prank(admin);
        tc.recallBatch(id, "Regulator order");
        assertEq(uint8(tc.getBatch(id).status), uint8(TrustChain.BatchStatus.Recalled));
    }

    function test_RevertWhen_OtherManufacturerRecalls() public {
        uint256 id = _createBatch(5, false);
        vm.prank(manufacturer2);
        vm.expectRevert(TrustChain.NotBatchManufacturer.selector);
        tc.recallBatch(id, "sabotage");
    }

    function test_RevertWhen_RecallTwice() public {
        uint256 id = _createBatch(5, false);
        vm.startPrank(manufacturer);
        tc.recallBatch(id, "a");
        vm.expectRevert(abi.encodeWithSelector(TrustChain.AlreadyRecalled.selector, id));
        tc.recallBatch(id, "b");
        vm.stopPrank();
    }

    function test_QuarantineOnlyByMonitorOrAdmin() public {
        uint256 id = _createBatch(5, false);
        vm.prank(manufacturer);
        vm.expectRevert(TrustChain.NotMonitor.selector);
        tc.quarantineBatch(id, 0, 16);

        vm.prank(admin);
        tc.quarantineBatch(id, 0, 16);
        assertEq(uint8(tc.getBatch(id).status), uint8(TrustChain.BatchStatus.Quarantined));
    }

    function test_OnlyAdminReleasesQuarantine() public {
        uint256 id = _createBatch(5, false);
        vm.prank(admin);
        tc.quarantineBatch(id, 0, 16);

        vm.prank(manufacturer);
        vm.expectRevert(TrustChain.NotAdmin.selector);
        tc.releaseQuarantine(id, "trust me");

        vm.prank(admin);
        tc.releaseQuarantine(id, "Lab tested OK");
        assertEq(uint8(tc.getBatch(id).status), uint8(TrustChain.BatchStatus.Active));
    }

    function test_QuarantineDoesNotUnrecall() public {
        uint256 id = _createBatch(5, false);
        vm.prank(manufacturer);
        tc.recallBatch(id, "x");
        vm.prank(admin);
        tc.quarantineBatch(id, 0, 16);
        assertEq(uint8(tc.getBatch(id).status), uint8(TrustChain.BatchStatus.Recalled));
    }
}

contract ShipmentTest is BaseTest {
    uint256 internal batchId;

    function setUp() public override {
        super.setUp();
        batchId = _createBatch(100, false);
    }

    function test_TwoStepHandover() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 40, address(0));
        assertEq(tc.balanceOf(batchId, manufacturer), 60);
        assertEq(tc.balanceOf(batchId, distributor), 0); // not yet received

        _receive(distributor, sid);
        assertEq(tc.balanceOf(batchId, distributor), 40);
        TrustChain.Shipment memory s = tc.getShipment(sid);
        assertEq(uint8(s.status), uint8(ITrustChain.ShipmentStatus.Delivered));
        assertEq(s.deliveredAt, block.timestamp);
        assertEq(tc.getShipmentsOf(distributor).length, 1);
    }

    function test_RevertWhen_WrongRecipientReceives() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 40, address(0));
        vm.prank(distributor2);
        vm.expectRevert(TrustChain.NotShipmentParty.selector);
        tc.receiveShipment(sid);
    }

    function test_RevertWhen_ReceiveTwice() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 40, address(0));
        _receive(distributor, sid);
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.ShipmentNotInTransit.selector, sid));
        tc.receiveShipment(sid);
    }

    function test_CancelBySenderRestoresBalance() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 40, address(0));
        vm.prank(manufacturer);
        tc.cancelShipment(sid);
        assertEq(tc.balanceOf(batchId, manufacturer), 100);
    }

    function test_RejectByRecipientRestoresBalance() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 40, address(0));
        vm.prank(distributor);
        tc.cancelShipment(sid);
        assertEq(tc.balanceOf(batchId, manufacturer), 100);
        assertEq(tc.balanceOf(batchId, distributor), 0);
    }

    function test_RevertWhen_StrangerCancels() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 40, address(0));
        vm.prank(stranger);
        vm.expectRevert(TrustChain.NotShipmentParty.selector);
        tc.cancelShipment(sid);
    }

    function test_RevertWhen_InsufficientBalance() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.InsufficientBalance.selector, batchId, 100, 101));
        tc.createShipment(batchId, distributor, 101, address(0));
    }

    function test_RevertWhen_DistributorTakesWithoutHandover() public {
        // Old bug: receiveFromManufacturer let any distributor grab any batch.
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.InsufficientBalance.selector, batchId, 0, 10));
        tc.createShipment(batchId, pharmacy, 10, address(0));
    }

    function test_RevertWhen_ManufacturerShipsToPharmacy() public {
        vm.prank(manufacturer);
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustChain.InvalidRoute.selector, TrustChain.Role.Manufacturer, TrustChain.Role.Pharmacy
            )
        );
        tc.createShipment(batchId, pharmacy, 10, address(0));
    }

    function test_RevertWhen_ShipToUnregistered() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.InactiveParticipant.selector, stranger));
        tc.createShipment(batchId, stranger, 10, address(0));
    }

    function test_RevertWhen_ShipToDoctor() public {
        _receive(distributor, _ship(manufacturer, distributor, batchId, 10, address(0)));
        vm.prank(distributor);
        vm.expectRevert(
            abi.encodeWithSelector(
                TrustChain.InvalidRoute.selector, TrustChain.Role.Distributor, TrustChain.Role.Doctor
            )
        );
        tc.createShipment(batchId, doctor, 10, address(0));
    }

    function test_DistributorToDistributorToPharmacy() public {
        _receive(distributor, _ship(manufacturer, distributor, batchId, 50, address(0)));
        _receive(distributor2, _ship(distributor, distributor2, batchId, 30, address(0)));
        _receive(pharmacy, _ship(distributor2, pharmacy, batchId, 20, address(0)));
        assertEq(tc.balanceOf(batchId, manufacturer), 50);
        assertEq(tc.balanceOf(batchId, distributor), 20);
        assertEq(tc.balanceOf(batchId, distributor2), 10);
        assertEq(tc.balanceOf(batchId, pharmacy), 20);
    }

    function test_PharmacyReturnsToDistributor() public {
        _receive(distributor, _ship(manufacturer, distributor, batchId, 50, address(0)));
        _receive(pharmacy, _ship(distributor, pharmacy, batchId, 20, address(0)));
        _receive(distributor, _ship(pharmacy, distributor, batchId, 5, address(0)));
        assertEq(tc.balanceOf(batchId, pharmacy), 15);
        assertEq(tc.balanceOf(batchId, distributor), 35);
    }

    function test_RecalledStockCanOnlyReturnToManufacturer() public {
        _receive(distributor, _ship(manufacturer, distributor, batchId, 50, address(0)));
        _receive(pharmacy, _ship(distributor, pharmacy, batchId, 20, address(0)));
        vm.prank(manufacturer);
        tc.recallBatch(batchId, "bad");

        vm.prank(pharmacy);
        vm.expectRevert(
            abi.encodeWithSelector(TrustChain.BatchNotActive.selector, batchId, TrustChain.BatchStatus.Recalled)
        );
        tc.createShipment(batchId, distributor, 20, address(0));

        // Reverse logistics straight to the manufacturer is allowed.
        _receive(manufacturer, _ship(pharmacy, manufacturer, batchId, 20, address(0)));
        _receive(manufacturer, _ship(distributor, manufacturer, batchId, 30, address(0)));
        assertEq(tc.balanceOf(batchId, manufacturer), 100);
    }

    function test_RevertWhen_ShippingExpiredStock() public {
        _receive(distributor, _ship(manufacturer, distributor, batchId, 50, address(0)));
        vm.warp(block.timestamp + ONE_YEAR);
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.BatchExpired.selector, batchId));
        tc.createShipment(batchId, pharmacy, 10, address(0));
    }

    function test_ReceiveAllowedAfterRecallInTransit() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 50, address(0));
        vm.prank(manufacturer);
        tc.recallBatch(batchId, "bad");
        _receive(distributor, sid);
        assertEq(tc.balanceOf(batchId, distributor), 50);
    }

    function test_ShipmentWithRegisteredDevice() public {
        uint256 sid = _ship(manufacturer, distributor, batchId, 10, device);
        assertEq(tc.getShipment(sid).device, device);
        ITrustChain.MonitoringInfo memory info = tc.monitoringInfo(sid);
        assertEq(info.device, device);
        assertEq(info.batchId, batchId);
        assertEq(info.conditions.minTempX10, 20);
    }

    function test_RevertWhen_UnregisteredDevice() public {
        vm.prank(manufacturer);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.DeviceNotRegistered.selector, stranger));
        tc.createShipment(batchId, distributor, 10, stranger);
    }
}

contract DispenseTest is BaseTest {
    function test_OtcDispense() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(pharmacy);
        tc.dispense(_one(secrets[0]), patient, 0);

        assertEq(tc.balanceOf(id, pharmacy), 4);
        TrustChain.Strip memory s = tc.getStrip(_codeHash(secrets[0]));
        assertEq(uint8(s.status), uint8(TrustChain.StripStatus.Dispensed));
        assertEq(s.dispensedBy, pharmacy);
        assertEq(s.patient, patient);
    }

    function test_AnonymousOtcDispense() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(pharmacy);
        tc.dispense(_one(secrets[0]), address(0), 0);
        assertEq(tc.getStrip(_codeHash(secrets[0])).patient, address(0));
    }

    function test_RevertWhen_DispensedTwice() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.startPrank(pharmacy);
        tc.dispense(_one(secrets[0]), patient, 0);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.StripNotDispensable.selector, _codeHash(secrets[0])));
        tc.dispense(_one(secrets[0]), patient, 0);
        vm.stopPrank();
    }

    function test_RevertWhen_UnknownSecret() public {
        _stockPharmacy(5, false);
        bytes32 fake = keccak256("counterfeit");
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.StripNotDispensable.selector, _codeHash(fake)));
        tc.dispense(_one(fake), patient, 0);
    }

    function test_RevertWhen_PharmacyWithoutStock() public {
        // Old bug: pharmacies could mint stock via receiveFromDistributor / returnMedicine.
        uint256 id = _createBatch(5, false);
        bytes32[] memory secrets = _registerStrips(id, 5);
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.InsufficientBalance.selector, id, 0, 1));
        tc.dispense(_one(secrets[0]), patient, 0);
    }

    function test_RevertWhen_RecalledBatch() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(manufacturer);
        tc.recallBatch(id, "bad");
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.BatchNotActive.selector, id, TrustChain.BatchStatus.Recalled));
        tc.dispense(_one(secrets[0]), patient, 0);
    }

    function test_RevertWhen_QuarantinedBatch() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(admin);
        tc.quarantineBatch(id, 0, 16);
        vm.prank(pharmacy);
        vm.expectRevert(
            abi.encodeWithSelector(TrustChain.BatchNotActive.selector, id, TrustChain.BatchStatus.Quarantined)
        );
        tc.dispense(_one(secrets[0]), patient, 0);
    }

    function test_RevertWhen_Expired() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.warp(block.timestamp + ONE_YEAR);
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.BatchExpired.selector, id));
        tc.dispense(_one(secrets[0]), patient, 0);
    }

    function test_RevertWhen_NonPharmacyDispenses() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.WrongRole.selector, TrustChain.Role.Pharmacy));
        tc.dispense(_one(secrets[0]), patient, 0);
    }

    function test_RevertWhen_RxOnlyWithoutPrescription() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.prank(pharmacy);
        vm.expectRevert(TrustChain.PrescriptionRequired.selector);
        tc.dispense(_one(secrets[0]), patient, 0);
    }

    function test_RxDispenseConsumesAllowance() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.prank(doctor);
        uint256 rx = tc.issuePrescription(patient, keccak256("insulin 10u"), uint64(block.timestamp) + 30 days, 2);

        bytes32[] memory two = new bytes32[](2);
        two[0] = secrets[0];
        two[1] = secrets[1];
        vm.prank(pharmacy);
        tc.dispense(two, patient, rx);

        assertEq(tc.getPrescription(rx).dispensed, 2);
        assertFalse(tc.isPrescriptionUsable(rx));
        assertEq(tc.getStrip(_codeHash(secrets[1])).prescriptionId, rx);

        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.PrescriptionNotUsable.selector, rx));
        tc.dispense(_one(secrets[2]), patient, rx);
    }

    function test_RevertWhen_ExceedingAllowanceInOneCall() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.prank(doctor);
        uint256 rx = tc.issuePrescription(patient, 0, uint64(block.timestamp) + 30 days, 1);
        bytes32[] memory two = new bytes32[](2);
        two[0] = secrets[0];
        two[1] = secrets[1];
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.PrescriptionNotUsable.selector, rx));
        tc.dispense(two, patient, rx);
    }

    function test_RevertWhen_PrescriptionForSomeoneElse() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.prank(doctor);
        uint256 rx = tc.issuePrescription(patient, 0, uint64(block.timestamp) + 30 days, 2);
        vm.prank(pharmacy);
        vm.expectRevert(TrustChain.PatientMismatch.selector);
        tc.dispense(_one(secrets[0]), stranger, rx);
    }

    function test_RevertWhen_PrescriptionCancelled() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.startPrank(doctor);
        uint256 rx = tc.issuePrescription(patient, 0, uint64(block.timestamp) + 30 days, 2);
        tc.cancelPrescription(rx);
        vm.stopPrank();
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.PrescriptionNotUsable.selector, rx));
        tc.dispense(_one(secrets[0]), patient, rx);
    }

    function test_RevertWhen_PrescriptionExpired() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.prank(doctor);
        uint256 rx = tc.issuePrescription(patient, 0, uint64(block.timestamp) + 1 days, 2);
        vm.warp(block.timestamp + 2 days);
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.PrescriptionNotUsable.selector, rx));
        tc.dispense(_one(secrets[0]), patient, rx);
    }

    function test_RevertWhen_DoctorSuspended() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, true);
        vm.prank(doctor);
        uint256 rx = tc.issuePrescription(patient, 0, uint64(block.timestamp) + 30 days, 2);
        vm.prank(admin);
        tc.setParticipantActive(doctor, false);
        vm.prank(pharmacy);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.PrescriptionNotUsable.selector, rx));
        tc.dispense(_one(secrets[0]), patient, rx);
    }

    function test_RevertWhen_NonDoctorPrescribes() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(TrustChain.WrongRole.selector, TrustChain.Role.Doctor));
        tc.issuePrescription(patient, 0, uint64(block.timestamp) + 1 days, 1);
    }

    function test_RevertWhen_OtherDoctorCancels() public {
        vm.prank(doctor);
        uint256 rx = tc.issuePrescription(patient, 0, uint64(block.timestamp) + 1 days, 1);
        vm.prank(admin);
        tc.registerParticipant(stranger, TrustChain.Role.Doctor, "Dr. Other", "", "");
        vm.prank(stranger);
        vm.expectRevert(TrustChain.NotPrescriber.selector);
        tc.cancelPrescription(rx);
    }

    function test_PrescriptionIndexes() public {
        vm.startPrank(doctor);
        tc.issuePrescription(patient, 0, uint64(block.timestamp) + 1 days, 1);
        tc.issuePrescription(patient, 0, uint64(block.timestamp) + 1 days, 1);
        vm.stopPrank();
        assertEq(tc.getPrescriptionsOfPatient(patient).length, 2);
        assertEq(tc.getPrescriptionsOfDoctor(doctor).length, 2);
    }
}

contract VerifyTest is BaseTest {
    function test_UnknownCodeIsFlagged() public view {
        TrustChain.Verification memory v = tc.verify(keccak256("fake"));
        assertEq(uint8(v.verdict), uint8(TrustChain.Verdict.Unknown));
    }

    function test_GenuineThenDispensed() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        bytes32 h = _codeHash(secrets[0]);

        TrustChain.Verification memory v = tc.verify(h);
        assertEq(uint8(v.verdict), uint8(TrustChain.Verdict.Genuine));
        assertEq(v.batchId, id);
        assertEq(v.manufacturerName, "Acme Pharma");
        assertEq(v.lotNumber, "TC-IN-2025-0007731");

        vm.prank(pharmacy);
        tc.dispense(_one(secrets[0]), patient, 0);

        v = tc.verify(h);
        assertEq(uint8(v.verdict), uint8(TrustChain.Verdict.AlreadyDispensed));
        assertEq(v.dispensedByName, "City Pharmacy");
    }

    function test_RecalledVerdict() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(manufacturer);
        tc.recallBatch(id, "x");
        assertEq(uint8(tc.verify(_codeHash(secrets[0])).verdict), uint8(TrustChain.Verdict.Recalled));
    }

    function test_QuarantinedVerdict() public {
        (uint256 id, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.prank(admin);
        tc.quarantineBatch(id, 0, 16);
        assertEq(uint8(tc.verify(_codeHash(secrets[0])).verdict), uint8(TrustChain.Verdict.Quarantined));
    }

    function test_ExpiredVerdict() public {
        (, bytes32[] memory secrets) = _stockPharmacy(5, false);
        vm.warp(block.timestamp + ONE_YEAR);
        assertEq(uint8(tc.verify(_codeHash(secrets[0])).verdict), uint8(TrustChain.Verdict.Expired));
    }
}

contract PauseTest is BaseTest {
    function test_PauseBlocksWrites() public {
        vm.prank(admin);
        tc.pause();
        vm.prank(manufacturer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        tc.createBatch("X", "L", 1, uint64(block.timestamp) + 1 days, false, _cond(), 0);
    }

    function test_RecallStillWorksWhenPaused() public {
        uint256 id = _createBatch(5, false);
        vm.prank(admin);
        tc.pause();
        vm.prank(manufacturer);
        tc.recallBatch(id, "emergency");
        assertEq(uint8(tc.getBatch(id).status), uint8(TrustChain.BatchStatus.Recalled));
    }

    function test_RevertWhen_StrangerPauses() public {
        vm.prank(stranger);
        vm.expectRevert(TrustChain.NotAdmin.selector);
        tc.pause();
    }
}
