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
        # Check if ports are already forwarded by looking for tcp:80 in reverse list
        if ! adb reverse --list | grep -q "tcp:80"; then
            echo "[$(date)] Tablet detected. Setting up port forwarding..."
            
            # Forward Frontend (80) and Backend (3001)
            adb reverse tcp:80 tcp:80
            adb reverse tcp:3001 tcp:3001
            
            if [ $? -eq 0 ]; then
                echo "[$(date)] ✅ Ports successfully forwarded (80, 3001)."
            else
                echo "[$(date)] ❌ Failed to forward ports."
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
