// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ITrustChain} from "./interfaces/ITrustChain.sol";

/// @title ColdChainMonitor
/// @notice Accepts telemetry summaries signed by registered IoT trackers (EIP-712) and quarantines
///         the batch on TrustChain when storage conditions are breached or the box is tampered with.
/// @dev Devices sign one Report per time window (e.g. every 5-15 min). Raw readings stay off-chain;
///      `dataHash` commits to them so they can be audited later. Anyone may relay a signed report.
contract ColdChainMonitor is EIP712 {
    struct Device {
        bool active;
        uint64 registeredAt;
        string label;
    }

    struct Report {
        uint256 shipmentId;
        uint64 windowStart;
        uint64 windowEnd;
        uint32 readings;
        int16 minTempX10;
        int16 maxTempX10;
        uint16 maxHumidityX10;
        int32 latE6;
        int32 lonE6;
        bool tamper;
        bytes32 dataHash;
        uint64 seq;
    }

    struct ShipmentTelemetry {
        uint32 reportCount;
        uint32 breachCount;
        uint64 lastSeq;
        uint64 lastReportAt;
        int16 minTempSeenX10;
        int16 maxTempSeenX10;
        uint16 maxHumiditySeenX10;
        int32 lastLatE6;
        int32 lastLonE6;
        bool tamperDetected;
    }

    bytes32 public constant REPORT_TYPEHASH = keccak256(
        "Report(uint256 shipmentId,uint64 windowStart,uint64 windowEnd,uint32 readings,int16 minTempX10,int16 maxTempX10,uint16 maxHumidityX10,int32 latE6,int32 lonE6,bool tamper,bytes32 dataHash,uint64 seq)"
    );

    /// Tolerated device clock drift into the future.
    uint64 public constant MAX_CLOCK_SKEW = 5 minutes;

    uint8 internal constant REASON_TEMP_LOW = 1;
    uint8 internal constant REASON_TEMP_HIGH = 2;
    uint8 internal constant REASON_HUMIDITY = 4;
    uint8 internal constant REASON_TAMPER = 8;

    ITrustChain public immutable trustChain;

    mapping(address => Device) private _devices;
    address[] private _deviceList;
    mapping(uint256 => ShipmentTelemetry) private _telemetry;

    error NotAdmin();
    error ZeroAddress();
    error UnknownDevice(address device);
    error WrongDevice(address expected, address signer);
    error ShipmentNotMonitorable(uint256 shipmentId);
    error StaleSequence(uint64 lastSeq, uint64 seq);
    error InvalidWindow();

    event DeviceRegistered(address indexed device, string label);
    event DeviceStatusChanged(address indexed device, bool active);
    event TelemetryRecorded(
        uint256 indexed shipmentId,
        address indexed device,
        uint64 seq,
        uint64 windowStart,
        uint64 windowEnd,
        int16 minTempX10,
        int16 maxTempX10,
        uint16 maxHumidityX10,
        int32 latE6,
        int32 lonE6,
        bool tamper,
        bytes32 dataHash
    );
    event BreachDetected(uint256 indexed shipmentId, uint256 indexed batchId, uint8 reasonFlags, uint64 seq);

    modifier onlyAdmin() {
        if (!trustChain.isAdmin(msg.sender)) revert NotAdmin();
        _;
    }

    constructor(ITrustChain trustChain_) EIP712("TrustChainColdChain", "1") {
        if (address(trustChain_) == address(0)) revert ZeroAddress();
        trustChain = trustChain_;
    }

    // ------------------------------------------------------------------
    // Device registry
    // ------------------------------------------------------------------

    function registerDevice(address device, string calldata label) external onlyAdmin {
        if (device == address(0)) revert ZeroAddress();
        if (_devices[device].registeredAt == 0) _deviceList.push(device);
        _devices[device] = Device({active: true, registeredAt: uint64(block.timestamp), label: label});
        emit DeviceRegistered(device, label);
    }

    function setDeviceActive(address device, bool active) external onlyAdmin {
        if (_devices[device].registeredAt == 0) revert UnknownDevice(device);
        _devices[device].active = active;
        emit DeviceStatusChanged(device, active);
    }

    // ------------------------------------------------------------------
    // Telemetry
    // ------------------------------------------------------------------

    /// @notice Submit a device-signed telemetry report. Reports may arrive late (after delivery) as long as
    ///         their window ended before delivery, so an offline tracker cannot hide an excursion.
    function submitReport(Report calldata r, bytes calldata signature) external returns (uint8 reasonFlags) {
        if (r.windowStart > r.windowEnd || r.windowEnd > block.timestamp + MAX_CLOCK_SKEW) revert InvalidWindow();
        if (r.minTempX10 > r.maxTempX10) revert InvalidWindow();

        ITrustChain.MonitoringInfo memory info = trustChain.monitoringInfo(r.shipmentId);
        if (info.device == address(0)) revert ShipmentNotMonitorable(r.shipmentId);
        if (r.windowEnd < info.createdAt) revert InvalidWindow();
        if (info.status == ITrustChain.ShipmentStatus.Delivered) {
            if (r.windowStart > info.deliveredAt) revert ShipmentNotMonitorable(r.shipmentId);
        } else if (info.status != ITrustChain.ShipmentStatus.InTransit) {
            revert ShipmentNotMonitorable(r.shipmentId);
        }

        address signer = ECDSA.recover(_hashTypedDataV4(hashReport(r)), signature);
        if (signer != info.device) revert WrongDevice(info.device, signer);
        if (!_devices[signer].active) revert UnknownDevice(signer);

        ShipmentTelemetry storage t = _telemetry[r.shipmentId];
        if (r.seq <= t.lastSeq) revert StaleSequence(t.lastSeq, r.seq);

        if (t.reportCount == 0) {
            t.minTempSeenX10 = r.minTempX10;
            t.maxTempSeenX10 = r.maxTempX10;
        } else {
            if (r.minTempX10 < t.minTempSeenX10) t.minTempSeenX10 = r.minTempX10;
            if (r.maxTempX10 > t.maxTempSeenX10) t.maxTempSeenX10 = r.maxTempX10;
        }
        if (r.maxHumidityX10 > t.maxHumiditySeenX10) t.maxHumiditySeenX10 = r.maxHumidityX10;
        t.reportCount += 1;
        t.lastSeq = r.seq;
        t.lastReportAt = uint64(block.timestamp);
        t.lastLatE6 = r.latE6;
        t.lastLonE6 = r.lonE6;

        emit TelemetryRecorded(
            r.shipmentId,
            signer,
            r.seq,
            r.windowStart,
            r.windowEnd,
            r.minTempX10,
            r.maxTempX10,
            r.maxHumidityX10,
            r.latE6,
            r.lonE6,
            r.tamper,
            r.dataHash
        );

        ITrustChain.StorageConditions memory c = info.conditions;
        if (r.minTempX10 < c.minTempX10) reasonFlags |= REASON_TEMP_LOW;
        if (r.maxTempX10 > c.maxTempX10) reasonFlags |= REASON_TEMP_HIGH;
        if (c.maxHumidityX10 != 0 && r.maxHumidityX10 > c.maxHumidityX10) reasonFlags |= REASON_HUMIDITY;
        if (r.tamper) {
            reasonFlags |= REASON_TAMPER;
            t.tamperDetected = true;
        }

        if (reasonFlags != 0) {
            t.breachCount += 1;
            emit BreachDetected(r.shipmentId, info.batchId, reasonFlags, r.seq);
            trustChain.quarantineBatch(info.batchId, r.shipmentId, reasonFlags);
        }
    }

    function hashReport(Report calldata r) public pure returns (bytes32) {
        // Split encoding to keep the stack shallow.
        bytes memory head = abi.encode(
            REPORT_TYPEHASH, r.shipmentId, r.windowStart, r.windowEnd, r.readings, r.minTempX10, r.maxTempX10
        );
        bytes memory tail = abi.encode(r.maxHumidityX10, r.latE6, r.lonE6, r.tamper, r.dataHash, r.seq);
        return keccak256(bytes.concat(head, tail));
    }

    /// @notice Full EIP-712 digest a device must sign for `r`.
    function reportDigest(Report calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(hashReport(r));
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getDevice(address device) external view returns (Device memory) {
        return _devices[device];
    }

    function isActiveDevice(address device) external view returns (bool) {
        return _devices[device].active;
    }

    function getDevices() external view returns (address[] memory) {
        return _deviceList;
    }

    function getTelemetry(uint256 shipmentId) external view returns (ShipmentTelemetry memory) {
        return _telemetry[shipmentId];
    }
}
