import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Text, Grid, GridItem, Progress, Dialog } from '@chakra-ui/react';
import { io } from 'socket.io-client';
import { CheckCircle } from 'lucide-react';
import EmergencyButton from '../components/EmergencyButton';
import heartPulseIcon from '../assets/heart-icon.png';
import temperatureIcon from '../assets/temp-icon.png';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
const API_URL = import.meta.env.VITE_API_URL;
const CLIENT_SESSION_ID =
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function Vitals() {
  const location = useLocation();
  const navigate = useNavigate();
  const student = location.state?.student;
  const studentName = student?.first_name || 'Ryan';

  const [progress, setProgress] = useState(0);
  const [bpm, setBpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState('--');
  const [status, setStatus] = useState('Waiting');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const socketRef = useRef(null);
  const scanStartedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (socketRef.current) {
      return;
    }

    isMountedRef.current = true;
    console.log('🔌 Initializing Socket.IO connection to:', SOCKET_URL);
    
    // Create socket connection
    const socket = io(SOCKET_URL, { 
      auth: { sessionId: CLIENT_SESSION_ID },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 999,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      randomizationFactor: 0.5,
      timeout: 30000,
      path: '/socket.io/',
      autoConnect: true,
      forceNew: false,
      multiplex: false,
      upgrade: true,
      rememberUpgrade: true
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      if (!isMountedRef.current) return;
      
      console.log('✅ Socket.IO connected to:', SOCKET_URL);
      console.log('Socket ID:', socket.id);
      
      
      // Start scanning when connected (only once)
      if (!scanStartedRef.current) {
        scanStartedRef.current = true;
        fetch(`${API_URL}/api/scan/start`, { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            console.log('🟢 Scan started:', data);
          })
          .catch(err => {
            console.error('❌ Error starting scan:', err);
            scanStartedRef.current = false;
          });
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      if (isMountedRef.current) {
        setStatus('Waiting');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnect attempt:', attemptNumber);
    });

    socket.on('reconnect', () => {
      console.log('✅ Reconnected to Socket.IO');
    });

    socket.on('vitals-progress', (data) => {
      if (!isMountedRef.current) return;
      
      console.log('📊 Vitals progress received:', data);
      const liveBpm = Number.parseFloat(data?.bpm);
      const liveTemp = Number.parseFloat(data?.temp);
      const rawProgress = Number.parseFloat(data?.progress);

      if (!Number.isNaN(liveBpm)) {
        setBpm(liveBpm);
      }

      if (!Number.isNaN(liveTemp)) {
        setDisplayTemp(liveTemp.toFixed(1));
      }

      if (!Number.isNaN(rawProgress)) {
        const clamped = Math.max(0, Math.min(10, rawProgress));
        setProgress(clamped);
      }

      setStatus('Scanning');
    });

    socket.on('vitals-complete', (data) => {
      if (!isMountedRef.current) return;

      setStatus('Complete');

      if (data?.avg_bpm !== undefined) {
        localStorage.setItem('avg_bpm', String(data.avg_bpm));
        setBpm(Number.parseFloat(data.avg_bpm) || 0);
      }

      if (data?.temp !== undefined) {
        localStorage.setItem('temp', String(data.temp));
        const tempValue = Number.parseFloat(data.temp);
        setDisplayTemp(Number.isNaN(tempValue) ? '--' : tempValue.toFixed(1));
      }

      // Open success modal
      setIsModalOpen(true);

      // Navigate to triage after showing the modal
      setTimeout(() => {
        navigate('/triage');
      }, 2000);
    });

    return () => {
      console.log('🔌 Component unmounting - cleaning up');
      isMountedRef.current = false;
      
      // Stop scanning
      if (scanStartedRef.current) {
        fetch(`${API_URL}/api/scan/stop`, { method: 'POST' })
          .catch(err => console.error('Error stopping scan:', err));
        scanStartedRef.current = false;
      }
      
      // Disconnect socket
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate]); // Empty dependency array - only run once

  return (
    <Box
      bg="#f5f5f5"
      width="100vw"
      height="100vh"
      position="relative"
      overflow="hidden"
    >
      {/* Hello Name - Top Left */}
      <Box
        position="absolute"
        left="38px"
        top="37px"
        width="270px"
      >
        <Text
          fontSize="36px"
          fontWeight="600"
          fontFamily="'Inter', sans-serif"
          color="rgba(43,40,40,0.85)"
          lineHeight="normal"
        >
          Hello, {studentName}!
        </Text>
      </Box>

      {/* Emergency Button */}
      <EmergencyButton onClick={() => console.log('Emergency triggered')} />

      {/* Title - Center Top */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% - 262px))"
        width="335px"
        textAlign="center"
      >
        <Text
          fontSize="36px"
          fontWeight="600"
          fontFamily="'Inter', sans-serif"
          color="rgba(43,40,40,0.85)"
          lineHeight="normal"
        >
          Vital Signs Check
        </Text>
      </Box>

      {/* Instruction */}
      <Text
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% - 221.5px))"
        fontSize="16px"
        fontWeight="500"
        fontFamily="'Inter', sans-serif"
        color="rgba(43,40,40,0.49)"
        textAlign="center"
        width="323px"
        lineHeight="normal"
      >
        Keep finger still until bar is full.
      </Text>

      {/* Progress Bar */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% + 260px))"
        width="323px"
      >
        <Progress.Root value={progress * 10} size="lg" striped>
          <Progress.Track>
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
        <Text mt={2} fontSize="sm" color="gray.500" textAlign="center">
          {status}
        </Text>
      </Box>

      {/* Heart Rate Card - Left */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(calc(-50% - 212px), calc(-50% + 48.5px))"
        width="310px"
        height="422px"
        bg="#f8f8f8"
        borderRadius="24px"
        boxShadow="3px 4px 13.1px 0px rgba(0,0,0,0.25)"
        paddingX="21px"
        paddingY="26px"
      >
        <Grid
          templateRows="repeat(4, 1fr)"
          templateColumns="1fr"
          gap="12px"
          height="100%"
        >
          {/* Heart Icon */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Box width="90px" height="90px">
              <img src={heartPulseIcon} alt="Heart" style={{ width: '100%', height: '100%' }} />
            </Box>
          </GridItem>

          {/* Label */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="32px"
              fontWeight="600"
              fontFamily="'Inter', sans-serif"
              color="#7f8c8d"
              textAlign="center"
              lineHeight="normal"
            >
              Heart Rate
            </Text>
          </GridItem>

          {/* Value */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="112px"
              fontWeight="600"
              fontFamily="'Poppins', sans-serif"
              color="#eb3223"
              textAlign="center"
              lineHeight="normal"
            >
              {Number.isNaN(bpm) ? '--' : Math.round(bpm).toString()}
            </Text>
          </GridItem>

          {/* Unit */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="24px"
              fontWeight="600"
              fontFamily="'Inter', sans-serif"
              color="#7f8c8d"
              textAlign="center"
              lineHeight="normal"
            >
              BPM
            </Text>
          </GridItem>
        </Grid>
      </Box>

      {/* Temperature Card - Right */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(calc(-50% + 212px), calc(-50% + 48.5px))"
        width="310px"
        height="422px"
        bg="#f8f8f8"
        borderRadius="24px"
        boxShadow="3px 4px 13.1px 0px rgba(0,0,0,0.25)"
        paddingX="21px"
        paddingY="26px"
      >
        <Grid
          templateRows="repeat(4, 1fr)"
          templateColumns="1fr"
          gap="12px"
          height="100%"
        >
          {/* Temperature Icon */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Box width="90px" height="90px">
              <img src={temperatureIcon} alt="Temperature" style={{ width: '100%', height: '100%' }} />
            </Box>
          </GridItem>

          {/* Label */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="32px"
              fontWeight="600"
              fontFamily="'Inter', sans-serif"
              color="#7f8c8d"
              textAlign="center"
              lineHeight="normal"
            >
              Temperature
            </Text>
          </GridItem>

          {/* Value */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="96px"
              fontWeight="600"
              fontFamily="'Poppins', sans-serif"
              color="#3b82f6"
              textAlign="center"
              lineHeight="normal"
            >
              {displayTemp}
            </Text>
          </GridItem>

          {/* Unit */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="24px"
              fontWeight="600"
              fontFamily="'Inter', sans-serif"
              color="#7f8c8d"
              textAlign="center"
              lineHeight="normal"
            >
              °C
            </Text>
          </GridItem>
        </Grid>
      </Box>

      {/* Bottom Status Text */}
      <Text
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% + 308.5px))"
        fontSize="16px"
        fontWeight="500"
        fontFamily="'Inter', sans-serif"
        color="rgba(43,40,40,0.49)"
        textAlign="center"
        width="323px"
        lineHeight="normal"
      >
        Capturing heart rate and temperature...
      </Text>

      {/* Success Modal */}
      <Dialog.Root 
        open={isModalOpen} 
        onOpenChange={(e) => setIsModalOpen(e.open)}
        placement="center"
        closeOnInteractOutside={false}
      >
        <Dialog.Backdrop 
          bg="rgba(0,0,0,0.5)" 
          backdropFilter="blur(4px)"
        />
        <Dialog.Positioner
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex="9999"
        >
          <Dialog.Content
            bg="white"
            borderRadius="24px"
            p="40px 32px"
            boxShadow="0 20px 60px rgba(0,0,0,0.3)"
            maxW="420px"
            textAlign="center"
          >
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap="20px"
            >
              {/* Animated Checkmark */}
              <Box
                animation="scaleIn 0.5s ease-out"
                css={{
                  '@keyframes scaleIn': {
                    '0%': { transform: 'scale(0)', opacity: 0 },
                    '50%': { transform: 'scale(1.2)', opacity: 1 },
                    '100%': { transform: 'scale(1)', opacity: 1 }
                  }
                }}
              >
                <CheckCircle 
                  size={72} 
                  color="#10b981"
                  strokeWidth={2.5}
                />
              </Box>

              {/* Success Message */}
              <Box>
                <Text
                  fontSize="32px"
                  fontWeight="700"
                  fontFamily="'Poppins', sans-serif"
                  color="#1a1a1a"
                  mb="12px"
                  lineHeight="1.2"
                >
                  Scan Complete!
                </Text>
                <Text
                  fontSize="16px"
                  fontWeight="400"
                  fontFamily="'Inter', sans-serif"
                  color="#7f8c8d"
                  lineHeight="1.5"
                >
                  Your vitals have been recorded
                </Text>
              </Box>
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}
