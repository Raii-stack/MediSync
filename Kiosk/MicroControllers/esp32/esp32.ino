#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ==================== CONFIGURATION ====================
#define ENABLE_RFID true

// ==================== PIN MAP ====================
// I2C Buses
#define THERMAL_SDA 21
#define THERMAL_SCL 22

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
TwoWire I2C_Thermal = TwoWire(0);

// ==================== VARIABLES ====================


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

// Emergency alarm state (non-blocking)
bool emergencyLocked = false;          // disables physical button while modal is open
bool emergencyAlarmActive = false;     // alarm buzzer currently running
unsigned long emergencyAlarmStart = 0; // millis() when alarm started

// ==================== SETUP ====================
void setup()
{
  delay(2000);

  Serial2.begin(115200, SERIAL_8N1, UART_RX, UART_TX);

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



  playSuccessTone();
}

// ==================== MAIN LOOP ====================
void loop()
{
  checkEmergencyButton();
  checkCommands();
  updateEmergencyAlarm(); // non-blocking alarm ticker

#if ENABLE_RFID
  checkRFID();
#endif

  if (currentState == READING_VITALS)
  {
    readVitalSigns();
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
  else if (cmd == "emergency_lock")
  {
    // Lock the physical button (no alarm yet)
    emergencyLocked = true;
    Serial2.println("{\"event\":\"emergency_locked\"}");
  }
  else if (cmd == "emergency_sound_alarm")
  {
    // Start 10-second alarm (button should already be locked)
    emergencyLocked = true;
    emergencyAlarmActive = true;
    emergencyAlarmStart = millis();
    Serial2.println("{\"event\":\"emergency_alarm_started\"}");
  }
  else if (cmd == "emergency_unlock")
  {
    // Unlock physical button and stop alarm
    emergencyLocked = false;
    emergencyAlarmActive = false;
    noTone(BUZZER_PIN);
    Serial2.println("{\"event\":\"emergency_unlocked\"}");
  }
}

// ==================== EMERGENCY ALARM ====================
void updateEmergencyAlarm()
{
  if (!emergencyAlarmActive) return;

  unsigned long elapsed = millis() - emergencyAlarmStart;

  if (elapsed >= 10000)
  {
    // Auto-stop buzzer after 10 seconds (button stays locked until unlock command)
    noTone(BUZZER_PIN);
    emergencyAlarmActive = false;
    return;
  }

  // Alternating siren: high tone 300ms, low tone 300ms
  if ((elapsed / 300) % 2 == 0)
    tone(BUZZER_PIN, 2200);
  else
    tone(BUZZER_PIN, 900);
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
  static unsigned long lastStreamTime = 0;
  static bool initialized = false;

  if (!initialized)
  {
    lastStreamTime = 0;
    initialized = true;
  }

  // ESP32 now only reads temperature. Heart rate is handled by Raspberry Pi.
  if (millis() - lastStreamTime >= 1000)
  {
    lastStreamTime = millis();
    float tempC = mlx.readObjectTempC();
    
    // Only send valid readings
    if (tempC > 20 && tempC < 50)
    {
      StaticJsonDocument<200> doc;
      doc["event"] = "vitals_temp";
      doc["temperature"] = ((int)(tempC * 10)) / 10.0;
      String out;
      serializeJson(doc, out);
      Serial2.println(out);
    }
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
  // Ignore presses while emergency modal is active
  if (emergencyLocked) return;

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