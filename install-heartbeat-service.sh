#!/bin/bash

# ==============================================================================
# MediSync Kiosk - Heartbeat Sensor Service Installer
# ==============================================================================
# This script sets up a systemd service to automatically run the Python
# heartbeat sensor script (MAX30102) on Raspberry Pi boot.
# ==============================================================================

SERVICE_NAME="medisync-heartbeat.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"
K_DIR="$(pwd)/Kiosk/MicroControllers/heartbeat_service"
SCRIPT_PATH="$K_DIR/heartbeat.py"
VENV_PATH="$K_DIR/venv"
PYTHON_BIN="$VENV_PATH/bin/python3"
REQ_PATH="$K_DIR/requirements.txt"

echo "❤️  Installing Heartbeat Sensor Service..."

# 1. Ensure Python 3, pip, and venv are installed
echo "⚙️  Checking OS dependencies..."
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip i2c-tools python3-smbus

# 2. Setup Virtual Environment and install packages
echo "⚙️  Setting up Python Virtual Environment..."
if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv "$VENV_PATH"
fi

echo "⚙️  Installing Python requirements..."
"$PYTHON_BIN" -m pip install -r "$REQ_PATH"

# 3. Create the systemd service file
echo "⚙️  Creating systemd service file at $SERVICE_FILE..."

sudo bash -c "cat > $SERVICE_FILE" << EOL
[Unit]
Description=MediSync Heartbeat Sensor Service (MAX30102)
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=$K_DIR
# Adjust to your backend URL if it's hosted elsewhere
Environment="BACKEND_URL=http://localhost:3001"
ExecStart=$PYTHON_BIN $SCRIPT_PATH
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
echo "The Heartbeat Sensor service is now running in the background."
echo "It will automatically start whenever the Raspberry Pi boots up."
echo ""
echo "To check the service status, run:"
echo "  sudo systemctl status $SERVICE_NAME"
echo ""
echo "To view live logs (Heartbeat/vitals readings), run:"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo "------------------------------------------------------"
