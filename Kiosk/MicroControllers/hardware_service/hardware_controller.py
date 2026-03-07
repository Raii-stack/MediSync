#!/usr/bin/env python3
"""
MediSync Hardware Controller Service
====================================
Runs inside a single Docker container to manage both:
1. MAX30102 Heartbeat Sensor (I2C)
2. RGB LEDs (GPIO)
"""

import os
import time
import math
import logging
import threading
import socketio
from gpiozero import PWMLED, Device
from gpiozero.pins.rpigpio import RPiGPIOFactory

# Attempt to load max30102 (local file)
try:
    from max30102 import MAX30102
except ImportError:
    MAX30102 = None

# Attempt to load mlx90614 (local file)
try:
    from mlx90614 import MLX90614
except ImportError:
    MLX90614 = None

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [HARDWARE] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("hardware")

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3001")

# ==================== LED SETUP ====================
Device.pin_factory = RPiGPIOFactory()

VITALS_R_PIN = int(os.environ.get("LED_R_PIN", 17))
VITALS_G_PIN = int(os.environ.get("LED_G_PIN", 27))
RFID_R_PIN   = int(os.environ.get("RFID_LED_R_PIN", 23))
RFID_G_PIN   = int(os.environ.get("RFID_LED_G_PIN", 24))
RFID_B_PIN   = int(os.environ.get("RFID_LED_B_PIN", 25))

# SMD5050 Common Anode LEDs: active_high=False so value=1.0 → pin LOW → LED ON.
# Set LED_COMMON_ANODE=false in env only if you are using common cathode LEDs.
IS_COMMON_ANODE = os.environ.get("LED_COMMON_ANODE", "true").lower() == "true"
active_high = not IS_COMMON_ANODE  # False for common anode (pin LOW = LED ON)

# Common Anode LEDs — active_high=False so gpiozero inverts: value=1.0 → pin LOW → LED ON
vitals_r = PWMLED(VITALS_R_PIN, active_high=active_high)
vitals_g = PWMLED(VITALS_G_PIN, active_high=active_high)
rfid_r   = PWMLED(RFID_R_PIN, active_high=active_high)
rfid_g   = PWMLED(RFID_G_PIN, active_high=active_high)
rfid_b   = PWMLED(RFID_B_PIN, active_high=active_high)

class VitalsState:
    IDLE           = "idle"
    WAITING        = "waiting_for_finger"
    FINGER_REMOVED = "finger_removed"
    SCANNING       = "scanning"
    COMPLETE       = "complete"
    DISCONNECTED   = "disconnected"

class RfidState:
    IDLE    = "idle"
    SESSION = "session"
    TEST    = "test"

vitals_state = VitalsState.DISCONNECTED
vitals_prog  = 0.0
rfid_state   = RfidState.IDLE

_lock = threading.Lock()
_stop_event = threading.Event()

def set_vitals_color(r, g):
    vitals_r.value = max(0.0, min(1.0, r))
    vitals_g.value = max(0.0, min(1.0, g))

def set_rfid_color(r, g, b):
    rfid_r.value = max(0.0, min(1.0, r))
    rfid_g.value = max(0.0, min(1.0, g))
    rfid_b.value = max(0.0, min(1.0, b))

def set_states(vs=None, vp=None, rs=None):
    global vitals_state, vitals_prog, rfid_state
    with _lock:
        if vs is not None: vitals_state = vs
        if vp is not None: vitals_prog = vp
        if rs is not None: rfid_state = rs

def led_animation_loop():
    complete_until = 0.0
    prev_vs = None
    prev_rs = None
    while not _stop_event.is_set():
        with _lock:
            vs = vitals_state
            prog = vitals_prog
            rs = rfid_state

        # Log state changes (once per transition, not every frame)
        if vs != prev_vs:
            log.info(f"🔆 [LED] Vitals state: {prev_vs} → {vs} (prog={prog:.0%})")
            prev_vs = vs
        if rs != prev_rs:
            log.info(f"🔆 [LED] RFID state: {prev_rs} → {rs}")
            prev_rs = rs

        t = time.time()
        
        # Vitals LED
        if vs == VitalsState.DISCONNECTED:
            set_vitals_color(1.0 if (int(t * 2) % 2 == 0) else 0.0, 0)
        elif vs == VitalsState.IDLE:
            brightness = 0.08 + ((math.sin(t * 2 * math.pi * 0.4) + 1) / 2) * 0.52
            set_vitals_color(0, brightness)
        elif vs == VitalsState.WAITING:
            set_vitals_color(1.0, 0)
        elif vs == VitalsState.FINGER_REMOVED:
            set_vitals_color(1.0 if (int(t * 6) % 2 == 0) else 0.0, 0)
        elif vs == VitalsState.SCANNING:
            set_vitals_color(1.0 - prog, prog)
        elif vs == VitalsState.COMPLETE:
            if complete_until == 0.0: complete_until = t + 2.0
            if t < complete_until: set_vitals_color(0, 1.0)
            else:
                complete_until = 0.0
                set_states(vs=VitalsState.IDLE)

        # RFID LED
        if rs == RfidState.IDLE: set_rfid_color(0, 1.0, 0)
        elif rs == RfidState.SESSION: set_rfid_color(1.0, 0, 0)
        elif rs == RfidState.TEST:
            brightness = 0.3 + ((math.sin(t * 2 * math.pi * 1.5) + 1) / 2) * 0.7
            set_rfid_color(0, 0, brightness)

        time.sleep(0.05)
    
    set_vitals_color(0, 0)
    set_rfid_color(0, 0, 0)

# ==================== HEARTBEAT SETUP ====================
is_scanning = False
hb_sensor = None  # Global reference so socket handlers can call wakeup/shutdown
finger_detected = False
waiting_prompt_sent = False
finger_removed_sent = False
finger_placed_at = 0.0   # timestamp when finger was first detected this scan

SCAN_DURATION = 60.0     # seconds — timer starts from when finger is placed
RATE_SIZE = 8
rates = []
temps = []               # Track temperature readings
last_beat = 0
heart_readings = 0

def reset_scan_state():
    global finger_detected, waiting_prompt_sent, finger_removed_sent, rates, temps, last_beat, heart_readings, finger_placed_at
    with _lock:
        finger_detected = False
        waiting_prompt_sent = False
        finger_removed_sent = False
        rates.clear()
        temps.clear()
        last_beat = time.time()
        heart_readings = 0
        finger_placed_at = 0.0

def complete_scan():
    global is_scanning
    with _lock:
        is_scanning = False
        avg_hr = sum(rates) / len(rates) if rates else 0
        avg_temp = sum(temps) / len(temps) if temps else 0
        sio.emit("pi-vitals-data", {"bpm": avg_hr, "temp": avg_temp, "progress": 100})
        log.info(f"✅ Vitals scan complete. Final HR: {avg_hr:.1f}, Temp: {avg_temp:.1f}")

def heartbeat_loop():
    global finger_detected, waiting_prompt_sent, finger_removed_sent, rates, temps, last_beat, heart_readings, finger_placed_at, hb_sensor
    
    sensor = None
    temp_sensor = None
    if MAX30102:
        MAX_RETRIES = 5
        RETRY_DELAY = 3  # seconds
        log.info(f"🔧 [DEBUG] MAX30102 module found, attempting init (up to {MAX_RETRIES} tries)...")
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                sensor = MAX30102()
                log.info("✅ [DEBUG] MAX30102 initialized successfully on I2C bus.")
                # Put sensor to sleep immediately — it will be woken on scan start.
                # This prevents the FIFO from filling up and stalling during idle.
                sensor.shutdown()
                log.info("💤 [DEBUG] Sensor put into shutdown mode (FIFO won't fill during idle)")
                break
            except Exception as e:
                log.warning(f"MAX30102 init attempt {attempt}/{MAX_RETRIES} failed: {e}")
                if attempt < MAX_RETRIES:
                    log.info(f"Retrying in {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                else:
                    log.error("❌ [DEBUG] MAX30102 could not be initialized after all retries. Falling back to simulation.")
                    sensor = None
    else:
        log.warning("⚠️  [DEBUG] max30102 module missing. Running in SIMULATION mode.")

    MLX_I2C_BUS = int(os.environ.get("MLX_I2C_BUS", 3))
    if MLX90614:
        log.info(f"🔧 [DEBUG] MLX90614 module found, attempting init on I2C bus {MLX_I2C_BUS}...")
        try:
            temp_sensor = MLX90614(bus_num=MLX_I2C_BUS)
            log.info(f"✅ [DEBUG] MLX90614 initialized successfully on I2C bus {MLX_I2C_BUS}.")
        except Exception as e:
            log.error(f"❌ [DEBUG] MLX90614 could not be initialized: {e}")
            temp_sensor = None
    else:
        log.warning("⚠️  [DEBUG] mlx90614 module missing.")

    hb_sensor = sensor  # Store globally for socket handlers
    log.info(f"🔧 [DEBUG] Heartbeat loop started. sensor={'REAL' if sensor else 'SIMULATION'}, is_scanning={is_scanning}")

    loop_count = 0
    null_read_count = 0  # Track consecutive empty FIFO reads
    while not _stop_event.is_set():
        with _lock:
            scanning = is_scanning

        if not scanning:
            # Log idle state every 10 seconds so we know the loop is alive
            loop_count += 1
            null_read_count = 0  # reset when not scanning
            if loop_count % 20 == 0:  # every ~10s at 0.5s sleep
                log.debug(f"💤 [DEBUG] Heartbeat loop idle — waiting for start-vitals-scan event (is_scanning=False)")
            time.sleep(0.5)
            continue

        loop_count = 0  # reset idle counter when scanning

        if sensor:
            try:
                red, ir = sensor.read_sequential()
                if ir is None:
                    null_read_count += 1
                    # Log every 50 null reads (~1 second) so we know FIFO is empty
                    if null_read_count % 50 == 1:
                        log.warning(f"⚠️  [DEBUG] Sensor FIFO empty (null read #{null_read_count}) — no data from MAX30102")
                    if null_read_count >= 500:  # ~10 seconds of nothing
                        log.error(f"❌ [DEBUG] Sensor FIFO stuck after {null_read_count} null reads! Attempting FIFO reset...")
                        try:
                            sensor.wakeup()
                            log.info("🔄 [DEBUG] Sensor FIFO reset + wakeup completed")
                        except Exception as e:
                            log.error(f"❌ [DEBUG] Sensor wakeup failed: {e}")
                        null_read_count = 0
                    time.sleep(0.02)  # FIFO empty, wait for next sample
                    continue
                null_read_count = 0  # Got data, reset counter
                ir_value = ir
                log.debug(f"📡 [DEBUG] Sensor read: red={red}, ir={ir_value}")
            except Exception as e:
                log.error(f"❌ [DEBUG] Sensor read error: {e}")
                ir_value = 0
                time.sleep(0.5)
        else:
            # Simulation mode: always provide a finger-present signal unless
            # we are simulating a 'waiting for finger' pause.
            if not finger_detected and waiting_prompt_sent:
                log.debug("[DEBUG] Simulation: waiting 2s before simulating finger placed...")
                # Simulate brief absence then place finger
                time.sleep(2)
            ir_value = 60000  # Simulated finger-present IR value
            log.debug(f"🧪 [DEBUG] Simulation: ir_value={ir_value}")

        if ir_value < 50000:
            log.debug(f"🔻 [DEBUG] IR below threshold: ir_value={ir_value} < 50000 → no finger")
            if finger_detected:
                log.warning("🔴 [DEBUG] Finger REMOVED during scan! Resetting timer.")
                if not finger_removed_sent:
                    sio.emit("pi-sensor-status", {"status": "finger_removed"})
                    # Emit a 0 progress to reset frontend
                    sio.emit("pi-vitals-progress", {"bpm": 0, "temp": 0, "progress": 0})
                    finger_removed_sent = True
                # Reset timer and readings when finger lifted
                heart_readings = 0
                rates.clear()
                temps.clear()
                finger_placed_at = 0.0
                null_read_count = 0
            else:
                if not waiting_prompt_sent:
                    sio.emit("pi-sensor-status", {"status": "waiting_for_finger"})
                    log.info("🟡 [DEBUG] No finger yet — emitted pi-sensor-status{waiting_for_finger}")
                    waiting_prompt_sent = True
            finger_detected = False
            time.sleep(0.1)
            continue

        # ── Finger is present ────────────────────────────────────────────────
        current_time = time.time()
        
        # Don't start the countdown until we get at least one valid heart reading
        if len(rates) > 0 and finger_placed_at == 0:
            finger_placed_at = current_time
            log.info(f"👆 [DEBUG] First beat detected — starting {SCAN_DURATION}s scan timer")
            
        elapsed = current_time - finger_placed_at if finger_placed_at > 0 else 0
        progress = min(100, int((elapsed / SCAN_DURATION) * 100)) if finger_placed_at > 0 else 0

        # Collect a BPM sample roughly every 0.8 s using raw IR value heuristic
        if current_time - last_beat > 0.8:
            last_beat = current_time
            # Simple IR-to-BPM mapping — replace with hrcalc when hardware is confirmed
            # Simulated value derived from IR amplitude variation
            if ir_value is None:
                continue
            raw_bpm = 60.0 + (int(ir_value) % 30)  # placeholder until real beat detection
            if len(rates) < RATE_SIZE:
                rates.append(float(raw_bpm))
            else:
                rates.pop(0)
                rates.append(float(raw_bpm))
            heart_readings += 1
            
            # Read Temperature
            raw_temp = 0
            if temp_sensor:
                try:
                    t = temp_sensor.read_object_temp_c()
                    # Add debug log for temperature sensor just like heartbeat
                    log.debug(f"🌡️ [DEBUG] MLX90614 read: {t} °C")
                    
                    if t is not None and t > 20 and t < 50:
                        raw_temp = t
                except Exception as e:
                    log.error(f"❌ [DEBUG] MLX90614 read error: {e}")
            else:
                log.debug(f"🌡️ [DEBUG] MLX90614 module missing or not initialized")
            
            if raw_temp > 20:
                if len(temps) < RATE_SIZE * 2:  # Temp can have more samples
                    temps.append(float(raw_temp))
                else:
                    temps.pop(0)
                    temps.append(float(raw_temp))

            log.info(f"💓 [DEBUG] BPM sample #{heart_readings}: raw_bpm={raw_bpm:.1f}, avg_hr={sum(rates)/len(rates):.1f}, temp={raw_temp:.1f}°C")

        avg_hr = sum(rates) / len(rates) if rates else 0

        # Send raw live temperature data to frontend instead of rolling average
        raw_temp_to_emit = raw_temp if raw_temp is not None else 0.0

        emit_payload = {"bpm": avg_hr, "temp": raw_temp_to_emit, "progress": progress}
        sio.emit("pi-vitals-data", emit_payload)
        log.info(f" [DEBUG] Emitted pi-vitals-data → bpm={avg_hr:.1f}, temp={raw_temp_to_emit:.1f}°C, progress={progress}%, elapsed={elapsed:.1f}s")

        if progress >= 100:
            log.info(f"✅ [DEBUG] Progress hit 100% — completing scan. Total BPM samples: {len(rates)}")
            complete_scan()

        time.sleep(0.1)

# ==================== SOCKET.IO CONTROLLER ====================
sio = socketio.Client(reconnection=True, reconnection_delay=1, reconnection_delay_max=10)

@sio.event
def connect():
    log.info(f"✅ Connected to backend at {BACKEND_URL}")
    set_states(vs=VitalsState.IDLE, rs=RfidState.IDLE)

@sio.event
def disconnect():
    log.warning("⚠️  Disconnected from backend")
    set_states(vs=VitalsState.DISCONNECTED)

@sio.event
def connect_error(data):
    log.error(f"❌ Connection error: {data}")
    set_states(vs=VitalsState.DISCONNECTED)

# --- LEDs ---
@sio.on("sensor-status")
def on_sensor_status(data):
    s = data.get("status", "")
    log.info(f"📥 [DEBUG] Received sensor-status: {s}")
    if s == "waiting_for_finger": set_states(vs=VitalsState.WAITING)
    elif s == "finger_removed": set_states(vs=VitalsState.FINGER_REMOVED)

@sio.on("vitals-progress")
def on_vitals_progress(data):
    prog = max(0.0, min(1.0, data.get("progress", 0) / 100.0))
    set_states(vs=VitalsState.SCANNING, vp=prog)

@sio.on("vitals-complete")
def on_vitals_complete(data):
    log.info(f"📥 [DEBUG] Received vitals-complete: {data}")
    set_states(vs=VitalsState.COMPLETE, rs=RfidState.IDLE)

@sio.on("rfid-led-session")
def on_rfid_led_session(data=None):
    log.info("📥 [DEBUG] Received rfid-led-session → LED RED")
    set_states(rs=RfidState.SESSION)

@sio.on("rfid-led-test")
def on_rfid_led_test(data=None):
    log.info("📥 [DEBUG] Received rfid-led-test → LED BLUE")
    set_states(rs=RfidState.TEST)

@sio.on("rfid-led-idle")
def on_rfid_led_idle(data=None):
    log.info("📥 [DEBUG] Received rfid-led-idle → LED GREEN")
    set_states(rs=RfidState.IDLE)

@sio.on("system-reset")
def on_system_reset(data=None):
    log.warning("⚠️  [DEBUG] Received system-reset → resetting all states, is_scanning=False")
    set_states(vs=VitalsState.IDLE, rs=RfidState.IDLE)
    global is_scanning
    with _lock: is_scanning = False

@sio.on("rfid-scan")
def on_rfid_scan(data=None):
    log.info(f"📥 [DEBUG] Received rfid-scan → vitals LED idle")
    set_states(vs=VitalsState.IDLE)

# --- Heartbeat ---
@sio.on("start-vitals-scan")
def on_start_vitals(*args):
    global is_scanning
    log.info("🟢 [DEBUG] Received start-vitals-scan → is_scanning=True")
    # Wake up the sensor and flush FIFO so fresh data flows
    if hb_sensor:
        try:
            hb_sensor.wakeup()
            log.info("🔄 [DEBUG] Sensor woken up + FIFO reset for fresh scan")
        except Exception as e:
            log.error(f"❌ [DEBUG] Sensor wakeup failed: {e}")
    with _lock: is_scanning = True
    reset_scan_state()

@sio.on("stop-vitals-scan")
def on_stop_vitals(*args):
    global is_scanning
    log.warning(f"🟠 [DEBUG] Received stop-vitals-scan → is_scanning=False (was {is_scanning})")
    with _lock: is_scanning = False
    # Put sensor back to sleep to prevent FIFO filling during idle
    if hb_sensor:
        try:
            hb_sensor.shutdown()
            log.info("💤 [DEBUG] Sensor put back to shutdown mode")
        except Exception as e:
            log.error(f"❌ [DEBUG] Sensor shutdown failed: {e}")

# ==================== MAIN ====================
def main():
    log.info("🚀 MediSync Hardware Controller Service starting")
    
    t1 = threading.Thread(target=led_animation_loop, daemon=True)
    t2 = threading.Thread(target=heartbeat_loop, daemon=True)
    t1.start()
    t2.start()

    while True:
        try:
            sio.connect(BACKEND_URL, transports=["websocket", "polling"])
            sio.wait()
        except Exception as exc:
            log.error(f"Socket error: {exc}")
            time.sleep(5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down Hardware Service")
        _stop_event.set()
