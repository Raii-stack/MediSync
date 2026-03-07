# Connecting the Tablet via USB

This guide explains how to connect the Kiosk's Android tablet to the Raspberry Pi via a USB cable instead of Wi-Fi. This is highly recommended as it provides a much more stable and faster connection between the frontend UI and the backend/hardware.

We use **ADB (Android Debug Bridge)** to forward the backend API port over the USB connection.

## Overview

When the tablet is connected via USB, the frontend is accessible directly at `http://localhost:8080` on the Raspberry Pi (no port remapping required). Only the backend API port (3001) needs to be forwarded over USB so the tablet's browser can reach the backend.

## 1. Prepare the Tablet

Before connecting the tablet to the Pi, you must enable Developer Options and USB Debugging:
1. Open the tablet's **Settings** app.
2. Scroll down and tap **About tablet**.
3. Find the **Build number** and tap it **7 times** quickly until you see "You are now a developer!".
4. Go back to the main Settings menu and tap **System** > **Developer options**.
5. Scroll down to the Debugging section and enable **USB debugging**.

## 2. Install the Auto-Forwarding Service

Because tablets can be unplugged or restarted, we provide an automated background service that watches for the tablet and forwards the backend port over USB.

1. Connect the tablet to any of the Raspberry Pi's USB ports using a data-capable USB cable.
2. On the Raspberry Pi, navigate into the MediSync directory and make the installer script executable:
   ```bash
   chmod +x install-adb-service.sh
   chmod +x Kiosk/scripts/adb-auto-forward.sh
   ```
3. Run the installer script:
   ```bash
   ./install-adb-service.sh
   ```
4. **WATCH THE TABLET SCREEN.** The first time this service detects the tablet, the tablet will pop up a dialog box asking: **"Allow USB debugging?"**.
5. Check the box that says **"Always allow from this computer"** and tap **OK**.
6. The background service will now automatically forward the backend port over USB:
   - `tcp:3001` → `tcp:3001` (Backend)

> **Note:** Because this runs as a system service, it starts automatically every time the Raspberry Pi turns on. If the USB cable is unplugged and plugged back in, the service recovers without any action from you.

## 3. Configure the Kiosk App

Because the frontend is now served on port 8080 directly:
1. Open the kiosk browser on the tablet (e.g., Fully Kiosk Browser or Chrome).
2. Set the Start URL to: `http://localhost:8080`
3. Update your `.env` file on the Raspberry Pi so the frontend hits the correct backend port:
   ```env
   VITE_API_URL=http://localhost:3001
   ```
   *(Note: you'll need to rebuild the frontend container or just restart if using dynamic env vars).*

## Troubleshooting

If the connection stops working:
1. Check the live logs of the background service by running:
   ```bash
   sudo journalctl -u medisync-adb.service -f
   ```
2. Verify the USB cable hasn't come loose on either end.
3. Ensure USB Debugging is still enabled on the tablet.
4. Confirm the Start URL in your kiosk browser is set to `http://localhost:8080`.

