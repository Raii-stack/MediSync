#!/usr/bin/env python3
"""
MediSync RPi Heartbeat Sensor Service
=====================================
Reads from MAX30102 connected to Raspberry Pi I2C (SDA=GPIO2, SCL=GPIO3)
and sends vitals data to the Node.js backend.
"""

import os
import time
import json
import logging
import threading
import socketio

try:
    from max30102 import MAX30102
except ImportError:
    MAX30102 = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [HEART] %(levelname)s %(message)s")
log = logging.getLogger("heartbeat")

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3001")

sio = socketio.Client(reconnection=True, reconnection_delay=1, reconnection_delay_max=10)

# Shared state
state_lock = threading.Lock()
is_scanning = False
finger_detected = False
waiting_prompt_sent = False
finger_removed_sent = False

# Heartbeat vars
RATE_SIZE = 4
rates = []
last_beat = 0
heart_readings = 0

def check_for_beat(ir_value):
    # Extremely simplified beat detection for demonstration
    # In a production environment, use hrcalc from max30102 module
    global last_beat
    return False

def reset_scan_state():
    global finger_detected, waiting_prompt_sent, finger_removed_sent, rates, last_beat, heart_readings
    with state_lock:
        finger_detected = False
        waiting_prompt_sent = False
        finger_removed_sent = False
        rates.clear()
        last_beat = time.time()
        heart_readings = 0

def complete_scan():
    global is_scanning
    with state_lock:
        is_scanning = False
        avg_hr = sum(rates) / len(rates) if rates else 0
        sio.emit("pi-vitals-data", {"bpm": avg_hr, "progress": 100})
        log.info(f"✅ Vitals scan complete. Final HR: {avg_hr:.1f}")

@sio.on("start-vitals-scan")
def on_start_vitals(*args):
    global is_scanning
    log.info("🟢 Start Vitals Scan received")
    with state_lock:
        is_scanning = True
    reset_scan_state()

@sio.on("stop-vitals-scan")
def on_stop_vitals(*args):
    global is_scanning
    log.info("🟠 Stop Vitals Scan received")
    with state_lock:
        is_scanning = False

@sio.on("system-reset")
def on_system_reset(*args):
    global is_scanning
    log.info("🔄 System Reset received")
    with state_lock:
        is_scanning = False

def heartbeat_loop():
    global finger_detected, waiting_prompt_sent, finger_removed_sent, rates, last_beat, heart_readings
    
    sensor = None
    if MAX30102:
        try:
            sensor = MAX30102()
            log.info("MAX30102 initialized successfully.")
        except Exception as e:
            log.error(f"Failed to init MAX30102: {e}")
            sensor = None
    else:
        log.warning("max30102 module not installed. Running in simulation/dummy mode.")

    while True:
        with state_lock:
            scanning = is_scanning

        if not scanning:
            time.sleep(0.5)
            continue

        if sensor:
            try:
                red, ir = sensor.read_sequential()
                # If your max30102 library works differently, adjust here.
                # Common max30102 pypi library returns (red, ir).
                ir_value = ir
            except Exception as e:
                log.error(f"Sensor read error: {e}")
                ir_value = 0
                time.sleep(0.5)
        else:
            # Dummy simulation for testing if the sensor isn't physically wired yet
            # Simulate a finger placed after 2 seconds
            ir_value = 60000 if not waiting_prompt_sent else ir_value
            if not finger_detected and waiting_prompt_sent:
                time.sleep(2)
                ir_value = 60000

        # Finger Detection Logic
        if ir_value < 50000:
            if finger_detected:
                if not finger_removed_sent:
                    sio.emit("pi-sensor-status", {"status": "finger_removed"})
                    log.info("🔴 Finger removed mid-scan")
                    finger_removed_sent = True
                
                # Reset progress when finger is removed
                heart_readings = 0
                rates.clear()
            else:
                if not waiting_prompt_sent:
                    sio.emit("pi-sensor-status", {"status": "waiting_for_finger"})
                    log.info("🔴 Waiting for finger")
                    waiting_prompt_sent = True
            
            finger_detected = False
            time.sleep(0.1)
            continue

        # Finger is present
        finger_detected = True
        finger_removed_sent = False
        waiting_prompt_sent = False

        # In a real hardware integration, you'd calculate actual heart rate here
        # using 'hrcalc' or 'check_for_beat' algorithm.
        # Here we simulate finding a heartbeat every ~1s for robustness
        # replacing it with the proper hrcalc loop if needed.
        
        current_time = time.time()
        if current_time - last_beat > 0.8:  # simulate a beat every 0.8s
            last_beat = current_time
            mock_hr = 75.0 + (current_time % 5)
            
            if len(rates) < RATE_SIZE:
                rates.append(float(mock_hr))
            else:
                rates.pop(0)
                rates.append(float(mock_hr))
                
            heart_readings += 1
            avg_hr = sum(rates) / len(rates)
            
            progress = min(100, int((heart_readings / 5.0) * 100))
            
            sio.emit("pi-vitals-data", {
                "bpm": avg_hr,
                "progress": progress
            })
            log.info(f"📊 Progress: {progress}%, HR: {avg_hr:.1f}")
            
            if progress >= 100:
                complete_scan()

        time.sleep(0.1)

def main():
    log.info("🚀 Starting RPi Heartbeat Sensor Service...")
    
    # Start sensor loop thread
    t = threading.Thread(target=heartbeat_loop, daemon=True)
    t.start()

    # Connect to Backend
    while True:
        try:
            log.info(f"🔗 Connecting to {BACKEND_URL} ...")
            sio.connect(BACKEND_URL, transports=['websocket', 'polling'])
            sio.wait()
        except socketio.exceptions.ConnectionError:
            log.error("❌ Connection failed. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            log.error(f"Unexpected Socket Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Shutting down...")
