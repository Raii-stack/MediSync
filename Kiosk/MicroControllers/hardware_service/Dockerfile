# MediSync Hardware Controller Service (LED & Heartbeat)
# Needs access to /dev/gpiomem and /dev/i2c-1

FROM python:3.11-slim-bookworm

# Install system dependencies needed for RPi.GPIO and I2C
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    i2c-tools \
    python3-smbus \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the service scripts
COPY hardware_controller.py .
COPY max30102.py .
COPY mlx90614.py .

# Default environment (override in docker-compose)
ENV BACKEND_URL=http://localhost:3001
ENV LED_R_PIN=17
ENV LED_G_PIN=27
ENV LED_B_PIN=22

CMD ["python", "-u", "hardware_controller.py"]
