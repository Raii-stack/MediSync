#!/bin/bash

# ==============================================================================
# MediSync Kiosk - ADB Auto-Forward Service Installer
# ==============================================================================
# This script sets up a systemd service to automatically run the ADB port
# forwarding script on Raspberry Pi boot.
# ==============================================================================

SERVICE_NAME="medisync-adb.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"
SCRIPT_PATH="$(pwd)/Kiosk/scripts/adb-auto-forward.sh"

echo "🔌 Installing ADB Auto-Forward Service..."

# 1. Install ADB if missing
if ! command -v adb &> /dev/null; then
    echo "⚙️ ADB not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y adb
fi

# 2. Make the script executable
chmod +x "$SCRIPT_PATH"

# 3. Create the systemd service file
echo "⚙️ Creating systemd service file at $SERVICE_FILE..."

sudo bash -c "cat > $SERVICE_FILE" << EOL
[Unit]
Description=MediSync ADB Auto Port Forwarding
After=network.target

[Service]
Type=simple
User=pi
ExecStart=$SCRIPT_PATH
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

# 4. Enable and start the service
echo "🚀 Enabling and starting the service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo ""
echo "✅ Installation Complete!"
echo "------------------------------------------------------"
echo "The ADB port forwarding service is now running in the background."
echo "It will automatically start every time the Raspberry Pi boots up."
echo ""
echo "To check the service status, run:"
echo "  sudo systemctl status $SERVICE_NAME"
echo ""
echo "To view live logs (plug/unplug events), run:"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo "------------------------------------------------------"
