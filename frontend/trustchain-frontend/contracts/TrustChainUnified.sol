// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TrustChainUnified {
    
    // --- ERRORS (Reduces Size) ---
    error Unauthorized();
    error UnauthorizedRole(Role required);
    error AlreadyRegistered();
    error InvalidBatch();
    error TransitNotActive();
    error InvalidStrip();
    error BatchMismatch();
    error InsufficientStock();
    error PrescriptionUsed();
    error PrescriptionInvalid();

    // --- TYPES ---
    enum Role { None, Admin, Manufacturer, Distributor, Pharmacy, Doctor, Patient }

    struct User {
        string name;
        Role role;
        address wallet;
        bool isRegistered;
        string location;
    }

    struct Batch {
        uint256 id;
        string name;
        uint256 quantity;
        uint256 manufactureDate;
        uint256 expiryDate;
        address manufacturer;
        string batchHash;
        bool recalled;
        address currentHandler;
    }

    struct Strip {
        uint256 id;
        uint256 batchId;
        string composition;
        uint256 expiryDate;
        string stripHash;
        address currentHandler;
        bool isSold;
        bool isUsed;
    }

    struct Transit {
        uint256 id;
        uint256 batchId;
        address distributor;
        address recipient;
        uint256 startTime;
        uint256 endTime;
        bool inTransit;
        bool isCompleted;
    }

    struct Checkpoint {
        uint256 transitId;
        string location;
        string metadata;
        uint256 timestamp;
    }

    struct Prescription {
        uint256 id;
        address patient;
        address doctor;
        string medicineListHash;
        uint256 createdAt;
        bool dispensed;
        bool cancelled;
    }

    struct DoctorProfile {
        string name;
        string license;
        bool isApproved;
        address wallet;
    }

    struct IoTLog {
        uint256 transitId;
        int256 temperature;
        int256 humidity;
        uint256 timestamp;
    }

    // --- STATE ---
    address public owner;
    mapping(address => User) public users;
    mapping(address => DoctorProfile) public doctors;
    
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => Strip) public strips;
    
    mapping(uint256 => Transit) public transits;
    mapping(uint256 => Checkpoint[]) public transitCheckpoints;
    mapping(uint256 => IoTLog[]) public iotLogs; 

    mapping(address => mapping(uint256 => uint256)) public pharmacyStock; 
    mapping(uint256 => Prescription) public prescriptions;

    uint256 public batchCount;
    uint256 public stripCount;
    uint256 public transitCount;
    uint256 public prescriptionCount;

    // --- EVENTS ---
    event UserRegistered(address indexed wallet, string name, Role role);
    event BatchCreated(uint256 indexed id, string name, address indexed manufacturer);
    event StripAdded(uint256 indexed id, uint256 indexed batchId, string composition);
    event BatchRecalled(uint256 indexed id);
    event BatchUpdated(uint256 indexed id);
    event TransitStarted(uint256 indexed id, uint256 batchId, address from, address to);
    event CheckpointRecorded(uint256 indexed transitId, string location);
    event TransitCompleted(uint256 indexed id);
    event StockReceived(uint256 batchId, uint256 stripId, uint256 qty);
    event MedicineDispensed(uint256 stripId, uint256 qty, address to);
    event MedicineReturned(uint256 stripId, uint256 qty, string reason);
    event PrescriptionCreated(uint256 indexed id, address indexed patient, address indexed doctor);
    event PrescriptionCancelled(uint256 indexed id);
    event IoTDataLogged(uint256 indexed transitId, int256 temperature, int256 humidity);

    // --- MODIFIERS ---
    function _checkRole(Role _role) internal view {
        if (_role == Role.Admin) {
            if (msg.sender != owner && users[msg.sender].role != Role.Admin) revert Unauthorized();
        } else {
            if (users[msg.sender].role != _role) revert UnauthorizedRole(_role);
        }
    }
    modifier onlyAdmin() { _checkRole(Role.Admin); _; }
    modifier onlyManufacturer() { _checkRole(Role.Manufacturer); _; }
    modifier onlyDistributor() { _checkRole(Role.Distributor); _; }
    modifier onlyPharmacy() { _checkRole(Role.Pharmacy); _; }
    modifier onlyDoctor() { _checkRole(Role.Doctor); _; }
    modifier onlyPatient() { _checkRole(Role.Patient); _; }

    // --- CONSTRUCTOR ---
    constructor() {
        owner = msg.sender;
        users[msg.sender] = User({
            name: "Genesis Admin",
            role: Role.Admin,
            wallet: msg.sender,
            isRegistered: true,
            location: "System Root"
        });
        emit UserRegistered(msg.sender, "Genesis Admin", Role.Admin);
    }

    // --- ADMIN ---
    function registerUser(address _wallet, string memory _name, Role _role, string memory _location) public onlyAdmin {
        if (users[_wallet].isRegistered) revert AlreadyRegistered();
        users[_wallet] = User({ name: _name, role: _role, wallet: _wallet, isRegistered: true, location: _location });
        emit UserRegistered(_wallet, _name, _role);
    }

    function revokeUser(address _wallet) public onlyAdmin {
        users[_wallet].isRegistered = false;
        users[_wallet].role = Role.None;
        emit UserRegistered(_wallet, "", Role.None); 
    }

    // --- MANUFACTURER ---
    function createBatch(string memory _name, uint256 _quantity, uint256 _expiry, string memory _hash) public onlyManufacturer {
        batchCount++;
        batches[batchCount] = Batch({
            id: batchCount, name: _name, quantity: _quantity, manufactureDate: block.timestamp,
            expiryDate: _expiry, manufacturer: msg.sender, batchHash: _hash, recalled: false, currentHandler: msg.sender
        });
        emit BatchCreated(batchCount, _name, msg.sender);
    }

    function addStrip(uint256 _batchId, string memory _hash, string memory _composition, uint256 _expiry) public onlyManufacturer {
        if (batches[_batchId].manufacturer != msg.sender) revert Unauthorized();
        stripCount++;
        strips[stripCount] = Strip({
            id: stripCount, batchId: _batchId, composition: _composition, expiryDate: _expiry,
            stripHash: _hash, currentHandler: msg.sender, isSold: false, isUsed: false
        });
        emit StripAdded(stripCount, _batchId, _composition);
    }

    function recallBatch(uint256 _batchId) public onlyManufacturer {
        if (batches[_batchId].manufacturer != msg.sender) revert Unauthorized();
        batches[_batchId].recalled = true;
        emit BatchRecalled(_batchId);
    }

    function updateBatch(uint256 _batchId, string memory _name, uint256 _expiry) public onlyManufacturer {
         if (batches[_batchId].manufacturer != msg.sender) revert Unauthorized();
         batches[_batchId].name = _name;
         batches[_batchId].expiryDate = _expiry;
         emit BatchUpdated(_batchId);
    }

    function getBatch(uint256 _id) public view returns (string memory name, uint256 quantity, uint256 expiryDate, address manufacturer, bool recalled) {
        Batch memory b = batches[_id];
        return (b.name, b.quantity, b.expiryDate, b.manufacturer, b.recalled);
    }

    function getStrip(uint256 _id) public view returns (string memory composition, uint256 batchId, uint256 expiryDate, string memory stripHash) {
        Strip memory s = strips[_id];
        return (s.composition, s.batchId, s.expiryDate, s.stripHash);
    }

    // --- DISTRIBUTOR ---
    function receiveFromManufacturer(uint256 _batchId) public onlyDistributor {
        if (batches[_batchId].id == 0) revert InvalidBatch();
        batches[_batchId].currentHandler = msg.sender;
    }

    function startTransit(uint256 _batchId, address _recipient) public onlyDistributor {
        if (batches[_batchId].currentHandler != msg.sender) revert Unauthorized();
        transitCount++;
        transits[transitCount] = Transit({
            id: transitCount, batchId: _batchId, distributor: msg.sender, recipient: _recipient,
            startTime: block.timestamp, endTime: 0, inTransit: true, isCompleted: false
        });
        emit TransitStarted(transitCount, _batchId, msg.sender, _recipient);
    }

    function recordCheckpoint(uint256 _transitId, string memory _location, string memory _metadata) public onlyDistributor {
        if (transits[_transitId].distributor != msg.sender) revert Unauthorized();
        if (!transits[_transitId].inTransit) revert TransitNotActive();
        transitCheckpoints[_transitId].push(Checkpoint({
            transitId: _transitId, location: _location, metadata: _metadata, timestamp: block.timestamp
        }));
        emit CheckpointRecorded(_transitId, _location);
    }

    function completeTransit(uint256 _transitId) public onlyDistributor {
        if (transits[_transitId].distributor != msg.sender) revert Unauthorized();
        transits[_transitId].inTransit = false;
        transits[_transitId].isCompleted = true;
        transits[_transitId].endTime = block.timestamp;
        batches[transits[_transitId].batchId].currentHandler = transits[_transitId].recipient;
        emit TransitCompleted(_transitId);
    }

    function getTransit(uint256 _id) public view returns (uint256 batchId, address distributor, address recipient, uint256 startTime, uint256 endTime, bool inTransit) {
        Transit memory t = transits[_id];
        return (t.batchId, t.distributor, t.recipient, t.startTime, t.endTime, t.inTransit);
    }

    function getCheckpointCount(uint256 _transitId) public view returns (uint256) {
        return transitCheckpoints[_transitId].length;
    }

    // --- PATIENT REGISTRATION ---
    function registerPatient(string memory _name, uint256 _age) public {
        if (users[msg.sender].isRegistered) revert AlreadyRegistered();
        users[msg.sender] = User({
            name: _name,
            role: Role.Patient,
            wallet: msg.sender,
            isRegistered: true,
            location: "Registered Patient"
        });
        emit UserRegistered(msg.sender, _name, Role.Patient);
    }

    // --- PHARMACY ---
    function receiveFromDistributor(uint256 _batchId, uint256 _stripId, uint256 _quantity) public onlyPharmacy {
         if (strips[_stripId].id == 0) revert InvalidStrip();
         if (strips[_stripId].batchId != _batchId) revert BatchMismatch();
         if (batches[_batchId].id == 0) revert InvalidBatch();
         
         pharmacyStock[msg.sender][_stripId] += _quantity;
         emit StockReceived(_batchId, _stripId, _quantity);
    }

    function dispenseStrip(uint256 _prescriptionId, uint256 _stripId, uint256 _quantity) public onlyPharmacy {
        if (pharmacyStock[msg.sender][_stripId] < _quantity) revert InsufficientStock();
        if (prescriptions[_prescriptionId].dispensed) revert PrescriptionUsed();
        pharmacyStock[msg.sender][_stripId] -= _quantity;
        prescriptions[_prescriptionId].dispensed = true;
        emit MedicineDispensed(_stripId, _quantity, prescriptions[_prescriptionId].patient);
    }

    function dispenseWithoutPrescription(address _patient, uint256 _stripId, uint256 _quantity) public onlyPharmacy {
        if (pharmacyStock[msg.sender][_stripId] < _quantity) revert InsufficientStock();
        pharmacyStock[msg.sender][_stripId] -= _quantity;
        emit MedicineDispensed(_stripId, _quantity, _patient);
    }

    function returnMedicine(uint256 _stripId, uint256 _quantity) public onlyPharmacy {
        pharmacyStock[msg.sender][_stripId] += _quantity;
        emit MedicineReturned(_stripId, _quantity, "Ret:Pt");
    }

    function returnStock(uint256 _stripId, uint256 _quantity) public onlyPharmacy {
        if (pharmacyStock[msg.sender][_stripId] < _quantity) revert InsufficientStock();
        pharmacyStock[msg.sender][_stripId] -= _quantity;
        emit MedicineReturned(_stripId, _quantity, "Ret:Dist");
    }

    function getStock(address _pharmacy, uint256 _stripId) public view returns (uint256 availableQuantity, uint256 returnedQuantity, uint256 batchId, uint256 stripId) {
        return (pharmacyStock[_pharmacy][_stripId], 0, strips[_stripId].batchId, _stripId);
    }

    // --- DOCTOR ---
    function applyAsDoctor(string memory _name, string memory _license) public {
        doctors[msg.sender] = DoctorProfile({ name: _name, license: _license, isApproved: true, wallet: msg.sender });
        users[msg.sender] = User({ name: _name, role: Role.Doctor, wallet: msg.sender, isRegistered: true, location: "Registry" });
    }

    function updateDoctorDetails(string memory _name, string memory _license) public onlyDoctor {
        doctors[msg.sender].name = _name;
        doctors[msg.sender].license = _license;
    }

    function getDoctor(address _doctor) public view returns (string memory name, string memory license, bool isApproved) {
        DoctorProfile memory d = doctors[_doctor];
        return (d.name, d.license, d.isApproved);
    }

    function isApprovedDoctor(address _doctor) public view returns (bool) {
        return doctors[_doctor].isApproved;
    }

    function createPrescription(address _patient, string memory _medsHash) public onlyDoctor {
        prescriptionCount++;
        prescriptions[prescriptionCount] = Prescription({
            id: prescriptionCount, patient: _patient, doctor: msg.sender, medicineListHash: _medsHash,
            createdAt: block.timestamp, dispensed: false, cancelled: false
        });
        emit PrescriptionCreated(prescriptionCount, _patient, msg.sender);
    }

    function cancelPrescription(uint256 _id) public onlyDoctor {
        if (prescriptions[_id].doctor != msg.sender) revert Unauthorized();
        prescriptions[_id].cancelled = true;
        emit PrescriptionCancelled(_id);
    }

    function getPrescription(uint256 _id) public view returns (address patient, address doctor, string memory medicineListHash, uint256 createdAt, bool dispensed, bool cancelled) {
        Prescription memory p = prescriptions[_id];
        return (p.patient, p.doctor, p.medicineListHash, p.createdAt, p.dispensed, p.cancelled);
    }

    function isPrescriptionValid(uint256 _id) public view returns (bool) {
        Prescription memory p = prescriptions[_id];
        return (p.id != 0 && !p.cancelled && !p.dispensed);
    }

    // --- PATIENT ---
    function verifyStrip(uint256 _stripId) public view returns (address manufacturer, uint256 expiryDate, bool isSold) {
        Strip memory s = strips[_stripId];
        Batch memory b = batches[s.batchId];
        return (b.manufacturer, s.expiryDate, s.isSold);
    }

    // --- IOT ---
    function logData(uint256 _transitId, int256 _temperature, int256 _humidity, uint256 _timestamp) public {
        iotLogs[_transitId].push(IoTLog({ transitId: _transitId, temperature: _temperature, humidity: _humidity, timestamp: _timestamp }));
        emit IoTDataLogged(_transitId, _temperature, _humidity);
    }

    function getLogs(uint256 _transitId) public view returns (IoTLog[] memory) {
        return iotLogs[_transitId];
    }
}
