// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Admin.sol";
import "./Manufacturer.sol";

/// @title Distributor Contract for TrustChain
/// @notice Handles transfer of medicine batches from manufacturers to pharmacies with transit tracking.
contract Distributor {
    Admin public admin;
    Manufacturer public manufacturer;

    // ---------------------------
    // Structs
    // ---------------------------
    struct Transit {
        uint256 transitId;
        uint256 batchId;
        address from;
        address to;
        uint256 startTime;
        uint256 endTime;
        bool inTransit;
        mapping(uint256 => Checkpoint) checkpoints; // New: Store checkpoints
        uint256 checkpointCount; // New: Track number of checkpoints
    }

    struct Checkpoint {
        uint256 timestamp;
        string location; // e.g., "Warehouse A"
        string metadata; // e.g., "Temp: 20C, Humidity: 50%"
    }

    // ---------------------------
    // Storage
    // ---------------------------
    uint256 public nextTransitId;
    mapping(uint256 => Transit) public transits;       // transitId → Transit
    mapping(uint256 => address) public currentHolder;  // batchId → current holder
    uint256 public constant TRANSIT_TIMEOUT = 7 days;  // New: Timeout for stuck transits

    // ---------------------------
    // Events
    // ---------------------------
    event TransitStarted(uint256 indexed transitId, uint256 indexed batchId, address from, address to, uint256 startTime);
    event TransitCompleted(uint256 indexed transitId, uint256 indexed batchId, address from, address to, uint256 endTime);
    event CheckpointAdded(uint256 indexed transitId, uint256 indexed batchId, string location, string metadata, uint256 timestamp);

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address _admin, address _manufacturer) {
        admin = Admin(_admin);
        manufacturer = Manufacturer(_manufacturer);
        nextTransitId = 1;
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Manufacturer hands over a batch to Distributor
    function receiveFromManufacturer(uint256 batchId) external {
        admin.checkApprovedDistributor(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(batchId);
        require(batch.exists, "Batch does not exist");
        require(!batch.recalled, "Batch is recalled");

        currentHolder[batchId] = msg.sender;
    }

    /// @notice Start transit of a batch
    function startTransit(uint256 batchId, address to) external {
        admin.checkApprovedDistributor(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(batchId);
        require(batch.exists, "Batch does not exist");
        require(!batch.recalled, "Batch is recalled");
        require(currentHolder[batchId] == msg.sender, "You are not holder of this batch");
        require(to != address(0), "Invalid recipient");

        uint256 transitId = nextTransitId++;
        Transit storage t = transits[transitId];
        t.transitId = transitId;
        t.batchId = batchId;
        t.from = msg.sender;
        t.to = to;
        t.startTime = block.timestamp;
        t.inTransit = true;
        t.checkpointCount = 0;

        emit TransitStarted(transitId, batchId, msg.sender, to, block.timestamp);
    }

    /// @notice Record a checkpoint during transit (e.g., QR scan, IoT data)
    function recordCheckpoint(uint256 transitId, string memory location, string memory metadata) external {
        admin.checkApprovedDistributor(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        Transit storage t = transits[transitId];
        require(t.inTransit, "Transit not active");
        require(t.from == msg.sender || t.to == msg.sender, "Not involved in transit");

        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(t.batchId);
        require(!batch.recalled, "Batch is recalled");

        uint256 checkpointId = t.checkpointCount++;
        t.checkpoints[checkpointId] = Checkpoint({
            timestamp: block.timestamp,
            location: location,
            metadata: metadata
        });

        emit CheckpointAdded(transitId, t.batchId, location, metadata, block.timestamp);
    }

    /// @notice Complete transit (mark arrival of batch)
    function completeTransit(uint256 transitId) external {
        admin.checkNotBlacklisted(msg.sender);

        Transit storage t = transits[transitId];
        require(t.inTransit, "Transit already completed");
        require(msg.sender == t.to, "Only recipient can complete transit");

        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(t.batchId);
        require(!batch.recalled, "Batch is recalled");

        t.endTime = block.timestamp;
        t.inTransit = false;
        currentHolder[t.batchId] = msg.sender;

        emit TransitCompleted(transitId, t.batchId, t.from, t.to, block.timestamp);
    }

    /// @notice Check if transit is timed out
    function isTransitTimedOut(uint256 transitId) external view returns (bool) {
        Transit storage t = transits[transitId];
        require(t.inTransit, "Transit not active");
        return block.timestamp > t.startTime + TRANSIT_TIMEOUT;
    }

    // ---------------------------
    // View Helpers
    // ---------------------------
    function getCurrentHolder(uint256 batchId) external view returns (address) {
        return currentHolder[batchId];
    }

    function getTransit(uint256 transitId) external view returns (
        uint256 batchId,
        address from,
        address to,
        uint256 startTime,
        uint256 endTime,
        bool inTransit
    ) {
        Transit storage t = transits[transitId];
        return (t.batchId, t.from, t.to, t.startTime, t.endTime, t.inTransit);
    }

    function getCheckpoint(uint256 transitId, uint256 checkpointId) external view returns (
        uint256 timestamp,
        string memory location,
        string memory metadata
    ) {
        Transit storage t = transits[transitId];
        Checkpoint storage c = t.checkpoints[checkpointId];
        require(checkpointId < t.checkpointCount, "Invalid checkpoint ID");
        return (c.timestamp, c.location, c.metadata);
    }

    function getCheckpointCount(uint256 transitId) external view returns (uint256) {
        return transits[transitId].checkpointCount;
    }
}