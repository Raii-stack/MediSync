# ESP32 Arduino Library Versions

## Required Libraries for MediSync Kiosk

Install these exact versions in Arduino IDE (Tools → Manage Libraries):

### Core Libraries

1. **ESP32 Board Support**
   - Version: **2.0.17** (or 2.0.x latest)
   - Install via: Tools → Board → Boards Manager → "esp32"
   - Arduino IDE: File → Preferences → Additional Board Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```

### Sensor Libraries

2. **MFRC522** (RFID)
   - Version: **1.4.11**
   - Author: GithubCommunity
   - Library Manager: Search "MFRC522"

3. **Adafruit MLX90614** (Thermal Sensor)
   - Version: **1.0.1** or **2.1.3**
   - Author: Adafruit
   - Also install dependency: **Adafruit BusIO** (latest)

4. **SparkFun MAX3010x Pulse and Proximity Sensor** (Heart Rate)
   - Version: **1.1.2**
   - Author: SparkFun Electronics
   - Library Manager: Search "MAX3010x"

5. **ArduinoJson**
   - Version: **6.21.3** (NOT 7.x - breaking changes)
   - Author: Benoit Blanchon
   - Library Manager: Search "ArduinoJson"

### Communication Libraries

6. **Wire** (I2C)
   - Built-in with ESP32 core - No installation needed
7. **SPI** (RFID)
   - Built-in with ESP32 core - No installation needed

## Installation Steps

1. Open Arduino IDE
2. Go to: Tools → Manage Libraries
3. Search for each library name
4. Select the exact version listed above
5. Click "Install"

## Upload Settings

- Board: **ESP32 Dev Module**
- Upload Speed: **115200**
- CPU Frequency: **240MHz**
- Flash Frequency: **80MHz**
- Flash Mode: **QIO**
- Flash Size: **4MB (32Mb)**
- Partition Scheme: **Default 4MB with spiffs**
- Core Debug Level: **None** (or "Info" for debugging)
- PSRAM: **Disabled**
- Port: **COM3** (your ESP32 USB port)

## Troubleshooting

### Upload Failed

- Close Arduino Serial Monitor
- Close backend server (frees COM3 port)
- Press and hold "BOOT" button on ESP32 while clicking "Upload"

### Sensor Not Found

- Check I2C wiring: SDA/SCL pins
- Verify sensor power: 3.3V and GND
- Try lowering I2C speed: `Wire.setClock(10000);` (10kHz)

### Serial Garbage/Corruption

- ✅ **FIXED**: Use Serial (USB) for commands instead of Serial2
- Verify baud rate: 115200 on both ESP32 and backend
- Check USB cable quality (some charge-only cables don't support data)
