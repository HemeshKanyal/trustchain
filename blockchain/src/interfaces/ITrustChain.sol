// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Surface of TrustChain that the ColdChainMonitor depends on.
interface ITrustChain {
    enum ShipmentStatus {
        None,
        InTransit,
        Delivered,
        Cancelled
    }

    /// @dev Temperatures in tenths of °C, humidity in tenths of %RH. maxHumidityX10 == 0 disables the humidity check.
    struct StorageConditions {
        int16 minTempX10;
        int16 maxTempX10;
        uint16 maxHumidityX10;
    }

    struct MonitoringInfo {
        uint256 batchId;
        address device;
        ShipmentStatus status;
        uint64 createdAt;
        uint64 deliveredAt;
        StorageConditions conditions;
    }

    function isAdmin(address account) external view returns (bool);

    function monitoringInfo(uint256 shipmentId) external view returns (MonitoringInfo memory);

    function quarantineBatch(uint256 batchId, uint256 shipmentId, uint8 reasonFlags) external;
}
