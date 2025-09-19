// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Admin.sol";
import "./Distributor.sol";
import "./Prescription.sol";
import "./Patient.sol";
import "./Manufacturer.sol";

/// @title Pharmacy Contract for TrustChain
/// @notice Handles dispensing and returning of medicines (strips) to patients with or without prescriptions.
contract Pharmacy {
    Admin public admin;
    Distributor public distributor;
    Prescription public prescriptionContract;
    Patient public patientContract;
    Manufacturer public manufacturer;

    // ---------------------------
    // Structs
    // ---------------------------
    struct Stock {
        uint256 batchId;
        uint256 stripId;
        uint256 availableQuantity;  // strips available from this batch
        uint256 returnedQuantity;   // New: Track returned strips (non-resellable)
        bool exists;
    }

    // ---------------------------
    // Storage
    // ---------------------------
    mapping(address => mapping(uint256 => Stock)) public pharmacyStock; // pharmacy → stripId → Stock
    uint256 public constant PRESCRIPTION_VALIDITY = 30 days; // Prescription expiration period
    uint256 public constant RETURN_VALIDITY = 30 days;       // New: Return time limit

    // ---------------------------
    // Events
    // ---------------------------
    event StockReceived(address indexed pharmacy, uint256 indexed batchId, uint256 stripId, uint256 quantity);
    event StripDispensed(address indexed pharmacy, address indexed patient, uint256 stripId, uint256 quantity, bool withPrescription);
    event StockReturned(address indexed pharmacy, uint256 indexed stripId, uint256 quantity);
    event MedicineReturned(address indexed patient, uint256 indexed stripId, uint256 quantity); // New: Patient return event

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(
        address _admin,
        address _distributor,
        address _prescription,
        address _patient,
        address _manufacturer
    ) {
        admin = Admin(_admin);
        distributor = Distributor(_distributor);
        prescriptionContract = Prescription(_prescription);
        patientContract = Patient(_patient);
        manufacturer = Manufacturer(_manufacturer);
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Receive strips from distributor (after receiving batch)
    function receiveFromDistributor(uint256 batchId, uint256 stripId, uint256 quantity) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(distributor.getCurrentHolder(batchId) == msg.sender, "Not holder of this batch");
        Manufacturer.Strip memory strip = manufacturer.getStrip(stripId);
        require(strip.exists && strip.batchId == batchId, "Invalid strip for this batch");
        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(batchId);
        require(!batch.recalled, "Batch is recalled");

        require(quantity > 0, "Invalid quantity");

        pharmacyStock[msg.sender][stripId].batchId = batchId;
        pharmacyStock[msg.sender][stripId].stripId = stripId;
        pharmacyStock[msg.sender][stripId].availableQuantity += quantity;
        pharmacyStock[msg.sender][stripId].exists = true;

        emit StockReceived(msg.sender, batchId, stripId, quantity);
    }

    /// @notice Dispense strips to patient with prescription
    function dispenseStrip(
        uint256 prescriptionId,
        uint256 stripId,
        uint256 quantity
    ) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(quantity > 0, "Quantity must be > 0");
        require(pharmacyStock[msg.sender][stripId].availableQuantity >= quantity, "Not enough stock");

        Prescription.PrescriptionData memory pres = prescriptionContract.getPrescription(prescriptionId);
        require(pres.patient != address(0), "Invalid prescription");
        require(block.timestamp <= pres.createdAt + PRESCRIPTION_VALIDITY, "Prescription expired");

        Manufacturer.Strip memory strip = manufacturer.getStrip(stripId);
        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(strip.batchId);
        require(!batch.recalled, "Batch is recalled");

        // Basic composition check (assumes medicineListHash includes composition; full matching off-chain)
        require(bytes(strip.composition).length > 0, "Invalid strip composition");

        pharmacyStock[msg.sender][stripId].availableQuantity -= quantity;
        patientContract.markStripDispensed(pres.patient, stripId, quantity, prescriptionId);

        emit StripDispensed(msg.sender, pres.patient, stripId, quantity, true);
    }

    /// @notice Dispense strips to patient without prescription (OTC)
    function dispenseWithoutPrescription(
        address patientAddr,
        uint256 stripId,
        uint256 quantity
    ) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(quantity > 0, "Quantity must be > 0");
        require(pharmacyStock[msg.sender][stripId].availableQuantity >= quantity, "Not enough stock");

        Manufacturer.Strip memory strip = manufacturer.getStrip(stripId);
        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(strip.batchId);
        require(!batch.recalled, "Batch is recalled");

        // Ensure strip has valid composition (for AI recommendation off-chain)
        require(bytes(strip.composition).length > 0, "Invalid strip composition");

        pharmacyStock[msg.sender][stripId].availableQuantity -= quantity;
        patientContract.markStripDispensed(patientAddr, stripId, quantity, 0); // 0 for OTC

        emit StripDispensed(msg.sender, patientAddr, stripId, quantity, false);
    }

    /// @notice Handle return or spoilage of strips by pharmacy
    function returnStock(uint256 stripId, uint256 quantity) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(pharmacyStock[msg.sender][stripId].exists, "Stock not found");
        require(quantity > 0, "Invalid quantity");
        require(pharmacyStock[msg.sender][stripId].availableQuantity >= quantity, "Not enough stock to return");

        pharmacyStock[msg.sender][stripId].availableQuantity -= quantity;
        pharmacyStock[msg.sender][stripId].returnedQuantity += quantity; // Track as returned

        emit StockReturned(msg.sender, stripId, quantity);
    }

    /// @notice Patient returns dispensed strips
    function returnMedicine(uint256 stripId, uint256 quantity) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(quantity > 0, "Invalid quantity");
        require(patientContract.getPatientStripHistory(msg.sender, stripId) >= quantity, "Patient did not receive this quantity");
        require(pharmacyStock[msg.sender][stripId].exists, "Stock not found");

        Manufacturer.Strip memory strip = manufacturer.getStrip(stripId);
        require(block.timestamp <= strip.expiryDate + RETURN_VALIDITY, "Return period expired");

        patientContract.recordReturn(msg.sender, stripId, quantity);
        pharmacyStock[msg.sender][stripId].returnedQuantity += quantity; // Track as returned, not resellable

        emit MedicineReturned(msg.sender, stripId, quantity);
    }

    // ---------------------------
    // View Helpers
    // ---------------------------
    function getStock(address pharmacy, uint256 stripId) external view returns (Stock memory) {
        return pharmacyStock[pharmacy][stripId];
    }
}