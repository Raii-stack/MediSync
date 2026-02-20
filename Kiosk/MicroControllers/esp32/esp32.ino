/*
 * MediSync Kiosk - ESP32 Firmware (Optimized + UART Support)
 * * FEATURES:
 * - Dual I2C Bus (Separate Thermal & Heart Sensor)
 * - Fast-Start Heart Rate Algorithm (Instant BPM)
 * - Synchronized Data Streaming (Temp + BPM locked)
 * - Full JSON Command Support (Dispense, Test, Reset)
 * - Dual Serial Output (USB + UART)
 */

#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
#define ENABLE_RFID true // Keep FALSE (Pin 18/19 Conflict)

#if ENABLE_RFID
#include <SPI.h>
#include <MFRC522.h>
#define RFID_SS_PIN 15 // Changed from 5 (Conflict with UART)
#define RFID_RST_PIN 2 // Changed from 4 (Conflict with UART)
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
#endif

// ==================== PIN MAP ====================
// I2C Buses
#define THERMAL_SDA 21
#define THERMAL_SCL 22
#define HEART_SDA 18
#define HEART_SCL 19

// Output Devices
#define SLOT1_RELAY 33
#define SLOT2_RELAY 32
#define SLOT3_RELAY 25
#define SLOT4_RELAY 26
// GPIO 24 is safe and available (RFID uses 2 for RST, 15 for SS)
#define SLOT5_RELAY 27
#define BUZZER_PIN 15

// LEDs
// Heart RGB uses 12/13/14 (strapping pins). Keep wiring stable and avoid strong pull-ups/downs.
#define HEART_R 17
#define HEART_G 5
#define HEART_B 16
// RFID RGB uses 27/26/16 (safe output pins)
#define RFID_R 12
#define RFID_G 13
#define RFID_B 14

// LED wiring: set true if LEDs are active-low (common anode)
#define LED_ACTIVE_LOW true

// Input
#define EMERGENCY_BTN 34

// UART (Serial2) - Remapped to avoid Relay/LED conflict on 16/17
#define UART_RX 1
#define UART_TX 3

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

enum ScanState
{
  IDLE,
  READING_VITALS
};
ScanState currentState = IDLE;

// Flags & Timers
bool isBlinkingHeartLED = false;
unsigned long lastBlinkTime = 0;
bool blinkLEDState = false;
bool lastEmergencyState = HIGH;
unsigned long lastEmergencyDebounce = 0;
unsigned long lastDispenseTime = 0;

// ==================== SETUP ====================
void setup()
{
  // 1. Comms Init
  Serial.begin(115200);                                // USB Serial
  Serial2.begin(115200, SERIAL_8N1, UART_RX, UART_TX); // Hardware UART

  Serial.println("\n--- MEDISYNC OPTIMIZED FIRMWARE ---");
  Serial.println("System: UART initialized on GPIO 4(RX) & 5(TX)");

  // 2. Hardware Init
  pinMode(SLOT1_RELAY, OUTPUT);
  digitalWrite(SLOT1_RELAY, HIGH);
  pinMode(SLOT2_RELAY, OUTPUT);
  digitalWrite(SLOT2_RELAY, HIGH);
  pinMode(SLOT3_RELAY, OUTPUT);
  digitalWrite(SLOT3_RELAY, HIGH);
  pinMode(SLOT4_RELAY, OUTPUT);
  digitalWrite(SLOT4_RELAY, HIGH);
  pinMode(SLOT5_RELAY, OUTPUT);
  digitalWrite(SLOT5_RELAY, HIGH);

  pinMode(HEART_R, OUTPUT);
  pinMode(HEART_G, OUTPUT);
  pinMode(HEART_B, OUTPUT);
  pinMode(RFID_R, OUTPUT);
  pinMode(RFID_G, OUTPUT);
  pinMode(RFID_B, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(EMERGENCY_BTN, INPUT_PULLUP);

  // 3. Thermal Sensor Init
  I2C_Thermal.begin(THERMAL_SDA, THERMAL_SCL, 100000);
  if (!mlx.begin(0x5A, &I2C_Thermal))
  {
    Serial.println("ERROR: Thermal Sensor Missing");
    playErrorTone();
  }
  else
  {
    Serial.println("OK: Thermal Sensor Ready");
  }

  // 4. Heart Sensor Init
  I2C_Heart.begin(HEART_SDA, HEART_SCL, 400000);
  if (!particleSensor.begin(I2C_Heart, I2C_SPEED_FAST))
  {
    Serial.println("ERROR: Heart Sensor Missing");
    playErrorTone();
  }
  else
  {
    Serial.println("OK: Heart Sensor Ready");
    // Optimized Settings for Fast Detection
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
  }

  // 5. RFID Init
#if ENABLE_RFID
  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_DumpVersionToSerial();
  Serial.println("OK: RFID Reader Ready");
#endif

  // Ready State
  setHeartLed(255, 255, 255); // White (Idle)
  setRfidLed(0, 255, 0);      // Green (Idle)
  playSuccessTone();
}

// ==================== MAIN LOOP ====================
void loop()
{
  checkEmergencyButton();
  checkCommands(); // Checks both USB and UART for instructions

#if ENABLE_RFID
  checkRFID();
#endif

  if (currentState == READING_VITALS)
  {
    readVitalSigns();
  }
  else
  {
    // Idle Maintenance: Keep Sensor FIFO empty
    particleSensor.check();
    while (particleSensor.available())
      particleSensor.nextSample();

    // Blink Logic (External Command)
    if (isBlinkingHeartLED && (millis() - lastBlinkTime >= 500))
    {
      lastBlinkTime = millis();
      blinkLEDState = !blinkLEDState;
      if (blinkLEDState)
        setHeartLed(255, 0, 0);
      else
        setHeartLed(0, 0, 0);
    }
  }
}

// ==================== COMMAND PROCESSING (UART/USB) ====================
void checkCommands()
{
  String input = "";

  // Priority 1: Check USB Serial
  if (Serial.available())
    input = Serial.readStringUntil('\n');
  // Priority 2: Check Hardware UART
  else if (Serial2.available())
    input = Serial2.readStringUntil('\n');

  if (input.length() > 0)
  {
    input.trim();
    if (input.startsWith("{"))
      processJSONCommand(input);
  }
}

void processJSONCommand(String json)
{
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, json);

  if (error)
  {
    Serial.print("JSON Error: ");
    Serial.println(error.c_str());
    return;
  }

  String cmd = doc["command"];

  if (cmd == "start_vitals")
  {
    Serial.println("CMD: Start Vitals");
    currentState = READING_VITALS;
    setHeartLed(255, 0, 0); // Start red
  }
  else if (cmd == "session_start")
  {
    setRfidLed(255, 0, 0); // Red during kiosk session
  }
  else if (cmd == "session_end")
  {
    setRfidLed(0, 255, 0); // Green when idle
  }
  else if (cmd == "dispense")
  {
    int slot = doc["slot"];
    dispense(slot);
  }
  else if (cmd == "blink_heart_led")
  {
    isBlinkingHeartLED = true;
  }
  else if (cmd == "stop_blink_led")
  {
    isBlinkingHeartLED = false;
    setHeartLed(0, 0, 0);
  }
  else if (cmd == "reset")
  {
    currentState = IDLE;
    setRfidLed(0, 255, 0);
    setHeartLed(255, 255, 255);
  }
}

// ==================== OPTIMIZED VITALS ENGINE ====================
void readVitalSigns()
{
  static unsigned long scanStart = 0;
  static unsigned long waitStart = 0;
  static unsigned long fingerRemovedTime = 0;
  static bool fingerDetected = false;
  static bool firstReading = true; // Flag for Fast Start
  static int readingCount = 0;
  static float tempSum = 0;
  static int heartReadings = 0;
  static unsigned long lastStreamTime = 0;
  static bool initialized = false;

  // --- INIT ---
  if (!initialized)
  {
    waitStart = millis();
    scanStart = 0;
    fingerDetected = false;
    fingerRemovedTime = 0;
    readingCount = 0;
    tempSum = 0;
    heartReadings = 0;
    initialized = true;
    firstReading = true;
    beatAvg = 0;
    rateSpot = 0;
    particleSensor.clearFIFO();
    sendJson("status", "waiting_for_finger", 0, 0);
  }

  // --- SENSOR READ ---
  long irValue = particleSensor.getIR();
  if (irValue == 0)
  {
    particleSensor.check();
    while (particleSensor.available())
      irValue = particleSensor.getIR();
  }

  // --- PHASE 1: WAIT ---
  if (!fingerDetected)
  {
    // Amber Blink
    if ((millis() / 500) % 2 == 0)
      setHeartLed(255, 100, 0);
    else
      setHeartLed(0, 0, 0);

    if (irValue > 50000)
    {
      fingerDetected = true;
      scanStart = millis();
      sendJson("vitals_progress", 0, 0, 0.05);
    }
    if (millis() - waitStart > 30000)
    { // Timeout
      finishVitals(false);
      initialized = false;
    }
    return;
  }

  // --- PHASE 2: SCAN ---
  if (irValue < 50000)
  {
    if (fingerRemovedTime == 0)
      fingerRemovedTime = millis();
    if (millis() - fingerRemovedTime > 2000)
    {
      finishVitals(false);
      initialized = false;
    }
    return;
  }
  fingerRemovedTime = 0;

  // Temp Read
  float tempC = mlx.readObjectTempC();
  if (tempC > 20 && tempC < 50)
  {
    tempSum += tempC;
    readingCount++;
  }

  // Heart Rate (FAST START ALGORITHM)
  if (checkForBeat(irValue))
  {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute > 40 && beatsPerMinute < 180)
    {
      // Instant Buffer Fill on First Beat
      if (firstReading)
      {
        for (byte i = 0; i < RATE_SIZE; i++)
          rates[i] = (byte)beatsPerMinute;
        firstReading = false;
      }
      else
      {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;
      }

      // Average
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++)
        beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
      heartReadings++;

      // Visuals
      float prog = min((float)heartReadings / 10.0f, 1.0f);
      int g = 255 * prog;
      int r = 255 * (1.0 - prog);
      setHeartLed(r, g, 0);
    }
  }

  // Sync Stream (1Hz)
  if (millis() - lastStreamTime >= 1000)
  {
    lastStreamTime = millis();
    float curTemp = readingCount > 0 ? tempSum / readingCount : 0;
    float prog = min((float)heartReadings / 10.0f, 1.0f);

    // Only send if we have valid Heart Rate data
    if (beatAvg > 0)
      sendJson("vitals_progress", curTemp, beatAvg, prog);
  }

  // Done (10 valid beats)
  if (heartReadings >= 10)
  {
    float avgTemp = readingCount > 0 ? tempSum / readingCount : 0;
    sendJson("vitals_data", avgTemp, beatAvg, 1.0);
    finishVitals(true);
    initialized = false;
  }
}

void finishVitals(bool success)
{
  if (success)
  {
    setHeartLed(0, 255, 0);
    playCompleteTone();
    delay(1000);
  }
  else
  {
    setHeartLed(255, 0, 0);
    playErrorTone();
    delay(1000);
  }
  setHeartLed(255, 255, 255);
  setRfidLed(0, 255, 0);
  currentState = IDLE;
}

// ==================== DISPENSER LOGIC ====================
void dispense(int slot)
{
  if (millis() - lastDispenseTime < 2000)
    return; // Debounce
  lastDispenseTime = millis();

  int pin = -1;
  if (slot == 1)
    pin = SLOT1_RELAY;
  else if (slot == 2)
    pin = SLOT2_RELAY;
  else if (slot == 3)
    pin = SLOT3_RELAY;
  else if (slot == 4)
    pin = SLOT4_RELAY;
  else if (slot == 5)
    pin = SLOT5_RELAY;

  if (pin != -1)
  {
    Serial.print("Dispensing Slot ");
    Serial.println(slot);
    playDispensingTone();
    digitalWrite(pin, LOW);  // Activate
    delay(2000);             // Dispense duration
    digitalWrite(pin, HIGH); // Deactivate

    StaticJsonDocument<200> doc;
    doc["event"] = "dispense_complete";
    doc["slot"] = slot;
    String out;
    serializeJson(doc, out);
    Serial.println(out);  // To USB
    Serial2.println(out); // To UART
  }
}

// ==================== HELPERS ====================
void writeRgb(int rPin, int gPin, int bPin, int r, int g, int b)
{
  if (LED_ACTIVE_LOW)
  {
    analogWrite(rPin, 255 - r);
    analogWrite(gPin, 255 - g);
    analogWrite(bPin, 255 - b);
    return;
  }
  analogWrite(rPin, r);
  analogWrite(gPin, g);
  analogWrite(bPin, b);
}

void setHeartLed(int r, int g, int b)
{
  writeRgb(HEART_R, HEART_G, HEART_B, r, g, b);
}

void setRfidLed(int r, int g, int b)
{
  writeRgb(RFID_R, RFID_G, RFID_B, r, g, b);
}

void sendJson(String event, String status, int val1, int val2)
{
  StaticJsonDocument<200> doc;
  doc["event"] = event;
  doc["status"] = status;
  String out;
  serializeJson(doc, out);
  Serial.println(out);
  Serial2.println(out);
}

void sendJson(String event, float temp, int hr, float prog)
{
  StaticJsonDocument<200> doc;
  doc["event"] = event;
  doc["temperature"] = ((int)(temp * 10)) / 10.0;
  doc["heartRate"] = hr;
  doc["progress"] = prog;
  String out;
  serializeJson(doc, out);
  Serial.println(out);
  Serial2.println(out);
}

void checkEmergencyButton()
{
  bool state = digitalRead(EMERGENCY_BTN);
  if (state == LOW && lastEmergencyState == HIGH)
  {
    if (millis() - lastEmergencyDebounce > 50)
    {
      playEmergencyTone();
      StaticJsonDocument<200> doc;
      doc["event"] = "emergency";
      String out;
      serializeJson(doc, out);
      Serial.println(out);
      Serial2.println(out);
    }
    lastEmergencyDebounce = millis();
  }
  lastEmergencyState = state;
}

#if ENABLE_RFID
void checkRFID()
{
  static unsigned long lastRfidRead = 0;

  // Prevent reading too frequently (debounce)
  if (millis() - lastRfidRead < 1000)
    return;

  // Look for new cards
  if (!rfid.PICC_IsNewCardPresent())
    return;

  // Attempt to read card
  if (!rfid.PICC_ReadCardSerial())
    return;

  lastRfidRead = millis();

  // Build UID string
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++)
  {
    if (rfid.uid.uidByte[i] < 0x10)
      uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  // Flash RFID LED Blue
  setRfidLed(0, 0, 255);
  tone(BUZZER_PIN, 1500, 100);

  // Send JSON event
  StaticJsonDocument<200> doc;
  doc["event"] = "rfid_scan";
  doc["uid"] = uid;
  String out;
  serializeJson(doc, out);
  Serial.println(out);
  Serial2.println(out);

  // Print to console for debugging
  Serial.print("RFID Card Detected: ");
  Serial.println(uid);

  delay(300);
  setRfidLed(0, 255, 0); // Back to green

  // Halt PICC
  rfid.PICC_HaltA();
  // Stop encryption on PCD
  rfid.PCD_StopCrypto1();
}
#endif

// ==================== TONES ====================
void playSuccessTone()
{
  tone(BUZZER_PIN, 1000, 100);
  delay(120);
  tone(BUZZER_PIN, 1500, 100);
}
void playErrorTone()
{
  tone(BUZZER_PIN, 1500, 150);
  delay(170);
  tone(BUZZER_PIN, 800, 150);
}
void playCompleteTone()
{
  tone(BUZZER_PIN, 1000, 200);
  delay(220);
  tone(BUZZER_PIN, 1500, 200);
}
void playDispensingTone() { tone(BUZZER_PIN, 1200, 300); }
void playEmergencyTone()
{
  tone(BUZZER_PIN, 2000, 100);
  delay(100);
  tone(BUZZER_PIN, 2000, 100);
}