// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Admin.sol";

/// @title Doctor Registry Contract for TrustChain
/// @notice Manages registration, updates, and verification of doctors.
contract DoctorRegistry is AccessControl {
    Admin public admin;

    // ---------------------------
    // Structs
    // ---------------------------
    struct Doctor {
        address doctor;
        string name;
        string licenseId;
        bool exists;
    }

    // ---------------------------
    // Storage
    // ---------------------------
    mapping(address => Doctor) public doctors;

    // ---------------------------
    // Events
    // ---------------------------
    event DoctorApplied(address indexed doctor, string name, string licenseId);
    event DoctorUpdated(address indexed doctor, string name, string licenseId);
    event DoctorRemoved(address indexed doctor);
    event DoctorVerificationFailed(address indexed doctor, string reason);

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address _admin) {
        admin = Admin(_admin);
    }

    // ---------------------------
    // Functions
    // ---------------------------

    /// @notice Doctor applies for verification
    function applyAsDoctor(string memory _name, string memory _licenseId) external {
        require(!doctors[msg.sender].exists, "Already applied/registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_licenseId).length > 0, "License ID cannot be empty");

        doctors[msg.sender] = Doctor({
            doctor: msg.sender,
            name: _name,
            licenseId: _licenseId,
            exists: true
        });

        emit DoctorApplied(msg.sender, _name, _licenseId);
    }

    /// @notice Doctor updates their details
    function updateDoctorDetails(string memory _name, string memory _licenseId) external {
        require(doctors[msg.sender].exists, "Doctor not registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_licenseId).length > 0, "License ID cannot be empty");

        // Ensure doctor is still approved
        admin.checkApprovedDoctor(msg.sender);
        admin.checkNotBlacklisted(msg.sender);

        doctors[msg.sender].name = _name;
        doctors[msg.sender].licenseId = _licenseId;

        emit DoctorUpdated(msg.sender, _name, _licenseId);
    }

    /// @notice Admin removes a doctor
    function removeDoctor(address doctorAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(doctors[doctorAddr].exists, "Doctor not registered");

        delete doctors[doctorAddr];
        admin.revokeDoctor(doctorAddr); // Call Admin.sol's revokeDoctor to remove role

        emit DoctorRemoved(doctorAddr);
    }

    // ---------------------------
    // View Helpers
    // ---------------------------

    /// @notice Check if doctor is approved
    function isApprovedDoctor(address _doctor) external returns (bool) {
        try admin.checkApprovedDoctor(_doctor) {
            return true;
        } catch {
            emit DoctorVerificationFailed(_doctor, "Not approved or blacklisted");
            return false;
        }
    }

    /// @notice Get doctor details
    function getDoctor(address _doctor) external view returns (Doctor memory) {
        require(doctors[_doctor].exists, "Doctor not found");
        return doctors[_doctor];
    }
}