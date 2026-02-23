# Backend Dockerfile for Development
FROM node:20-alpine

WORKDIR /app

# Install system dependencies for Raspberry Pi production:
# - networkmanager: nmcli for WiFi scanning/management
# - dbus: required for nmcli to communicate with host NetworkManager
# - tini: proper signal handling in container
# - udev/eudev-libs: serial device access (ESP32)
RUN apk add --no-cache \
    networkmanager \
    networkmanager-cli \
    dbus \
    tini \
    udev \
    eudev-libs

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
