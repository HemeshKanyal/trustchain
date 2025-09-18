// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Admin.sol";

/// @title Prescription Contract for TrustChain
/// @notice Handles creation, storage, and cancellation of patient prescriptions.
contract Prescription {
    Admin public admin;

    // ---------------------------
    // Structs
    // ---------------------------
    struct PrescriptionData {
        uint256 id;
        address doctor;
        address patient;
        string medicineListHash; // Hash of medicine list (e.g., IPFS hash for off-chain data)
        bool withDoctor;
        uint256 createdAt;
        bool cancelled; // New: Track if prescription is cancelled
    }

    // ---------------------------
    // Storage
    // ---------------------------
    uint256 public nextPrescriptionId;
    mapping(uint256 => PrescriptionData) public prescriptions;
    mapping(address => uint256[]) public patientPrescriptions; // New: Track prescriptions per patient
    uint256 public constant PRESCRIPTION_VALIDITY = 30 days; // New: Prescription expiration period

    // ---------------------------
    // Events
    // ---------------------------
    event PrescriptionCreated(
        uint256 indexed prescriptionId,
        address indexed doctor,
        address indexed patient,
        string medicineListHash,
        bool withDoctor,
        uint256 createdAt
    );
    event PrescriptionCancelled(uint256 indexed prescriptionId, address indexed caller);

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address _admin) {
        admin = Admin(_admin);
        nextPrescriptionId = 1;
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Doctor creates prescription for patient
    function createPrescription(address patient, string memory medicineListHash)
        external
        returns (uint256)
    {
        admin.checkApprovedDoctor(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        require(patient != address(0), "Invalid patient address");
        require(bytes(medicineListHash).length > 0, "Invalid medicine list hash");

        uint256 prescriptionId = nextPrescriptionId++;
        prescriptions[prescriptionId] = PrescriptionData({
            id: prescriptionId,
            doctor: msg.sender,
            patient: patient,
            medicineListHash: medicineListHash,
            withDoctor: true,
            createdAt: block.timestamp,
            cancelled: false
        });

        patientPrescriptions[patient].push(prescriptionId);

        emit PrescriptionCreated(prescriptionId, msg.sender, patient, medicineListHash, true, block.timestamp);

        return prescriptionId;
    }

    /// @notice Patient creates self-prescription
    function createSelfPrescription(string memory medicineListHash)
        external
        returns (uint256)
    {
        require(bytes(medicineListHash).length > 0, "Invalid medicine list hash");

        uint256 prescriptionId = nextPrescriptionId++;
        prescriptions[prescriptionId] = PrescriptionData({
            id: prescriptionId,
            doctor: address(0),
            patient: msg.sender,
            medicineListHash: medicineListHash,
            withDoctor: false,
            createdAt: block.timestamp,
            cancelled: false
        });

        patientPrescriptions[msg.sender].push(prescriptionId);

        emit PrescriptionCreated(prescriptionId, address(0), msg.sender, medicineListHash, false, block.timestamp);

        return prescriptionId;
    }

    /// @notice Cancel a prescription (by doctor or patient)
    function cancelPrescription(uint256 prescriptionId) external {
        PrescriptionData storage pres = prescriptions[prescriptionId];
        require(pres.id != 0, "Prescription not found");
        require(!pres.cancelled, "Prescription already cancelled");
        require(
            pres.doctor == msg.sender || pres.patient == msg.sender,
            "Only doctor or patient can cancel"
        );

        if (pres.withDoctor) {
            admin.checkApprovedDoctor(msg.sender);
            admin.checkNotBlacklisted(msg.sender);
        }

        pres.cancelled = true;
        emit PrescriptionCancelled(prescriptionId, msg.sender);
    }

    // ---------------------------
    // View Helpers
    // ---------------------------

    /// @notice Fetch prescription details
    function getPrescription(uint256 prescriptionId)
        external
        view
        returns (PrescriptionData memory)
    {
        require(prescriptions[prescriptionId].id != 0, "Prescription not found");
        return prescriptions[prescriptionId];
    }

    /// @notice Check if prescription is valid (not expired or cancelled)
    function isPrescriptionValid(uint256 prescriptionId) external view returns (bool) {
        PrescriptionData memory pres = prescriptions[prescriptionId];
        if (pres.id == 0) return false;
        if (pres.cancelled) return false;
        if (block.timestamp > pres.createdAt + PRESCRIPTION_VALIDITY) return false;
        return true;
    }

    /// @notice Get all prescriptions for a patient
    function getPatientPrescriptions(address patient) external view returns (uint256[] memory) {
        return patientPrescriptions[patient];
    }
}