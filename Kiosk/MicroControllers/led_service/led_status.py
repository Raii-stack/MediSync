#!/usr/bin/env python3
"""
MediSync RPi Status LED Service
================================
Connects to the kiosk backend via Socket.IO and drives an RGB LED
on the Raspberry Pi's GPIO to reflect the current system state.

LED States:
  - Idle / Connected:       Slow green breathing pulse
  - Waiting for finger:     Solid red
  - Vitals in progress:     Red → green fade (tracks progress %)
  - Vitals complete:        Solid green for 2s, then back to idle
  - Backend disconnected:   Fast red blink

Wiring (BCM pin numbers, configurable via env vars):
  LED_R_PIN = 17  (Red channel, via 220Ω resistor)
  LED_G_PIN = 27  (Green channel, via 220Ω resistor)
  LED_B_PIN = 22  (Blue channel, not used, for future RGB use)
  Common Cathode → GND
"""

import os
import time
import math
import threading
import logging
import socketio

from gpiozero import PWMLED, Device
from gpiozero.pins.rpigpio import RPiGPIOFactory

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [LED] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("led_status")

# ── Configuration (override via environment variables) ────────────────────────
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3001")
LED_R_PIN   = int(os.environ.get("LED_R_PIN", 17))
LED_G_PIN   = int(os.environ.get("LED_G_PIN", 27))
LED_B_PIN   = int(os.environ.get("LED_B_PIN", 22))  # reserved, not driven yet

# ── GPIO Setup ────────────────────────────────────────────────────────────────
Device.pin_factory = RPiGPIOFactory()
led_r = PWMLED(LED_R_PIN)
led_g = PWMLED(LED_G_PIN)

def set_color(r: float, g: float):
    """Set RGB LED brightness. r and g are 0.0–1.0 floats."""
    led_r.value = max(0.0, min(1.0, r))
    led_g.value = max(0.0, min(1.0, g))

def off():
    set_color(0, 0)

# ── LED State Machine ─────────────────────────────────────────────────────────
class LEDState:
    IDLE        = "idle"
    WAITING     = "waiting_for_finger"
    SCANNING    = "scanning"
    COMPLETE    = "complete"
    DISCONNECTED = "disconnected"

state       = LEDState.DISCONNECTED
vitals_prog = 0.0          # 0.0 – 1.0
_lock       = threading.Lock()
_stop_event = threading.Event()

def set_state(new_state: str, progress: float = 0.0):
    global state, vitals_prog
    with _lock:
        state = new_state
        vitals_prog = progress

# ── Animation Thread ──────────────────────────────────────────────────────────
def animation_loop():
    """Runs in background thread and continuously updates the LED."""
    complete_until = 0.0

    while not _stop_event.is_set():
        with _lock:
            current_state = state
            prog = vitals_prog

        t = time.time()

        if current_state == LEDState.DISCONNECTED:
            # Fast red blink (2 Hz)
            val = 1.0 if (int(t * 2) % 2 == 0) else 0.0
            set_color(val, 0)

        elif current_state == LEDState.IDLE:
            # Slow green sine-wave breathing (~0.4 Hz)
            brightness = (math.sin(t * 2 * math.pi * 0.4) + 1) / 2
            # Scale 0.08–0.6 so it never fully turns off
            brightness = 0.08 + brightness * 0.52
            set_color(0, brightness)

        elif current_state == LEDState.WAITING:
            # Solid red
            set_color(1.0, 0)

        elif current_state == LEDState.SCANNING:
            # Fade from red (progress=0) to green (progress=1)
            r = 1.0 - prog
            g = prog
            set_color(r, g)

        elif current_state == LEDState.COMPLETE:
            # Solid green for 2 s, then switch back to idle
            if complete_until == 0.0:
                complete_until = t + 2.0
            if t < complete_until:
                set_color(0, 1.0)
            else:
                complete_until = 0.0
                set_state(LEDState.IDLE)

        time.sleep(0.05)  # ~20 fps update rate

    off()

# ── Socket.IO Client ──────────────────────────────────────────────────────────
sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=0,       # infinite
    reconnection_delay=1,
    reconnection_delay_max=10,
    logger=False,
    engineio_logger=False,
)

@sio.event
def connect():
    log.info(f"✅ Connected to backend at {BACKEND_URL}")
    set_state(LEDState.IDLE)

@sio.event
def disconnect():
    log.warning("⚠️  Disconnected from backend")
    set_state(LEDState.DISCONNECTED)

@sio.event
def connect_error(data):
    log.error(f"❌ Connection error: {data}")
    set_state(LEDState.DISCONNECTED)

# sensor-status: {"status": "waiting_for_finger"}
@sio.on("sensor-status")
def on_sensor_status(data):
    status = data.get("status", "")
    if status == "waiting_for_finger":
        log.info("🔴 Waiting for finger")
        set_state(LEDState.WAITING)

# vitals-progress: {"bpm": X, "temp": Y, "progress": 0-100}
@sio.on("vitals-progress")
def on_vitals_progress(data):
    raw = data.get("progress", 0)
    # Backend sends progress as 0-100
    prog = max(0.0, min(1.0, raw / 100.0))
    log.debug(f"📊 Vitals progress: {prog:.0%}")
    set_state(LEDState.SCANNING, progress=prog)

# vitals-complete: {"avg_bpm": X, "temp": Y}
@sio.on("vitals-complete")
def on_vitals_complete(data):
    log.info("✅ Vitals complete")
    set_state(LEDState.COMPLETE)

# session reset / idle
@sio.on("rfid-scan")
def on_rfid_scan(data):
    # When a new RFID is scanned, reset to idle until vitals start
    set_state(LEDState.IDLE)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info(f"🚀 MediSync LED Status Service starting")
    log.info(f"   Backend : {BACKEND_URL}")
    log.info(f"   LED pins: R=GPIO{LED_R_PIN}  G=GPIO{LED_G_PIN}  B=GPIO{LED_B_PIN}(unused)")

    # Start animation in background thread
    anim_thread = threading.Thread(target=animation_loop, daemon=True)
    anim_thread.start()

    # Keep reconnecting to backend
    while True:
        try:
            log.info(f"🔗 Connecting to {BACKEND_URL} ...")
            sio.connect(BACKEND_URL, transports=["websocket", "polling"])
            sio.wait()
        except Exception as exc:
            log.error(f"Socket error: {exc}")
            set_state(LEDState.DISCONNECTED)
            time.sleep(5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down LED service")
        _stop_event.set()
        off()
