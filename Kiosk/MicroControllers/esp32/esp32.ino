#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ==================== CONFIGURATION ====================
#define ENABLE_RFID true

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

// Output Devices - Medicine Slots
#define SLOT1_RELAY 33
#define SLOT2_RELAY 32
#define SLOT3_RELAY 25
#define SLOT4_RELAY 12

// Relay logic (true = active-low, false = active-high)
#define SLOT1_ACTIVE_LOW true
#define SLOT2_ACTIVE_LOW true
#define SLOT3_ACTIVE_LOW true
#define SLOT4_ACTIVE_LOW true

// Solenoid Door Lock (replaces Slot 5 relay)
#define SOLENOID_PIN 14
#define SOLENOID_ACTIVE_LOW true
#define SOLENOID_UNLOCK_MS 10000

// Buzzer
#define BUZZER_PIN 15

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

enum ScanState
{
  IDLE,
  READING_VITALS,
  TESTING_RFID
};
ScanState currentState = IDLE;

bool rfidDisabled = false;
bool lastEmergencyState = HIGH;
unsigned long lastEmergencyDebounce = 0;
unsigned long lastDispenseTime = 0;

// ==================== SETUP ====================
void setup()
{
  // Boot guard: allow strapping pins to settle before driving relays.
  delay(2000);

  Serial2.begin(115200, SERIAL_8N1, UART_RX, UART_TX);

  // Adding a small delay to let Serial2 settle
  delay(100);
  Serial2.println("\n--- MEDISYNC KIOSK FIRMWARE ---");
  Serial2.println("System: UART initialized on GPIO 3(RX) & 1(TX)");

  // Relays - Medicine Slots
  pinMode(SLOT1_RELAY, OUTPUT);
  setRelay(SLOT1_RELAY, SLOT1_ACTIVE_LOW, false);
  pinMode(SLOT2_RELAY, OUTPUT);
  setRelay(SLOT2_RELAY, SLOT2_ACTIVE_LOW, false);
  pinMode(SLOT3_RELAY, OUTPUT);
  setRelay(SLOT3_RELAY, SLOT3_ACTIVE_LOW, false);
  pinMode(SLOT4_RELAY, OUTPUT);
  setRelay(SLOT4_RELAY, SLOT4_ACTIVE_LOW, false);

  // Solenoid lock - ensure locked on boot
  pinMode(SOLENOID_PIN, OUTPUT);
  setRelay(SOLENOID_PIN, SOLENOID_ACTIVE_LOW, false);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(EMERGENCY_BTN, INPUT_PULLUP);

// RFID Init
#if ENABLE_RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial2.println("OK: RFID/NFC Scanner Ready");
#endif

  // Thermal Sensor Init
  I2C_Thermal.begin(THERMAL_SDA, THERMAL_SCL, 100000);
  if (!mlx.begin(0x5A, &I2C_Thermal))
  {
    Serial2.println("ERROR: Thermal Sensor Missing");
  }
  else
  {
    Serial2.println("OK: Thermal Sensor Ready");
  }

  // Heart Sensor Init
  // NOTE: Pulse amplitude raised to 0x3F (~12.5 mA) for better signal-to-noise ratio.
  // If finger detection feels too sensitive or IR values saturate, lower to 0x1F.
  I2C_Heart.begin(HEART_SDA, HEART_SCL, 400000);
  if (!particleSensor.begin(I2C_Heart, I2C_SPEED_FAST))
  {
    Serial2.println("ERROR: Heart Sensor Missing");
  }
  else
  {
    Serial2.println("OK: Heart Sensor Ready");
    particleSensor.setup(60, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x3F); // Raised from 0x0A for improved accuracy
    particleSensor.setPulseAmplitudeGreen(0);
  }

  playSuccessTone();
}

// ==================== MAIN LOOP ====================
void loop()
{
  checkEmergencyButton();
  checkCommands();

#if ENABLE_RFID
  checkRFID();
#endif

  if (currentState == READING_VITALS)
  {
    readVitalSigns();
  }
  else
  {
    particleSensor.check();
    while (particleSensor.available())
      particleSensor.nextSample();
  }
}

// ==================== RFID SCANNING ENGINE ====================
#if ENABLE_RFID
void checkRFID()
{
  // Disable RFID scanning when session is active (unless in test mode)
  if (rfidDisabled && currentState != TESTING_RFID)
    return;

  if (millis() - lastRfidRead < 1000)
    return;

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial())
    return;

  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++)
  {
    if (rfid.uid.uidByte[i] < 0x10)
      uidString += "0";
    uidString += String(rfid.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  rfid.PICC_HaltA();

  StaticJsonDocument<200> doc;
  // Send different event types based on current state
  if (currentState == TESTING_RFID)
  {
    doc["event"] = "rfid_test"; // Test mode event
  }
  else
  {
    doc["event"] = "rfid_scanned"; // Regular scan event
  }
  doc["uid"] = uidString;
  String out;
  serializeJson(doc, out);

  Serial2.println(out);
  playSuccessTone();
  lastRfidRead = millis();
}
#endif

// ==================== COMMAND PROCESSING ====================
void checkCommands()
{
  String input = "";
  if (Serial2.available())
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
    return;
  String cmd = doc["command"];

  if (cmd == "session_start" || cmd == "start_vitals")
  {
    rfidDisabled = true; // Disable RFID when session starts
    if (cmd == "start_vitals")
    {
      currentState = READING_VITALS;
    }
  }
  else if (cmd == "session_end" || cmd == "reset")
  {
    rfidDisabled = false; // Re-enable RFID when session ends
    currentState = IDLE;
  }
  else if (cmd == "rfid_test_start")
  {
    // Enable RFID test mode - don't change LED state
    currentState = TESTING_RFID;
    Serial2.println("{\"event\":\"rfid_test_mode\",\"status\":\"enabled\"}");
  }
  else if (cmd == "rfid_test_stop")
  {
    // Disable RFID test mode - return to idle
    currentState = IDLE;
    Serial2.println("{\"event\":\"rfid_test_mode\",\"status\":\"disabled\"}");
  }
  else if (cmd == "enable_rfid")
  {
    // Explicitly enable RFID scanning without starting a full session
    rfidDisabled = false;
    Serial2.println("{\"event\":\"rfid_status\",\"status\":\"enabled\"}");
  }
  else if (cmd == "disable_rfid")
  {
    // Explicitly disable RFID scanning without ending a full session
    rfidDisabled = true;
    Serial2.println("{\"event\":\"rfid_status\",\"status\":\"disabled\"}");
  }
  else if (cmd == "dispense")
  {
    dispense(doc["slot"]);
  }
  else if (cmd == "unlock_solenoid")
  {
    unlockSolenoid();
  }
}

// ==================== SOLENOID LOCK ====================
void unlockSolenoid()
{
  Serial2.println("{\"event\":\"solenoid_unlocking\"}");
  setRelay(SOLENOID_PIN, SOLENOID_ACTIVE_LOW, true);  // Unlock (relay ON)
  delay(SOLENOID_UNLOCK_MS);                           // Hold open for 10 seconds
  setRelay(SOLENOID_PIN, SOLENOID_ACTIVE_LOW, false);  // Lock again
  Serial2.println("{\"event\":\"solenoid_locked\"}");
}

// ==================== VITALS ====================
void readVitalSigns()
{
  static unsigned long fingerRemovedTime = 0;
  static bool fingerDetected = false;
  static bool waitingPromptSent = false;
  static bool firstReading = true;
  static int readingCount = 0;
  static float tempSum = 0;
  static int heartReadings = 0;
  static unsigned long lastStreamTime = 0;
  static bool initialized = false;

  if (!initialized)
  {
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
    waitingPromptSent = false;
  }

  long irValue = particleSensor.getIR();
  if (irValue == 0)
  {
    particleSensor.check();
    while (particleSensor.available())
      irValue = particleSensor.getIR();
  }

  if (!fingerDetected)
  {
    if (!waitingPromptSent)
    {
      sendJson("status", "waiting_for_finger", 0, 0);
      waitingPromptSent = true;
    }

    if (irValue > 50000)
    {
      fingerDetected = true;
      sendJson("vitals_progress", 0, 0, 0.05);
    }
    return;
  }

  if (irValue < 50000)
  {
    if (fingerRemovedTime == 0)
      fingerRemovedTime = millis();

    if (millis() - fingerRemovedTime > 2000)
    {
      fingerDetected = false;
      fingerRemovedTime = 0;
      readingCount = 0;
      tempSum = 0;
      heartReadings = 0;
      firstReading = true;
      beatAvg = 0;
      rateSpot = 0;
      lastStreamTime = 0;
      particleSensor.clearFIFO();
      waitingPromptSent = false;
    }
    return;
  }
  fingerRemovedTime = 0;
  waitingPromptSent = false;

  float tempC = mlx.readObjectTempC();
  if (tempC > 20 && tempC < 50)
  {
    tempSum += tempC;
    readingCount++;
  }

  if (checkForBeat(irValue))
  {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute > 40 && beatsPerMinute < 180)
    {
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
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++)
        beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
      heartReadings++;

      float prog = min((float)heartReadings / 5.0f, 1.0f);
      sendJson("vitals_progress", 0, beatAvg, prog);
    }
  }

  if (millis() - lastStreamTime >= 1000)
  {
    lastStreamTime = millis();
    float curTemp = readingCount > 0 ? tempSum / readingCount : 0;
    float prog = min((float)heartReadings / 5.0f, 1.0f);
    if (beatAvg > 0)
      sendJson("vitals_progress", curTemp, beatAvg, prog);
  }

  if (heartReadings >= 5)
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
    playCompleteTone();
  }
  else
  {
    playErrorTone();
  }
  delay(1500);
  currentState = IDLE;
}

// ==================== DISPENSER LOGIC ====================
void dispense(int slot)
{
  if (millis() - lastDispenseTime < 2000)
    return;
  lastDispenseTime = millis();

  int pin = -1;
  bool activeLow = true;
  if (slot == 1)
  {
    pin = SLOT1_RELAY;
    activeLow = SLOT1_ACTIVE_LOW;
  }
  else if (slot == 2)
  {
    pin = SLOT2_RELAY;
    activeLow = SLOT2_ACTIVE_LOW;
  }
  else if (slot == 3)
  {
    pin = SLOT3_RELAY;
    activeLow = SLOT3_ACTIVE_LOW;
  }
  else if (slot == 4)
  {
    pin = SLOT4_RELAY;
    activeLow = SLOT4_ACTIVE_LOW;
  }
  // Slot 5 is reserved for the solenoid lock - not dispensable

  if (pin != -1)
  {
    playDispensingTone();

    setRelay(pin, activeLow, true);
    delay(slot == 4 ? 2500 : 2000);
    setRelay(pin, activeLow, false);

    StaticJsonDocument<200> doc;
    doc["event"] = "dispense_complete";
    doc["slot"] = slot;
    String out;
    serializeJson(doc, out);
    Serial2.println(out);
  }
}

// ==================== HELPERS ====================
void setRelay(int pin, bool activeLow, bool on)
{
  if (activeLow)
  {
    digitalWrite(pin, on ? LOW : HIGH);
  }
  else
  {
    digitalWrite(pin, on ? HIGH : LOW);
  }
}

void sendJson(String event, String status, int val1, int val2)
{
  StaticJsonDocument<200> doc;
  doc["event"] = event;
  doc["status"] = status;
  String out;
  serializeJson(doc, out);
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
      Serial2.println(out);
    }
    lastEmergencyDebounce = millis();
  }
  lastEmergencyState = state;
}

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