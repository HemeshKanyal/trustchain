// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Admin.sol";

/// @title Manufacturer Contract for TrustChain
/// @notice Handles creation of medicine batches and strips by approved manufacturers.
contract Manufacturer {
    // Reference to Admin contract
    Admin public admin;

    // ---------------------------
    // Structs
    // ---------------------------
    struct MedicineBatch {
        uint256 batchId;
        string name;
        uint256 quantity;          // number of strips or units
        uint256 manufactureDate;
        uint256 expiryDate;
        string batchHash;          // QR/unique hash for the batch box
        address manufacturer;
        bool exists;
        bool recalled;             // New: Track if batch is recalled
    }

    struct Strip {
        uint256 stripId;
        uint256 batchId;
        string stripHash;          // QR/unique hash for strip
        string composition;        // e.g., "Paracetamol 500mg"
        uint256 expiryDate;
        bool exists;
    }

    // ---------------------------
    // Storage
    // ---------------------------
    uint256 public nextBatchId;
    uint256 public nextStripId;

    mapping(uint256 => MedicineBatch) public batches; // batchId → Batch
    mapping(uint256 => Strip) public strips;          // stripId → Strip
    mapping(string => uint256) public stripHashToId;  // stripHash → stripId
    mapping(uint256 => uint256) public stripToBatch;  // stripId → batchId
    mapping(string => bool) public batchHashExists;   // New: Track used batch hashes
    mapping(string => bool) public stripHashExists;   // New: Track used strip hashes

    // ---------------------------
    // Events
    // ---------------------------
    event BatchCreated(
        uint256 indexed batchId,
        string name,
        uint256 quantity,
        uint256 manufactureDate,
        uint256 expiryDate,
        string batchHash,
        address indexed manufacturer
    );
    event StripAdded(
        uint256 indexed stripId,
        uint256 indexed batchId,
        string stripHash,
        string composition,
        uint256 expiryDate
    );
    event BatchRecalled(uint256 indexed batchId, address indexed manufacturer);
    event BatchUpdated(uint256 indexed batchId, string name, uint256 expiryDate);

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address _admin) {
        admin = Admin(_admin);
        nextBatchId = 1;
        nextStripId = 1;
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Manufacturer creates a new batch (box-level)
    function createBatch(
        string memory _name,
        uint256 _quantity,
        uint256 _expiryDate,
        string memory _batchHash
    ) external {
        admin.checkApprovedManufacturer(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(_quantity > 0, "Quantity must be > 0");
        require(_expiryDate > block.timestamp, "Expiry must be in future");
        require(!batchHashExists[_batchHash], "Batch hash already used");

        uint256 batchId = nextBatchId++;
        batches[batchId] = MedicineBatch({
            batchId: batchId,
            name: _name,
            quantity: _quantity,
            manufactureDate: block.timestamp,
            expiryDate: _expiryDate,
            batchHash: _batchHash,
            manufacturer: msg.sender,
            exists: true,
            recalled: false
        });

        batchHashExists[_batchHash] = true;

        emit BatchCreated(batchId, _name, _quantity, block.timestamp, _expiryDate, _batchHash, msg.sender);
    }

    /// @notice Add strips inside a batch (strip-level)
    function addStrip(
        uint256 batchId,
        string memory _stripHash,
        string memory _composition,
        uint256 _expiryDate
    ) external {
        admin.checkApprovedManufacturer(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(batches[batchId].exists, "Batch not found");
        require(!batches[batchId].recalled, "Batch is recalled");
        require(_expiryDate <= batches[batchId].expiryDate, "Strip expiry cannot exceed batch expiry");
        require(!stripHashExists[_stripHash], "Strip hash already used");

        uint256 stripId = nextStripId++;
        strips[stripId] = Strip({
            stripId: stripId,
            batchId: batchId,
            stripHash: _stripHash,
            composition: _composition,
            expiryDate: _expiryDate,
            exists: true
        });

        stripHashToId[_stripHash] = stripId;
        stripToBatch[stripId] = batchId;
        stripHashExists[_stripHash] = true;

        emit StripAdded(stripId, batchId, _stripHash, _composition, _expiryDate);
    }

    /// @notice Recall a batch (e.g., for defective products)
    function recallBatch(uint256 batchId) external {
        admin.checkApprovedManufacturer(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(batches[batchId].exists, "Batch not found");
        require(batches[batchId].manufacturer == msg.sender, "Not batch manufacturer");
        require(!batches[batchId].recalled, "Batch already recalled");

        batches[batchId].recalled = true;
        emit BatchRecalled(batchId, msg.sender);
    }

    /// @notice Update batch metadata (name, expiry) with Admin approval
    function updateBatch(
        uint256 batchId,
        string memory _name,
        uint256 _expiryDate
    ) external {
        admin.checkApprovedManufacturer(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(batches[batchId].exists, "Batch not found");
        require(batches[batchId].manufacturer == msg.sender, "Not batch manufacturer");
        require(_expiryDate > block.timestamp, "Expiry must be in future");

        batches[batchId].name = _name;
        batches[batchId].expiryDate = _expiryDate;

        emit BatchUpdated(batchId, _name, _expiryDate);
    }

    // ---------------------------
    // View Helpers
    // ---------------------------
    function getBatch(uint256 batchId) external view returns (MedicineBatch memory) {
        require(batches[batchId].exists, "Batch not found");
        return batches[batchId];
    }

    function getStrip(uint256 stripId) external view returns (Strip memory) {
        require(strips[stripId].exists, "Strip not found");
        return strips[stripId];
    }

    function getBatchByStrip(uint256 stripId) external view returns (MedicineBatch memory) {
        require(strips[stripId].exists, "Strip not found");
        uint256 batchId = stripToBatch[stripId];
        return batches[batchId];
    }
}