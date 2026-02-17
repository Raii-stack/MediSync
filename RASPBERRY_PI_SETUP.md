# MediSync Raspberry Pi 3B Production Setup Guide

## Overview

This guide covers setting up MediSync on Raspberry Pi 3B using Docker Compose for production deployment, including WiFi management and hardware integration.

---

## Phase 1: System Preparation

### 1.1 Initial OS Setup

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install essential tools
sudo apt-get install -y \
    git \
    curl \
    wget \
    nano \
    htop \
    build-essential \
    libffi-dev \
    libssl-dev \
    python3-dev
```

### 1.2 Install Docker & Docker Compose

```bash
# Install Docker using official script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add pi user to docker group (avoid sudo for docker commands)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker
```

### 1.3 Install NetworkManager (Required for WiFi Management)

```bash
# Install NetworkManager and dependencies
sudo apt-get install -y \
    network-manager \
    network-manager-gnome \
    dbus

# Start and enable NetworkManager
sudo systemctl start NetworkManager
sudo systemctl enable NetworkManager

# Verify it's running
nmcli dev status
nmcli dev wifi list
```

**⚠️ Important:** If using Raspberry Pi OS with dhcpcd, you may need to disable it:

```bash
# Disable dhcpcd in favor of NetworkManager
sudo systemctl disable dhcpcd
sudo systemctl stop dhcpcd
```

---

## Phase 2: Clone & Prepare Project

### 2.1 Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the MediSync repository
git clone https://github.com/your-org/medisync.git
cd medisync
```

### 2.2 Configure Environment Variables

```bash
# Create .env file for production
cat > .env.prod << EOF
# Kiosk Identity
KIOSK_ID=kiosk-rpi-001
KIOSK_LOCATION=Clinic-Building-A-Room-102

# Clinic Socket Connection (for emergency alerts)
CLINIC_SOCKET_URL=http://clinic-server:3000

# Database
DATABASE_URL=/app/data/kiosk.db

# Logging
LOG_LEVEL=info

# Node Environment
NODE_ENV=production
EOF

# Make it secure
chmod 600 .env.prod
```

### 2.3 Create Data Directories

```bash
# Create directories for persistent data
mkdir -p ~/medisync/data
chmod 755 ~/medisync/data
```

---

## Phase 3: Network Setup

### 3.1 Verify Network Connectivity

Since the RFID reader is connected to the ESP32 (not the Pi), the Raspberry Pi only needs standard network access:

```bash
# Test internet connectivity
ping 8.8.8.8

# Check IP address
hostname -I

# Show active network connections
nmcli connection show --active
```

### 3.2 Verify NetworkManager for WiFi Control

The WiFi settings in the admin panel will manage the Pi's network connection:

```bash
# Check if wlan0 is managed by NetworkManager
nmcli device status

# Should show wlan0 as "connected" or "disconnected"
# If "unmanaged", edit NetworkManager config:
sudo nano /etc/NetworkManager/conf.d/99-manage-wlan.conf

# Add these lines:
[device]
wifi.powersave=2
wifi.scan-rand-mac-address=no
```

---

## Phase 4: Docker Build & Deployment

### 4.1 Build Docker Images

```bash
# Navigate to project root
cd ~/medisync

# Build images for production (ARM-compatible)
docker compose -f docker-compose.prod.yml build

# This will take 10-15 minutes on Raspberry Pi
# Monitor progress
docker image ls | grep medisync
```

### 4.2 Verify Images Built

```bash
docker images | grep medisync-backend
docker images | grep medisync-frontend
```

### 4.3 Create Startup Script

```bash
# Create a deployment script
cat > ~/medisync/deploy-prod.sh << 'EOF'
#!/bin/bash

set -e

PROJECT_DIR=$(pwd)
ENV_FILE="$PROJECT_DIR/.env.prod"

echo "🚀 Starting MediSync Production Deployment..."

# Check if .env.prod exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    exit 1
fi

# Load environment
export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

echo "📦 Building Docker images..."
docker compose -f docker-compose.prod.yml build

echo "🔧 Creating networks and volumes..."
docker compose -f docker-compose.prod.yml up -d

echo "✅ Waiting for services to start (30 seconds)..."
sleep 30

echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml ps

echo "📝 Logs:"
docker compose -f docker-compose.prod.yml logs -n 20

echo "🎉 Deployment complete!"
echo "   Backend: http://$(hostname -I | awk '{print $1}'):3001"
echo "   Frontend: http://$(hostname -I | awk '{print $1}'):80"
EOF

chmod +x ~/medisync/deploy-prod.sh
```

### 4.4 Deploy Services

```bash
cd ~/medisync

# Run deployment script
./deploy-prod.sh

# Or manually start
docker compose -f docker-compose.prod.yml up -d
```

### 4.5 Verify Deployment

```bash
# Check container status
docker ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Test backend API
curl http://localhost:3001/api/inventory

# Test WiFi scan (requires NetworkManager)
curl http://localhost:3001/api/scan
```

---

## Phase 5: WiFi Configuration & Testing

### 5.1 Configure Initial WiFi Connection

```bash
# List available networks
nmcli dev wifi list

# Connect to a network
nmcli dev wifi connect "SSID_Name" password "password123"

# Verify connection
nmcli device show
```

### 5.2 Test WiFi API Endpoints

```bash
# Scan for networks
curl -X GET http://localhost:3001/api/scan | json_pp

# Connect to WiFi (from frontend admin panel or API)
curl -X POST http://localhost:3001/api/connect \
  -H "Content-Type: application/json" \
  -d '{
    "ssid": "YourNetwork",
    "password": "YourPassword"
  }'
```

### 5.3 Verify WiFi Connectivity

```bash
# Check active connection
nmcli connection show --active

# Monitor WiFi strength
watch -n 1 'nmcli dev wifi list | head -5'

# Test internet connectivity
ping 8.8.8.8
```

---

## Phase 6: Persistent Data & Auto-Restart

### 6.1 Enable Auto-Start on Boot

```bash
# Create systemd service
sudo bash -c 'cat > /etc/systemd/system/medisync.service << EOF
[Unit]
Description=MediSync Kiosk System
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=exec
User=pi
ExecStart=/usr/bin/docker compose -f /home/pi/medisync/docker-compose.prod.yml up
ExecStop=/usr/bin/docker compose -f /home/pi/medisync/docker-compose.prod.yml down
Restart=always
RestartSec=10
WorkingDirectory=/home/pi/medisync

[Install]
WantedBy=multi-user.target
EOF'

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable medisync
sudo systemctl start medisync

# Check status
sudo systemctl status medisync
```

### 6.2 Monitor Logs

```bash
# View real-time logs
sudo journalctl -u medisync -f

# View Docker container logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## Phase 7: Database & Backup

### 7.1 Database Initialization

```bash
# Check if database exists
ls -lah ~/medisync/data/

# Initialize database if needed
docker compose -f docker-compose.prod.yml exec backend node init-db.js

# Verify database
sqlite3 ~/medisync/data/kiosk.db ".tables"
```

### 7.2 Backup Strategy

```bash
# Create backup script
cat > ~/medisync/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR=~/medisync/backups
DATA_DIR=~/medisync/data
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup database
tar -czf "$BACKUP_DIR/kiosk-db-$TIMESTAMP.tar.gz" -C "$DATA_DIR" .

echo "✅ Backup created: $BACKUP_DIR/kiosk-db-$TIMESTAMP.tar.gz"

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -t *.tar.gz | tail -n +8 | xargs -r rm
EOF

chmod +x ~/medisync/backup.sh

# Schedule daily backup
(crontab -l 2>/dev/null; echo "0 2 * * * /home/pi/medisync/backup.sh") | crontab -
```

---

## Phase 8: Monitoring & Maintenance

### 8.1 System Health Check Script

```bash
cat > ~/medisync/health-check.sh << 'EOF'
#!/bin/bash

echo "🏥 MediSync Health Check"
echo "========================"

# Check containers
echo "📦 Container Status:"
docker ps

# Check ports
echo "\n🔌 Open Ports:"
netstat -tlnp 2>/dev/null | grep -E '3001|80|443'

# Check disk space
echo "\n💾 Disk Space:"
df -h /home/pi/medisync

# Check WiFi
echo "\n📡 WiFi Status:"
nmcli connection show --active

# Check memory
echo "\n🧠 Memory Usage:"
free -h

# Backend API health
echo "\n🔍 Backend Health:"
curl -s http://localhost:3001/api/inventory | head -20 || echo "❌ Backend not responding"

# Frontend status
echo "\n🎨 Frontend Status:"
curl -s http://localhost:80 | head -10 || echo "❌ Frontend not responding"
EOF

chmod +x ~/medisync/health-check.sh

# Run health check
./health-check.sh
```

### 8.2 Log Rotation

```bash
# Docker automatically manages logs, but you can configure max size:
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker
```

---

## Troubleshooting

### Issue: WiFi Commands Not Working in Container

```bash
# Verify NetworkManager is accessible
docker exec medisync-backend-prod nmcli dev status

# Check D-Bus socket is mounted
docker inspect medisync-backend-prod | grep -A 5 Mounts

# Restart NetworkManager
sudo systemctl restart NetworkManager
```

### Issue: Serial Port Not Accessible

```bash
# Check permissions
ls -la /dev/tyyUSB0

# Verify container has device access
docker exec medisync-backend-prod ls -la /dev/ttyUSB0

# Check udev rules
cat /etc/udev/rules.d/99-medisync-serial.rules
```

### Issue: Out of Memory

```bash
# Check memory usage
free -h

# Set swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Issue: High CPU Usage

```bash
# Monitor processes
docker stats

# Check which container is consuming CPU
top -p $(pgrep -f docker)

# Restart problematic container
docker compose -f docker-compose.prod.yml restart backend
```

---

## Accessing the Kiosk

### Frontend URLs

- **Local Access:** `http://<rpi-local-ip>`
- **Local Access (Port):** `http://<rpi-local-ip>:5173`
- **Admin Panel:** Add `#/admin` to any URL

### Backend API

- **Base:** `http://<rpi-local-ip>:3001`
- **WiFi Scan:** `curl http://<rpi-local-ip>:3001/api/scan`
- **Inventory:** `curl http://<rpi-local-ip>:3001/api/inventory`

### Getting Raspberry Pi IP

```bash
hostname -I
# or
ip addr show wlan0 | grep "inet " | awk '{print $2}'
```

---

## Summary Checklist

- [ ] System updated and Docker installed
- [ ] NetworkManager installed and running
- [ ] Project cloned and .env.prod created
- [ ] Docker images built successfully
- [ ] Services started and verified
- [ ] WiFi management endpoints tested
- [ ] Database initialized
- [ ] Auto-start systemd service enabled
- [ ] Backup script scheduled
- [ ] Health checks passing

---

## Quick Commands

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a service
docker compose -f docker-compose.prod.yml restart backend

# Remove and rebuild
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Check status
sudo systemctl status medisync
docker ps
```

---

## Support Resources

- [NetworkManager Documentation](https://networkmanager.dev/)
- [Docker Compose on ARM](https://docs.docker.com/go/compose-on-arm/)
- [Raspberry Pi Serial Communication](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)
