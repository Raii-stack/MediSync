const io = require('socket.io-client');
const axios = require('axios');

const socket = io('http://localhost:3001');

console.log('🔌 Connecting to backend socket...');

socket.on('connect', () => {
  console.log('✅ Connected to backend socket');
  
  // Start listening for vitals updates
  socket.on('vitals-update', (data) => {
    console.log('📊 Received vitals:', data);
  });
  
  // Trigger scan start
  console.log('🟢 Sending START_SCAN request...');
  axios.post('http://localhost:3001/api/scan/start')
    .then(res => {
      console.log('✅ Scan started:', res.data);
      console.log('⏱️  Waiting for sensor data for 5 seconds...');
      
      // Stop after 5 seconds
      setTimeout(() => {
        console.log('🛑 Sending STOP_SCAN request...');
        axios.post('http://localhost:3001/api/scan/stop')
          .then(res => {
            console.log('✅ Scan stopped:', res.data);
            setTimeout(() => {
              console.log('👋 Test complete, exiting...');
              process.exit(0);
            }, 1000);
          });
      }, 5000);
    })
    .catch(err => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
});

socket.on('disconnect', () => {
  console.log('⚠️  Disconnected from backend');
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});
