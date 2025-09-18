// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Admin.sol";
import "./Manufacturer.sol";

/// @title IoT Tracker Contract for TrustChain
/// @notice Records environmental, location, and RFID verification data during medicine transportation
/// @dev Data is sent by off-chain IoT devices via oracles or approved distributors
contract IoTTracker {
    Admin public admin;
    Manufacturer public manufacturer;

    // ---------------------------
    // Structs
    // ---------------------------
    struct IoTData {
        string gpsLocation;   // from NEO-6M
        int256 temperature;   // from DHT22 (in Celsius)
        uint256 humidity;     // from DHT22 (in %)
        string rfidTag;       // from RC522
        uint256 timestamp;    // logged time
        address reporter;     // oracle or distributor
    }

    // ---------------------------
    // Storage
    // ---------------------------
    mapping(uint256 => IoTData[]) public batchIoTLogs; // batchId => list of IoTData

    // ---------------------------
    // Events
    // ---------------------------
    event IoTDataLogged(
        uint256 indexed batchId,
        string gpsLocation,
        int256 temperature,
        uint256 humidity,
        string rfidTag,
        uint256 timestamp,
        address indexed reporter
    );

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address _admin, address _manufacturer) {
        admin = Admin(_admin);
        manufacturer = Manufacturer(_manufacturer);
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Logs IoT data for a medicine batch during transport
    /// @param batchId The unique identifier for the medicine batch
    /// @param gpsLocation Current GPS coordinates
    /// @param temperature Recorded temperature in Celsius
    /// @param humidity Recorded humidity %
    /// @param rfidTag RFID tag scanned
    function logIoTData(
        uint256 batchId,
        string memory gpsLocation,
        int256 temperature,
        uint256 humidity,
        string memory rfidTag
    ) external {
        // Restrict to approved distributors or oracles
        admin.checkApprovedDistributor(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        // Verify batch exists and is not recalled
        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(batchId);
        require(batch.exists, "Batch does not exist");
        require(!batch.recalled, "Batch is recalled");

        // Basic input validation
        require(bytes(gpsLocation).length > 0, "Invalid GPS location");
        require(bytes(rfidTag).length > 0, "Invalid RFID tag");
        require(temperature >= -40 && temperature <= 80, "Invalid temperature"); // DHT22 range
        require(humidity <= 100, "Invalid humidity"); // 0-100%

        IoTData memory data = IoTData({
            gpsLocation: gpsLocation,
            temperature: temperature,
            humidity: humidity,
            rfidTag: rfidTag,
            timestamp: block.timestamp,
            reporter: msg.sender
        });

        batchIoTLogs[batchId].push(data);

        emit IoTDataLogged(batchId, gpsLocation, temperature, humidity, rfidTag, block.timestamp, msg.sender);
    }

    // ---------------------------
    // View Helpers
    // ---------------------------

    /// @notice Get IoT data logs for a batch
    function getBatchLogs(uint256 batchId) external view returns (IoTData[] memory) {
        return batchIoTLogs[batchId];
    }

    /// @notice Get environmental summary for a batch (max/min temperature, humidity)
    function getBatchEnvSummary(uint256 batchId) external view returns (
        int256 maxTemp,
        int256 minTemp,
        uint256 maxHumidity,
        uint256 minHumidity
    ) {
        IoTData[] memory logs = batchIoTLogs[batchId];
        require(logs.length > 0, "No logs for batch");

        maxTemp = logs[0].temperature;
        minTemp = logs[0].temperature;
        maxHumidity = logs[0].humidity;
        minHumidity = logs[0].humidity;

        for (uint256 i = 1; i < logs.length; i++) {
            if (logs[i].temperature > maxTemp) maxTemp = logs[i].temperature;
            if (logs[i].temperature < minTemp) minTemp = logs[i].temperature;
            if (logs[i].humidity > maxHumidity) maxHumidity = logs[i].humidity;
            if (logs[i].humidity < minHumidity) minHumidity = logs[i].humidity;
        }

        return (maxTemp, minTemp, maxHumidity, minHumidity);
    }
}