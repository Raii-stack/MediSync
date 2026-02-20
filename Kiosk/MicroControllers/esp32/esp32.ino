/*
 * MediSync Kiosk - ESP32 Firmware (Dual LEDs + RFID + UART on 1/3)
 */

#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ==================== CONFIGURATION ====================
#define ENABLE_RFID true 
#define LED_ACTIVE_LOW false 

// ==================== PIN MAP ====================
// I2C Buses
#define THERMAL_SDA 21
#define THERMAL_SCL 22
#define HEART_SDA 4   
#define HEART_SCL 13  

// SPI & RFID
#define RFID_SS_PIN 5 
#define RFID_RST_PIN UINT8_MAX 
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
unsigned long lastRfidRead = 0;

// Output Devices
#define SLOT1_RELAY 33
#define SLOT2_RELAY 32
#define SLOT3_RELAY 25
#define SLOT4_RELAY 26
#define SLOT5_RELAY 27
#define BUZZER_PIN 15

// RFID Status LED 
#define RFID_R 12
#define RFID_G 14

// Heartbeat Progress LED 
#define HEART_R 2
#define HEART_G 0

// Input
#define EMERGENCY_BTN 16

// UART (Serial2) - Remapped to 1 and 3
#define UART_RX 3
#define UART_TX 1

// ==================== GLOBAL OBJECTS ====================
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
MAX30105 particleSensor;
TwoWire I2C_Thermal = TwoWire(0);
TwoWire I2C_Heart = TwoWire(1);

// ==================== VARIABLES ====================
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

enum ScanState { IDLE, READING_VITALS };
ScanState currentState = IDLE;

bool lastEmergencyState = HIGH;
unsigned long lastEmergencyDebounce = 0;
unsigned long lastDispenseTime = 0;

// ==================== SETUP ====================
void setup() {
  // We initialize Serial2 on pins 3 (RX) and 1 (TX).
  // Note: This overrides the default USB Serial debug output on these pins.
  Serial2.begin(115200, SERIAL_8N1, UART_RX, UART_TX); 

  // Adding a small delay to let Serial2 settle
  delay(100);
  Serial2.println("\n--- MEDISYNC KIOSK FIRMWARE ---");
  Serial2.println("System: UART initialized on GPIO 3(RX) & 1(TX)");

  // Relays
  pinMode(SLOT1_RELAY, OUTPUT); digitalWrite(SLOT1_RELAY, HIGH);
  pinMode(SLOT2_RELAY, OUTPUT); digitalWrite(SLOT2_RELAY, HIGH);
  pinMode(SLOT3_RELAY, OUTPUT); digitalWrite(SLOT3_RELAY, HIGH);
  pinMode(SLOT4_RELAY, OUTPUT); digitalWrite(SLOT4_RELAY, HIGH);
  pinMode(SLOT5_RELAY, OUTPUT); digitalWrite(SLOT5_RELAY, HIGH);

  // Dual LEDs
  pinMode(RFID_R, OUTPUT);
  pinMode(RFID_G, OUTPUT);
  pinMode(HEART_R, OUTPUT);
  pinMode(HEART_G, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  pinMode(EMERGENCY_BTN, INPUT_PULLUP);

  // RFID Init
  #if ENABLE_RFID
    SPI.begin(); 
    rfid.PCD_Init();
    Serial2.println("OK: RFID/NFC Scanner Ready");
  #endif

  // Thermal Sensor Init
  I2C_Thermal.begin(THERMAL_SDA, THERMAL_SCL, 100000);
  if (!mlx.begin(0x5A, &I2C_Thermal)) {
    Serial2.println("ERROR: Thermal Sensor Missing");
  } else {
    Serial2.println("OK: Thermal Sensor Ready");
  }

  // Heart Sensor Init
  I2C_Heart.begin(HEART_SDA, HEART_SCL, 400000);
  if (!particleSensor.begin(I2C_Heart, I2C_SPEED_FAST)) {
    Serial2.println("ERROR: Heart Sensor Missing");
  } else {
    Serial2.println("OK: Heart Sensor Ready");
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
  }

  setRfidLed(0, 255); 
  setHeartLed(0, 0); 
  playSuccessTone();
}

// ==================== MAIN LOOP ====================
void loop() {
  checkEmergencyButton();
  checkCommands(); 

  #if ENABLE_RFID
    checkRFID();
  #endif

  if (currentState == READING_VITALS) {
    readVitalSigns();
  } else {
    particleSensor.check();
    while (particleSensor.available()) particleSensor.nextSample();
  }
}

// ==================== RFID SCANNING ENGINE ====================
#if ENABLE_RFID
void checkRFID() {
  if (millis() - lastRfidRead < 1000) return; 

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
    uidString += String(rfid.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  rfid.PICC_HaltA(); 

  StaticJsonDocument<200> doc;
  doc["event"] = "rfid_scanned";
  doc["uid"] = uidString;
  String out; serializeJson(doc, out);
  
  Serial2.println(out);
  playSuccessTone(); 
  lastRfidRead = millis();
}
#endif

// ==================== COMMAND PROCESSING ====================
void checkCommands() {
  String input = "";
  if (Serial2.available()) input = Serial2.readStringUntil('\n');

  if (input.length() > 0) {
    input.trim();
    if (input.startsWith("{")) processJSONCommand(input);
  }
}

void processJSONCommand(String json) {
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, json);

  if (error) return;
  String cmd = doc["command"];

  if (cmd == "session_start" || cmd == "start_vitals") {
    setRfidLed(255, 0); 
    if (cmd == "start_vitals") {
        currentState = READING_VITALS;
        setHeartLed(255, 0); 
    }
  } else if (cmd == "session_end" || cmd == "reset") {
    setRfidLed(0, 255); 
    setHeartLed(0, 0);  
    currentState = IDLE;
  } else if (cmd == "dispense") {
    dispense(doc["slot"]);
  }
}

// ==================== VITALS & PROGRESS LED ====================
void readVitalSigns() {
  static unsigned long waitStart = 0;
  static unsigned long fingerRemovedTime = 0;
  static bool fingerDetected = false;
  static bool firstReading = true;
  static int readingCount = 0;
  static float tempSum = 0;
  static int heartReadings = 0;
  static unsigned long lastStreamTime = 0;
  static bool initialized = false;

  if (!initialized) {
    waitStart = millis(); fingerDetected = false; fingerRemovedTime = 0;
    readingCount = 0; tempSum = 0; heartReadings = 0; initialized = true;
    firstReading = true; beatAvg = 0; rateSpot = 0;
    particleSensor.clearFIFO();
    sendJson("status", "waiting_for_finger", 0, 0);
  }

  long irValue = particleSensor.getIR();
  if (irValue == 0) {
    particleSensor.check();
    while (particleSensor.available()) irValue = particleSensor.getIR();
  }

  if (!fingerDetected) {
    if ((millis() / 500) % 2 == 0) setHeartLed(255, 0); 
    else setHeartLed(0, 0);

    if (irValue > 50000) {
      fingerDetected = true;
      sendJson("vitals_progress", 0, 0, 0.05);
    }
    if (millis() - waitStart > 30000) { finishVitals(false); initialized = false; }
    return;
  }

  if (irValue < 50000) {
    if (fingerRemovedTime == 0) fingerRemovedTime = millis();
    if (millis() - fingerRemovedTime > 2000) { finishVitals(false); initialized = false; }
    return;
  }
  fingerRemovedTime = 0;

  float tempC = mlx.readObjectTempC();
  if (tempC > 20 && tempC < 50) { tempSum += tempC; readingCount++; }

  if (checkForBeat(irValue)) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute > 40 && beatsPerMinute < 180) {
      if (firstReading) {
        for (byte i = 0; i < RATE_SIZE; i++) rates[i] = (byte)beatsPerMinute;
        firstReading = false;
      } else {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;
      }
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
      heartReadings++;

      float prog = min((float)heartReadings / 10.0f, 1.0f);
      int rProg = 255 * (1.0 - prog);
      int gProg = 255 * prog;
      setHeartLed(rProg, gProg);
    }
  }

  if (millis() - lastStreamTime >= 1000) {
    lastStreamTime = millis();
    float curTemp = readingCount > 0 ? tempSum / readingCount : 0;
    float prog = min((float)heartReadings / 10.0f, 1.0f);
    if (beatAvg > 0) sendJson("vitals_progress", curTemp, beatAvg, prog);
  }

  if (heartReadings >= 10) {
    float avgTemp = readingCount > 0 ? tempSum / readingCount : 0;
    sendJson("vitals_data", avgTemp, beatAvg, 1.0);
    finishVitals(true);
    initialized = false;
  }
}

void finishVitals(bool success) {
  if (success) {
    setHeartLed(0, 255); 
    playCompleteTone();
  } else {
    setHeartLed(255, 0); 
    playErrorTone();
  }
  delay(1500);
  setHeartLed(0, 0); 
  currentState = IDLE;
}

// ==================== DISPENSER LOGIC ====================
void dispense(int slot) {
  if (millis() - lastDispenseTime < 2000) return; 
  lastDispenseTime = millis();

  int pin = -1;
  if (slot == 1) pin = SLOT1_RELAY; else if (slot == 2) pin = SLOT2_RELAY;
  else if (slot == 3) pin = SLOT3_RELAY; else if (slot == 4) pin = SLOT4_RELAY;
  else if (slot == 5) pin = SLOT5_RELAY;

  if (pin != -1) {
    playDispensingTone();
    digitalWrite(pin, LOW);  delay(2000); digitalWrite(pin, HIGH); 

    StaticJsonDocument<200> doc;
    doc["event"] = "dispense_complete";
    doc["slot"] = slot;
    String out; serializeJson(doc, out);
    Serial2.println(out);
  }
}

// ==================== HELPERS ====================
void setColor(int rPin, int gPin, int r, int g) {
  if (LED_ACTIVE_LOW) {
    analogWrite(rPin, 255 - r); analogWrite(gPin, 255 - g);
    return;
  }
  analogWrite(rPin, r); analogWrite(gPin, g);
}

void setRfidLed(int r, int g) { setColor(RFID_R, RFID_G, r, g); }
void setHeartLed(int r, int g) { setColor(HEART_R, HEART_G, r, g); }

void sendJson(String event, String status, int val1, int val2) {
  StaticJsonDocument<200> doc; doc["event"] = event; doc["status"] = status;
  String out; serializeJson(doc, out); Serial2.println(out);
}
void sendJson(String event, float temp, int hr, float prog) {
  StaticJsonDocument<200> doc; doc["event"] = event;
  doc["temperature"] = ((int)(temp * 10)) / 10.0; doc["heartRate"] = hr; doc["progress"] = prog;
  String out; serializeJson(doc, out); Serial2.println(out);
}
void checkEmergencyButton() {
  bool state = digitalRead(EMERGENCY_BTN);
  if (state == LOW && lastEmergencyState == HIGH) {
    if (millis() - lastEmergencyDebounce > 50) {
      playEmergencyTone();
      StaticJsonDocument<200> doc; doc["event"] = "emergency";
      String out; serializeJson(doc, out); Serial2.println(out);
    }
    lastEmergencyDebounce = millis();
  }
  lastEmergencyState = state;
}

// ==================== TONES ====================
void playSuccessTone() { tone(BUZZER_PIN, 1000, 100); delay(120); tone(BUZZER_PIN, 1500, 100); }
void playErrorTone() { tone(BUZZER_PIN, 1500, 150); delay(170); tone(BUZZER_PIN, 800, 150); }
void playCompleteTone() { tone(BUZZER_PIN, 1000, 200); delay(220); tone(BUZZER_PIN, 1500, 200); }
void playDispensingTone() { tone(BUZZER_PIN, 1200, 300); }
void playEmergencyTone() { tone(BUZZER_PIN, 2000, 100); delay(100); tone(BUZZER_PIN, 2000, 100); }