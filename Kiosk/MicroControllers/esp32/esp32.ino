/*
 * MediSync Kiosk - ESP32 Microcontroller
 *
 * Components:
 * - RC522 RFID Reader (SPI)
 * - MLX90614 Thermal Sensor (I2C: SDA=GPIO21, SCL=GPIO22)
 * - MAX30102 Heart Rate Sensor (I2C: SDA=GPIO18, SCL=GPIO19)
 * - 4x Relay Modules (GPIO 33, 32, 25, 26)
 * - 2x RGB LEDs (Scanning Progress & RFID Status)
 * - Passive Buzzer
 *
 * Communication: UART to Raspberry Pi (Serial2: TX=GPIO17, RX=GPIO16)
 */

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <ArduinoJson.h>

// ==================== PIN DEFINITIONS ====================

// RFID RC522 (SPI)
#define RFID_SS_PIN 5
#define RFID_RST_PIN 4

// Thermal Sensor MLX90614 (I2C1)
#define THERMAL_SDA 21
#define THERMAL_SCL 22

// Heart Rate Sensor MAX30102 (I2C2)
#define HEART_SDA 18
#define HEART_SCL 19

// Relay Slots (Active LOW)
#define SLOT1_RELAY 33
#define SLOT2_RELAY 32
#define SLOT3_RELAY 2  // Changed from 25 (conflict with LED)
#define SLOT4_RELAY 25 // Changed from 26 (GPIO 26 conflicts with LED Green)

// RGB LED 1 - Scanning Progress (Common Cathode)
#define PROGRESS_LED_R 12
#define PROGRESS_LED_G 13
#define PROGRESS_LED_B 14

// RGB LED 2 - RFID Status (Common Cathode)
#define STATUS_LED_R 27
#define STATUS_LED_G 26
#define STATUS_LED_B 4 // Changed from 25 (conflict with relay)

// Passive Buzzer
#define BUZZER_PIN 15

// Emergency Button (with internal pull-up)
// Note: GPIO 34-39 are INPUT-ONLY and don't support internal pull-ups!
// Changed to GPIO 23 which supports INPUT_PULLUP
#define EMERGENCY_BTN 23

// UART to Raspberry Pi (Serial2)
#define RPI_TX 17
#define RPI_RX 16

// ==================== OBJECTS ====================
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
MAX30105 particleSensor;

TwoWire I2C_Thermal = TwoWire(0);
TwoWire I2C_Heart = TwoWire(1);

// ==================== VARIABLES ====================
String lastRFID = "";
unsigned long lastRFIDTime = 0;
const unsigned long RFID_COOLDOWN = 2000; // 2 seconds between scans

// Heart rate variables
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

// Scanning state
enum ScanState
{
    IDLE,
    SCANNING_RFID,
    READING_VITALS,
    COMPLETE
};
ScanState currentState = IDLE;

// Emergency button state
bool lastEmergencyState = HIGH;
unsigned long lastEmergencyDebounce = 0;
const unsigned long DEBOUNCE_DELAY = 50;

// LED blinking state (for sensor prompt)
bool isBlinkingHeartLED = false;
unsigned long lastBlinkTime = 0;
const unsigned long BLINK_INTERVAL = 500; // 500ms blink interval
bool blinkLEDState = false;

// ==================== SETUP ====================
void setup()
{
    // Initialize Serial for debugging
    Serial.begin(115200);
    while (!Serial)
        delay(10);
    Serial.println("MediSync ESP32 Initializing...");

    // Initialize UART to Raspberry Pi
    Serial2.begin(115200, SERIAL_8N1, RPI_RX, RPI_TX);
    // Clear any garbage from serial buffer
    delay(100);
    while (Serial2.available())
    {
        Serial2.read();
    }
    Serial.println("UART to RPI initialized");

    // Initialize GPIO Pins
    pinMode(SLOT1_RELAY, OUTPUT);
    pinMode(SLOT2_RELAY, OUTPUT);
    pinMode(SLOT3_RELAY, OUTPUT);
    pinMode(SLOT4_RELAY, OUTPUT);

    // Relays are active LOW, so HIGH = OFF
    digitalWrite(SLOT1_RELAY, HIGH);
    digitalWrite(SLOT2_RELAY, HIGH);
    digitalWrite(SLOT3_RELAY, HIGH);
    digitalWrite(SLOT4_RELAY, HIGH);

    // Initialize RGB LEDs
    pinMode(PROGRESS_LED_R, OUTPUT);
    pinMode(PROGRESS_LED_G, OUTPUT);
    pinMode(PROGRESS_LED_B, OUTPUT);
    pinMode(STATUS_LED_R, OUTPUT);
    pinMode(STATUS_LED_G, OUTPUT);
    pinMode(STATUS_LED_B, OUTPUT);

    // Set status LED to RED (waiting for scan)
    setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);

    // Progress LED off
    setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);

    // Initialize Buzzer
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    // Initialize Emergency Button (with internal pull-up)
    pinMode(EMERGENCY_BTN, INPUT_PULLUP);

    // Initialize SPI for RFID
    SPI.begin();
    rfid.PCD_Init();
    Serial.println("RFID RC522 initialized");

    // Initialize I2C for Thermal Sensor
    // Using 10kHz (10000) for stability with long wires/breadboard
    I2C_Thermal.begin(THERMAL_SDA, THERMAL_SCL, 10000);
    delay(100);
    if (!mlx.begin(MLX90614_I2CADDR, &I2C_Thermal))
    {
        Serial.println("ERROR: MLX90614 not found!");
    }
    else
    {
        Serial.println("MLX90614 Thermal Sensor initialized");
    }

    // Initialize I2C for Heart Rate Sensor
    // Using 10kHz (10000) for stability with long wires/breadboard
    I2C_Heart.begin(HEART_SDA, HEART_SCL, 10000);
    delay(200); // Give I2C time to stabilize

    // Try MAX30102 initialization with retry
    bool sensorFound = false;
    for (int retry = 0; retry < 3; retry++)
    {
        // Use I2C_SPEED_STANDARD (100kHz) instead of I2C_SPEED_FAST
        // Or better yet, the custom 10kHz we set above should take precedence
        if (particleSensor.begin(I2C_Heart, I2C_SPEED_STANDARD))
        {
            sensorFound = true;
            break;
        }
        delay(200);
    }

    if (!sensorFound)
    {
        Serial.println("ERROR: MAX30102 not found!");
        Serial.println("Check: 1) Wiring (SDA=18, SCL=19)");
        Serial.println("       2) Power supply (3.3V)");
        Serial.println("       3) I2C address conflicts");
    }
    else
    {
        Serial.println("MAX30102 Heart Rate Sensor initialized");
        particleSensor.setup();
        particleSensor.setPulseAmplitudeRed(0x0A);
        particleSensor.setPulseAmplitudeGreen(0);
    }

    // Startup tone
    playSuccessTone();

    Serial.println("System Ready!");
    sendToRPI("{\"event\":\"system_ready\"}");
}

// ==================== MAIN LOOP ====================
void loop()
{
    // Check for emergency button
    checkEmergencyButton();

    // Check for commands from Raspberry Pi
    checkRPICommands();

    // Check for RFID scan
    if (currentState == IDLE || currentState == SCANNING_RFID)
    {
        checkRFID();
    }

    // Handle vital signs reading if in progress
    if (currentState == READING_VITALS)
    {
        // Stop LED blinking when vitals reading starts (they use the same LED)
        if (isBlinkingHeartLED)
        {
            isBlinkingHeartLED = false;
            Serial.println("Auto-stopping LED blink (vitals reading started)");
        }
        readVitalSigns();
    }

    // Handle LED blinking for sensor prompt (only when NOT reading vitals)
    if (isBlinkingHeartLED && currentState != READING_VITALS)
    {
        unsigned long currentMillis = millis();
        if (currentMillis - lastBlinkTime >= BLINK_INTERVAL)
        {
            lastBlinkTime = currentMillis;
            blinkLEDState = !blinkLEDState;

            if (blinkLEDState)
            {
                // Red blink to indicate "place finger here"
                setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 255, 0, 0);
            }
            else
            {
                // Turn off
                setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
            }
        }
    }

    delay(50);
}

// ==================== RFID FUNCTIONS ====================
void checkRFID()
{
    // Reset the loop if no new card present
    if (!rfid.PICC_IsNewCardPresent())
    {
        return;
    }

    // Verify if the NUID has been read
    if (!rfid.PICC_ReadCardSerial())
    {
        return;
    }

    // Check cooldown
    if (millis() - lastRFIDTime < RFID_COOLDOWN)
    {
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        return;
    }

    // Read UID
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++)
    {
        uidString += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
        uidString += String(rfid.uid.uidByte[i], HEX);
    }
    uidString.toUpperCase();

    // Check if it's a new card
    if (uidString != lastRFID)
    {
        lastRFID = uidString;
        lastRFIDTime = millis();

        Serial.println("RFID Detected: " + uidString);

        // Send RFID to RPI
        sendRFIDToRPI(uidString);

        // Change status LED to GREEN
        setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 0, 255, 0);

        // Success beep pattern
        playSuccessTone();

        // Start vital signs reading
        currentState = READING_VITALS;
    }

    // Halt PICC
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
}

void sendRFIDToRPI(String uid)
{
    StaticJsonDocument<200> doc;
    doc["event"] = "rfid_scan";
    doc["uid"] = uid;
    doc["timestamp"] = millis();

    String jsonString;
    serializeJson(doc, jsonString);
    sendToRPI(jsonString);
}

// ==================== VITAL SIGNS FUNCTIONS ====================
void readVitalSigns()
{
    static unsigned long startTime = 0;
    static int readingCount = 0;
    static float tempSum = 0;
    static int heartReadings = 0;

    if (startTime == 0)
    {
        startTime = millis();
        readingCount = 0;
        tempSum = 0;
        heartReadings = 0;
        Serial.println("Starting vital signs reading...");
    }

    unsigned long elapsedTime = millis() - startTime;
    float progress = min(elapsedTime / 5000.0, 1.0); // 5 seconds max

    // Update progress LED (red to green gradient)
    int red = 255 * (1.0 - progress);
    int green = 255 * progress;
    setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, red, green, 0);

    // Read temperature
    float tempC = mlx.readObjectTempC();
    Serial.print("Temperature: ");
    Serial.print(tempC);
    Serial.print("°C ");
    if (tempC > 20 && tempC < 50)
    { // Valid range
        Serial.println("✓ Valid");
        tempSum += tempC;
        readingCount++;
    }
    else
    {
        Serial.println("✗ Out of range");
    }

    // Read heart rate
    long irValue = particleSensor.getIR();

    // Debug: Print IR value every second to help diagnose finger detection
    static unsigned long lastDebugPrint = 0;
    if (millis() - lastDebugPrint > 1000)
    {
        Serial.print("IR Value: ");
        Serial.print(irValue);
        Serial.println(irValue > 50000 ? " ✓ Finger detected" : " ✗ No finger");
        lastDebugPrint = millis();
    }

    if (irValue > 50000)
    { // Finger detected
        if (checkForBeat(irValue))
        {
            long delta = millis() - lastBeat;
            lastBeat = millis();
            beatsPerMinute = 60 / (delta / 1000.0);

            if (beatsPerMinute > 40 && beatsPerMinute < 200)
            {
                rates[rateSpot++] = (byte)beatsPerMinute;
                rateSpot %= RATE_SIZE;

                beatAvg = 0;
                for (byte x = 0; x < RATE_SIZE; x++)
                {
                    beatAvg += rates[x];
                }
                beatAvg /= RATE_SIZE;
                heartReadings++;
            }
        }
    }

    // Complete after 5 seconds or sufficient readings
    if (elapsedTime >= 5000 || (readingCount >= 10 && heartReadings >= 3))
    {
        float avgTemp = readingCount > 0 ? tempSum / readingCount : 0;

        // Send vital signs to RPI
        sendVitalsToRPI(avgTemp, beatAvg);

        // Green LED on completion
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 255, 0);

        // Completion tone
        playCompleteTone();
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
        setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);

        currentState = IDLE;
        startTime = 0;
        lastRFID = "";
    }
}

void sendVitalsToRPI(float temperature, int heartRate)
{
    StaticJsonDocument<200> doc;
    doc["event"] = "vitals_data";
    doc["temperature"] = round(temperature * 10) / 10.0;
    doc["heartRate"] = heartRate;
    doc["timestamp"] = millis();

    String jsonString;
    serializeJson(doc, jsonString);
    sendToRPI(jsonString);

    Serial.print("Vitals - Temp: ");
    Serial.print(temperature);
    Serial.print("°C, HR: ");
    Serial.print(heartRate);
    Serial.println(" BPM");
}

// ==================== RELAY/DISPENSING FUNCTIONS ====================
void dispenseFromSlot(int slotNumber)
{
    int relayPin;

    switch (slotNumber)
    {
    case 1:
        relayPin = SLOT1_RELAY;
        break;
    case 2:
        relayPin = SLOT2_RELAY;
        break;
    case 3:
        relayPin = SLOT3_RELAY;
        break;
    case 4:
        relayPin = SLOT4_RELAY;
        break;
    default:
        Serial.println("Invalid slot number!");
        return;
    }

    Serial.print("Dispensing from Slot ");
    Serial.println(slotNumber);

    // Visual feedback
    for (int i = 0; i < 3; i++)
    {
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 255, 0);
        delay(100);
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
        delay(100);
    }
    playDispensingTone();

    // Activate relay (LOW = ON)
    digitalWrite(relayPin, LOW);
    delay(2000); // Keep relay on for 2 seconds
    digitalWrite(relayPin, HIGH);

    // Send confirmation
    StaticJsonDocument<200> doc;
    doc["event"] = "dispense_complete";
    doc["slot"] = slotNumber;
    doc["timestamp"] = millis();

    String jsonString;
    serializeJson(doc, jsonString);
    sendToRPI(jsonString);
}

// ==================== RPI COMMUNICATION ====================
void checkRPICommands()
{
    // Check Serial (USB) for commands - used when connected to PC
    if (Serial.available())
    {
        String command = Serial.readStringUntil('\n');
        command.trim();

        if (command.length() > 0)
        {
            // Check if command looks like valid JSON (starts with { )
            if (command.startsWith("{"))
            {
                processRPICommand(command);
            }
            // Ignore non-JSON (might be Serial Monitor input)
        }
    }

    // Also check Serial2 (GPIO pins) for RPi commands - used in production
    if (Serial2.available())
    {
        String command = Serial2.readStringUntil('\n');
        command.trim();

        if (command.length() > 0)
        {
            // Check if command looks like valid JSON (starts with { )
            if (command.startsWith("{"))
            {
                processRPICommand(command);
            }
            else
            {
                Serial.println("[Serial2] Invalid command format (not JSON): " + command);
                // Clear remaining garbage from Serial2 only
                while (Serial2.available())
                {
                    Serial2.read();
                    delay(1);
                }
            }
        }
    }
}

void processRPICommand(String command)
{
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, command);

    if (error)
    {
        Serial.println("JSON parse error!");
        return;
    }

    String cmd = doc["command"];

    if (cmd == "dispense")
    {
        int slot = doc["slot"];
        dispenseFromSlot(slot);
    }
    else if (cmd == "simulate_rfid")
    {
        String uid = doc["uid"] | "FAKE12345678";
        Serial.println("Simulating RFID scan: " + uid);

        // Send RFID to RPI
        sendRFIDToRPI(uid);

        // Change status LED to GREEN
        setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 0, 255, 0);

        // Success beep pattern
        playSuccessTone();

        // Start vital signs reading
        lastRFID = uid;
        lastRFIDTime = millis();
        currentState = READING_VITALS;
    }
    else if (cmd == "test_buzzer")
    {
        playTestTone();
    }
    else if (cmd == "test_led")
    {
        testLEDs();
    }
    else if (cmd == "reset")
    {
        currentState = IDLE;
        lastRFID = "";
        setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
    }
    else if (cmd == "blink_heart_led")
    {
        Serial.println("Starting heart rate LED blink");
        isBlinkingHeartLED = true;
        blinkLEDState = false;
        lastBlinkTime = millis();
    }
    else if (cmd == "stop_blink_led")
    {
        Serial.println("Stopping LED blink");
        isBlinkingHeartLED = false;
        // Turn off the progress LED
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
    }
}

void sendToRPI(String message)
{
    // Send to both Serial (USB) and Serial2 (RPi GPIO)
    // This allows working in both development and production modes
    Serial.println(message);  // USB - backend reads from here
    Serial2.println(message); // GPIO - for future RPi integration
}

// ==================== UTILITY FUNCTIONS ====================
void setRGBColor(int redPin, int greenPin, int bluePin, int red, int green, int blue)
{
    analogWrite(redPin, red);
    analogWrite(greenPin, green);
    analogWrite(bluePin, blue);
}

// ==================== TONE PATTERNS ====================
void playSuccessTone()
{
    // Two quick ascending beeps
    tone(BUZZER_PIN, 1000, 100);
    delay(120);
    tone(BUZZER_PIN, 1500, 100);
    delay(120);
}

void playErrorTone()
{
    // Two descending beeps
    tone(BUZZER_PIN, 1500, 150);
    delay(170);
    tone(BUZZER_PIN, 800, 150);
    delay(170);
}

void playWarningTone()
{
    // Three short beeps at medium pitch
    for (int i = 0; i < 3; i++)
    {
        tone(BUZZER_PIN, 1200, 80);
        delay(100);
    }
}

void playEmergencyTone()
{
    // Urgent alternating high-low siren
    for (int i = 0; i < 4; i++)
    {
        tone(BUZZER_PIN, 2000, 150);
        delay(170);
        tone(BUZZER_PIN, 1000, 150);
        delay(170);
    }
}

void playCompleteTone()
{
    // Single long ascending tone
    tone(BUZZER_PIN, 1000, 200);
    delay(220);
    tone(BUZZER_PIN, 1500, 200);
    delay(220);
}

void playDispensingTone()
{
    // Gentle notification beep
    tone(BUZZER_PIN, 1300, 200);
    delay(250);
}

void playTestTone()
{
    // Full range test
    tone(BUZZER_PIN, 800, 200);
    delay(250);
    tone(BUZZER_PIN, 1200, 200);
    delay(250);
    tone(BUZZER_PIN, 1600, 200);
    delay(250);
    tone(BUZZER_PIN, 2000, 200);
}

// ==================== EMERGENCY BUTTON ====================
void checkEmergencyButton()
{
    // Read button state (LOW when pressed due to pull-up)
    bool currentState = digitalRead(EMERGENCY_BTN);

    // Check if state changed
    if (currentState != lastEmergencyState)
    {
        lastEmergencyDebounce = millis();
    }

    // If state stable for debounce delay
    if ((millis() - lastEmergencyDebounce) > DEBOUNCE_DELAY)
    {
        // Button pressed (LOW)
        if (currentState == LOW && lastEmergencyState == HIGH)
        {
            Serial.println("🚨 EMERGENCY BUTTON PRESSED!");

            // Visual alert - flash both LEDs red
            for (int i = 0; i < 5; i++)
            {
                setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);
                setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 255, 0, 0);
                delay(100);
                setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 0, 0, 0);
                setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
                delay(100);
            }

            // Play emergency tone
            playEmergencyTone();

            // Send emergency alert to RPI
            sendEmergencyAlert();

            // Reset LEDs to default
            setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);
            setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);
        }
    }

    lastEmergencyState = currentState;
}

void sendEmergencyAlert()
{
    StaticJsonDocument<200> doc;
    doc["event"] = "emergency_button";
    doc["timestamp"] = millis();
    doc["kiosk_id"] = "kiosk-001"; // Should match KIOSK_ID in backend

    String jsonString;
    serializeJson(doc, jsonString);
    sendToRPI(jsonString);
}

void testLEDs()
{
    Serial.println("Testing LEDs...");

    // Test Status LED
    setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);
    delay(500);
    setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 0, 255, 0);
    delay(500);
    setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 0, 0, 255);
    delay(500);
    setRGBColor(STATUS_LED_R, STATUS_LED_G, STATUS_LED_B, 255, 0, 0);

    // Test Progress LED
    for (int i = 0; i <= 255; i += 5)
    {
        setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 255 - i, i, 0);
        delay(20);
    }
    setRGBColor(PROGRESS_LED_R, PROGRESS_LED_G, PROGRESS_LED_B, 0, 0, 0);

    playTestTone();
}