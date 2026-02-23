const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Connects to a WiFi network using NetworkManager CLI (nmcli).
 * 
 * @param {string} ssid - The SSID of the WiFi network.
 * @param {string} password - The password for the WiFi network.
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
async function connectToWifi(ssid, password) {
  if (!ssid) {
    return { success: false, message: 'SSID is required.' };
  }

  try {
    // Construct command safely. Using spawn might be safer, but exec is fine
    // as long as we escape quotes if needed. 
    // If password is provided, include it, otherwise just connect (for open networks).
    let command;
        
    // Clean up input by replacing double quotes to avoid escaping the string early.
    const cleanSsid = ssid.replace(/"/g, '\\"');
    
    if (password) {
      const cleanPassword = password.replace(/"/g, '\\"');
      command = `nmcli dev wifi connect "${cleanSsid}" password "${cleanPassword}"`;
    } else {
      command = `nmcli dev wifi connect "${cleanSsid}"`;
    }

    const { stdout, stderr } = await execPromise(command, { timeout: 30000 }); // 30s timeout

    // nmcli normally outputs "Device 'wlan0' successfully activated with..." on success
    if (stdout && stdout.toLowerCase().includes('successfully')) {
      return { 
        success: true, 
        message: `Successfully connected to ${ssid}`, 
        data: stdout.trim() 
      };
    }

    // Sometimes it succeeds without explicitly saying "successfully"
    return { 
      success: true, 
      message: `Connection command completed for ${ssid}`, 
      data: stdout.trim() 
    };

  } catch (error) {
    console.error('[NetworkService] WiFi connection failed:', error.message);
    
    let errorMessage = 'Failed to connect to the network.';
    
    // nmcli usually puts the exact failure reason in stderr or stdout
    if (error.stderr) {
      errorMessage = error.stderr.trim();
    } else if (error.stdout) {
      errorMessage = error.stdout.trim();
    }

    return {
      success: false,
      message: errorMessage,
      error: error.message
    };
  }
}

async function scanWifi() {
  console.log('[NetworkService] 📡 WiFi Scan requested');
  
  try {
    // 1. Rescan (Optional but good for fresh results)
    try {
      await execPromise("nmcli dev wifi rescan", { timeout: 10000 });
    } catch (rescanError) {
      console.warn("[NetworkService] ⚠️  WiFi rescan failed:", rescanError.message);
    }

    // 2. Fetch list of networks
    const { stdout } = await execPromise(
      "nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list",
      { timeout: 15000 }
    );

    let networks = [];

    if (stdout) {
      const lines = stdout.split("\n").filter((line) => line.trim());

      networks = lines
        .map((line) => {
          // nmcli terse mode escapes colons with a backslash.
          const fields = line
            .split(/(?<!\\):/)
            .map((f) => f.replace(/\\:/g, ":"));
          
          const [ssid, signal, security, active] = fields;
          
          return {
            ssid: ssid || "Hidden Network",
            signalStrength: parseInt(signal) || 0,
            security: security && security !== "--" ? security.split(" ")[0] : "Open",
            isConnected: active === "yes",
          };
        })
        .filter((net) => net.ssid !== "Hidden Network"); // Filter out true hidden networks if preferred
    }

    // Sort by signal strength and whether it's connected
    networks.sort((a, b) => {
      if (a.isConnected) return -1;
      if (b.isConnected) return 1;
      return b.signalStrength - a.signalStrength;
    });

    // Remove duplicates (nmcli sometimes lists same SSID multiples per BSSID)
    const uniqueNetworks = [];
    const seenSsids = new Set();
    
    for (const net of networks) {
      if (!seenSsids.has(net.ssid)) {
        seenSsids.add(net.ssid);
        uniqueNetworks.push(net);
      }
    }

    return {
      success: true,
      networks: uniqueNetworks.slice(0, 20), // Max 20 networks
    };

  } catch (error) {
    console.error("[NetworkService] ❌ WiFi scan error:", error.message);
    return {
      success: false,
      error: "Failed to scan for networks",
    };
  }
}

module.exports = {
  scanWifi,
  connectToWifi
};
