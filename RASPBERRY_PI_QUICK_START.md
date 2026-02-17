# MediSync Raspberry Pi 3B - Quick Setup Summary

## What You Need for Backend Setup

### System Requirements

- **Raspberry Pi 3B+** with at least 1GB RAM (2GB+ recommended)
- **Raspberry Pi OS (Lite or Desktop)** or similar Linux ARM distro
- **Power Supply:** 2.5A minimum
- **SD Card:** 16GB minimum (32GB recommended)

### Key Dependencies

#### 1. Docker & Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 2. NetworkManager (Required for WiFi API)

```bash
sudo apt-get install -y network-manager dbus
sudo systemctl enable NetworkManager
sudo systemctl start NetworkManager
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         Raspberry Pi 3B (Production Docker)              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐        ┌──────────────────┐       │
│  │   Backend API    │        │  Frontend SPA    │       │
│  │  (Node.js)       │        │  (React/Vite)    │       │
│  │  Port: 3001      │        │  Port: 80/5173   │       │
│  └──────────────────┘        └──────────────────┘       │
│         ▲                           ▲                    │
│         │                           │                    │
│  ┌──────┴───────────────────────────┴────┐              │
│  │      Docker Network (medisync)         │              │
│  └──────────────────────────────────────┘              │
│         ▲                                               │
│         │                                               │
│  ┌──────┴─────────────────────────┐                    │
│  │   Persistent Data Volume        │                    │
│  │   ├─ kiosk.db (SQLite)         │                    │
│  │   └─ logs/                      │                    │
│  └─────────────────────────────────┘                    │
│                                                         │
│  ┌──────────────────────────────┐                      │
│  │   System Integration          │                      │
│  │   └─ /run/dbus (WiFi Mgmt)   │                      │
│  └──────────────────────────────┘                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
         │
         │ Ethernet/WiFi
         ▼
    ┌──────────────┐
    │ Network      │
    │ (WiFi/ETH)   │
    └──────────────┘
         │
         │ USB Serial
         ▼
    ┌─────────────────────────────┐
    │        ESP32                │
    │  ├─ RFID Reader (RC522)    │
    │  ├─ Vital Signs Sensors    │
    │  └─ Servo Control          │
    └─────────────────────────────┘
```

---

## WiFi Configuration - What's Required

### Backend Implementation (UPDATED)

The backend now includes **NetworkManager CLI (nmcli)** integration for:

- **GET /api/scan** - Scans and returns available WiFi networks
- **POST /api/connect** - Connects to a specified WiFi network

### Frontend (Admin Panel)

The WiFiSettingsModal component provides:

- Network scanning with signal strength visualization
- Password entry for secured networks
- Connection status indication
- Open network instant connection

### Setup on Raspberry Pi

1. **Install NetworkManager**

   ```bash
   sudo apt-get install -y network-manager dbus
   ```

2. **Backend Changes** (Already Done)
   - `server.js` now uses `execSync` to run `nmcli` commands
   - Falls back to mock data if NetworkManager unavailable
   - Handles WPA2, WPA3, and Open networks

3. **Docker Configuration** (Updated)
   - Mounts `/run/dbus` for NetworkManager socket
   - Installs `networkmanager` in backend container
   - Runs with `cap_add: SYS_ADMIN` capability

### Testing WiFi API

```bash
# Scan for networks
curl http://localhost:3001/api/scan

# Connect to WiFi
curl -X POST http://localhost:3001/api/connect \
  -H "Content-Type: application/json" \
  -d '{"ssid":"MyNetwork","password":"MyPassword"}'
```

---

## Backend Dependencies

### Required Node Packages

```json
{
  "express": "^5.2.1",
  "socket.io": "^4.8.3",
  "sqlite3": "^5.0.2",
  "serialport": "^13.0.0",
  "axios": "^1.13.4",
  "cors": "^2.8.6",
  "dotenv": "^17.2.4"
}
```

### Environment Variables

```env
NODE_ENV=production
KIOSK_ID=kiosk-rpi-001
CLINIC_SOCKET_URL=http://clinic-server:3000
LOG_LEVEL=info
```

---

## Hardware Integration

### ESP32 Connection

The RFID reader and vital signs sensors are all connected to the **ESP32 microcontroller**, not directly to the Raspberry Pi:

```
ESP32 (Microcontroller)
├─ RFID Reader (RC522)     - I2C/SPI
├─ Temperature Sensor      - Analog/I2C
├─ Heart Rate Sensor       - Analog/I2C
└─ Servo Motors            - GPIO PWM

    ↓ USB Serial

Raspberry Pi Backend
└─ Node.js Server (port 3001)
```

The backend communicates with the ESP32 via:
- **Serial USB connection** - At `/dev/ttyUSB0` (on host)
- Or **Network connection** - If WiFi between devices

### Raspberry Pi Docker Compose (Production)

The file `docker-compose.prod.yml` includes:

- ARM-compatible images (node:20-alpine)
- D-Bus socket for WiFi management (admin panel WiFi settings)
- Persistent data volumes
- Auto-restart policy

---

## Deployment Steps

### 1. One-Command Setup (Recommended)

```bash
cd ~/medisync
./RASPBERRY_PI_SETUP.md  # Follow the guide

# Quick deployment:
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### 2. Verify Installation

```bash
# Check containers
docker ps

# Test backend
curl http://localhost:3001/api/inventory

# Test WiFi API
curl http://localhost:3001/api/scan

# View logs
docker logs medisync-backend-prod -f
```

### 3. Enable Auto-Startup (systemd)

```bash
sudo systemctl enable medisync
sudo systemctl start medisync
```

---

## Troubleshooting WiFi Issues

| Issue                               | Solution                                                              |
| ----------------------------------- | --------------------------------------------------------------------- |
| `nmcli: command not found`          | Install NetworkManager: `sudo apt-get install network-manager`        |
| WiFi API returns mock data          | Check if NetworkManager is running: `systemctl status NetworkManager` |
| Connection fails with "auth failed" | Verify SSID/password in Admin Panel, check network password           |
| D-Bus permission denied             | Ensure `/run/dbus` is mounted in docker-compose.prod.yml              |
| No networks detected                | Run `nmcli dev wifi list` on host to verify WiFi hardware             |

---

## Quick Reference

### Access Points

| Service     | URL                       | Purpose                        |
| ----------- | ------------------------- | ------------------------------ |
| Frontend    | `http://<rpi-ip>`         | Main kiosk interface           |
| Admin Panel | `http://<rpi-ip>#/admin`  | Admin controls & WiFi settings |
| Backend API | `http://<rpi-ip>:3001`    | API endpoints                  |
| Logs        | `docker logs <container>` | Debug information              |

### Key Files Updated

- ✅ [server.js](../Kiosk/Backend/server.js) - WiFi endpoints with nmcli
- ✅ [docker-compose.prod.yml](../docker-compose.prod.yml) - Production config
- ✅ [Dockerfile.prod](../Kiosk/Backend/Dockerfile.prod) - Backend build
- ✅ [Dockerfile.prod](../Kiosk/Frontend/Dockerfile.prod) - Frontend build
- ✅ [RASPBERRY_PI_SETUP.md](../RASPBERRY_PI_SETUP.md) - Full guide

---

## Next Steps

1. **Follow RASPBERRY_PI_SETUP.md** for detailed step-by-step guide
2. **Test WiFi functionality** through Admin Panel
3. **Configure initial WiFi** connection with NetworkManager
4. **Set up auto-backup** cronjob for database
5. **Enable systemd auto-start** for production reliability
