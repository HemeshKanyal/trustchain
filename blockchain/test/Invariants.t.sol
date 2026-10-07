// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BaseTest} from "./Base.t.sol";
import {TrustChain} from "../src/TrustChain.sol";
import {ITrustChain} from "../src/interfaces/ITrustChain.sol";

/// Drives random custody operations on a single batch.
contract CustodyHandler is Test {
    TrustChain internal tc;
    uint256 internal batchId;
    address[] public actors;
    bytes32[] internal secrets;
    uint256 internal nextSecret;

    uint256[] internal openShipments;
    uint256 public inTransit;
    uint256 public dispensed;

    constructor(TrustChain tc_, uint256 batchId_, address[] memory actors_, bytes32[] memory secrets_) {
        tc = tc_;
        batchId = batchId_;
        actors = actors_;
        secrets = secrets_;
    }

    function ship(uint256 fromSeed, uint256 toSeed, uint32 qty) external {
        address from = actors[fromSeed % actors.length];
        address to = actors[toSeed % actors.length];
        uint256 bal = tc.balanceOf(batchId, from);
        if (bal == 0) return;
        qty = uint32(bound(qty, 1, bal));
        vm.prank(from);
        try tc.createShipment(batchId, to, qty, address(0)) returns (uint256 id) {
            openShipments.push(id);
            inTransit += qty;
        } catch {}
    }

    function settle(uint256 seed, bool accept) external {
        if (openShipments.length == 0) return;
        uint256 idx = seed % openShipments.length;
        uint256 id = openShipments[idx];
        TrustChain.Shipment memory s = tc.getShipment(id);
        vm.prank(accept ? s.to : s.from);
        if (accept) tc.receiveShipment(id);
        else tc.cancelShipment(id);
        inTransit -= s.quantity;
        openShipments[idx] = openShipments[openShipments.length - 1];
        openShipments.pop();
    }

    function dispense(uint256 pharmacySeed) external {
        if (nextSecret >= secrets.length) return;
        address pharmacy = actors[pharmacySeed % actors.length];
        vm.prank(pharmacy);
        bytes32[] memory one = new bytes32[](1);
        one[0] = secrets[nextSecret];
        try tc.dispense(one, address(0), 0) {
            nextSecret++;
            dispensed++;
        } catch {}
    }
}

contract CustodyInvariantTest is BaseTest {
    CustodyHandler internal handler;
    uint256 internal batchId;
    address[] internal actors;
    uint32 internal constant QTY = 500;

    function setUp() public override {
        super.setUp();
        batchId = _createBatch(QTY, false);
        bytes32[] memory secrets = new bytes32[](200);
        for (uint256 i; i < 200; ++i) {
            secrets[i] = _secret(batchId, i);
        }
        bytes32[] memory hashes = new bytes32[](200);
        for (uint256 i; i < 200; ++i) {
            hashes[i] = _codeHash(secrets[i]);
        }
        vm.prank(manufacturer);
        tc.registerStrips(batchId, hashes);

        actors = [manufacturer, distributor, distributor2, pharmacy, doctor, stranger];
        handler = new CustodyHandler(tc, batchId, actors, secrets);
        targetContract(address(handler));
    }

    /// Stock is never created or destroyed: held + in transit + dispensed == minted.
    function invariant_ConservationOfStock() public view {
        uint256 held;
        for (uint256 i; i < actors.length; ++i) {
            held += tc.balanceOf(batchId, actors[i]);
        }
        assertEq(held + handler.inTransit() + handler.dispensed(), QTY);
    }

    /// Only pharmacies can ever dispense, and custody never reaches non-supply-chain roles.
    function invariant_NoStockOutsideSupplyChain() public view {
        assertEq(tc.balanceOf(batchId, doctor), 0);
        assertEq(tc.balanceOf(batchId, stranger), 0);
    }
}
