import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Text, Flex } from '@chakra-ui/react';
import { io } from 'socket.io-client';
import hospitalIcon from '/hospital-icon.svg';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;

export default function Home() {
  const navigate = useNavigate();
  const [adminClicks, setAdminClicks] = useState(0);
  const resetTimerRef = useRef(null);
  const socketRef = useRef(null);

  // Socket.IO connection for RFID scanning
  useEffect(() => {
    if (socketRef.current) {
      return;
    }

    console.log('🔌 [Home] Connecting to Socket.IO:', SOCKET_URL);
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('✅ [Home] Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ [Home] Socket disconnected:', reason);
    });

    socket.on('rfid-scan', (data) => {
      console.log('🔴 [Home] RFID scan received:', data);
      
      if (data.student) {
        console.log('✅ [Home] Navigating to vitals with student:', data.student);
        navigate('/vitals', { state: { student: data.student } });
      } else {
        console.log('⚠️ [Home] No student found, navigating to vitals anyway');
        navigate('/vitals');
      }
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 [Home] Cleaning up socket connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate]);

  const handleTapIdCard = async () => {
    // Simulate scanning student ID card
    // In production, this would read from NFC/RFID scanner
    const mockStudentId = '20240001';
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: mockStudentId })
      });
      
      const data = await response.json();
      
      if (data.success && data.student) {
        console.log('✅ Student logged in:', data.student);
        navigate('/vitals', { state: { student: data.student } });
      } else {
        console.error('❌ Login failed');
        // Still navigate but with default name
        navigate('/vitals');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      // Still navigate but with default name
      navigate('/vitals');
    }
  };

  const handleLogoClick = () => {
    const nextCount = adminClicks + 1;
    setAdminClicks(nextCount);

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    if (nextCount >= 5) {
      setAdminClicks(0);
      navigate('/admin/slots');
      return;
    }

    resetTimerRef.current = setTimeout(() => {
      setAdminClicks(0);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return (
    <Box
      bg="#f5f5f5"
      width="100vw"
      height="100vh"
      position="relative"
      overflow="hidden"
    >
      {/* Top centered content */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% - 141.5px))"
        width="625.78px"
      >
        {/* Logo */}
        <Flex
          onClick={handleLogoClick}
          cursor="pointer"
          justifyContent="center"
          alignItems="center"
          width="218px"
          height="218px"
          margin="0 auto"
          padding="10px"
        >
          <Box position="relative" width="135px" height="135px">
            {/* Outer border */}
            <Box
              position="absolute"
              top="-32px"
              left="-32px"
              right="-32px"
              bottom="-32px"
              border="2px solid #bfdbfe"
              borderRadius="50%"
              opacity={0.6}
            />
            {/* Inner dashed border */}
            <Box
              position="absolute"
              top="-16px"
              left="-16px"
              right="-16px"
              bottom="-16px"
              border="1px dashed #93c5fd"
              borderRadius="50%"
              opacity={0.4}
            />
            {/* Main logo box */}
            <Box
              backgroundColor="#3b82f6"
              bg="#3b82f6"
              width="135px"
              height="135px"
              borderRadius="32px"
              position="relative"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)"
              overflow="hidden"
              css={{ backgroundColor: '#3b82f6 !important' }}
              style={{ backgroundColor: '#3b82f6' }}
            >
              {/* Gradient overlay */}
              <Box
                position="absolute"
                top="50%"
                left="0"
                right="0"
                transform="translateY(-50%)"
                height="192px"
                bgGradient="linear(45deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.2) 100%)"
                pointerEvents="none"
              />
              {/* Icon */}
              <Box position="relative" zIndex={1} width="78px" height="78px">
                <img src={hospitalIcon} alt="Hospital" style={{ width: '100%', height: '100%', filter: 'brightness(0) invert(1)' }} />
              </Box>
            </Box>
          </Box>
        </Flex>

        {/* Heading */}
        <Box textAlign="center" marginTop="6px">
          <Text
            fontSize="60px"
            fontWeight="700"
            fontFamily="'Inter', sans-serif"
            color="#111827"
            letterSpacing="-1.5px"
            lineHeight="60px"
          >
            Welcome to{' '}
            <Text as="span" color="#3b82f6" fontWeight="700" fontFamily="'Inter', sans-serif">
              MediSync
            </Text>
          </Text>
        </Box>

        {/* Subtitle */}
        <Box textAlign="center" marginTop="6px" padding="10px">
          <Text
            fontSize="24px"
            fontWeight="400"
            fontFamily="'Arimo', sans-serif"
            color="#6b7280"
            lineHeight="32px"
          >
            Your Smart Health Kiosk
          </Text>
        </Box>
      </Box>

      {/* Bottom action section */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, calc(-50% + 204.5px))"
        width="453px"
      >
        {/* Instruction text */}
        <Text
          fontSize="16px"
          fontWeight="500"
          fontFamily="'Inter', sans-serif"
          color="#9ca3af"
          textAlign="center"
          letterSpacing="3.2px"
          textTransform="uppercase"
          lineHeight="24px"
          marginBottom="17px"
        >
          Waiting for RFID scan...
        </Text>

        {/* Tap ID Card Button - DISABLED (Use Debug Panel or Hardware RFID) */}
        <Button
          backgroundColor="#3b82f6"
          bg="#3b82f6"
          borderRadius="24px"
          height="81px"
          width="100%"
          disabled={true}
          cursor="not-allowed"
          paddingX="77px"
          paddingY="18px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap="12px"
          marginBottom="17px"
          css={{ backgroundColor: '#3b82f6 !important' }}
          style={{ backgroundColor: '#3b82f6' }}
          border="none"
          boxShadow="0px 10px 25px -5px rgba(59, 130, 246, 0.4), 0px 4px 10px -3px rgba(59, 130, 246, 0.3)"
          opacity={1}
        >
          <Flex alignItems="center" justifyContent="center" width="44px" height="44px">
            <Text fontSize="36px" color="white" fontFamily="'Material Icons'" lineHeight="1">
              nfc
            </Text>
          </Flex>
          <Text
            fontSize="26px"
            fontWeight="600"
            fontFamily="'Inter', sans-serif"
            color="white"
            whiteSpace="nowrap"
          >
            Tap ID Card
          </Text>
        </Button>

        {/* Version text */}
        <Text
          fontSize="14px"
          fontWeight="500"
          fontFamily="'Inter', sans-serif"
          color="rgba(156,163,175,0.7)"
          textAlign="center"
          letterSpacing="3.2px"
          textTransform="uppercase"
          lineHeight="24px"
        >
          v1.0.1
        </Text>
      </Box>

      {/* Bottom gradient bar */}
      <Box
        position="absolute"
        bottom="-1px"
        left="0"
        right="0"
        height="8px"
        bgGradient="linear(to-r, #93c5fd, #3b82f6, #93c5fd)"
      />
    </Box>
  );
}
