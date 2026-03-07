#!/bin/bash

# ==============================================================================
# MediSync Kiosk - Auto ADB Port Forwarding Service
# ==============================================================================
# This script runs continuously in the background. It watches for a connected
# Android tablet via USB and automatically sets up port forwarding when detected.
# If the tablet is unplugged and plugged back in, it re-establishes the connection.
# ==============================================================================

echo "Starting Auto ADB Port Forwarding Service..."

# Ensure ADB is running
adb start-server

while true; do
    # Check if a device is connected and authorized
    if adb devices | grep -q "\<device\>"; then
        # Check if backend or frontend ports are already forwarded
        if ! adb reverse --list | grep -q "tcp:3001" || ! adb reverse --list | grep -q "tcp:8080"; then
            echo "[$(date)] Tablet detected. Setting up port forwarding..."

            # Forward Backend: tablet's localhost:3001 -> Pi's localhost:3001
            adb reverse tcp:3001 tcp:3001
            STATUS_3001=$?

            # Forward Frontend: tablet's localhost:8080 -> Pi's localhost:8080
            adb reverse tcp:8080 tcp:8080
            STATUS_8080=$?

            if [ $STATUS_3001 -eq 0 ]; then
                echo "[$(date)] ✅ Backend port successfully forwarded (3001→3001)."
            else
                echo "[$(date)] ❌ Failed to forward backend port (exit: $STATUS_3001)."
            fi

            if [ $STATUS_8080 -eq 0 ]; then
                echo "[$(date)] ✅ Frontend port successfully forwarded (8080→8080)."
            else
                echo "[$(date)] ❌ Failed to forward frontend port (exit: $STATUS_8080)."
            fi
        fi
    else
        # If devices shows "unauthorized", log a warning occasionally
        if adb devices | grep -q "unauthorized"; then
            echo "[$(date)] ⚠️ Tablet is connected but UNAUTHORIZED. Please tap 'OK' on the tablet screen."
        fi
    fi

    # Check every 5 seconds
    sleep 5
done
