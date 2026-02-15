/// <reference types="react" />
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Text,
  Grid,
  GridItem,
  Progress,
  Dialog,
  Flex,
  VStack,
  HStack,
} from '@chakra-ui/react';
import { io, Socket } from 'socket.io-client';
import { CheckCircle } from 'lucide-react';
import EmergencyButton from '../components/EmergencyButton';
import heartPulseIcon from '../assets/heart-icon.png';
import temperatureIcon from '../assets/temp-icon.png';

interface StudentData {
  first_name?: string;
  [key: string]: any;
}

interface LocationState {
  student?: StudentData;
}

interface VitalsProgressData {
  bpm?: number | string;
  temp?: number | string;
  progress?: number | string;
}

interface VitalsCompleteData {
  avg_bpm?: number | string;
  temp?: number | string;
}

// Use the proxy base URL configured in docker-compose and vite.config
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const SOCKET_URL: string = API_BASE_URL;
const API_URL: string = API_BASE_URL;
const CLIENT_SESSION_ID: string =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function VitalsScreen() {
  const location = useLocation() as { state?: LocationState };
  const navigate = useNavigate();
  const student = location.state?.student;
  const studentName = student?.first_name || 'Ryan';

  const [progress, setProgress] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(0);
  const [displayTemp, setDisplayTemp] = useState<string>('--');
  const [status, setStatus] = useState<string>('Waiting');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const scanStartedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

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
      rememberUpgrade: true,
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
          .then((res) => res.json())
          .then((data) => {
            console.log('🟢 Scan started:', data);
          })
          .catch((err) => {
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

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket.IO connection error:', error.message);
    });

    socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('🔄 Reconnect attempt:', attemptNumber);
    });

    socket.on('reconnect', () => {
      console.log('✅ Reconnected to Socket.IO');
    });

    socket.on('vitals-progress', (data: VitalsProgressData) => {
      if (!isMountedRef.current) return;

      console.log('📊 Vitals progress received:', data);
      const liveBpm = Number.parseFloat(String(data?.bpm));
      const liveTemp = Number.parseFloat(String(data?.temp));
      const rawProgress = Number.parseFloat(String(data?.progress));

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

    socket.on('vitals-complete', (data: VitalsCompleteData) => {
      if (!isMountedRef.current) return;

      setStatus('Complete');

      if (data?.avg_bpm !== undefined) {
        localStorage.setItem('avg_bpm', String(data.avg_bpm));
        setBpm(Number.parseFloat(String(data.avg_bpm)) || 0);
      }

      if (data?.temp !== undefined) {
        localStorage.setItem('temp', String(data.temp));
        const tempValue = Number.parseFloat(String(data.temp));
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
        fetch(`${API_URL}/api/scan/stop`, { method: 'POST' }).catch((err) =>
          console.error('Error stopping scan:', err)
        );
        scanStartedRef.current = false;
      }

      // Disconnect socket
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [navigate]);

  return (
    <Box
      bg="#f5f5f5"
      width="100vw"
      height="100vh"
      position="relative"
      overflow="hidden"
      data-testid="vitals-screen"
    >
      {/* Hello Name - Top Left */}
      <Box position="absolute" left="38px" top="37px" width="270px">
        <Text
          fontSize="36px"
          fontWeight="600"
          fontFamily="'Inter', sans-serif"
          color="rgba(43,40,40,0.85)"
          lineHeight="normal"
          data-testid="greeting-text"
        >
          Hello, {studentName}!
        </Text>
      </Box>

      {/* Emergency Button - Top Right */}
      <Box position="absolute" right="49px" top="33px" width="184px">
        <EmergencyButton
          onClick={() => console.log('Emergency triggered')}
          data-testid="emergency-button"
        />
      </Box>

      {/* Health Monitoring Badge */}
      <Flex
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% - 296.51px))"
        bg="rgba(255,255,255,0.8)"
        backdropBlur="8px"
        borderRadius="9999px"
        paddingX="24px"
        paddingY="12px"
        gap="12px"
        alignItems="center"
        justifyContent="center"
        boxShadow="0px 10px 15px 0px rgba(0,0,0,0.1), 0px 4px 6px 0px rgba(0,0,0,0.1)"
        data-testid="health-monitoring-badge"
      >
        <Box
          width="20px"
          height="20px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            color="#4a5565"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </Box>
        <Text
          fontSize="14px"
          fontWeight="600"
          fontFamily="'Arimo', sans-serif"
          color="#4a5565"
          textTransform="uppercase"
          letterSpacing="0.35px"
          lineHeight="20px"
          whiteSpace="nowrap"
        >
          Health Monitoring
        </Text>
      </Flex>

      {/* Main Title */}
      <Text
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% - 258.5px))"
        fontSize="48px"
        fontWeight="700"
        fontFamily="'Arimo', sans-serif"
        color="#1e2939"
        textAlign="center"
        lineHeight="48px"
        data-testid="vital-signs-title"
      >
        Vital Signs Check
      </Text>

      {/* Progress Bar with Gradient */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% - 155.5px))"
        width="576px"
        height="8px"
        borderRadius="9999px"
        overflow="hidden"
        bg="#e5e7eb"
        data-testid="progress-bar-container"
      >
        <Box
          height="100%"
          borderRadius="9999px"
          width={`${(progress / 10) * 100}%`}
          bgGradient="linear(to-r, #4a90e2, #2ecc71)"
          transition="width 0.3s ease"
          data-testid="progress-bar-fill"
        />
      </Box>

      {/* Heart Rate Card - Left */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(calc(-50% - 212px), calc(-50% + 97.5px))"
        width="310px"
        minHeight="422px"
        bg="white"
        borderRadius="24px"
        boxShadow="0px 8px 10px 0px rgba(235,50,35,0.1), 0px 20px 25px 0px rgba(235,50,35,0.1)"
        paddingX="21px"
        paddingY="26px"
        data-testid="heart-rate-card"
      >
        <Grid templateRows="repeat(4, 1fr)" gap="12px" height="100%">
          {/* Heart Icon */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Box width="90px" height="90px" flexShrink={0}>
              <img
                src={heartPulseIcon}
                alt="Heart Rate Icon"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
          </GridItem>

          {/* Label */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="32px"
              fontWeight="700"
              fontFamily="'Arimo', sans-serif"
              color="#7f8c8d"
              textAlign="center"
              lineHeight="normal"
              data-testid="heart-rate-label"
            >
              Heart Rate
            </Text>
          </GridItem>

          {/* Value */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="112px"
              fontWeight="700"
              fontFamily="'Arimo', sans-serif"
              color="#eb3223"
              textAlign="center"
              lineHeight="normal"
              data-testid="bpm-value"
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
        transform="translate(calc(-50% + 212px), calc(-50% + 97.5px))"
        width="310px"
        minHeight="422px"
        bg="white"
        borderRadius="24px"
        boxShadow="0px 8px 10px 0px rgba(39,174,96,0.1), 0px 20px 25px 0px rgba(0,166,62,0.1)"
        paddingX="21px"
        paddingY="26px"
        data-testid="temperature-card"
      >
        <Grid templateRows="repeat(4, 1fr)" gap="12px" height="100%">
          {/* Temperature Icon */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Box width="90px" height="90px" flexShrink={0}>
              <img
                src={temperatureIcon}
                alt="Temperature Icon"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
          </GridItem>

          {/* Label */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="32px"
              fontWeight="700"
              fontFamily="'Arimo', sans-serif"
              color="#7f8c8d"
              textAlign="center"
              lineHeight="normal"
              data-testid="temperature-label"
            >
              Temperature
            </Text>
          </GridItem>

          {/* Value */}
          <GridItem display="flex" alignItems="center" justifyContent="center">
            <Text
              fontSize="112px"
              fontWeight="700"
              fontFamily="'Arimo', sans-serif"
              color="#3b82f6"
              textAlign="center"
              lineHeight="normal"
              data-testid="temperature-value"
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
        transform="translate(-50%, calc(-50% + 325.5px))"
        fontSize="16px"
        fontWeight="500"
        fontFamily="'Inter', sans-serif"
        color="rgba(43,40,40,0.49)"
        textAlign="center"
        width="323px"
        lineHeight="normal"
        data-testid="capturing-text"
      >
        Capturing heart rate <span style={{ fontWeight: 400 }}>and</span> temperature...
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
            data-testid="success-modal"
          >
            <VStack gap="20px" alignItems="center">
              {/* Animated Checkmark */}
              <Box
                animation="scaleIn 0.5s ease-out"
                css={{
                  '@keyframes scaleIn': {
                    '0%': { transform: 'scale(0)', opacity: 0 },
                    '50%': { transform: 'scale(1.2)', opacity: 1 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }}
                data-testid="success-checkmark"
              >
                <CheckCircle
                  size={72}
                  color="#10b981"
                  strokeWidth={2.5}
                />
              </Box>

              {/* Success Message */}
              <VStack gap="12px">
                <Text
                  fontSize="32px"
                  fontWeight="700"
                  fontFamily="'Poppins', sans-serif"
                  color="#1a1a1a"
                  lineHeight="1.2"
                  data-testid="success-title"
                >
                  Scan Complete!
                </Text>
                <Text
                  fontSize="16px"
                  fontWeight="400"
                  fontFamily="'Inter', sans-serif"
                  color="#7f8c8d"
                  lineHeight="1.5"
                  data-testid="success-message"
                >
                  Your vitals have been recorded
                </Text>
              </VStack>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}
