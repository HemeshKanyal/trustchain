// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TrustChain Admin / Governance Contract
/// @notice Central authority for managing roles, approvals, blacklisting, and recalls.
/// @dev Provides reusable role checks for other contracts in the system.
contract Admin is AccessControl {
    // ---------------------------
    // Roles
    // ---------------------------
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PHARMACY_ROLE     = keccak256("PHARMACY_ROLE");
    bytes32 public constant DOCTOR_ROLE       = keccak256("DOCTOR_ROLE");

    // Track approved status of entities
    mapping(address => bool) public approvedManufacturers;
    mapping(address => bool) public approvedDistributors;
    mapping(address => bool) public approvedPharmacies;
    mapping(address => bool) public approvedDoctors;

    // Track blacklisted addresses
    mapping(address => bool) public blacklisted;

    // ---------------------------
    // Events
    // ---------------------------
    event ManufacturerApproved(address indexed account);
    event DistributorApproved(address indexed account);
    event PharmacyApproved(address indexed account);
    event DoctorApproved(address indexed account);
    event ManufacturerRevoked(address indexed account);
    event DistributorRevoked(address indexed account);
    event PharmacyRevoked(address indexed account);
    event DoctorRevoked(address indexed account);
    event Blacklisted(address indexed account);
    event RemovedFromBlacklist(address indexed account);

    // ---------------------------
    // Constructor
    // ---------------------------
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------
    // Role Approvals
    // ---------------------------
    function approveManufacturer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedManufacturers[account] = true;
        _grantRole(MANUFACTURER_ROLE, account);
        emit ManufacturerApproved(account);
    }

    function approveDistributor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedDistributors[account] = true;
        _grantRole(DISTRIBUTOR_ROLE, account);
        emit DistributorApproved(account);
    }

    function approvePharmacy(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedPharmacies[account] = true;
        _grantRole(PHARMACY_ROLE, account);
        emit PharmacyApproved(account);
    }

    function approveDoctor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedDoctors[account] = true;
        _grantRole(DOCTOR_ROLE, account);
        emit DoctorApproved(account);
    }

    // ---------------------------
    // Role Revocations
    // ---------------------------
    function revokeManufacturer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedManufacturers[account] = false;
        _revokeRole(MANUFACTURER_ROLE, account);
        emit ManufacturerRevoked(account);
    }

    function revokeDistributor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedDistributors[account] = false;
        _revokeRole(DISTRIBUTOR_ROLE, account);
        emit DistributorRevoked(account);
    }

    function revokePharmacy(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedPharmacies[account] = false;
        _revokeRole(PHARMACY_ROLE, account);
        emit PharmacyRevoked(account);
    }

    function revokeDoctor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedDoctors[account] = false;
        _revokeRole(DOCTOR_ROLE, account);
        emit DoctorRevoked(account);
    }

    // ---------------------------
    // Blacklist Management
    // ---------------------------
    function blacklistAddress(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklisted[account] = true;
        emit Blacklisted(account);
    }

    function removeFromBlacklist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklisted[account] = false;
        emit RemovedFromBlacklist(account);
    }

    // ---------------------------
    // Access Check Functions
    // ---------------------------
    function checkApprovedManufacturer(address account) external view {
        require(hasRole(MANUFACTURER_ROLE, account) && approvedManufacturers[account], "Not approved manufacturer");
    }

    function checkApprovedDistributor(address account) external view {
        require(hasRole(DISTRIBUTOR_ROLE, account) && approvedDistributors[account], "Not approved distributor");
    }

    function checkApprovedPharmacy(address account) external view {
        require(hasRole(PHARMACY_ROLE, account) && approvedPharmacies[account], "Not approved pharmacy");
    }

    function checkApprovedDoctor(address account) external view {
        require(hasRole(DOCTOR_ROLE, account) && approvedDoctors[account], "Not approved doctor");
    }

    function checkNotBlacklisted(address account) external view {
        require(!blacklisted[account], "Address is blacklisted");
    }
}