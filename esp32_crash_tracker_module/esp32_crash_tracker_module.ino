#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>
#include <TinyGSM.h>


Adafruit_MPU6050 mpu;
TinyGPSPlus gps;

// GSM/LTE modem
HardwareSerial SerialAT(2); // RX=4, TX=5 for Air780E
TinyGsm modem(SerialAT);
TinyGsmClient client(modem);

// ----- CONFIG -----
const char* WIFI_SSID = "Alcayde's WiFi";
const char* WIFI_PASS = "c@rlL3mu3l";
// change to your machine IP or server domain (use http://ip:3000)
const char* SERVER_URL = "http://192.168.100.12:3000/tracker/update";
const char* REGISTER_URL = "http://192.168.100.12:3000/devices/register";
const char* SMS_NUMBER = "+639518519515"; // Replace with actual emergency number
const char* USER_EMAIL = "coolclayde05@gmail.com"; // Hardcoded for demo

// Generate unique deviceId from WiFi MAC
String deviceId = "";
String deviceName = "ESP32 Crash Tracker";

HardwareSerial GPSSerial(1); // RX=16, TX=17
#define CANCEL_PIN 15

// thresholds
const float G_THRESHOLD = 3.0;      // g
const float GYRO_THRESHOLD = 200.0; // deg/s
const unsigned long CANCEL_MS = 15000;
const float HDOP_THRESHOLD = 2.0;   // HDOP threshold for accurate GPS

bool crashPending = false;
unsigned long crashStart = 0;

bool isLocationAccurate() {
  return gps.location.isValid() && gps.hdop.hdop() < HDOP_THRESHOLD;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(CANCEL_PIN, INPUT_PULLUP);

  // Use fixed device ID for consistency
  deviceId = "esp32-crash-tracker-01";

  // MPU6050 init (I2C default pins)
  Wire.begin(21,22);
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found!");
    while (1) delay(10);
  }
  Serial.println("MPU6050 OK");

  // GPS
  GPSSerial.begin(9600, SERIAL_8N1, 16, 17);

  // LTE modem init
  SerialAT.begin(115200, SERIAL_8N1, 4, 5); // RX=4, TX=5 for Air780E
  delay(3000);
  Serial.println("Initializing modem...");
  if (!modem.restart()) {
    Serial.println("Modem restart failed");
  } else {
    Serial.println("Modem OK");
  }

  // WiFi
  Serial.printf("Connecting to WiFi %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
    Serial.print(".");
    delay(500);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    // Register device
    registerDevice();
  } else {
    Serial.println("\nWiFi not connected (will attempt when sending).");
  }
}

void loop() {
  // read GPS stream
  while (GPSSerial.available()) gps.encode((char)GPSSerial.read());

  // read MPU6050
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float mag = sqrt(a.acceleration.x*a.acceleration.x +
                   a.acceleration.y*a.acceleration.y +
                   a.acceleration.z*a.acceleration.z);
  float gForce = mag / 9.81f;
  float gyroMag = sqrt(g.gyro.x*g.gyro.x + g.gyro.y*g.gyro.y + g.gyro.z*g.gyro.z);

  Serial.printf("G=%.2f g | gyro=%.1f\n", gForce, gyroMag);

  // GPS debugging
  Serial.printf("GPS: valid=%d, satellites=%d", gps.location.isValid(), gps.satellites.value());
  if (gps.location.isValid()) {
    Serial.printf(", lat=%.6f, lng=%.6f, hdop=%.2f", gps.location.lat(), gps.location.lng(), gps.hdop.hdop());
  }

  // detect impact
  if (!crashPending && (gForce >= G_THRESHOLD || gyroMag >= GYRO_THRESHOLD)) {
    crashPending = true;
    crashStart = millis();
    Serial.println("Potential crash detected — 15s cancel window started");
  }

  // cancel button (held to ground)
  if (crashPending && digitalRead(CANCEL_PIN) == LOW) {
    crashPending = false;
    Serial.println("Crash canceled by user");
  }

  // if cancel window expired and still pending -> send
  if (crashPending && (millis() - crashStart) >= CANCEL_MS) {
    Serial.println("Crash confirmed — sending alert");
    sendAlert(gForce, gyroMag);
    crashPending = false;
  }

  // Send periodic update every 5 seconds
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate > 5000) {
    sendPeriodicUpdate(gForce, gyroMag);
    lastUpdate = millis();
  }

  delay(50);
}

void sendPeriodicUpdate(float gF, float gyroVal) {
  double lat = isLocationAccurate() ? gps.location.lat() : 11.5;
  double lng = isLocationAccurate() ? gps.location.lng() : 124.5;

  String payload = "{";
  payload += "\"lat\":" + String(lat, 6) + ",";
  payload += "\"lng\":" + String(lng, 6) + ",";
  payload += "\"gforce\":" + String(gF, 2) + ",";
  payload += "\"gyro\":" + String(gyroVal, 1) + ",";
  payload += "\"deviceId\":\"" + deviceId + "\"";
  payload += "}";

  bool dataSent = false;

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(payload);
    Serial.printf("Periodic update WiFi HTTP POST code: %d\n", code);
    http.end();
    if (code == 200) {
      dataSent = true;
    }
  }

  if (!dataSent) {
    Serial.println("WiFi not connected or failed — trying LTE for periodic update");
    // Try LTE HTTP POST
    if (modem.isNetworkConnected()) {
      if (client.connect("192.168.100.12", 3000)) {
        client.print(String("POST ") + "/tracker/update" + " HTTP/1.1\r\n");
        client.print(String("Host: ") + "192.168.100.12" + "\r\n");
        client.print("Content-Type: application/json\r\n");
        client.print(String("Content-Length: ") + payload.length() + "\r\n");
        client.print("Connection: close\r\n\r\n");
        client.print(payload);
        client.print("\r\n\r\n");

        // Read response
        String response = "";
        unsigned long timeout = millis();
        while (millis() - timeout < 10000) {
          while (client.available()) {
            response += (char)client.read();
          }
          if (response.indexOf("200 OK") > 0) {
            Serial.println("LTE periodic update HTTP POST successful");
            dataSent = true;
            break;
          }
        }
        client.stop();
      } else {
        Serial.println("LTE periodic update HTTP connection failed");
      }
    } else {
      Serial.println("LTE network not connected for periodic update");
    }
  }
}

void sendAlert(float gF, float gyroVal) {
  double lat = isLocationAccurate() ? gps.location.lat() : 11.5;
  double lng = isLocationAccurate() ? gps.location.lng() : 124.5;

  String payload = "{";
  payload += "\"lat\":" + String(lat, 6) + ",";
  payload += "\"lng\":" + String(lng, 6) + ",";
  payload += "\"gforce\":" + String(gF, 2) + ",";
  payload += "\"gyro\":" + String(gyroVal, 1) + ",";
  payload += "\"deviceId\":\"" + deviceId + "\"";
  payload += "}";

  bool dataSent = false;

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(payload);
    Serial.printf("WiFi HTTP POST code: %d\n", code);
    http.end();
    if (code == 200) {
      dataSent = true;
    }
  }

  if (!dataSent) {
    Serial.println("WiFi not connected or failed — trying LTE HTTP");
    // Try LTE HTTP POST
    if (modem.isNetworkConnected()) {
      if (client.connect("192.168.100.12", 3000)) {
        client.print(String("POST ") + "/tracker/update" + " HTTP/1.1\r\n");
        client.print(String("Host: ") + "192.168.100.12" + "\r\n");
        client.print("Content-Type: application/json\r\n");
        client.print(String("Content-Length: ") + payload.length() + "\r\n");
        client.print("Connection: close\r\n\r\n");
        client.print(payload);
        client.print("\r\n\r\n");

        // Read response
        String response = "";
        unsigned long timeout = millis();
        while (millis() - timeout < 10000) {
          while (client.available()) {
            response += (char)client.read();
          }
          if (response.indexOf("200 OK") > 0) {
            Serial.println("LTE HTTP POST successful");
            dataSent = true;
            break;
          }
        }
        client.stop();
      } else {
        Serial.println("LTE HTTP connection failed");
      }
    } else {
      Serial.println("LTE network not connected");
    }
  }

  // Send SMS alert regardless
  sendSMSAlert(lat, lng, gF, gyroVal);
}

void registerDevice() {
  String payload = "{";
  payload += "\"deviceId\":\"" + deviceId + "\",";
  payload += "\"deviceName\":\"" + deviceName + "\"";
  payload += "}";

  HTTPClient http;
  http.begin(REGISTER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("user-email", USER_EMAIL);
  int code = http.POST(payload);
  Serial.printf("Device registration code: %d\n", code);
  http.end();
}

void sendSMSAlert(double lat, double lng, float gF, float gyroVal) {
  String message = "Crash Alert! Lat: " + String(lat, 6) + ", Lng: " + String(lng, 6) + ", G-Force: " + String(gF, 2) + ", Gyro: " + String(gyroVal, 1);

  Serial.println("Sending SMS...");
  bool sent = modem.sendSMS(SMS_NUMBER, message);
  if (sent) {
    Serial.println("SMS sent successfully");
  } else {
    Serial.println("SMS send failed");
  }
}
