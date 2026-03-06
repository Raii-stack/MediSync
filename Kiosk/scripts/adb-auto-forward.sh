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
        # Check if ports are already forwarded by looking for tcp:8080 in reverse list
        if ! adb reverse --list | grep -q "tcp:8080"; then
            echo "[$(date)] Tablet detected. Setting up port forwarding..."

            # Forward Frontend: tablet's localhost:8080 -> Pi's localhost:80
            # (port 80 is privileged; using 8080 on the tablet side avoids permission errors)
            adb reverse tcp:8080 tcp:80
            STATUS_80=$?

            # Forward Backend: tablet's localhost:3001 -> Pi's localhost:3001
            adb reverse tcp:3001 tcp:3001
            STATUS_3001=$?

            if [ $STATUS_80 -eq 0 ] && [ $STATUS_3001 -eq 0 ]; then
                echo "[$(date)] ✅ Ports successfully forwarded (8080→80, 3001→3001)."
            else
                echo "[$(date)] ❌ Failed to forward one or more ports (frontend exit: $STATUS_80, backend exit: $STATUS_3001)."
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
