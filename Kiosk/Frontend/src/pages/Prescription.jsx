import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Flex, Text, VStack } from '@chakra-ui/react';
import axios from 'axios';
import { gsap } from 'gsap';

const API_BASE = import.meta.env.VITE_API_URL;

export default function Prescription() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const medicine = state?.medicine || { name: 'Unknown', description: '' };
  const pistonRef = useRef(null);
  const [isDispensing, setIsDispensing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleDispense = async () => {
    if (isDispensing) return;

    setIsDispensing(true);

    if (pistonRef.current) {
      gsap
        .timeline()
        .to(pistonRef.current, { x: 100, duration: 0.25, ease: 'power2.out' })
        .to(pistonRef.current, { x: 0, duration: 0.25, ease: 'power2.in', delay: 0.2 });
    }

    try {
      await axios.post(`${API_BASE}/api/dispense`, {
        medicine: medicine.name
      });

      setIsSuccess(true);
      redirectTimerRef.current = setTimeout(() => {
        navigate('/');
      }, 5000);
    } catch (err) {
      console.error('Dispense error:', err);
      setIsDispensing(false);
    }
  };

  return (
    <Flex w="full" h="100vh" align="center" justify="center" px={{ base: 6, md: 10 }}>
      <VStack spacing={8} maxW="720px" w="full">
        <Box
          w="full"
          bg="white"
          borderRadius="24px"
          boxShadow="xl"
          px={{ base: 6, md: 10 }}
          py={{ base: 6, md: 8 }}
        >
          <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="semibold" color="gray.700">
            {medicine.name}
          </Text>
          <Text mt={3} color="gray.500" fontSize={{ base: 'md', md: 'lg' }}>
            {medicine.description || 'No description available.'}
          </Text>
        </Box>

        <Box w="full" bg="white" borderRadius="24px" boxShadow="md" px={6} py={6}>
          <Text fontSize="sm" color="gray.500" mb={3}>
            Solenoid feedback
          </Text>
          <Box
            bg="gray.100"
            borderRadius="16px"
            h="80px"
            position="relative"
            overflow="hidden"
          >
            <Box
              ref={pistonRef}
              position="absolute"
              left="12px"
              top="50%"
              transform="translateY(-50%)"
              bg="brand.500"
              borderRadius="12px"
              h="40px"
              w="120px"
              boxShadow="md"
            />
          </Box>
        </Box>

        <Button
          size="lg"
          w="full"
          bg="brand.500"
          color="white"
          _hover={{ bg: 'brand.600' }}
          _active={{ bg: 'brand.700' }}
          isLoading={isDispensing}
          onClick={handleDispense}
        >
          DISPENSE NOW
        </Button>
      </VStack>

      {isSuccess ? (
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
            borderRadius="20px"
            px={8}
            py={6}
            maxW="420px"
            w="90%"
            boxShadow="xl"
          >
            <Text fontSize="xl" fontWeight="bold" color="gray.700">
              Take Medicine
            </Text>
            <Text mt={2} color="gray.500">
              Please take your medicine now. Returning to Home shortly.
            </Text>
          </Box>
        </Box>
      ) : null}
    </Flex>
  );
}
