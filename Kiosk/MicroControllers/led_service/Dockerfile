# MediSync RPi LED Status Service
# Runs on Raspberry Pi inside Docker, drives an RGB LED via GPIO
# based on kiosk backend Socket.IO events.

FROM python:3.11-slim-bookworm

# Install system dependencies needed for RPi.GPIO
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the service script
COPY led_status.py .

# Default environment (override in docker-compose)
ENV BACKEND_URL=http://localhost:3001
ENV LED_R_PIN=17
ENV LED_G_PIN=27
ENV LED_B_PIN=22

CMD ["python", "-u", "led_status.py"]
