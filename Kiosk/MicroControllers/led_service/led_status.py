#!/usr/bin/env python3
"""
MediSync RPi Status LED Service
================================
Drives TWO RGB LEDs on the Raspberry Pi via GPIO, subscribed to the
kiosk backend via Socket.IO.

 ┌──────────────────────────────────────────────────────────────┐
 │  VITALS LED  (GPIO 17=R, 27=G)                               │
 │    Idle/connected   → Slow green breathing pulse             │
 │    Waiting (finger) → Solid red                              │
 │    Scanning         → Red → green fade (tracks progress %)   │
 │    Vitals complete  → Solid green 2s, then idle              │
 │    Disconnected     → Fast red blink                         │
 ├──────────────────────────────────────────────────────────────┤
 │  RFID LED    (GPIO 23=R, 24=G, 25=B)                         │
 │    Idle             → Solid green                            │
 │    Session active   → Solid red  (scan/start called)         │
 │    Test mode        → Solid blue (rfid-test/start called)    │
 └──────────────────────────────────────────────────────────────┘

Both LEDs reset to idle on page refresh (system-reset event).

Wiring: Common Cathode RGB LEDs, 220Ω resistors on each channel.
Configure pins via environment variables (see defaults below).
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

# ── Configuration ─────────────────────────────────────────────────────────────
BACKEND_URL      = os.environ.get("BACKEND_URL",     "http://localhost:3001")

# Vitals LED (R + G only — no blue channel needed)
VITALS_R_PIN     = int(os.environ.get("LED_R_PIN",        17))
VITALS_G_PIN     = int(os.environ.get("LED_G_PIN",        27))

# RFID Status LED (full R/G/B for green / red / blue states)
RFID_R_PIN       = int(os.environ.get("RFID_LED_R_PIN",   23))
RFID_G_PIN       = int(os.environ.get("RFID_LED_G_PIN",   24))
RFID_B_PIN       = int(os.environ.get("RFID_LED_B_PIN",   25))

# ── GPIO Setup ────────────────────────────────────────────────────────────────
Device.pin_factory = RPiGPIOFactory()

# Common Anode LEDs are HIGH=OFF, LOW=ON. Set active_high=False so 1.0=ON, 0.0=OFF in code.
IS_COMMON_ANODE = os.environ.get("LED_COMMON_ANODE", "true").lower() == "true"
active_high = not IS_COMMON_ANODE

vitals_r = PWMLED(VITALS_R_PIN, active_high=active_high)
vitals_g = PWMLED(VITALS_G_PIN, active_high=active_high)

rfid_r   = PWMLED(RFID_R_PIN, active_high=active_high)
rfid_g   = PWMLED(RFID_G_PIN, active_high=active_high)
rfid_b   = PWMLED(RFID_B_PIN, active_high=active_high)


def set_vitals_color(r: float, g: float):
    """Set vitals LED brightness. Values are 0.0–1.0."""
    vitals_r.value = max(0.0, min(1.0, r))
    vitals_g.value = max(0.0, min(1.0, g))


def set_rfid_color(r: float, g: float, b: float):
    """Set RFID status LED brightness. Values are 0.0–1.0."""
    rfid_r.value = max(0.0, min(1.0, r))
    rfid_g.value = max(0.0, min(1.0, g))
    rfid_b.value = max(0.0, min(1.0, b))


def all_off():
    set_vitals_color(0, 0)
    set_rfid_color(0, 0, 0)


# ── Vitals LED State Machine ──────────────────────────────────────────────────
class VitalsState:
    IDLE           = "idle"
    WAITING        = "waiting_for_finger"
    FINGER_REMOVED = "finger_removed"   # finger lifted mid-scan — fast red blink
    SCANNING       = "scanning"
    COMPLETE       = "complete"
    DISCONNECTED   = "disconnected"


# ── RFID LED State Machine ────────────────────────────────────────────────────
class RfidState:
    IDLE    = "idle"     # green
    SESSION = "session"  # red  — vitals session active
    TEST    = "test"     # blue — RFID test mode


# ── Shared State ──────────────────────────────────────────────────────────────
vitals_state = VitalsState.DISCONNECTED
vitals_prog  = 0.0
rfid_state   = RfidState.IDLE
_lock        = threading.Lock()
_stop_event  = threading.Event()


def set_vitals_state(new_state: str, progress: float = 0.0):
    global vitals_state, vitals_prog
    with _lock:
        vitals_state = new_state
        vitals_prog  = progress


def set_rfid_state(new_state: str):
    global rfid_state
    with _lock:
        rfid_state = new_state


# ── Animation Thread ──────────────────────────────────────────────────────────
def animation_loop():
    """Runs in background thread; updates both LEDs at ~20 fps."""
    complete_until = 0.0

    while not _stop_event.is_set():
        with _lock:
            vs   = vitals_state
            prog = vitals_prog
            rs   = rfid_state

        t = time.time()

        # ── Vitals LED ────────────────────────────────────────────────────────
        if vs == VitalsState.DISCONNECTED:
            val = 1.0 if (int(t * 2) % 2 == 0) else 0.0  # fast red blink
            set_vitals_color(val, 0)

        elif vs == VitalsState.IDLE:
            brightness = (math.sin(t * 2 * math.pi * 0.4) + 1) / 2
            brightness = 0.08 + brightness * 0.52           # 0.08–0.60
            set_vitals_color(0, brightness)                  # slow green breathe

        elif vs == VitalsState.WAITING:
            set_vitals_color(1.0, 0)                         # solid red

        elif vs == VitalsState.FINGER_REMOVED:
            # Fast red blink ~3 Hz — urgent: put finger back
            val = 1.0 if (int(t * 6) % 2 == 0) else 0.0
            set_vitals_color(val, 0)

        elif vs == VitalsState.SCANNING:
            set_vitals_color(1.0 - prog, prog)               # red→green fade

        elif vs == VitalsState.COMPLETE:
            if complete_until == 0.0:
                complete_until = t + 2.0
            if t < complete_until:
                set_vitals_color(0, 1.0)                     # solid green
            else:
                complete_until = 0.0
                set_vitals_state(VitalsState.IDLE)

        # ── RFID LED ──────────────────────────────────────────────────────────
        if rs == RfidState.IDLE:
            set_rfid_color(0, 1.0, 0)        # solid green

        elif rs == RfidState.SESSION:
            set_rfid_color(1.0, 0, 0)        # solid red

        elif rs == RfidState.TEST:
            # Gentle blue pulse so it's clearly different from solid
            brightness = (math.sin(t * 2 * math.pi * 1.5) + 1) / 2
            brightness = 0.3 + brightness * 0.7
            set_rfid_color(0, 0, brightness)  # pulsing blue

        time.sleep(0.05)

    all_off()


# ── Socket.IO Client ──────────────────────────────────────────────────────────
sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=0,
    reconnection_delay=1,
    reconnection_delay_max=10,
    logger=False,
    engineio_logger=False,
)

# ── Vitals events ─────────────────────────────────────────────────────────────
@sio.event
def connect():
    log.info(f"✅ Connected to backend at {BACKEND_URL}")
    set_vitals_state(VitalsState.IDLE)
    set_rfid_state(RfidState.IDLE)

@sio.event
def disconnect():
    log.warning("⚠️  Disconnected from backend")
    set_vitals_state(VitalsState.DISCONNECTED)
    # Keep RFID LED at last known state; it'll reset on reconnect / system-reset

@sio.event
def connect_error(data):
    log.error(f"❌ Connection error: {data}")
    set_vitals_state(VitalsState.DISCONNECTED)

@sio.on("sensor-status")
def on_sensor_status(data):
    status = data.get("status", "")
    if status == "waiting_for_finger":
        log.info("🔴 [VITALS] Waiting for finger")
        set_vitals_state(VitalsState.WAITING)
    elif status == "finger_removed":
        log.info("🔴 [VITALS] Finger removed — blinking")
        set_vitals_state(VitalsState.FINGER_REMOVED)

@sio.on("vitals-progress")
def on_vitals_progress(data):
    raw  = data.get("progress", 0)
    prog = max(0.0, min(1.0, raw / 100.0))
    log.debug(f"📊 [VITALS] Progress: {prog:.0%}")
    # Finger is back on sensor — return to scanning regardless of previous state
    set_vitals_state(VitalsState.SCANNING, progress=prog)

@sio.on("vitals-complete")
def on_vitals_complete(data):
    log.info("✅ [VITALS] Complete")
    set_vitals_state(VitalsState.COMPLETE)
    # Session is done — RFID LED back to idle
    set_rfid_state(RfidState.IDLE)

# ── RFID events ───────────────────────────────────────────────────────────────
@sio.on("rfid-led-session")
def on_rfid_led_session(data=None):
    log.info("🔴 [RFID LED] Session active")
    set_rfid_state(RfidState.SESSION)

@sio.on("rfid-led-test")
def on_rfid_led_test(data=None):
    log.info("🔵 [RFID LED] Test mode")
    set_rfid_state(RfidState.TEST)

@sio.on("rfid-led-idle")
def on_rfid_led_idle(data=None):
    log.info("🟢 [RFID LED] Idle")
    set_rfid_state(RfidState.IDLE)

# ── System reset (page refresh / disconnect) ──────────────────────────────────
@sio.on("system-reset")
def on_system_reset(data=None):
    log.info("↩️  System reset — all LEDs to idle")
    set_vitals_state(VitalsState.IDLE)
    set_rfid_state(RfidState.IDLE)

@sio.on("rfid-scan")
def on_rfid_scan(data=None):
    # A new RFID scan means a fresh session start — vitals LED back to idle
    # (rfid-led-session will follow from scan/start)
    set_vitals_state(VitalsState.IDLE)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info("🚀 MediSync LED Status Service starting")
    log.info(f"   Backend     : {BACKEND_URL}")
    log.info(f"   Vitals LED  : R=GPIO{VITALS_R_PIN}  G=GPIO{VITALS_G_PIN}")
    log.info(f"   RFID LED    : R=GPIO{RFID_R_PIN}  G=GPIO{RFID_G_PIN}  B=GPIO{RFID_B_PIN}")

    anim_thread = threading.Thread(target=animation_loop, daemon=True)
    anim_thread.start()

    while True:
        try:
            log.info(f"🔗 Connecting to {BACKEND_URL} ...")
            sio.connect(BACKEND_URL, transports=["websocket", "polling"])
            sio.wait()
        except Exception as exc:
            log.error(f"Socket error: {exc}")
            set_vitals_state(VitalsState.DISCONNECTED)
            time.sleep(5)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down LED service")
        _stop_event.set()
        all_off()
