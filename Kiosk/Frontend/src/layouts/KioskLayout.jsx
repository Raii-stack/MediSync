import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Icon,
  Text
} from '@chakra-ui/react';
import { TriangleAlert } from 'lucide-react';
import { gsap } from 'gsap';
import DebugPanel from '../components/DebugPanel';

const IDLE_TIMEOUT_MS = 60_000;

export default function KioskLayout({ children }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const cancelRef = useRef(null);
  const idleTimerRef = useRef(null);
  const emergencyRef = useRef(null);

  useEffect(() => {
    if (!emergencyRef.current) return;

    const tween = gsap.to(emergencyRef.current, {
      scale: 1.1,
      duration: 0.9,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut'
    });

    return () => {
      tween.kill();
    };
  }, []);

  useEffect(() => {
    // Don't start inactivity timer on home page
    if (location.pathname === '/') {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      return;
    }

    const resetTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        window.location.assign('/');
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    const events = ['touchstart', 'mousedown', 'keydown', 'mousemove'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [location.pathname]);

  const openDialog = () => setIsOpen(true);
  const closeDialog = () => setIsOpen(false);

  return (
    <Box minH="100vh" position="relative">
      <Flex position="relative" minH="100vh">
        {children}
      </Flex>

      <DebugPanel />

      <Box position="fixed" top="24px" right="24px" zIndex={50}>
        <Button
          ref={emergencyRef}
          onClick={openDialog}
          bg="red.500"
          color="white"
          _hover={{ bg: 'red.600' }}
          _active={{ bg: 'red.700' }}
          rounded="full"
          px={6}
          py={6}
          boxShadow="lg"
          leftIcon={<Icon as={TriangleAlert} boxSize={5} />}
          textTransform="uppercase"
          fontWeight="bold"
          letterSpacing="0.08em"
        >
          Emergency
        </Button>
      </Box>

      {isOpen ? (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.600"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={60}
        >
          <Box
            bg="white"
            borderRadius="16px"
            px={6}
            py={5}
            maxW="420px"
            w="90%"
            boxShadow="xl"
          >
            <Text fontSize="lg" fontWeight="bold" mb={2}>
              Call the Clinic?
            </Text>
            <Text color="gray.600" mb={6}>
              This will send an emergency alert to the clinic staff. Continue?
            </Text>
            <Flex justify="flex-end" gap={3}>
              <Button ref={cancelRef} onClick={closeDialog}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={closeDialog}>
                Confirm
              </Button>
            </Flex>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
