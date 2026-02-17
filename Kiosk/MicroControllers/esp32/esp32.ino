/*
 * MediSync Kiosk - ESP32 Firmware (Final Synchronized Version)
 * * Hardware Map:
 * - Bus 0 (I2C): MLX90614 Thermal (SDA=21, SCL=22)
 * - Bus 1 (I2C): MAX30102 Heart (SDA=18, SCL=19)
 * - Relays: GPIO 33, 32, 17, 25
 * - RGB LEDs: Progress (12,13,14), Status (27,26,16)
 * - Buzzer: GPIO 15
 * - Emergency Btn: GPIO 23
 */

#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// CRITICAL: RFID uses pins 18/19 (SPI), which conflicts with Heart Sensor (I2C).
// Keep FALSE until Heart Sensor is moved to different pins.
#define ENABLE_RFID false 

#if ENABLE_RFID
  #include <SPI.h>
  #include <MFRC522.h>
  #define RFID_SS_PIN 5
  #define RFID_RST_PIN 4
  MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
#endif

// ==================== PIN DEFINITIONS ====================
// I2C Pins
#define THERMAL_SDA 21
#define THERMAL_SCL 22
#define HEART_SDA 18
#define HEART_SCL 19

// Relays (Active LOW)
#define SLOT1_RELAY 33
#define SLOT2_RELAY 32
#define SLOT3_RELAY 17 
#define SLOT4_RELAY 25 

// RGB LED 1 - Scanning Progress
#define PROGRESS_LED_R 12
#define PROGRESS_LED_G 13
#define PROGRESS_LED_B 14

// RGB LED 2 - Status
#define STATUS_LED_R 27
#define STATUS_LED_G 26
#define STATUS_LED_B 16 

// Input/Output
#define BUZZER_PIN 15
#define EMERGENCY_BTN 23

// ==================== OBJECTS ====================
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
MAX30105 particleSensor;

// Separate I2C Buses
TwoWire I2C_Thermal = TwoWire(0);
TwoWire I2C_Heart = TwoWire(1);

// ==================== VARIABLES ====================
// Heart Rate (Reduced buffer for faster synchronization)
const byte RATE_SIZE = 4; 
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

// State Machine
enum ScanState { IDLE, SCANNING_RFID, READING_VITALS, COMPLETE };
ScanState currentState = IDLE;

// Timers & Flags
String lastRFID = "";
unsigned long lastRFIDTime = 0;
bool isBlinkingHeartLED = false;
unsigned long lastBlinkTime = 0;
bool blinkLEDState = false;

// Emergency Button
bool lastEmergencyState = HIGH;
unsigned long lastEmergencyDebounce = 0;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200); 
  
  // 1. Setup Output Pins
  pinMode(SLOT1_RELAY, OUTPUT); digitalWrite(SLOT1_RELAY, HIGH);
  pinMode(SLOT2_RELAY, OUTPUT); digitalWrite(SLOT2_RELAY, HIGH);
  pinMode(SLOT3_RELAY, OUTPUT); digitalWrite(SLOT3_RELAY, HIGH);
  pinMode(SLOT4_RELAY, OUTPUT); digitalWrite(SLOT4_RELAY, HIGH);
  
  pinMode(PROGRESS_LED_R, OUTPUT); pinMode(PROGRESS_LED_G, OUTPUT); pinMode(PROGRESS_LED_B, OUTPUT);
  pinMode(STATUS_LED_R, OUTPUT);   pinMode(STATUS_LED_G, OUTPUT);   pinMode(STATUS_LED_B, OUTPUT);
  
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  pinMode(EMERGENCY_BTN, INPUT_PULLUP);

  // 2. Initialize Thermal Sensor (Bus 0)
  I2C_Thermal.begin(THERMAL_SDA, THERMAL_SCL, 100000); 
  if (!mlx.begin(0x5A, &I2C_Thermal)) {
    Serial.println("ERROR: Thermal Sensor (MLX90614) not found!");
    playErrorTone();
  } else {
    Serial.println("SYSTEM: Thermal Sensor Ready (Bus 0)");
  }

  // 3. Initialize Heart Sensor (Bus 1)
  I2C_Heart.begin(HEART_SDA, HEART_SCL, 400000); 
  if (!particleSensor.begin(I2C_Heart, I2C_SPEED_FAST)) {
    Serial.println("ERROR: Heart Sensor (MAX30102) not found!");
    playErrorTone();
  } else {
    Serial.println("SYSTEM: Heart Sensor Ready (Bus 1)");
    
    // Advanced Configuration for Accuracy
    byte ledBrightness = 60; // 0=Off to 255=50mA
    byte sampleAverage = 4;  // Average 4 samples
    byte ledMode = 2;        // Red + IR
    int sampleRate = 100;    
    int pulseWidth = 411;    // High resolution
    int adcRange = 4096;     
    
    particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
  }

  // 4. Initialize RFID (If Enabled)
  #if ENABLE_RFID
    SPI.begin();
    rfid.PCD_Init();
    Serial.println("SYSTEM: RFID Ready");
  #else
    Serial.println("SYSTEM: RFID Disabled (Pin Conflict Prevention)");
  #endif

  // Ready
  setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0); // Red (Waiting)
  playSuccessTone();
}

// ==================== MAIN LOOP ====================
void loop() {
  checkEmergencyButton();
  checkCommands();

  // RFID Handler
  #if ENABLE_RFID
    if (currentState == IDLE) checkRFID();
  #endif

  // Vitals Handler
  if (currentState == READING_VITALS) {
    readVitalSigns();
  } else {
    // Keep FIFO empty when not in use so we don't read old data later
    particleSensor.check();
    while(particleSensor.available()) {
        particleSensor.nextSample();
    }
  }

  // Blink LED Handler (Prompt)
  if (isBlinkingHeartLED && currentState != READING_VITALS) {
    if (millis() - lastBlinkTime >= 500) {
      lastBlinkTime = millis();
      blinkLEDState = !blinkLEDState;
      if (blinkLEDState) setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 255, 0, 0);
      else setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
    }
  }
}

// ==================== VITALS LOGIC (SYNCHRONIZED) ====================
void readVitalSigns() {
    static unsigned long scanStartTime = 0;
    static unsigned long waitStartTime = 0;
    static unsigned long fingerRemovedTime = 0;
    static bool fingerDetected = false;
    static int readingCount = 0;
    static float tempSum = 0;
    static int heartReadings = 0;
    static unsigned long lastStreamTime = 0;
    static bool initialized = false;

    // --- INIT ---
    if (!initialized) {
        waitStartTime = millis();
        scanStartTime = 0;
        fingerDetected = false;
        fingerRemovedTime = 0;
        readingCount = 0;
        tempSum = 0;
        heartReadings = 0;
        initialized = true;
        beatAvg = 0;
        rateSpot = 0;
        // Flush FIFO
        particleSensor.clearFIFO(); 
        Serial.println("Waiting for finger...");
    }

    // --- READ FRESH DATA (Continuous) ---
    long irValue = particleSensor.getIR(); 
    
    // Force check if sensor returns 0
    if (irValue == 0) {
      particleSensor.check();
      while(particleSensor.available()) irValue = particleSensor.getIR();
    }

    // --- PHASE 1: WAITING FOR FINGER ---
    if (!fingerDetected) {
        // Blink Amber
        if ((millis() / 500) % 2 == 0) setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 255, 100, 0);
        else setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);

        if (irValue > 50000) {
            fingerDetected = true;
            scanStartTime = millis();
            Serial.println("Finger detected! Synchronizing sensors...");
            sendJson("vitals_progress", 0, 0, 0.05); // Initial "contact" msg
        }

        if (millis() - waitStartTime > 30000) {
            Serial.println("Timeout: No finger.");
            finishVitals();
            initialized = false;
        }
        return;
    }

    // --- PHASE 2: SCANNING (Synchronized) ---
    
    // Check removal
    if (irValue < 50000) {
        if (fingerRemovedTime == 0) fingerRemovedTime = millis();
        if (millis() - fingerRemovedTime > 2000) {
             Serial.println("Aborted: Finger removed.");
             playErrorTone();
             finishVitals();
             initialized = false;
        }
        return;
    }
    fingerRemovedTime = 0;

    // 1. Read Temp
    float tempC = mlx.readObjectTempC();
    if (tempC > 20 && tempC < 50) { tempSum += tempC; readingCount++; }

    // 2. Read Heart Rate
    if (checkForBeat(irValue)) {
        long delta = millis() - lastBeat;
        lastBeat = millis();
        beatsPerMinute = 60 / (delta / 1000.0);

        if (beatsPerMinute > 40 && beatsPerMinute < 180) {
            rates[rateSpot++] = (byte)beatsPerMinute;
            rateSpot %= RATE_SIZE;
            beatAvg = 0;
            for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
            beatAvg /= RATE_SIZE;
            
            heartReadings++; 
            
            // Visual Progress (Green Bar)
            float prog = min((float)heartReadings / 15.0f, 1.0f);
            int g = 255 * prog;
            int r = 255 * (1.0 - prog);
            setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, r, g, 0);
            
            Serial.print("BPM: "); Serial.println(beatAvg);
        }
    }

    // 3. SYNCHRONIZED STREAM (Only send if both are ready)
    if (millis() - lastStreamTime >= 1000) {
        lastStreamTime = millis();
        float curTemp = readingCount > 0 ? tempSum / readingCount : 0;
        float prog = min((float)heartReadings / 15.0f, 1.0f);
        
        // Strict: Only send if we have a valid Heart Rate
        if (beatAvg > 0) {
             sendJson("vitals_progress", curTemp, beatAvg, prog);
        }
    }

    // 4. Completion
    if (heartReadings >= 15) {
        float avgTemp = readingCount > 0 ? tempSum / readingCount : 0;
        sendJson("vitals_data", avgTemp, beatAvg, 1.0);
        finishVitals();
        initialized = false;
    }
}

void finishVitals() {
    setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 255, 0); // Green
    playCompleteTone();
    delay(1000);
    setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
    setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0); // Back to Red
    currentState = IDLE;
}

// ==================== COMMANDS & HELPERS ====================
void checkCommands() {
    if (Serial.available()) {
        String input = Serial.readStringUntil('\n');
        input.trim();
        if (!input.startsWith("{")) return;

        StaticJsonDocument<200> doc;
        deserializeJson(doc, input);
        String cmd = doc["command"];

        if (cmd == "dispense") {
            int slot = doc["slot"];
            dispense(slot);
        }
        else if (cmd == "start_vitals") currentState = READING_VITALS;
        else if (cmd == "blink_heart_led") isBlinkingHeartLED = true;
        else if (cmd == "stop_blink_led") { isBlinkingHeartLED = false; setRGBColor(12,13,14,0,0,0); }
    }
}

void dispense(int slot) {
    int pin = -1;
    if (slot == 1) pin = SLOT1_RELAY;
    else if (slot == 2) pin = SLOT2_RELAY;
    else if (slot == 3) pin = SLOT3_RELAY;
    else if (slot == 4) pin = SLOT4_RELAY;

    if (pin != -1) {
        Serial.print("Dispensing Slot "); Serial.println(slot);
        playDispensingTone();
        digitalWrite(pin, LOW); // Active
        delay(2000);
        digitalWrite(pin, HIGH); // Off
        
        StaticJsonDocument<200> doc;
        doc["event"] = "dispense_complete";
        doc["slot"] = slot;
        String out; serializeJson(doc, out);
        Serial.println(out);
    }
}

// ==================== HARDWARE HELPERS ====================
void setRGBColor(int rPin, int gPin, int bPin, int r, int g, int b) {
    analogWrite(rPin, r); analogWrite(gPin, g); analogWrite(bPin, b);
}

void sendJson(String event, float temp, int hr, float prog) {
    StaticJsonDocument<200> doc;
    doc["event"] = event;
    doc["temperature"] = ((int)(temp*10))/10.0;
    doc["heartRate"] = hr;
    doc["progress"] = prog;
    String out; serializeJson(doc, out);
    Serial.println(out);
}

void checkEmergencyButton() {
    bool state = digitalRead(EMERGENCY_BTN);
    if (state == LOW && lastEmergencyState == HIGH) {
        if (millis() - lastEmergencyDebounce > 50) {
            Serial.println("EMERGENCY!");
            playEmergencyTone();
            StaticJsonDocument<200> doc; doc["event"] = "emergency";
            String out; serializeJson(doc, out); Serial.println(out);
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

// ==================== RFID (Keep disabled for now) ====================
#if ENABLE_RFID
void checkRFID() {
    if (!rfid.PICC_IsNewCardPresent()) return;
    if (!rfid.PICC_ReadCardSerial()) return;
    
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        uid += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
        uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    
    if (uid != lastRFID && (millis() - lastRFIDTime > 2000)) {
        lastRFID = uid;
        lastRFIDTime = millis();
        playSuccessTone();
        
        StaticJsonDocument<200> doc;
        doc["event"] = "rfid_scan";
        doc["uid"] = uid;
        String out; serializeJson(doc, out);
        Serial.println(out);
        
        currentState = READING_VITALS;
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
}
#endif