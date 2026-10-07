// The simulated network: real Indian cities, fictional organisations, real storage rules.
// Climate figures are approximate October normals (mean °C, day-night swing, mean %RH).

export const CITIES = {
  Baddi: { at: [30.958, 76.791], mean: 22, swing: 8, rh: 55 },
  Ahmedabad: { at: [23.023, 72.571], mean: 29, swing: 7, rh: 50 },
  Hyderabad: { at: [17.385, 78.487], mean: 26, swing: 5, rh: 60 },
  Delhi: { at: [28.614, 77.209], mean: 26, swing: 7, rh: 55 },
  Mumbai: { at: [19.076, 72.878], mean: 29, swing: 4, rh: 75 },
  Kolkata: { at: [22.573, 88.364], mean: 29, swing: 4, rh: 75 },
  Bengaluru: { at: [12.972, 77.595], mean: 24, swing: 5, rh: 65 },
  Chennai: { at: [13.083, 80.271], mean: 29, swing: 4, rh: 75 },
  Jaipur: { at: [26.912, 75.787], mean: 27, swing: 8, rh: 40 },
  Lucknow: { at: [26.847, 80.946], mean: 27, swing: 8, rh: 60 },
  Pune: { at: [18.52, 73.857], mean: 25, swing: 7, rh: 60 },
  Kochi: { at: [9.931, 76.267], mean: 28, swing: 3, rh: 80 },
  Bhopal: { at: [23.26, 77.413], mean: 25, swing: 8, rh: 55 },
  Nagpur: { at: [21.146, 79.088], mean: 27, swing: 7, rh: 55 },
  Guwahati: { at: [26.145, 91.736], mean: 26, swing: 5, rh: 80 },
};

// Storage ranges follow the products' label conditions (°C ×10, %RH ×10). Prices are ₹ per strip.
export const PRODUCTS = [
  { key: "insulin", name: "Insulin Glargine 100IU/ml", cond: { minTempX10: 20, maxTempX10: 80, maxHumidityX10: 0 }, rx: true, price: 46, perDay: 1, weekend: 1, shelfDays: 540 },
  { key: "hepb", name: "Hepatitis B Vaccine 10mcg", cond: { minTempX10: 20, maxTempX10: 80, maxHumidityX10: 0 }, rx: true, price: 120, perDay: 0.4, weekend: 0.7, shelfDays: 720 },
  { key: "amox", name: "Amoxicillin 500mg capsules", cond: { minTempX10: 150, maxTempX10: 250, maxHumidityX10: 650 }, rx: true, price: 65, perDay: 2, weekend: 1.2, shelfDays: 730 },
  { key: "azith", name: "Azithromycin 500mg tablets", cond: { minTempX10: 150, maxTempX10: 300, maxHumidityX10: 750 }, rx: true, price: 191, perDay: 1.5, weekend: 1.2, shelfDays: 730 },
  { key: "metf", name: "Metformin 500mg tablets", cond: { minTempX10: 150, maxTempX10: 300, maxHumidityX10: 750 }, rx: true, price: 30, perDay: 3, weekend: 1, shelfDays: 900 },
  { key: "para", name: "Paracetamol 500mg tablets", cond: { minTempX10: 150, maxTempX10: 300, maxHumidityX10: 800 }, rx: false, price: 75, perDay: 5, weekend: 1.6, shelfDays: 1095 },
  { key: "cetz", name: "Cetirizine 10mg tablets", cond: { minTempX10: 150, maxTempX10: 300, maxHumidityX10: 800 }, rx: false, price: 25, perDay: 3, weekend: 1.5, shelfDays: 1095 },
];
export const productByKey = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]));
export const isCold = (p) => p.cond.maxTempX10 <= 80;

// All names are fictional; every licence starts with SIM- so the site can label them as simulated.
export const ORGS = [
  { id: "m-himgiri", role: 2, name: "Himgiri Pharma", city: "Baddi", makes: ["insulin", "hepb", "para"] },
  { id: "m-sabarmati", role: 2, name: "Sabarmati Lifesciences", city: "Ahmedabad", makes: ["amox", "metf", "cetz"] },
  { id: "m-deccan", role: 2, name: "Deccan Biologics", city: "Hyderabad", makes: ["azith", "insulin"] },
  { id: "d-northstar", role: 3, name: "NorthStar Cold Logistics", city: "Delhi" },
  { id: "d-konkan", role: 3, name: "Konkan Pharma Distributors", city: "Mumbai" },
  { id: "d-hooghly", role: 3, name: "Hooghly MedSupply", city: "Kolkata" },
  { id: "d-nandi", role: 3, name: "Nandi Distributors", city: "Bengaluru" },
  { id: "p-lajpat", role: 4, name: "Apna Chemist Lajpat Nagar", city: "Delhi", dist: "d-northstar" },
  { id: "p-jaipur", role: 4, name: "Pink City Medicos", city: "Jaipur", dist: "d-northstar" },
  { id: "p-lucknow", role: 4, name: "Gomti Health Mart", city: "Lucknow", dist: "d-northstar" },
  { id: "p-andheri", role: 4, name: "Shree Medical Andheri", city: "Mumbai", dist: "d-konkan" },
  { id: "p-pune", role: 4, name: "Pune Life Pharmacy", city: "Pune", dist: "d-konkan" },
  { id: "p-saltlake", role: 4, name: "Salt Lake Care Pharmacy", city: "Kolkata", dist: "d-hooghly" },
  { id: "p-indira", role: 4, name: "Indiranagar Wellness Pharmacy", city: "Bengaluru", dist: "d-nandi" },
  { id: "p-chennai", role: 4, name: "Marina Care Chemist", city: "Chennai", dist: "d-nandi" },
  { id: "doc-mehta", role: 5, name: "Dr. Kavya Mehta", city: "Delhi" },
  { id: "doc-iyer", role: 5, name: "Dr. Arjun Iyer", city: "Chennai" },
  { id: "doc-banerjee", role: 5, name: "Dr. Riya Banerjee", city: "Kolkata" },
  { id: "doc-kulkarni", role: 5, name: "Dr. Sameer Kulkarni", city: "Pune" },
];
export const PATIENTS = 24;
