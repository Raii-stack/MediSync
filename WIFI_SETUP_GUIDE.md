# WiFi Management Integration - Complete Setup Guide

## Overview

The MediSync Admin Panel includes a WiFi Settings feature that allows administrators to scan for available networks and connect to WiFi directly from the kiosk interface.

---

## Architecture

### Frontend Component: WiFiSettingsModal

Location: [src/components/WiFiSettingsModal.tsx](../Kiosk/Frontend/src/components/WiFiSettingsModal.tsx)

**Features:**

- Real-time network scanning with signal strength visualization
- Support for WPA2, WPA3, and Open networks
- Secure password entry with masked input
- Network connection status indication
- Auto-scan when modal opens
- Error handling with toast notifications

**API Endpoints Called:**

```
GET  /api/scan       - Retrieve available WiFi networks
POST /api/connect    - Connect to selected network
```

### Backend Endpoints: Updated WiFi API

Location: [server.js](../Kiosk/Backend/server.js) (Lines 598-678)

#### GET /api/scan

Returns list of available WiFi networks with signal strength and security type.

**Response:**

```json
{
  "success": true,
  "networks": [
    {
      "ssid": "SchoolNet_5G",
      "signalStrength": 95,
      "security": "WPA2",
      "isConnected": false
    },
    {
      "ssid": "Guest_WiFi",
      "signalStrength": 65,
      "security": "Open",
      "isConnected": false
    }
  ]
}
```

#### POST /api/connect

Connects to a specified WiFi network with optional password.

**Request:**

```json
{
  "ssid": "SchoolNet_5G",
  "password": "yourpassword"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Connected to SchoolNet_5G",
  "ssid": "SchoolNet_5G"
}
```

---

## Implementation Details

### Backend Technology

**NetworkManager CLI (nmcli)**
The backend uses `nmcli` (NetworkManager command-line interface) to manage WiFi:

```javascript
// Import at top of server.js
const { execSync } = require("child_process");

// Scan networks
execSync("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list");

// Connect to network
execSync(`nmcli dev wifi connect "${ssid}" password "${password}"`);
```

**Key Features:**

- Parses nmcli output to extract network details
- Handles both WPA2/WPA3 (password-protected) and Open networks
- Automatic security type detection
- Returns active connection status
- Graceful fallback to mock data if NetworkManager unavailable

### Docker Integration

The Docker setup ensures WiFi management works inside containers:

**In docker-compose.prod.yml:**

```yaml
backend:
  volumes:
    - /run/dbus:/run/dbus # Required for NetworkManager socket
  cap_add:
    - SYS_ADMIN # Required for network operations
```

**In Dockerfile.prod:**

```dockerfile
RUN apk add --no-cache \
    networkmanager \
    dbus \
    tini
```

---

## Prerequisites for WiFi Functionality

### 1. Raspberry Pi Host Requirements

```bash
# Install NetworkManager
sudo apt-get install -y network-manager dbus

# Verify installation
nmcli --version  # Should be 1.x or higher

# Start and enable NetworkManager
sudo systemctl start NetworkManager
sudo systemctl enable NetworkManager

# Check status
nmcli device status
nmcli device show wlan0

# Test WiFi scanning
nmcli dev wifi list  # Should see available networks
```

### 2. Disable Competing Network Services

**If using dhcpcd (default Raspberry Pi OS):**

```bash
# Stop dhcpcd as it conflicts with NetworkManager
sudo systemctl stop dhcpcd
sudo systemctl disable dhcpcd
```

**Check what's managing your network:**

```bash
ps aux | grep -E "dhcpcd|wpa_supplicant|NetworkManager"
```

### 3. Set WiFi Interface to Managed Mode

```bash
# Check if interface is managed
nmcli device

# If not managed, edit NetworkManager config:
sudo nano /etc/NetworkManager/conf.d/default-wifi-powersave.conf

# Ensure it contains:
[connection]
wifi.powersave = 2

# Restart NetworkManager
sudo systemctl restart NetworkManager
```

---

## Setup Steps

### Step 1: Prepare the Raspberry Pi

```bash
# 1. Update system
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install NetworkManager
sudo apt-get install -y network-manager network-manager-gnome dbus

# 3. Disable dhcpcd (if present)
sudo systemctl disable dhcpcd
sudo systemctl stop dhcpcd

# 4. Start NetworkManager
sudo systemctl restart NetworkManager

# 5. Verify it's working
nmcli connection show
nmcli dev wifi list
```

### Step 2: Deploy Backend with WiFi Support

```bash
# Navigate to project directory
cd ~/medisync

# The backend now includes WiFi support (code already updated)
# Dockerfile.prod includes NetworkManager installation

# Build the image
docker compose -f docker-compose.prod.yml build backend

# Start the services
docker compose -f docker-compose.prod.yml up -d
```

### Step 3: Verify Backend WiFi Endpoints

```bash
# Test WiFi scan endpoint
curl -X GET http://localhost:3001/api/scan | jq

# Expected output:
# {
#   "success": true,
#   "networks": [
#     {
#       "ssid": "YourNetwork",
#       "signalStrength": 85,
#       "security": "WPA2",
#       "isConnected": false
#     }
#   ]
# }

# Check backend logs for any nmcli issues
docker logs medisync-backend-prod | grep -i wifi
```

### Step 4: Test from Admin Panel

```bash
# Access the frontend
# Replace <rpi-ip> with your Raspberry Pi IP address
# http://<rpi-ip>#/admin

# Click "WiFi Settings" button
# The modal should:
# 1. Auto-scan for available networks
# 2. Display list with signal strength
# 3. Allow password entry for secured networks
```

---

## Troubleshooting WiFi API

### Issue 1: "networks is null/undefined" in Frontend

**Cause:** Backend returning mock data (NetworkManager not available)

**Solution:**

```bash
# Verify NetworkManager is running
sudo systemctl status NetworkManager

# Check if nmcli is accessible in container
docker exec medisync-backend-prod nmcli dev wifi list

# If not found, rebuild with updated Dockerfile.prod
docker compose -f docker-compose.prod.yml build --no-cache backend
```

### Issue 2: "D-Bus permission denied"

**Cause:** D-Bus socket not mounted in container

**Solution:**

```bash
# Verify docker-compose.prod.yml has:
volumes:
  - /run/dbus:/run/dbus

# Restart containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Check if D-Bus is mounted
docker inspect medisync-backend-prod | grep -A 5 "Mounts"
```

### Issue 3: "Connection failed - authentication failed"

**Cause:** Incorrect password or network security mismatch

**Solution:**

```bash
# Verify correct password on host first
nmcli dev wifi connect "SSID" password "test_password"

# Check security type of network
nmcli dev wifi list | grep "SSID"

# Review backend logs
docker logs medisync-backend-prod -f --tail 50

# Try manual connection for debugging
docker exec medisync-backend-prod \
  nmcli dev wifi connect "SSID" password "password123"
```

### Issue 4: "Cannot read property 'isConnected' of undefined"

**Cause:** nmcli output parsing failure

**Solution:**

```bash
# Check actual nmcli output format
nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list

# Should show output like:
# SSID:signal:WPA2:yes
# Network:85:WPA3:no

# If format differs, update parsing logic in server.js
docker logs medisync-backend-prod | grep "🔴"
```

### Issue 5: No networks returned by scan

**Cause:** WiFi adapter not detected or not in managed mode

**Solution:**

```bash
# Check WiFi adapter status
nmcli device status

# If wlan0 shows 'unmanaged', edit config:
sudo nano /etc/NetworkManager/conf.d/99-manage-wlan.conf

# Add:
[device]
wifi.scan-rand-mac-address=no
wifi.powersave=2

# Restart NetworkManager
sudo systemctl restart NetworkManager

# Check WiFi power state
iwconfig wlan0 | grep Power

# If powered off, enable it
sudo rfkill unblock all
```

---

## nmcli Command Reference

### Common Commands

```bash
# List all devices
nmcli device

# Show detailed device info
nmcli device show wlan0

# Scan for networks (may take 2-5 seconds)
nmcli dev wifi list

# Show active connections
nmcli connection show --active

# Connect to open network
nmcli dev wifi connect "SSID"

# Connect with password
nmcli dev wifi connect "SSID" password "password123"

# Disconnect from network
nmcli device disconnect wlan0

# Forget a saved network
nmcli connection delete "SSID"

# Show connection details
nmcli connection show "SSID"

# Enable/disable WiFi
nmcli radio wifi on
nmcli radio wifi off
```

### Parse Output Format

Backend uses this nmcli format:

```bash
nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list
```

**Output format (tab-separated):**

```
SchoolNet_5G:95:WPA2:no
Guest_WiFi:65:Open:yes
Clinic_Network:72:WPA3:no
```

---

## Testing WiFi in Docker Container

```bash
# Open shell in backend container
docker exec -it medisync-backend-prod sh

# Inside container - test WiFi commands
apk add --no-cache networkmanager  # If not already installed

# Scan networks
nmcli dev wifi list

# Test connection
nmcli dev wifi connect "TestNetwork" password "testpass"

# Exit
exit
```

---

## Production Considerations

### Security

1. **Password handling:**
   - Passwords are passed via API (should use HTTPS in production)
   - Never logged or stored in application
   - Only transmitted to nmcli

2. **Network isolation:**
   - Consider using a VPN for remote clinic connections
   - Whitelist clinic server URLs in environment variables

3. **Admin access:**
   - WiFi settings should be protected by admin password
   - Log all WiFi connection attempts

### Performance

1. **Scan timeout (30 seconds):**

   ```bash
   nmcli dev wifi list --rescan yes
   ```

   This can take 5-30 seconds depending on environment

2. **Connection timeout (30 seconds):**
   Set in backend execSync options

3. **Rate limiting:**
   Consider adding cooldown between consecutive WiFi operations

---

## File Locations

| File                                                                                                          | Purpose                            |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [Kiosk/Backend/server.js](../Kiosk/Backend/server.js)                                                         | WiFi API endpoints (lines 598-678) |
| [Kiosk/Frontend/src/components/WiFiSettingsModal.tsx](../Kiosk/Frontend/src/components/WiFiSettingsModal.tsx) | Admin panel WiFi UI                |
| [docker-compose.prod.yml](../docker-compose.prod.yml)                                                         | Docker config with D-Bus mount     |
| [Kiosk/Backend/Dockerfile.prod](../Kiosk/Backend/Dockerfile.prod)                                             | Backend build with NetworkManager  |

---

## Testing Checklist

- [ ] NetworkManager installed and running on Raspberry Pi
- [ ] `nmcli dev wifi list` shows available networks on host
- [ ] Docker image builds successfully with NetworkManager
- [ ] `/run/dbus` is mounted in container (`docker exec ... nmcli ...` works)
- [ ] `GET /api/scan` returns actual networks (not mock data)
- [ ] `POST /api/connect` successfully connects to test network
- [ ] WiFi Settings modal appears in Admin Panel
- [ ] Network list loads in modal
- [ ] Can connect to open network without password
- [ ] Can connect to WPA2 network with password
- [ ] Connection status updates in UI
- [ ] Error messages appear on failed connections
