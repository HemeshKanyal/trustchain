// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Admin.sol";
import "./Manufacturer.sol";
import "./Prescription.sol";

/// @title Patient Contract for TrustChain
/// @notice Handles patient registration, strip history, verification, and returns of medicines.
contract Patient {
    Admin public admin;
    Manufacturer public manufacturer;
    Prescription public prescriptionContract;

    // ---------------------------
    // Structs
    // ---------------------------
    struct PatientData {
        address patient;
        bool registered;
        mapping(uint256 => uint256) dispensedStrips; // stripId → quantity dispensed
        mapping(uint256 => uint256) returnedStrips; // New: stripId → quantity returned
        mapping(uint256 => bool) prescriptionLinked; // prescriptionId → linked to patient
    }

    // ---------------------------
    // Storage
    // ---------------------------
    mapping(address => PatientData) private patients;

    // ---------------------------
    // Events
    // ---------------------------
    event PatientRegistered(address indexed patient);
    event PatientDeregistered(address indexed patient);
    event StripMarkedDispensed(address indexed patient, uint256 stripId, uint256 quantity, uint256 prescriptionId);
    event StripVerified(address indexed patient, uint256 stripId, bool valid, string reason);
    event StripReturned(address indexed patient, uint256 stripId, uint256 quantity); // New: Return event

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address _admin, address _manufacturer, address _prescription) {
        admin = Admin(_admin);
        manufacturer = Manufacturer(_manufacturer);
        prescriptionContract = Prescription(_prescription);
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Patient registers themselves
    function registerPatient() external {
        require(!patients[msg.sender].registered, "Already registered");

        patients[msg.sender].patient = msg.sender;
        patients[msg.sender].registered = true;

        emit PatientRegistered(msg.sender);
    }

    /// @notice Patient deregisters themselves (for privacy)
    function deregisterPatient() external {
        require(patients[msg.sender].registered, "Not registered");

        patients[msg.sender].registered = false;
        emit PatientDeregistered(msg.sender);
    }

    /// @notice Pharmacy marks strips as dispensed (with or without prescription)
    function markStripDispensed(address patientAddr, uint256 stripId, uint256 quantity, uint256 prescriptionId) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(patients[patientAddr].registered, "Patient not registered");
        require(quantity > 0, "Invalid quantity");

        Manufacturer.Strip memory strip = manufacturer.getStrip(stripId);
        require(strip.exists, "Strip not found");
        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(strip.batchId);
        require(!batch.recalled, "Batch is recalled");
        require(block.timestamp <= strip.expiryDate, "Strip expired");

        // If prescriptionId is provided, verify it
        if (prescriptionId != 0) {
            Prescription.PrescriptionData memory pres = prescriptionContract.getPrescription(prescriptionId);
            require(pres.patient == patientAddr, "Prescription not for this patient");
            require(block.timestamp <= pres.createdAt + 30 days, "Prescription expired");
            patients[patientAddr].prescriptionLinked[prescriptionId] = true;
        }

        patients[patientAddr].dispensedStrips[stripId] += quantity;

        emit StripMarkedDispensed(patientAddr, stripId, quantity, prescriptionId);
    }

    /// @notice Patient returns dispensed strips
    function recordReturn(address patientAddr, uint256 stripId, uint256 quantity) external {
        admin.checkApprovedPharmacy(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(patients[patientAddr].registered, "Patient not registered");
        require(quantity > 0, "Invalid quantity");
        require(patients[patientAddr].dispensedStrips[stripId] >= quantity, "Patient did not receive this quantity");

        patients[patientAddr].dispensedStrips[stripId] -= quantity;
        patients[patientAddr].returnedStrips[stripId] += quantity;

        emit StripReturned(patientAddr, stripId, quantity);
    }

    /// @notice Verify if strip is authentic and matches prescription (if provided)
    function verifyStrip(address patientAddr, uint256 stripId, uint256 prescriptionId) external returns (bool, string memory) {
        if (!patients[patientAddr].registered) {
            emit StripVerified(patientAddr, stripId, false, "Patient not registered");
            return (false, "Patient not registered");
        }

        Manufacturer.Strip memory strip = manufacturer.getStrip(stripId);
        if (!strip.exists) {
            emit StripVerified(patientAddr, stripId, false, "Strip not found");
            return (false, "Strip not found");
        }

        Manufacturer.MedicineBatch memory batch = manufacturer.getBatch(strip.batchId);
        if (batch.recalled) {
            emit StripVerified(patientAddr, stripId, false, "Batch is recalled");
            return (false, "Batch is recalled");
        }

        if (block.timestamp > strip.expiryDate) {
            emit StripVerified(patientAddr, stripId, false, "Strip expired");
            return (false, "Strip expired");
        }

        if (patients[patientAddr].dispensedStrips[stripId] == 0) {
            emit StripVerified(patientAddr, stripId, false, "Strip not dispensed to patient");
            return (false, "Strip not dispensed to patient");
        }

        // If prescriptionId is provided, check linkage and basic composition match
        if (prescriptionId != 0) {
            Prescription.PrescriptionData memory pres = prescriptionContract.getPrescription(prescriptionId);
            if (pres.patient != patientAddr || !patients[patientAddr].prescriptionLinked[prescriptionId]) {
                emit StripVerified(patientAddr, stripId, false, "Strip not linked to prescription");
                return (false, "Strip not linked to prescription");
            }
            // Basic composition check (assumes medicineListHash includes composition; full matching off-chain)
            require(bytes(strip.composition).length > 0, "Invalid strip composition");
        }

        emit StripVerified(patientAddr, stripId, true, "Valid strip");
        return (true, "Valid strip");
    }

    // ---------------------------
    // View Helpers
    // ---------------------------
    function getPatientStripHistory(address patientAddr, uint256 stripId) external view returns (uint256) {
        return patients[patientAddr].dispensedStrips[stripId];
    }

    function getPatientReturnHistory(address patientAddr, uint256 stripId) external view returns (uint256) {
        return patients[patientAddr].returnedStrips[stripId];
    }

    function isPatientRegistered(address patientAddr) external view returns (bool) {
        return patients[patientAddr].registered;
    }

    function getPrescriptionLink(address patientAddr, uint256 prescriptionId) external view returns (bool) {
        return patients[patientAddr].prescriptionLinked[prescriptionId];
    }
}