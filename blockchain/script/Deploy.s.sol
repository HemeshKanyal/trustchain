// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TrustChain} from "../src/TrustChain.sol";
import {ColdChainMonitor} from "../src/ColdChainMonitor.sol";
import {ITrustChain} from "../src/interfaces/ITrustChain.sol";

/// Deploys TrustChain + ColdChainMonitor and wires them together.
/// The broadcasting account becomes the owner (genesis admin).
///
///   forge script script/Deploy.s.sol --rpc-url sepolia --account deployer --broadcast --verify
contract Deploy is Script {
    function run() external returns (TrustChain tc, ColdChainMonitor monitor) {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        tc = new TrustChain(deployer);
        monitor = new ColdChainMonitor(ITrustChain(address(tc)));
        tc.setMonitor(address(monitor));

        vm.stopBroadcast();

        console.log("TrustChain:       ", address(tc));
        console.log("ColdChainMonitor: ", address(monitor));
        console.log("Owner:            ", deployer);

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployBlock", block.number);
        vm.serializeAddress(obj, "owner", deployer);
        vm.serializeAddress(obj, "coldChainMonitor", address(monitor));
        string memory json = vm.serializeAddress(obj, "trustChain", address(tc));
        vm.writeJson(json, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}
