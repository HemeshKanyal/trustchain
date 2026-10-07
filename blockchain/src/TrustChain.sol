// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ITrustChain} from "./interfaces/ITrustChain.sol";

interface IDeviceRegistry {
    function isActiveDevice(address device) external view returns (bool);
}

/// @title TrustChain
/// @notice Medicine custody ledger: permissioned participants, batch custody via two-step shipments,
///         serialised strips verified by QR secret, recalls/quarantine, and prescription-gated dispensing.
/// @dev Strip QR codes carry a random 32-byte secret; only keccak256(secret) is stored on-chain.
///      Dispensing reveals the secret and consumes the strip, so a cloned QR shows as "already dispensed".
contract TrustChain is ITrustChain, Ownable2Step, Pausable {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum Role {
        None,
        Admin,
        Manufacturer,
        Distributor,
        Pharmacy,
        Doctor
    }

    enum BatchStatus {
        Active,
        Quarantined,
        Recalled
    }

    enum StripStatus {
        Unknown,
        Registered,
        Dispensed
    }

    enum Verdict {
        Unknown, // code not registered: likely counterfeit
        Genuine, // registered, not yet dispensed, batch healthy
        AlreadyDispensed, // code already consumed: possible clone if you did not just buy it
        Recalled,
        Quarantined,
        Expired
    }

    struct Participant {
        Role role;
        bool active;
        uint64 registeredAt;
        string name;
        string location;
        string licenseId;
    }

    struct Application {
        Role role;
        uint64 appliedAt;
        string name;
        string location;
        string licenseId;
    }

    struct Batch {
        address manufacturer;
        uint64 manufacturedAt;
        uint64 expiresAt;
        uint32 quantity;
        uint32 stripsRegistered;
        BatchStatus status;
        bool rxOnly;
        StorageConditions conditions;
        bytes32 metadataHash;
        string productName;
        string lotNumber;
    }

    struct Strip {
        uint256 batchId;
        StripStatus status;
        uint64 dispensedAt;
        address dispensedBy;
        address patient;
        uint256 prescriptionId;
    }

    struct Shipment {
        uint256 batchId;
        address from;
        address to;
        uint32 quantity;
        ShipmentStatus status;
        uint64 createdAt;
        uint64 deliveredAt;
        address device;
    }

    struct Prescription {
        address doctor;
        address patient;
        uint64 issuedAt;
        uint64 validUntil;
        uint16 allowance;
        uint16 dispensed;
        bool cancelled;
        bytes32 contentHash;
    }

    struct Verification {
        Verdict verdict;
        uint256 batchId;
        string productName;
        string lotNumber;
        address manufacturer;
        string manufacturerName;
        uint64 manufacturedAt;
        uint64 expiresAt;
        BatchStatus batchStatus;
        StripStatus stripStatus;
        uint64 dispensedAt;
        address dispensedBy;
        string dispensedByName;
    }

    // Quarantine reason flags (shared with ColdChainMonitor).
    uint8 public constant REASON_TEMP_LOW = 1;
    uint8 public constant REASON_TEMP_HIGH = 2;
    uint8 public constant REASON_HUMIDITY = 4;
    uint8 public constant REASON_TAMPER = 8;
    uint8 public constant REASON_MANUAL = 16;

    uint256 public constant MAX_STRIPS_PER_CALL = 200;

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error NotAdmin();
    error NotOwnerForAdminRole();
    error WrongRole(Role required);
    error InactiveParticipant(address account);
    error InvalidRole();
    error AlreadyRegistered(address account);
    error NoApplication(address account);
    error ZeroAddress();
    error InvalidInput();
    error BatchNotFound(uint256 batchId);
    error NotBatchManufacturer();
    error BatchNotActive(uint256 batchId, BatchStatus status);
    error BatchExpired(uint256 batchId);
    error TooManyStrips();
    error StripAlreadyRegistered(bytes32 codeHash);
    error StripNotDispensable(bytes32 codeHash);
    error InsufficientBalance(uint256 batchId, uint256 available, uint256 requested);
    error InvalidRoute(Role from, Role to);
    error ShipmentNotInTransit(uint256 shipmentId);
    error NotShipmentParty();
    error PrescriptionRequired();
    error PrescriptionNotUsable(uint256 prescriptionId);
    error PatientMismatch();
    error NotPrescriber();
    error NotMonitor();
    error AlreadyRecalled(uint256 batchId);
    error DeviceNotRegistered(address device);

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event ParticipantRegistered(address indexed account, Role role, string name, address indexed by);
    event ParticipantStatusChanged(address indexed account, bool active, address indexed by);
    event ParticipantProfileUpdated(address indexed account, string name, string location);
    event RoleApplied(address indexed account, Role role, string name);
    event ApplicationRejected(address indexed account, address indexed by);
    event MonitorUpdated(address indexed monitor);

    event BatchCreated(
        uint256 indexed batchId, address indexed manufacturer, string productName, string lotNumber, uint32 quantity
    );
    event StripsRegistered(uint256 indexed batchId, uint256 count, uint32 totalRegistered);
    event BatchRecalled(uint256 indexed batchId, address indexed by, string reason);
    event BatchQuarantined(uint256 indexed batchId, uint256 indexed shipmentId, uint8 reasonFlags, address by);
    event QuarantineReleased(uint256 indexed batchId, address indexed by, string note);

    event ShipmentCreated(
        uint256 indexed shipmentId,
        uint256 indexed batchId,
        address indexed from,
        address to,
        uint32 quantity,
        address device
    );
    event ShipmentDelivered(uint256 indexed shipmentId, uint256 indexed batchId, address indexed to);
    event ShipmentCancelled(uint256 indexed shipmentId, uint256 indexed batchId, address indexed by);

    event PrescriptionIssued(
        uint256 indexed prescriptionId, address indexed doctor, address indexed patient, uint16 allowance
    );
    event PrescriptionCancelled(uint256 indexed prescriptionId);
    event StripDispensed(
        bytes32 indexed codeHash,
        uint256 indexed batchId,
        address indexed pharmacy,
        address patient,
        uint256 prescriptionId
    );

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    address public monitor;

    mapping(address => Participant) private _participants;
    mapping(address => Application) private _applications;
    address[] private _participantList;
    address[] private _applicantList;

    uint256 public batchCount;
    uint256 public shipmentCount;
    uint256 public prescriptionCount;

    mapping(uint256 => Batch) private _batches;
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(bytes32 => Strip) private _strips;
    mapping(uint256 => Shipment) private _shipments;
    mapping(uint256 => Prescription) private _prescriptions;

    mapping(address => uint256[]) private _batchesByManufacturer;
    mapping(address => uint256[]) private _shipmentsByParty;
    mapping(address => uint256[]) private _prescriptionsByPatient;
    mapping(address => uint256[]) private _prescriptionsByDoctor;

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyAdmin() {
        if (!isAdmin(msg.sender)) revert NotAdmin();
        _;
    }

    modifier onlyActive(Role role) {
        _requireActive(msg.sender, role);
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address initialOwner) Ownable(initialOwner) {
        _participants[initialOwner] = Participant({
            role: Role.Admin,
            active: true,
            registeredAt: uint64(block.timestamp),
            name: "Network Owner",
            location: "",
            licenseId: ""
        });
        _participantList.push(initialOwner);
        emit ParticipantRegistered(initialOwner, Role.Admin, "Network Owner", initialOwner);
    }

    // ------------------------------------------------------------------
    // Governance
    // ------------------------------------------------------------------

    function isAdmin(address account) public view returns (bool) {
        if (account == owner()) return true;
        Participant storage p = _participants[account];
        return p.role == Role.Admin && p.active;
    }

    function setMonitor(address newMonitor) external onlyOwner {
        monitor = newMonitor;
        emit MonitorUpdated(newMonitor);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    // ------------------------------------------------------------------
    // Participants
    // ------------------------------------------------------------------

    /// @notice Directly register a participant. Only the owner may create admins.
    function registerParticipant(
        address account,
        Role role,
        string calldata name,
        string calldata location,
        string calldata licenseId
    ) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        if (role == Role.None) revert InvalidRole();
        if (role == Role.Admin && msg.sender != owner()) revert NotOwnerForAdminRole();
        _register(account, role, name, location, licenseId);
    }

    /// @notice Self-service application for a non-admin role; an admin must approve it.
    function applyForRole(Role role, string calldata name, string calldata location, string calldata licenseId)
        external
    {
        if (role == Role.None || role == Role.Admin) revert InvalidRole();
        if (_participants[msg.sender].role != Role.None) revert AlreadyRegistered(msg.sender);
        if (bytes(name).length == 0) revert InvalidInput();
        if (_applications[msg.sender].role == Role.None) _applicantList.push(msg.sender);
        _applications[msg.sender] = Application({
            role: role, appliedAt: uint64(block.timestamp), name: name, location: location, licenseId: licenseId
        });
        emit RoleApplied(msg.sender, role, name);
    }

    function approveApplication(address account) external onlyAdmin {
        Application memory app = _applications[account];
        if (app.role == Role.None) revert NoApplication(account);
        delete _applications[account];
        _register(account, app.role, app.name, app.location, app.licenseId);
    }

    function rejectApplication(address account) external onlyAdmin {
        if (_applications[account].role == Role.None) revert NoApplication(account);
        delete _applications[account];
        emit ApplicationRejected(account, msg.sender);
    }

    /// @notice Suspend or reinstate a participant. Admins can only be changed by the owner.
    function setParticipantActive(address account, bool active) external onlyAdmin {
        Participant storage p = _participants[account];
        if (p.role == Role.None) revert InvalidRole();
        if (account == owner()) revert InvalidInput();
        if (p.role == Role.Admin && msg.sender != owner()) revert NotOwnerForAdminRole();
        p.active = active;
        emit ParticipantStatusChanged(account, active, msg.sender);
    }

    function updateProfile(string calldata name, string calldata location) external {
        Participant storage p = _participants[msg.sender];
        if (p.role == Role.None) revert InvalidRole();
        if (bytes(name).length == 0) revert InvalidInput();
        p.name = name;
        p.location = location;
        emit ParticipantProfileUpdated(msg.sender, name, location);
    }

    // ------------------------------------------------------------------
    // Batches & strips (manufacturer)
    // ------------------------------------------------------------------

    function createBatch(
        string calldata productName,
        string calldata lotNumber,
        uint32 quantity,
        uint64 expiresAt,
        bool rxOnly,
        StorageConditions calldata conditions,
        bytes32 metadataHash
    ) external whenNotPaused onlyActive(Role.Manufacturer) returns (uint256 batchId) {
        if (quantity == 0 || bytes(productName).length == 0 || expiresAt <= block.timestamp) {
            revert InvalidInput();
        }
        if (conditions.minTempX10 >= conditions.maxTempX10) revert InvalidInput();

        batchId = ++batchCount;
        Batch storage b = _batches[batchId];
        b.manufacturer = msg.sender;
        b.manufacturedAt = uint64(block.timestamp);
        b.expiresAt = expiresAt;
        b.quantity = quantity;
        b.rxOnly = rxOnly;
        b.conditions = conditions;
        b.metadataHash = metadataHash;
        b.productName = productName;
        b.lotNumber = lotNumber;

        _balances[batchId][msg.sender] = quantity;
        _batchesByManufacturer[msg.sender].push(batchId);
        emit BatchCreated(batchId, msg.sender, productName, lotNumber, quantity);
    }

    /// @notice Register strip QR code hashes (keccak256 of each 32-byte secret) for a batch.
    function registerStrips(uint256 batchId, bytes32[] calldata codeHashes)
        external
        whenNotPaused
        onlyActive(Role.Manufacturer)
    {
        Batch storage b = _batch(batchId);
        if (b.manufacturer != msg.sender) revert NotBatchManufacturer();
        if (b.status == BatchStatus.Recalled) revert BatchNotActive(batchId, b.status);
        uint256 n = codeHashes.length;
        if (n == 0 || n > MAX_STRIPS_PER_CALL) revert TooManyStrips();
        if (uint256(b.stripsRegistered) + n > b.quantity) revert TooManyStrips();

        for (uint256 i; i < n; ++i) {
            bytes32 h = codeHashes[i];
            if (h == bytes32(0)) revert InvalidInput();
            Strip storage s = _strips[h];
            if (s.status != StripStatus.Unknown) revert StripAlreadyRegistered(h);
            s.batchId = batchId;
            s.status = StripStatus.Registered;
        }
        b.stripsRegistered += uint32(n);
        emit StripsRegistered(batchId, n, b.stripsRegistered);
    }

    /// @notice Permanently recall a batch. Callable by its manufacturer or an admin.
    function recallBatch(uint256 batchId, string calldata reason) external {
        Batch storage b = _batch(batchId);
        if (!isAdmin(msg.sender)) {
            _requireActive(msg.sender, Role.Manufacturer);
            if (b.manufacturer != msg.sender) revert NotBatchManufacturer();
        }
        if (b.status == BatchStatus.Recalled) revert AlreadyRecalled(batchId);
        b.status = BatchStatus.Recalled;
        emit BatchRecalled(batchId, msg.sender, reason);
    }

    /// @notice Freeze a batch pending review. Called by the cold-chain monitor on a breach, or by an admin.
    function quarantineBatch(uint256 batchId, uint256 shipmentId, uint8 reasonFlags) external {
        if (msg.sender != monitor && !isAdmin(msg.sender)) revert NotMonitor();
        Batch storage b = _batch(batchId);
        if (b.status == BatchStatus.Active) b.status = BatchStatus.Quarantined;
        emit BatchQuarantined(batchId, shipmentId, reasonFlags, msg.sender);
    }

    /// @notice Only an admin (regulator) can clear a quarantine, never the manufacturer itself.
    function releaseQuarantine(uint256 batchId, string calldata note) external onlyAdmin {
        Batch storage b = _batch(batchId);
        if (b.status != BatchStatus.Quarantined) revert BatchNotActive(batchId, b.status);
        b.status = BatchStatus.Active;
        emit QuarantineReleased(batchId, msg.sender, note);
    }

    // ------------------------------------------------------------------
    // Shipments (custody transfer)
    // ------------------------------------------------------------------

    /// @notice Ship `quantity` strips of a batch to `to`. Custody moves only when the recipient confirms.
    /// @param device IoT tracker address assigned to this shipment (address(0) for none).
    function createShipment(uint256 batchId, address to, uint32 quantity, address device)
        external
        whenNotPaused
        returns (uint256 shipmentId)
    {
        Batch storage b = _batch(batchId);
        Participant storage sender = _participants[msg.sender];
        Participant storage recipient = _participants[to];
        if (!sender.active) revert InactiveParticipant(msg.sender);
        if (!recipient.active) revert InactiveParticipant(to);
        if (quantity == 0 || to == msg.sender) revert InvalidInput();

        bool toManufacturer = to == b.manufacturer;
        // Recalled / quarantined / expired stock may only flow back to its manufacturer.
        if (!toManufacturer) {
            if (b.status != BatchStatus.Active) revert BatchNotActive(batchId, b.status);
            if (block.timestamp >= b.expiresAt) revert BatchExpired(batchId);
        }
        _checkRoute(sender.role, recipient.role, toManufacturer);
        if (device != address(0) && (monitor == address(0) || !IDeviceRegistry(monitor).isActiveDevice(device))) {
            revert DeviceNotRegistered(device);
        }

        uint256 bal = _balances[batchId][msg.sender];
        if (bal < quantity) revert InsufficientBalance(batchId, bal, quantity);
        _balances[batchId][msg.sender] = bal - quantity;

        shipmentId = ++shipmentCount;
        _shipments[shipmentId] = Shipment({
            batchId: batchId,
            from: msg.sender,
            to: to,
            quantity: quantity,
            status: ShipmentStatus.InTransit,
            createdAt: uint64(block.timestamp),
            deliveredAt: 0,
            device: device
        });
        _shipmentsByParty[msg.sender].push(shipmentId);
        _shipmentsByParty[to].push(shipmentId);
        emit ShipmentCreated(shipmentId, batchId, msg.sender, to, quantity, device);
    }

    /// @notice Recipient confirms physical receipt. Allowed even if the batch was recalled in transit,
    ///         so custody always matches where the goods physically are.
    function receiveShipment(uint256 shipmentId) external whenNotPaused {
        Shipment storage s = _shipments[shipmentId];
        if (s.status != ShipmentStatus.InTransit) revert ShipmentNotInTransit(shipmentId);
        if (msg.sender != s.to) revert NotShipmentParty();
        if (!_participants[msg.sender].active) revert InactiveParticipant(msg.sender);
        s.status = ShipmentStatus.Delivered;
        s.deliveredAt = uint64(block.timestamp);
        _balances[s.batchId][s.to] += s.quantity;
        emit ShipmentDelivered(shipmentId, s.batchId, s.to);
    }

    /// @notice Sender cancels, or recipient rejects, an in-transit shipment; stock returns to the sender.
    function cancelShipment(uint256 shipmentId) external whenNotPaused {
        Shipment storage s = _shipments[shipmentId];
        if (s.status != ShipmentStatus.InTransit) revert ShipmentNotInTransit(shipmentId);
        if (msg.sender != s.from && msg.sender != s.to) revert NotShipmentParty();
        s.status = ShipmentStatus.Cancelled;
        _balances[s.batchId][s.from] += s.quantity;
        emit ShipmentCancelled(shipmentId, s.batchId, msg.sender);
    }

    // ------------------------------------------------------------------
    // Prescriptions (doctor)
    // ------------------------------------------------------------------

    /// @param contentHash hash of the off-chain prescription document (medicines, dosage).
    /// @param allowance maximum number of strips that may be dispensed against it.
    function issuePrescription(address patient, bytes32 contentHash, uint64 validUntil, uint16 allowance)
        external
        whenNotPaused
        onlyActive(Role.Doctor)
        returns (uint256 prescriptionId)
    {
        if (patient == address(0)) revert ZeroAddress();
        if (allowance == 0 || validUntil <= block.timestamp) revert InvalidInput();
        prescriptionId = ++prescriptionCount;
        _prescriptions[prescriptionId] = Prescription({
            doctor: msg.sender,
            patient: patient,
            issuedAt: uint64(block.timestamp),
            validUntil: validUntil,
            allowance: allowance,
            dispensed: 0,
            cancelled: false,
            contentHash: contentHash
        });
        _prescriptionsByPatient[patient].push(prescriptionId);
        _prescriptionsByDoctor[msg.sender].push(prescriptionId);
        emit PrescriptionIssued(prescriptionId, msg.sender, patient, allowance);
    }

    function cancelPrescription(uint256 prescriptionId) external {
        Prescription storage p = _prescriptions[prescriptionId];
        if (p.doctor != msg.sender) revert NotPrescriber();
        if (p.cancelled) revert PrescriptionNotUsable(prescriptionId);
        p.cancelled = true;
        emit PrescriptionCancelled(prescriptionId);
    }

    function isPrescriptionUsable(uint256 prescriptionId) public view returns (bool) {
        Prescription storage p = _prescriptions[prescriptionId];
        return p.doctor != address(0) && !p.cancelled && block.timestamp <= p.validUntil && p.dispensed < p.allowance
            && _participants[p.doctor].active;
    }

    // ------------------------------------------------------------------
    // Dispensing (pharmacy)
    // ------------------------------------------------------------------

    /// @notice Dispense strips by revealing their QR secrets. Consumes each strip permanently.
    /// @param patient recipient wallet; may be address(0) for anonymous OTC sales.
    /// @param prescriptionId 0 for OTC; required when any strip belongs to an rx-only batch.
    function dispense(bytes32[] calldata secrets, address patient, uint256 prescriptionId)
        external
        whenNotPaused
        onlyActive(Role.Pharmacy)
    {
        uint256 n = secrets.length;
        if (n == 0 || n > MAX_STRIPS_PER_CALL) revert TooManyStrips();

        if (prescriptionId != 0) {
            if (!isPrescriptionUsable(prescriptionId)) revert PrescriptionNotUsable(prescriptionId);
            Prescription storage p = _prescriptions[prescriptionId];
            if (p.patient != patient) revert PatientMismatch();
            if (uint256(p.dispensed) + n > p.allowance) revert PrescriptionNotUsable(prescriptionId);
            p.dispensed += uint16(n);
        }

        for (uint256 i; i < n; ++i) {
            bytes32 codeHash = keccak256(abi.encode(secrets[i]));
            Strip storage s = _strips[codeHash];
            if (s.status != StripStatus.Registered) revert StripNotDispensable(codeHash);

            uint256 batchId = s.batchId;
            Batch storage b = _batches[batchId];
            if (b.status != BatchStatus.Active) revert BatchNotActive(batchId, b.status);
            if (block.timestamp >= b.expiresAt) revert BatchExpired(batchId);
            if (b.rxOnly && prescriptionId == 0) revert PrescriptionRequired();

            uint256 bal = _balances[batchId][msg.sender];
            if (bal == 0) revert InsufficientBalance(batchId, 0, 1);
            _balances[batchId][msg.sender] = bal - 1;

            s.status = StripStatus.Dispensed;
            s.dispensedAt = uint64(block.timestamp);
            s.dispensedBy = msg.sender;
            s.patient = patient;
            s.prescriptionId = prescriptionId;
            emit StripDispensed(codeHash, batchId, msg.sender, patient, prescriptionId);
        }
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Public verification of a strip from its QR code hash. No wallet required.
    function verify(bytes32 codeHash) external view returns (Verification memory v) {
        Strip storage s = _strips[codeHash];
        v.stripStatus = s.status;
        if (s.status == StripStatus.Unknown) return v; // verdict Unknown

        Batch storage b = _batches[s.batchId];
        v.batchId = s.batchId;
        v.productName = b.productName;
        v.lotNumber = b.lotNumber;
        v.manufacturer = b.manufacturer;
        v.manufacturerName = _participants[b.manufacturer].name;
        v.manufacturedAt = b.manufacturedAt;
        v.expiresAt = b.expiresAt;
        v.batchStatus = b.status;
        v.dispensedAt = s.dispensedAt;
        v.dispensedBy = s.dispensedBy;
        if (s.dispensedBy != address(0)) v.dispensedByName = _participants[s.dispensedBy].name;

        if (b.status == BatchStatus.Recalled) v.verdict = Verdict.Recalled;
        else if (b.status == BatchStatus.Quarantined) v.verdict = Verdict.Quarantined;
        else if (block.timestamp >= b.expiresAt) v.verdict = Verdict.Expired;
        else if (s.status == StripStatus.Dispensed) v.verdict = Verdict.AlreadyDispensed;
        else v.verdict = Verdict.Genuine;
    }

    function monitoringInfo(uint256 shipmentId) external view returns (MonitoringInfo memory info) {
        Shipment storage s = _shipments[shipmentId];
        info.batchId = s.batchId;
        info.device = s.device;
        info.status = s.status;
        info.createdAt = s.createdAt;
        info.deliveredAt = s.deliveredAt;
        info.conditions = _batches[s.batchId].conditions;
    }

    function getParticipant(address account) external view returns (Participant memory) {
        return _participants[account];
    }

    function getApplication(address account) external view returns (Application memory) {
        return _applications[account];
    }

    function getParticipants() external view returns (address[] memory) {
        return _participantList;
    }

    /// @dev Includes accounts whose application was since approved or rejected; filter with getApplication.
    function getApplicants() external view returns (address[] memory) {
        return _applicantList;
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    function getStrip(bytes32 codeHash) external view returns (Strip memory) {
        return _strips[codeHash];
    }

    function getShipment(uint256 shipmentId) external view returns (Shipment memory) {
        return _shipments[shipmentId];
    }

    function getPrescription(uint256 prescriptionId) external view returns (Prescription memory) {
        return _prescriptions[prescriptionId];
    }

    function balanceOf(uint256 batchId, address holder) external view returns (uint256) {
        return _balances[batchId][holder];
    }

    function getBatchesByManufacturer(address manufacturer) external view returns (uint256[] memory) {
        return _batchesByManufacturer[manufacturer];
    }

    function getShipmentsOf(address party) external view returns (uint256[] memory) {
        return _shipmentsByParty[party];
    }

    function getPrescriptionsOfPatient(address patient) external view returns (uint256[] memory) {
        return _prescriptionsByPatient[patient];
    }

    function getPrescriptionsOfDoctor(address doctor) external view returns (uint256[] memory) {
        return _prescriptionsByDoctor[doctor];
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _register(address account, Role role, string memory name, string memory location, string memory licenseId)
        internal
    {
        if (_participants[account].role != Role.None) revert AlreadyRegistered(account);
        if (bytes(name).length == 0) revert InvalidInput();
        _participants[account] = Participant({
            role: role,
            active: true,
            registeredAt: uint64(block.timestamp),
            name: name,
            location: location,
            licenseId: licenseId
        });
        _participantList.push(account);
        if (_applications[account].role != Role.None) delete _applications[account];
        emit ParticipantRegistered(account, role, name, msg.sender);
    }

    function _requireActive(address account, Role role) internal view {
        Participant storage p = _participants[account];
        if (p.role != role) revert WrongRole(role);
        if (!p.active) revert InactiveParticipant(account);
    }

    function _batch(uint256 batchId) internal view returns (Batch storage b) {
        b = _batches[batchId];
        if (b.manufacturer == address(0)) revert BatchNotFound(batchId);
    }

    /// Allowed forward routes: Manufacturer → Distributor, Distributor → Distributor | Pharmacy.
    /// Any holder may return stock to the batch's manufacturer; a pharmacy may also return to a distributor.
    function _checkRoute(Role from, Role to, bool toBatchManufacturer) internal pure {
        if (toBatchManufacturer && from != Role.Manufacturer) return;
        if (from == Role.Manufacturer && to == Role.Distributor) return;
        if (from == Role.Distributor && (to == Role.Distributor || to == Role.Pharmacy)) return;
        if (from == Role.Pharmacy && to == Role.Distributor) return;
        revert InvalidRoute(from, to);
    }
}
