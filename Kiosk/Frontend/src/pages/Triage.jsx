import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Box,
  Button,
  createToaster,
  SimpleGrid,
  Toaster,
  Text,
  VStack,
  Spinner
} from '@chakra-ui/react';

const API_BASE = import.meta.env.VITE_API_URL;

const symptoms = [
  'Headache',
  'Fever',
  'Cough',
  'Colds',
  'Stomach Pain',
  'Allergy',
  'Dizziness',
  'Body Pain'
];

const normalizeTargets = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => item.toLowerCase().trim());
  return value
    .split(',')
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean);
};

export default function Triage() {
  const navigate = useNavigate();
  const toaster = useMemo(() => createToaster({ placement: 'top-end' }), []);

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/api/inventory`);
      return data;
    }
  });

  const { data: medicines, isLoading: medsLoading } = useQuery({
    queryKey: ['medicines'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/api/admin/medicines`);
      return data?.medicines || [];
    }
  });

  const inventoryWithTargets = useMemo(() => {
    if (!inventory) return [];
    return inventory.map((item) => ({
      ...item,
      targets: normalizeTargets(item.symptoms_target)
    }));
  }, [inventory]);

  const handleSymptomClick = (symptom) => {
    const normalized = symptom.toLowerCase();

    const match = inventoryWithTargets.find(
      (item) => item.current_stock > 0 && item.targets.includes(normalized)
    );

    if (match) {
      const medicineDetails = medicines?.find((med) => med.name === match.medicine_name);

      navigate('/prescription', {
        state: {
          medicine: {
            name: match.medicine_name,
            description: match.description || medicineDetails?.description || '',
            symptoms_target: match.symptoms_target || medicineDetails?.symptoms_target || '',
            current_stock: match.current_stock
          }
        }
      });
      return;
    }

    toaster.create({
      title: 'No available medicine',
      description: 'Please visit Nurse.',
      type: 'error',
      duration: 3000
    });
  };

  return (
    <VStack spacing={8} align="center" justify="center" h="100vh" px={{ base: 6, md: 10 }}>
      <Toaster toaster={toaster} />
      <Box textAlign="center">
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="semibold" color="gray.700">
          How are you feeling?
        </Text>
        <Text mt={2} color="gray.500" fontSize={{ base: 'md', md: 'lg' }}>
          Select your primary symptom.
        </Text>
      </Box>

      {(inventoryLoading || medsLoading) && (
        <VStack spacing={3}>
          <Spinner size="xl" color="brand.500" />
          <Text color="gray.500">Loading medicines...</Text>
        </VStack>
      )}

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} w={{ base: 'full', md: '70%' }}>
        {symptoms.map((symptom) => (
          <Button
            key={symptom}
            size="lg"
            bg="white"
            borderRadius="20px"
            boxShadow="md"
            _hover={{ boxShadow: 'lg', bg: 'gray.50' }}
            _active={{ transform: 'scale(0.98)' }}
            onClick={() => handleSymptomClick(symptom)}
          >
            {symptom}
          </Button>
        ))}
      </SimpleGrid>
    </VStack>
  );
}
