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

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
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

IS_COMMON_ANODE = os.environ.get("LED_COMMON_ANODE", "false").lower() == "true"
active_high = not IS_COMMON_ANODE  # True for common cathode (GPIO HIGH = LED ON)

# Common Cathode LEDs — active_high=True so value=1.0 → GPIO HIGH → LED ON
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
    while not _stop_event.is_set():
        with _lock:
            vs = vitals_state
            prog = vitals_prog
            rs = rfid_state

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
finger_detected = False
waiting_prompt_sent = False
finger_removed_sent = False
finger_placed_at = 0.0   # timestamp when finger was first detected this scan

SCAN_DURATION = 40.0     # seconds — timer starts from when finger is placed
RATE_SIZE = 8
rates = []
last_beat = 0
heart_readings = 0

def reset_scan_state():
    global finger_detected, waiting_prompt_sent, finger_removed_sent, rates, last_beat, heart_readings, finger_placed_at
    with _lock:
        finger_detected = False
        waiting_prompt_sent = False
        finger_removed_sent = False
        rates.clear()
        last_beat = time.time()
        heart_readings = 0
        finger_placed_at = 0.0

def complete_scan():
    global is_scanning
    with _lock:
        is_scanning = False
        avg_hr = sum(rates) / len(rates) if rates else 0
        sio.emit("pi-vitals-data", {"bpm": avg_hr, "progress": 100})
        log.info(f"✅ Vitals scan complete. Final HR: {avg_hr:.1f}")

def heartbeat_loop():
    global finger_detected, waiting_prompt_sent, finger_removed_sent, rates, last_beat, heart_readings, finger_placed_at
    
    sensor = None
    if MAX30102:
        MAX_RETRIES = 5
        RETRY_DELAY = 3  # seconds
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                sensor = MAX30102()
                log.info("MAX30102 initialized successfully.")
                break
            except Exception as e:
                log.warning(f"MAX30102 init attempt {attempt}/{MAX_RETRIES} failed: {e}")
                if attempt < MAX_RETRIES:
                    log.info(f"Retrying in {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                else:
                    log.error("MAX30102 could not be initialized after all retries. Falling back to simulation.")
                    sensor = None
    else:
        log.warning("max30102 module missing. Running in simulation.")

    while not _stop_event.is_set():
        with _lock:
            scanning = is_scanning

        if not scanning:
            time.sleep(0.5)
            continue

        if sensor:
            try:
                red, ir = sensor.read_sequential()
                if ir is None:
                    time.sleep(0.02)  # FIFO empty, wait for next sample
                    continue
                ir_value = ir
            except Exception as e:
                log.error(f"Sensor read error: {e}")
                ir_value = 0
                time.sleep(0.5)
        else:
            # Simulation mode: always provide a finger-present signal unless
            # we are simulating a 'waiting for finger' pause.
            if not finger_detected and waiting_prompt_sent:
                # Simulate brief absence then place finger
                time.sleep(2)
            ir_value = 60000  # Simulated finger-present IR value

        if ir_value < 50000:
            if finger_detected:
                if not finger_removed_sent:
                    sio.emit("pi-sensor-status", {"status": "finger_removed"})
                    log.info("🔴 Finger removed — scan progress paused")
                    finger_removed_sent = True
                # Reset timer and readings when finger lifted
                heart_readings = 0
                rates.clear()
                finger_placed_at = 0.0
            else:
                if not waiting_prompt_sent:
                    sio.emit("pi-sensor-status", {"status": "waiting_for_finger"})
                    waiting_prompt_sent = True
            finger_detected = False
            time.sleep(0.1)
            continue

        # ── Finger is present ────────────────────────────────────────────────
        if not finger_detected:
            # First contact — start the 40-second window
            finger_placed_at = time.time()
            log.info("👆 Finger detected — starting 40s scan timer")

        finger_detected = True
        finger_removed_sent = False
        waiting_prompt_sent = False

        current_time = time.time()
        elapsed = current_time - finger_placed_at if finger_placed_at > 0 else 0
        progress = min(100, int((elapsed / SCAN_DURATION) * 100))

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

        avg_hr = sum(rates) / len(rates) if rates else 0

        sio.emit("pi-vitals-data", {"bpm": avg_hr, "progress": progress})
        if heart_readings % 5 == 0:
            log.info(f"📊 Elapsed: {elapsed:.1f}s  Progress: {progress}%  HR: {avg_hr:.1f}")

        if progress >= 100:
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
    if s == "waiting_for_finger": set_states(vs=VitalsState.WAITING)
    elif s == "finger_removed": set_states(vs=VitalsState.FINGER_REMOVED)

@sio.on("vitals-progress")
def on_vitals_progress(data):
    prog = max(0.0, min(1.0, data.get("progress", 0) / 100.0))
    set_states(vs=VitalsState.SCANNING, vp=prog)

@sio.on("vitals-complete")
def on_vitals_complete(data):
    set_states(vs=VitalsState.COMPLETE, rs=RfidState.IDLE)

@sio.on("rfid-led-session")
def on_rfid_led_session(data=None): set_states(rs=RfidState.SESSION)

@sio.on("rfid-led-test")
def on_rfid_led_test(data=None): set_states(rs=RfidState.TEST)

@sio.on("rfid-led-idle")
def on_rfid_led_idle(data=None): set_states(rs=RfidState.IDLE)

@sio.on("system-reset")
def on_system_reset(data=None):
    set_states(vs=VitalsState.IDLE, rs=RfidState.IDLE)
    global is_scanning
    with _lock: is_scanning = False

@sio.on("rfid-scan")
def on_rfid_scan(data=None): set_states(vs=VitalsState.IDLE)

# --- Heartbeat ---
@sio.on("start-vitals-scan")
def on_start_vitals(*args):
    global is_scanning
    log.info("🟢 Start Vitals Scan")
    with _lock: is_scanning = True
    reset_scan_state()

@sio.on("stop-vitals-scan")
def on_stop_vitals(*args):
    global is_scanning
    log.info("🟠 Stop Vitals Scan")
    with _lock: is_scanning = False

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
