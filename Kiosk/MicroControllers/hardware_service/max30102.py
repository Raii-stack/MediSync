# Source: https://github.com/vrano714/max30102-tutorial-raspberrypi
import smbus2
import time

# I2C address
MAX30102_ADDRESS = 0x57

# Registers
REG_INTR_STATUS_1 = 0x00
REG_INTR_STATUS_2 = 0x01
REG_INTR_ENABLE_1 = 0x02
REG_INTR_ENABLE_2 = 0x03
REG_FIFO_WR_PTR = 0x04
REG_OVF_COUNTER = 0x05
REG_FIFO_RD_PTR = 0x06
REG_FIFO_DATA = 0x07
REG_FIFO_CONFIG = 0x08
REG_MODE_CONFIG = 0x09
REG_SPO2_CONFIG = 0x0A
REG_LED1_PA = 0x0C
REG_LED2_PA = 0x0D

class MAX30102:
    def __init__(self, i2c_bus=1):
        self.bus = smbus2.SMBus(i2c_bus)
        self.address = MAX30102_ADDRESS
        self.setup()

    def setup(self):
        # Reset device
        self.bus.write_byte_data(self.address, REG_MODE_CONFIG, 0x40)
        time.sleep(0.05)
        
        # INTR setting
        self.bus.write_byte_data(self.address, REG_INTR_ENABLE_1, 0xc0)
        self.bus.write_byte_data(self.address, REG_INTR_ENABLE_2, 0x00)
        
        # Reset FIFO pointers
        self.bus.write_byte_data(self.address, REG_FIFO_WR_PTR, 0x00)
        self.bus.write_byte_data(self.address, REG_OVF_COUNTER, 0x00)
        self.bus.write_byte_data(self.address, REG_FIFO_RD_PTR, 0x00)
        
        # sample avg = 4, fifo rollover = false, fifo almost full = 17
        self.bus.write_byte_data(self.address, REG_FIFO_CONFIG, 0x4f)
        
        # SPO2 mode
        self.bus.write_byte_data(self.address, REG_MODE_CONFIG, 0x03)
        
        # SPO2_ADC range = 4096nA, SPO2 sample rate (100 Hz), LED pulseWidth (411uS)
        self.bus.write_byte_data(self.address, REG_SPO2_CONFIG, 0x27)
        
        # LED currents
        self.bus.write_byte_data(self.address, REG_LED1_PA, 0x24)
        self.bus.write_byte_data(self.address, REG_LED2_PA, 0x24)
        
        # Clear interrupts
        self.bus.read_byte_data(self.address, REG_INTR_STATUS_1)
        self.bus.read_byte_data(self.address, REG_INTR_STATUS_2)

    def reset_fifo(self):
        """Clear FIFO pointers and overflow counter. Call before each scan
        to flush stale data and allow the sensor to write fresh samples."""
        self.bus.write_byte_data(self.address, REG_FIFO_WR_PTR, 0x00)
        self.bus.write_byte_data(self.address, REG_OVF_COUNTER, 0x00)
        self.bus.write_byte_data(self.address, REG_FIFO_RD_PTR, 0x00)
        # Clear any pending interrupts
        self.bus.read_byte_data(self.address, REG_INTR_STATUS_1)
        self.bus.read_byte_data(self.address, REG_INTR_STATUS_2)

    def shutdown(self):
        """Put sensor into shutdown/low-power mode. Stops data collection
        so the FIFO doesn't fill up during idle periods."""
        # Read current mode, set SHDN bit (bit 7)
        current = self.bus.read_byte_data(self.address, REG_MODE_CONFIG)
        self.bus.write_byte_data(self.address, REG_MODE_CONFIG, current | 0x80)

    def wakeup(self):
        """Wake sensor from shutdown mode and restart data collection.
        Also resets the FIFO so only fresh samples are read."""
        self.reset_fifo()
        # Re-enter SpO2 mode (clears SHDN bit)
        self.bus.write_byte_data(self.address, REG_MODE_CONFIG, 0x03)
        # Give sensor time to start collecting
        time.sleep(0.1)

    def read_sequential(self):
        # Read a single sample from the FIFO
        try:
            read_ptr = self.bus.read_byte_data(self.address, REG_FIFO_RD_PTR)
            write_ptr = self.bus.read_byte_data(self.address, REG_FIFO_WR_PTR)
            
            if read_ptr == write_ptr:
                return (None, None) # No new data
            
            # Read 6 bytes of data
            data = self.bus.read_i2c_block_data(self.address, REG_FIFO_DATA, 6)
            
            # Reconstruct 18-bit values
            red = (data[0] << 16) | (data[1] << 8) | data[2]
            # Strip out top 14 bits (only keep 18 valid bits)
            red &= 0x03FFFF
            
            ir = (data[3] << 16) | (data[4] << 8) | data[5]
            ir &= 0x03FFFF
            
            return (red, ir)
        except Exception as e:
            return (None, None)
