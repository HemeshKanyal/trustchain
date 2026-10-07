// Approximate city centres, used to place organisations (by their registered location text) on the globe and map.
const CITIES = {
  delhi: [28.6139, 77.209], "new delhi": [28.6139, 77.209], noida: [28.5355, 77.391], gurugram: [28.4595, 77.0266], gurgaon: [28.4595, 77.0266],
  mumbai: [19.076, 72.8777], pune: [18.5204, 73.8567], nagpur: [21.1458, 79.0882], nashik: [19.9975, 73.7898], aurangabad: [19.8762, 75.3433],
  bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946], mysuru: [12.2958, 76.6394], mangaluru: [12.9141, 74.856], hubli: [15.3647, 75.124],
  chennai: [13.0827, 80.2707], coimbatore: [11.0168, 76.9558], madurai: [9.9252, 78.1198],
  kolkata: [22.5726, 88.3639], hyderabad: [17.385, 78.4867], visakhapatnam: [17.6868, 83.2185], vijayawada: [16.5062, 80.648],
  ahmedabad: [23.0225, 72.5714], surat: [21.1702, 72.8311], vadodara: [22.3072, 73.1812], rajkot: [22.3039, 70.8022],
  jaipur: [26.9124, 75.7873], jodhpur: [26.2389, 73.0243], udaipur: [24.5854, 73.7125],
  lucknow: [26.8467, 80.9462], kanpur: [26.4499, 80.3319], varanasi: [25.3176, 82.9739], prayagraj: [25.4358, 81.8463], agra: [27.1767, 78.0081], meerut: [28.9845, 77.7064],
  bhopal: [23.2599, 77.4126], indore: [22.7196, 75.8577], raipur: [21.2514, 81.6296], ranchi: [23.3441, 85.3096], patna: [25.5941, 85.1376],
  bhubaneswar: [20.2961, 85.8245], guwahati: [26.1445, 91.7362], kochi: [9.9312, 76.2673], thiruvananthapuram: [8.5241, 76.9366], goa: [15.2993, 74.124],
  chandigarh: [30.7333, 76.7794], baddi: [30.9578, 76.7914], shimla: [31.1048, 77.1734], dehradun: [30.3165, 78.0322], amritsar: [31.634, 74.8723],
  ludhiana: [30.901, 75.8573], jammu: [32.7266, 74.857], srinagar: [34.0837, 74.7973], hisar: [29.1492, 75.7217],
  london: [51.5074, -0.1278], "new york": [40.7128, -74.006], singapore: [1.3521, 103.8198], dubai: [25.2048, 55.2708], nairobi: [-1.2921, 36.8219], lagos: [6.5244, 3.3792],
};

/** [lat, lon] for a free-text location like "Baddi, HP", or null. */
export function locate(text) {
  const t = String(text ?? "").toLowerCase();
  let best = null;
  for (const [name, ll] of Object.entries(CITIES)) {
    if (t.includes(name) && (!best || name.length > best[0].length)) best = [name, ll];
  }
  return best ? best[1] : null;
}
