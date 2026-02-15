import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Icon,
  Text,
  Dialog,
  Portal,
  CloseButton,
} from "@chakra-ui/react";
import { TriangleAlert, Phone } from "lucide-react";
import { gsap } from "gsap";
import DebugPanel from "../components/DebugPanel";

const IDLE_TIMEOUT_MS = 60_000;

export default function KioskLayout({ children }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const idleTimerRef = useRef(null);
  const emergencyRef = useRef(null);

  useEffect(() => {
    if (!emergencyRef.current) return;

    const tween = gsap.to(emergencyRef.current, {
      scale: 1.1,
      duration: 0.9,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });

    return () => {
      tween.kill();
    };
  }, []);

  useEffect(() => {
    // Don't start inactivity timer on home page
    if (location.pathname === "/") {
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
        window.location.assign("/");
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    const events = ["touchstart", "mousedown", "keydown", "mousemove"];
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

  // 2. Define the confirm action (placeholder for now)
  const handleConfirm = () => {
    console.log("Emergency confirmed");
    closeDialog();
  };

  return (
    <Box minH="100vh" position="relative">
      <Flex position="relative" minH="100vh">
        {children}
      </Flex>

      <DebugPanel />

      {/* 1. Move the ref to the Box (Wrapper) */}
      <Box 
        ref={emergencyRef} 
        position="fixed" 
        top="24px" 
        right="24px" 
        zIndex={9999}
      >
        <Button
          clickable="true"
          onClick={openDialog}
          background="#ef4444"
          color="white"
          transition="all 0.2s" // Smooth transition for user interaction
          borderRadius="9999px"
          paddingTop="12px"
          paddingBottom="12px"
          paddingLeft="20px"
          paddingRight="20px"
          height="auto"
          boxShadow="0px 10px 15px -3px rgba(248, 7, 7, 0.18)"
          display="flex"
          gap="2px"
          alignItems="center"
          textTransform="uppercase"
          fontWeight="bold"
          fontFamily="'Arimo', sans-serif"
          fontSize="16px"
          letterSpacing="0.35px"
          lineHeight="20px"
        >
          <Icon as={TriangleAlert} boxSize="18px" paddingRight="2px" />
          Emergency
        </Button>
      </Box>

      {/* Emergency Confirmation Dialog */}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(e) => setIsOpen(e.open)}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop bg="rgba(0,0,0,0.5)" backdropFilter="blur(4px)" />
          <Dialog.Positioner>
            <Dialog.Content
              bg="white"
              borderRadius="24px"
              boxShadow="0 20px 60px rgba(0,0,0,0.3)"
              overflow="hidden"
            >
              <Dialog.Header p="32px 32px 16px">
                <Flex align="center" gap="12px">
                  <Flex
                    align="center"
                    justify="center"
                    w="40px"
                    h="40px"
                    bg="#fef2f2"
                    borderRadius="12px"
                    flexShrink={0}
                  >
                    <Icon as={Phone} color="#ef4444" boxSize="20px" />
                  </Flex>
                  <Dialog.Title
                    fontSize="22px"
                    fontWeight="700"
                    fontFamily="'Arimo', sans-serif"
                    color="#1e2939"
                  >
                    Call the Clinic?
                  </Dialog.Title>
                </Flex>
              </Dialog.Header>

              <Dialog.Body px="32px" pb="24px" pt="0">
                <Text
                  fontSize="16px"
                  fontWeight="400"
                  fontFamily="'Inter', sans-serif"
                  color="#7f8c8d"
                  lineHeight="1.6"
                >
                  This action will notify the medical staff immediately. Please
                  only use this for actual health emergencies.
                </Text>
              </Dialog.Body>

              <Dialog.Footer
                bg="#f9fafb"
                p="20px 32px"
                gap="12px"
                justifyContent="flex-end"
              >
                <Dialog.ActionTrigger asChild>
                  <Button
                    bg="transparent"
                    color="#6b7280"
                    borderRadius="12px"
                    px="20px"
                    fontSize="16px"
                    fontWeight="600"
                    fontFamily="'Inter', sans-serif"
                    _hover={{ bg: "#f3f4f6" }}
                  >
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  onClick={handleConfirm}
                  bg="#ef4444"
                  color="white"
                  borderRadius="12px"
                  px="28px"
                  fontSize="16px"
                  fontWeight="600"
                  fontFamily="'Inter', sans-serif"
                  boxShadow="0 4px 10px rgba(239, 68, 68, 0.25)"
                  _hover={{ bg: "#dc2626" }}
                  _active={{ bg: "#b91c1c" }}
                >
                  Confirm Alert
                </Button>
              </Dialog.Footer>

              <Dialog.CloseTrigger asChild>
                <CloseButton
                  size="sm"
                  position="absolute"
                  top="16px"
                  right="16px"
                  color="#9ca3af"
                />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
