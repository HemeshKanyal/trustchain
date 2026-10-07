#pragma once
// Copy to secrets.h (git-ignored) and fill in.

// ESP32 only supports 2.4 GHz WiFi.
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// TrustChain backend reachable from the ESP32, e.g. your laptop's LAN IP (run `hostname -I`).
#define BACKEND_URL "http://192.168.1.50:4000"
