# ESP32 Hardware Integration Guide

## Hardware Components

### Sensors

- **MLX90614 Infrared Thermal Sensor**
  - Connection: I2C Bus 0
  - SDA: GPIO 21
  - SCL: GPIO 22
  - Power: 5V
  - Range: -40°C to 125°C
- **MAX30102 Heart Rate & SpO2 Sensor**
  - Connection: I2C Bus 1
  - SDA: GPIO 18
  - SCL: GPIO 19
  - Power: 3.3V
  - Typical BPM Range: 40-200

- **RC522 RFID Reader**
  - Connection: SPI
  - SS: GPIO 5
  - RST: GPIO 4
  - MOSI/MISO/SCK: Default SPI pins
  - Power: 3.3V
  - Frequency: 13.56 MHz

### Outputs

#### Relay Modules (4 channels)

- **Slot 1**: GPIO 33 (Active LOW)
- **Slot 2**: GPIO 32 (Active LOW)
- **Slot 3**: GPIO 25 (Active LOW)
- **Slot 4**: GPIO 26 (Active LOW)
- Activation Duration: 2 seconds

#### RGB LED #1 - Scanning Progress

- Red Pin: GPIO 12
- Green Pin: GPIO 13
- Blue Pin: GPIO 14
- Type: Common Cathode
- Function: Red→Yellow→Green gradient during vital signs capture

#### RGB LED #2 - RFID Status

- Red Pin: GPIO 27
- Green Pin: GPIO 26
- Blue Pin: GPIO 25
- Type: Common Cathode
- States:
  - RED: Waiting for RFID scan
  - GREEN: Card detected

#### Passive Buzzer

- Pin: GPIO 15
- Tone Patterns:
  - **Success**: Two ascending beeps (1000Hz → 1500Hz) - RFID detected
  - **Complete**: Long ascending tone (1000Hz → 1500Hz) - Vitals done
  - **Dispensing**: Gentle beep (1300Hz, 200ms) - Medicine dispensing
  - **Warning**: Three short beeps (1200Hz, 80ms × 3) - General warnings
  - **Error**: Two descending beeps (1500Hz → 800Hz) - Errors
  - **Emergency**: Urgent siren (2000Hz ↔ 1000Hz × 4) - Emergency button
  - **Test**: Four ascending tones (800Hz → 2000Hz) - Hardware test

#### Emergency Button

- Pin: GPIO 34 (Input with internal pull-up)
- Type: Momentary push button (normally open)
- Connection: Button between GPIO 34 and GND
- Debounce: 50ms
- Action:
  - Both LEDs flash red 5 times
  - Emergency siren plays
  - Sends emergency alert to backend
  - Backend forwards to clinic system

### Communication

- **UART to Raspberry Pi**
  - TX: GPIO 17
  - RX: GPIO 16
  - Baud Rate: 115200
  - Protocol: JSON messages (newline-terminated)

---

## Communication Protocol

### ESP32 → Raspberry Pi (Events)

#### System Ready

```json
{
  "event": "system_ready"
}
```

#### RFID Scanned

```json
{
  "event": "rfid_scan",
  "uid": "A1B2C3D4",
  "timestamp": 123456
}
```

#### Vital Signs Complete

```json
{
  "event": "vitals_data",
  "temperature": 36.5,
  "heartRate": 75,
  "timestamp": 123456
}
```

#### Dispensing Complete

```json
{
  "event": "dispense_complete",
  "slot": 1,
  "timestamp": 123456
}
```

#### Emergency Button Pressed

```json
{
  "event": "emergency_button",
  "timestamp": 123456,
  "kiosk_id": "kiosk-001"
}
```

Backend forwards this event to both frontend and clinic system.

---

### Raspberry Pi → ESP32 (Commands)

#### Dispense Medicine

```json
{
  "command": "dispense",
  "slot": 1
}
```

Response: `dispense_complete` event

#### Test Buzzer

```json
{
  "command": "test_buzzer"
}
```

#### Test LEDs

```json
{
  "command": "test_led"
}
```

#### Reset System

```json
{
  "command": "reset"
}
```

Resets state machine, clears RFID cache, returns LEDs to default

---

## State Machine Flow

1. **IDLE**
   - Status LED: RED (waiting)
   - Progress LED: OFF
   - Listening for RFID scan

2. **SCANNING_RFID**
   - RFID detected
   - Status LED: GREEN
   - Double beep
   - Send `rfid_scan` event

3. **READING_VITALS**
   - Duration: 5 seconds (or until sufficient readings)
   - Progress LED: Red→Green gradient
   - Reads temperature continuously
   - Reads heart rate when finger detected
   - Sends `vitals_data` event on completion

4. **COMPLETE**
   - Long beep
   - Reset to IDLE after 1 second
   - Ready for next scan

---

## Arduino Libraries Required

Install via Arduino Library Manager:

```cpp
// Core libraries (built-in)
#include <SPI.h>
#include <Wire.h>

// External libraries (install these)
#include <MFRC522.h>           // by GithubCommunity (v1.4.10+)
#include <Adafruit_MLX90614.h> // by Adafruit (v2.1.3+)
#include <MAX30105.h>          // by SparkFun (v1.1.1+)
#include <heartRate.h>         // by SparkFun (included with MAX30105)
#include <ArduinoJson.h>       // by Benoit Blanchon (v6.21.0+)
```

---

## Backend Integration (Node.js)

### Serial Port Setup

```javascript
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const port = new SerialPort({
  path: "/dev/ttyUSB0", // or COM port on Windows
  baudRate: 115200,
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// Listen for ESP32 events
parser.on("data", (data) => {
  try {
    const message = JSON.parse(data);
    handleESP32Event(message);
  } catch (err) {
    console.error("Invalid JSON from ESP32:", data);
  }
});

function handleESP32Event(message) {
  switch (message.event) {
    case "system_ready":
      console.log("ESP32 is ready");
      break;

    case "rfid_scan":
      // Look up student by RFID UID
      const student = lookupStudent(message.uid);
      if (student) {
        io.emit("student_identified", student);
      }
      break;

    case "vitals_data":
      // Store vitals and emit to frontend
      io.emit("vitals_received", {
        temperature: message.temperature,
        heartRate: message.heartRate,
      });
      break;

    case "dispense_complete":
      // Log dispensing and notify frontend
      logDispensing(message.slot);
      io.emit("medicine_dispensed", { slot: message.slot });
      break;
  }
}

// Send dispense command to ESP32
function dispenseSlot(slotNumber) {
  const command =
    JSON.stringify({
      command: "dispense",
      slot: slotNumber,
    }) + "\n";

  port.write(command, (err) => {
    if (err) {
      console.error("Error sending command:", err);
    }
  });
}
```

---

## Testing & Troubleshooting

### Serial Monitor Testing

1. Open Arduino IDE Serial Monitor at 115200 baud
2. You should see:
   ```
   MediSync ESP32 Initializing...
   UART to RPI initialized
   RFID RC522 initialized
   MLX90614 Thermal Sensor initialized
   MAX30102 Heart Rate Sensor initialized
   System Ready!
   ```

### LED Test Sequence

Send command:

```json
{ "command": "test_led" }
```

Should show:

- Status LED: Red → Green → Blue → Red
- Progress LED: Red→Yellow→Green gradient

### Buzzer Test

Send command:

```json
{ "command": "test_buzzer" }
```

### Manual Dispense Test

```json
{ "command": "dispense", "slot": 1 }
```

### Common Issues

**Problem**: MLX90614 not found

- Check I2C wiring (GPIO 21/22)
- Verify 5V power supply
- Check I2C address (default 0x5A)

**Problem**: MAX30102 not found

- Check separate I2C wiring (GPIO 18/19)
- Use 3.3V power (NOT 5V)
- Ensure proper finger placement for detection

**Problem**: RFID not reading

- Check SPI wiring
- Verify 3.3V power
- Ensure card is within 3cm of reader
- Check SS and RST pins

**Problem**: Relays not activating

- Verify relay module type (active LOW vs HIGH)
- Check GPIO connections
- Test with multimeter
- Ensure adequate power supply

---

## Wiring Diagram Summary

```
ESP32          Component
-----          ---------
GPIO 21   →    MLX90614 SDA
GPIO 22   →    MLX90614 SCL
5V        →    MLX90614 VCC
GND       →    MLX90614 GND

GPIO 18   →    MAX30102 SDA
GPIO 19   →    MAX30102 SCL
3.3V      →    MAX30102 VCC
GND       →    MAX30102 GND

GPIO 5    →    RC522 SS
GPIO 4    →    RC522 RST
GPIO 23   →    RC522 MOSI
GPIO 19   →    RC522 MISO
GPIO 18   →    RC522 SCK
3.3V      →    RC522 VCC
GND       →    RC522 GND

GPIO 33   →    Relay 1 IN
GPIO 32   →    Relay 2 IN
GPIO 25   →    Relay 3 IN
GPIO 26   →    Relay 4 IN
VCC       →    Relay VCC
GND       →    Relay GND

GPIO 12   →    Progress LED R
GPIO 13   →    Progress LED G
GPIO 14   →    Progress LED B
GND       →    Progress LED Cathode

GPIO 27   →    Status LED R
GPIO 26   →    Status LED G
GPIO 25   →    Status LED B
GND       →    Status LED Cathode

GPIO 15   →    Buzzer +
GND       →    Buzzer -

GPIO 17   →    RPI RX (USB-UART)
GPIO 16   →    RPI TX (USB-UART)
GND       →    RPI GND
```

---

## Power Considerations

- ESP32: 5V via USB or VIN
- Total current draw: ~500-800mA
- Relay modules need separate 5V supply if switching high loads
- Use common ground for all components
- Consider using a 5V 2A power supply for the entire system

---

## Next Steps

1. ✅ Upload code to ESP32
2. Test individual components (RFID, sensors, LEDs, buzzer)
3. Connect ESP32 to Raspberry Pi via USB-UART adapter
4. Update backend `serial.js` with event handlers
5. Test full integration flow
6. Calibrate sensor thresholds if needed
7. Deploy to kiosk hardware
