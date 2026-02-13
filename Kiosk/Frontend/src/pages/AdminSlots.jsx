import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Badge,
  Box,
  Button,
  Flex,
  Image,
  NativeSelect,
  NumberInput,
  Progress,
  SimpleGrid,
  Text,
  VStack
} from '@chakra-ui/react';

const API_BASE = import.meta.env.VITE_API_URL;

export default function AdminSlots() {
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [stockValue, setStockValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['admin-slots'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/api/admin/slots`);
      return data?.slots || [];
    }
  });

  const { data: medicinesData } = useQuery({
    queryKey: ['admin-medicines'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/api/admin/medicines`);
      return data?.medicines || [];
    }
  });

  const medicines = medicinesData || [];
  const slots = slotsData || [];

  const openModal = (slot) => {
    setSelectedSlot(slot);
    setSelectedMedicine(slot?.medicine_name || '');
    setStockValue(slot?.current_stock?.toString() ?? '');
    setErrorMessage('');
  };

  const closeModal = () => {
    setSelectedSlot(null);
    setSelectedMedicine('');
    setStockValue('');
    setErrorMessage('');
  };

  const handleSubmit = async () => {
    if (!selectedSlot) return;

    if (!selectedMedicine) {
      setErrorMessage('Please select a medicine.');
      return;
    }

    const stockNumber = Number.parseInt(stockValue, 10);
    if (Number.isNaN(stockNumber) || stockNumber < 0) {
      setErrorMessage('Stock level must be 0 or higher.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      await axios.post(`${API_BASE}/api/admin/slots`, {
        slot_id: selectedSlot.slot_id,
        medicine_name: selectedMedicine,
        stock: stockNumber
      });

      await queryClient.invalidateQueries({ queryKey: ['admin-slots'] });
      closeModal();
    } catch (err) {
      console.error('Slot update failed:', err);
      setErrorMessage('Failed to update slot. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getProgressColor = (stock) => (stock < 10 ? 'red' : 'green');

  const emptyState = useMemo(() => !slotsLoading && slots.length === 0, [slotsLoading, slots]);

  return (
    <Box w="full" minH="100vh" px={{ base: 6, md: 10 }} py={{ base: 8, md: 10 }}>
      <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="semibold" color="gray.700">
        Admin Slots
      </Text>
      <Text mt={2} color="gray.500">
        Manage solenoid slot assignments and inventory.
      </Text>

      {slotsLoading ? (
        <Text mt={6} color="gray.500">
          Loading slots...
        </Text>
      ) : null}

      {emptyState ? (
        <Text mt={6} color="gray.500">
          No slots available.
        </Text>
      ) : null}

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mt={8}>
        {slots.map((slot) => (
          <Box key={slot.slot_id} bg="white" borderRadius="20px" boxShadow="md" p={5}>
            <Badge colorScheme="blue" mb={3}>
              SOLENOID {slot.slot_id}
            </Badge>
            <VStack spacing={3} align="stretch">
              <Flex align="center" gap={4}>
                <Image
                  src={slot.image_url || 'https://via.placeholder.com/64'}
                  alt={slot.medicine_name || 'Empty'}
                  boxSize="64px"
                  borderRadius="12px"
                  objectFit="cover"
                />
                <Box>
                  <Text fontWeight="semibold" color="gray.700">
                    {slot.medicine_name || 'Unassigned'}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Stock: {slot.current_stock} / {slot.max_capacity}
                  </Text>
                </Box>
              </Flex>

              <Progress
                value={slot.max_capacity ? (slot.current_stock / slot.max_capacity) * 100 : 0}
                colorScheme={getProgressColor(slot.current_stock)}
                borderRadius="full"
              />

              <Button
                variant="outline"
                colorScheme="blue"
                onClick={() => openModal(slot)}
              >
                Refill
              </Button>
            </VStack>
          </Box>
        ))}
      </SimpleGrid>

      {selectedSlot ? (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.600"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={60}
        >
          <Box bg="white" borderRadius="20px" px={8} py={6} w="90%" maxW="520px" boxShadow="xl">
            <Text fontSize="xl" fontWeight="bold" color="gray.700">
              Refill Solenoid {selectedSlot.slot_id}
            </Text>

            <Box mt={5}>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Medicine
              </Text>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={selectedMedicine}
                  onChange={(event) => setSelectedMedicine(event.target.value)}
                >
                  <option value="">Select medicine</option>
                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.name}>
                      {medicine.name}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Box>

            <Box mt={5}>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Stock Level
              </Text>
              <NumberInput.Root
                value={stockValue}
                onValueChange={(details) => setStockValue(details.value)}
                min={0}
              >
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
                <NumberInput.Input />
              </NumberInput.Root>
            </Box>

            {errorMessage ? (
              <Text mt={3} color="red.500" fontSize="sm">
                {errorMessage}
              </Text>
            ) : null}

            <Flex justify="flex-end" gap={3} mt={6}>
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleSubmit} isLoading={isSaving}>
                Save
              </Button>
            </Flex>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
