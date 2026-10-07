// TrustChain smart-box tracker.
//
// Samples temperature/humidity (DHT22), GPS and the lid switch, logs RFID tag scans, and every window
// signs an EIP-712 Report with its own secp256k1 key. Reports go to the backend, which relays them to
// ColdChainMonitor on-chain. The device key never leaves the ESP32.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <MFRC522.h>
#include <Preferences.h>
#include <SPI.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include <deque>

#include "../pins.h"
#include "eip712_report.h"
#include "eth_signer.h"
#include "telemetry_window.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Copy src/tracker/secrets.example.h to src/tracker/secrets.h and fill in WiFi + backend URL"
#endif

// ------------------------------------------------------------------ state

struct DeviceConfig {
  bool loaded = false;
  uint64_t chainId = 0;
  uint8_t monitor[20] = {0};
  uint64_t shipmentId = 0;  // 0 = not assigned
  uint32_t windowSeconds = 60;
  uint32_t sampleSeconds = 10;
  bool hasConditions = false;
  int16_t minTempX10 = 0, maxTempX10 = 0;
  uint16_t maxHumidityX10 = 0;
};

static MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
static DHT dht(PIN_DHT, DHT22);
static TinyGPSPlus gps;
static TinyGPSCustom gpsInView(gps, "GPGSV", 3);
static HardwareSerial gpsSerial(2);
static Preferences prefs;

static EthKey key;
static char addrHex[43];  // 0x + 40
static DeviceConfig cfg;
static TelemetryWindow window;
static std::deque<String> outbox;
static constexpr size_t OUTBOX_MAX = 24;

static uint64_t seq = 0;
static int64_t serverTimeOffset = 0;  // fallback clock if NTP is unreachable
static bool lidOpenLatched = false;
static bool alarmLatched = false;
static uint32_t lastSampleMs = 0, lastConfigMs = 0, lastSendMs = 0;
static bool configEverTried = false;

// ------------------------------------------------------------------ helpers

static uint32_t nowUnix() {
  time_t t = time(nullptr);
  if (t > 1700000000) return (uint32_t)t;
  if (serverTimeOffset) return (uint32_t)(serverTimeOffset + millis() / 1000);
  return 0;
}

static bool httpCall(const char *method, const String &url, const String &body, int &code, String &resp) {
  HTTPClient http;
  WiFiClient plain;
  WiFiClientSecure tls;
  bool ok;
  if (url.startsWith("https://")) {
    // Report integrity comes from the device signature, not TLS, so certificate pinning is optional here.
    tls.setInsecure();
    ok = http.begin(tls, url);
  } else {
    ok = http.begin(plain, url);
  }
  if (!ok) return false;
  http.setTimeout(8000);
  if (body.length()) http.addHeader("Content-Type", "application/json");
  code = http.sendRequest(method, body);
  if (code > 0) resp = http.getString();
  http.end();
  return code > 0;
}

static void loadOrCreateKey() {
  prefs.begin("trustchain", false);
  bool ok = false;
  if (prefs.getBytesLength("priv") == 32) {
    prefs.getBytes("priv", key.priv, 32);
    ok = ethsig::deriveKey(key);
  }
  if (!ok) {
    Serial.println("[KEY] generating new device key");
    ok = ethsig::generateKey(key);
    if (ok) prefs.putBytes("priv", key.priv, 32);
  }
  if (!ok) {
    Serial.println("[KEY] FATAL: key generation failed");
    while (true) delay(1000);
  }
  seq = prefs.getULong64("seq", 0);
  addrHex[0] = '0';
  addrHex[1] = 'x';
  toHex(key.address, 20, addrHex + 2);
}

static void printBanner() {
  Serial.println();
  Serial.println("==================================================");
  Serial.println(" TrustChain smart-box tracker");
  Serial.printf(" Device address: %s\n", addrHex);
  Serial.println(" Register this address in ColdChainMonitor (admin),");
  Serial.println(" then assign it to a shipment.");
  Serial.println("==================================================");
}

// ------------------------------------------------------------------ backend

static void fetchConfig() {
  lastConfigMs = millis();
  configEverTried = true;
  int code;
  String resp;
  String url = String(BACKEND_URL) + "/api/devices/" + addrHex + "/config";
  if (!httpCall("GET", url, "", code, resp) || code != 200) {
    Serial.printf("[CFG] backend unreachable (%d) at %s\n", code, BACKEND_URL);
    return;
  }
  JsonDocument doc;
  if (deserializeJson(doc, resp)) {
    Serial.println("[CFG] bad JSON");
    return;
  }
  if (doc["serverTime"].is<uint32_t>()) serverTimeOffset = (int64_t)doc["serverTime"].as<uint32_t>() - millis() / 1000;

  DeviceConfig next;
  next.loaded = true;
  next.chainId = doc["chainId"].as<uint64_t>();
  if (!fromHex(doc["monitor"] | "", next.monitor, 20)) {
    Serial.println("[CFG] invalid monitor address");
    return;
  }
  next.shipmentId = doc["shipmentId"].isNull() ? 0 : doc["shipmentId"].as<uint64_t>();
  next.windowSeconds = constrain(doc["windowSeconds"] | 60, 20, 3600);
  next.sampleSeconds = constrain(doc["sampleSeconds"] | 10, 3, 300);
  if (!doc["conditions"].isNull()) {
    next.hasConditions = true;
    next.minTempX10 = doc["conditions"]["minTempX10"];
    next.maxTempX10 = doc["conditions"]["maxTempX10"];
    next.maxHumidityX10 = doc["conditions"]["maxHumidityX10"];
  }
  if (!doc["registered"].as<bool>()) {
    Serial.printf("[CFG] device %s is NOT registered on-chain yet\n", addrHex);
  }

  if (next.shipmentId != cfg.shipmentId) {
    Serial.printf("[CFG] shipment %llu -> %llu\n", cfg.shipmentId, next.shipmentId);
    // Start a fresh window for the new assignment; readings taken while packing do not count.
    window.reset(nowUnix());
    lidOpenLatched = false;
    alarmLatched = false;
  }
  cfg = next;
}

static void closeWindow(uint32_t now) {
  if (window.sampleCount() == 0) {
    window.reset(now);
    return;
  }
  TelemetryReport r;
  window.summarize(now, r);
  r.shipmentId = cfg.shipmentId;
  r.seq = ++seq;
  prefs.putULong64("seq", seq);

  uint8_t domain[32], digest[32], sig[65];
  eip712::domainSeparator(cfg.chainId, cfg.monitor, domain);
  eip712::reportDigest(domain, r, digest);
  if (!ethsig::sign(key, digest, sig)) {
    Serial.println("[SIGN] failed");
    window.reset(now);
    return;
  }

  char hex[131];
  JsonDocument doc;
  doc["device"] = addrHex;
  JsonObject rep = doc["report"].to<JsonObject>();
  rep["shipmentId"] = r.shipmentId;
  rep["windowStart"] = r.windowStart;
  rep["windowEnd"] = r.windowEnd;
  rep["readings"] = r.readings;
  rep["minTempX10"] = r.minTempX10;
  rep["maxTempX10"] = r.maxTempX10;
  rep["maxHumidityX10"] = r.maxHumidityX10;
  rep["latE6"] = r.latE6;
  rep["lonE6"] = r.lonE6;
  rep["tamper"] = r.tamper;
  toHex(r.dataHash, 32, hex);
  rep["dataHash"] = String("0x") + hex;
  rep["seq"] = r.seq;
  toHex(sig, 65, hex);
  doc["signature"] = String("0x") + hex;

  JsonArray samples = doc["samples"].to<JsonArray>();
  for (size_t i = 0; i < window.sampleCount(); i++) {
    const Sample &s = window.sample(i);
    JsonArray a = samples.add<JsonArray>();
    a.add(s.t);
    a.add(s.tempX10);
    a.add(s.humX10);
    a.add(s.latE6);
    a.add(s.lonE6);
    a.add(s.flags);
  }
  JsonArray tags = doc["rfid"].to<JsonArray>();
  for (size_t i = 0; i < window.rfidCount(); i++) {
    const RfidEvent &e = window.rfid(i);
    JsonArray a = tags.add<JsonArray>();
    a.add(e.t);
    toHex(e.uid, e.uidLen, hex);
    a.add(String(hex));
  }

  String body;
  serializeJson(doc, body);
  if (outbox.size() >= OUTBOX_MAX) {
    outbox.pop_front();
    Serial.println("[OUTBOX] full, dropped oldest report");
  }
  outbox.push_back(body);
  Serial.printf("[REPORT] seq=%llu shipment=%llu n=%u temp=%.1f..%.1fC hum<=%.1f%% tamper=%d queued=%u\n", r.seq,
                r.shipmentId, r.readings, r.minTempX10 / 10.0, r.maxTempX10 / 10.0, r.maxHumidityX10 / 10.0,
                r.tamper, (unsigned)outbox.size());
  window.reset(now);
}

static void trySend() {
  lastSendMs = millis();
  if (outbox.empty() || WiFi.status() != WL_CONNECTED) return;
  int code;
  String resp;
  if (!httpCall("POST", String(BACKEND_URL) + "/api/telemetry", outbox.front(), code, resp)) {
    Serial.println("[SEND] backend unreachable, will retry");
    return;
  }
  if (code >= 200 && code < 300) {
    outbox.pop_front();
    Serial.printf("[SEND] accepted (%d) %s\n", code, resp.c_str());
  } else if (code >= 400 && code < 500) {
    outbox.pop_front();  // permanently rejected; retrying cannot help
    Serial.printf("[SEND] rejected (%d) %s\n", code, resp.c_str());
  } else {
    Serial.printf("[SEND] server error (%d), will retry\n", code);
  }
}

// ------------------------------------------------------------------ sensors

static void takeSample() {
  lastSampleMs = millis();
  uint32_t now = nowUnix();
  if (!now) return;  // no clock yet

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Sample s;
  s.t = now;
  s.tempX10 = isnan(t) ? TEMP_INVALID : (int16_t)lroundf(t * 10);
  s.humX10 = isnan(h) ? HUM_INVALID : (uint16_t)lroundf(h * 10);
  s.flags = 0;
  s.latE6 = 0;
  s.lonE6 = 0;
  if (gps.location.isValid() && gps.location.age() < 10000) {
    s.latE6 = (int32_t)lround(gps.location.lat() * 1e6);
    s.lonE6 = (int32_t)lround(gps.location.lng() * 1e6);
    s.flags |= FLAG_GPS_FIX;
  }
  if (lidOpenLatched || digitalRead(PIN_TAMPER) == HIGH) s.flags |= FLAG_LID_OPEN;
  lidOpenLatched = false;

  if (cfg.shipmentId) {
    if (!window.addSample(s)) closeWindow(now), window.addSample(s);
    bool breach = (s.flags & FLAG_LID_OPEN) || s.tempX10 == TEMP_INVALID;
    if (cfg.hasConditions && s.tempX10 != TEMP_INVALID)
      breach |= s.tempX10 < cfg.minTempX10 || s.tempX10 > cfg.maxTempX10;
    if (cfg.hasConditions && cfg.maxHumidityX10 && s.humX10 != HUM_INVALID) breach |= s.humX10 > cfg.maxHumidityX10;
    if (breach) alarmLatched = true;
  }

  char gpsInfo[48];
  if (s.flags & FLAG_GPS_FIX)
    snprintf(gpsInfo, sizeof gpsInfo, "%.5f,%.5f(sats=%u)", s.latE6 / 1e6, s.lonE6 / 1e6, gps.satellites.value());
  else
    snprintf(gpsInfo, sizeof gpsInfo, "no-fix(inView=%s)", gpsInView.isValid() ? gpsInView.value() : "0");
  Serial.printf("[SAMPLE] %s  %s  gps=%s  lid=%s  %s\n",
                s.tempX10 == TEMP_INVALID ? "temp=ERR" : String("temp=" + String(s.tempX10 / 10.0, 1) + "C").c_str(),
                s.humX10 == HUM_INVALID ? "hum=ERR" : String("hum=" + String(s.humX10 / 10.0, 1) + "%").c_str(),
                gpsInfo,
                (s.flags & FLAG_LID_OPEN) ? "OPEN" : "closed",
                cfg.shipmentId ? String("shipment #" + String((unsigned long)cfg.shipmentId)).c_str() : "idle");
}

static void pollRfid() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  RfidEvent e;
  e.t = nowUnix();
  e.uidLen = min<uint8_t>(rfid.uid.size, 10);
  memcpy(e.uid, rfid.uid.uidByte, e.uidLen);
  rfid.PICC_HaltA();
  char hex[21];
  toHex(e.uid, e.uidLen, hex);
  Serial.printf("[RFID] tag %s\n", hex);
  if (cfg.shipmentId && e.t) window.addRfid(e);
}

static void updateLed() {
  uint32_t ms = millis();
  bool on;
  if (alarmLatched) on = true;                                        // solid: breach seen this shipment
  else if (WiFi.status() != WL_CONNECTED) on = (ms / 100) % 2;        // fast blink: no WiFi
  else if (!cfg.shipmentId) on = (ms / 1000) % 2;                     // slow blink: idle
  else on = (ms % 2000) < 100;                                        // short blip: monitoring
  digitalWrite(PIN_LED, on);
}

static void handleSerial() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd == "addr") {
    Serial.printf("Device address: %s\n", addrHex);
  } else if (cmd == "status") {
    Serial.printf("wifi=%s ip=%s time=%lu shipment=%llu seq=%llu window=%u samples outbox=%u\n",
                  WiFi.status() == WL_CONNECTED ? "up" : "down", WiFi.localIP().toString().c_str(),
                  (unsigned long)nowUnix(), cfg.shipmentId, seq, (unsigned)window.sampleCount(),
                  (unsigned)outbox.size());
  } else if (cmd == "config") {
    fetchConfig();
  } else if (cmd.length()) {
    Serial.println("commands: addr | status | config");
  }
}

// ------------------------------------------------------------------ main

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_TAMPER, INPUT_PULLUP);

  WiFi.mode(WIFI_STA);  // RF on first: the hardware RNG is only fully random with WiFi/BT running
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  loadOrCreateKey();
  printBanner();

  SPI.begin();
  rfid.PCD_Init();
  dht.begin();
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  if (digitalRead(PIN_TAMPER) == HIGH) lidOpenLatched = true;
  pollRfid();
  handleSerial();

  static bool wasConnected = false;
  bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wasConnected) Serial.printf("[WIFI] connected, ip=%s\n", WiFi.localIP().toString().c_str());
  if (!connected && wasConnected) Serial.println("[WIFI] disconnected");
  wasConnected = connected;

  if (connected && (!configEverTried || millis() - lastConfigMs > 30000)) fetchConfig();
  if (millis() - lastSampleMs >= cfg.sampleSeconds * 1000UL) takeSample();

  uint32_t now = nowUnix();
  if (cfg.shipmentId && now && window.start() == 0) window.reset(now);
  if (cfg.shipmentId && now && now - window.start() >= cfg.windowSeconds) closeWindow(now);
  if (!outbox.empty() && millis() - lastSendMs > 3000) trySend();

  updateLed();
  delay(5);
}
