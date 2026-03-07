import time
import logging

try:
    import smbus2
except ImportError:
    smbus2 = None

# MLX90614 default I2C address
MLX90614_I2C_ADDR = 0x5A
# Register to read object temperature
MLX90614_TA = 0x06
MLX90614_TOBJ1 = 0x07

class MLX90614:
    def __init__(self, bus_num=1, address=MLX90614_I2C_ADDR):
        if smbus2 is None:
            raise ImportError("smbus2 is required to use MLX90614")
        self.bus_num = bus_num
        self.address = address
        self.bus = smbus2.SMBus(bus_num)

    def read_object_temp_c(self):
        """Reads object temperature in Celsius."""
        try:
            # Read word (16 bits) from device
            raw = self.bus.read_word_data(self.address, MLX90614_TOBJ1)
            # The device returns temperature in Kelvin * 50
            temp_k = raw * 0.02
            temp_c = temp_k - 273.15
            return temp_c
        except Exception as e:
            logging.getLogger("hardware").error(f"Error reading MLX90614: {e}")
            return None

    def read_ambient_temp_c(self):
        """Reads ambient temperature in Celsius."""
        try:
            raw = self.bus.read_word_data(self.address, MLX90614_TA)
            temp_c = (raw * 0.02) - 273.15
            return temp_c
        except Exception as e:
            logging.getLogger("hardware").error(f"Error reading MLX90614 ambient temp: {e}")
            return None
