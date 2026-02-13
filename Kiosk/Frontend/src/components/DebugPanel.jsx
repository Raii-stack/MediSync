import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  Heading,
  Tag
} from '@chakra-ui/react';
import { X, Zap, Wifi } from 'lucide-react';

// Determine API URL - handles both localhost and Codespaces environments
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // For Codespaces, replace port 5173 (frontend) with 3001 (backend)
  if (window.location.hostname.includes('github.dev')) {
    // In Codespaces, the port is part of the subdomain: upgraded-zebra-xxx-5173.app.github.dev
    const newOrigin = window.location.origin.replace('-5173.', '-3001.');
    return newOrigin;
  }
  
  // For local Docker/localhost
  if (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')) {
    return window.location.origin.replace(':5173', ':3001');
  }
  
  // Fallback
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

export default function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [rfidUid, setRfidUid] = useState(`TEST_${Date.now()}`);
  const [bpm, setBpm] = useState(75);
  const [temp, setTemp] = useState(37.0);
  const [duration, setDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [debugStatus, setDebugStatus] = useState(null);

  // Toggle debug panel with Ctrl+Alt+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check debug status on mount
  useEffect(() => {
    const checkDebugStatus = async () => {
      try {
        console.log(`📡 Checking debug status at: ${API_URL}/api/debug/status`);
        const res = await fetch(`${API_URL}/api/debug/status`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        setDebugStatus(data);
        console.log('Debug status:', data);
      } catch (err) {
        console.error('Failed to check debug status:', err);
        setDebugStatus({ error: err.message });
      }
    };

    if (isVisible) {
      checkDebugStatus();
    }
  }, [isVisible]);

  const simulateRfid = async () => {
    setLoading(true);
    setStatus('Simulating RFID tap...');
    try {
      console.log(`📡 Sending RFID request to: ${API_URL}/api/debug/rfid`);
      const res = await fetch(`${API_URL}/api/debug/rfid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfid_uid: rfidUid })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setStatus(`✅ ${data.message}`);
      console.log('RFID Debug Response:', data);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      console.error('RFID error:', err);
      setStatus(`❌ ${err.message || 'Failed to connect to backend'}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateVitals = async () => {
    setLoading(true);
    setStatus('Simulating vitals data...');
    try {
      console.log(`📡 Sending vitals request to: ${API_URL}/api/debug/vitals`);
      const res = await fetch(`${API_URL}/api/debug/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpm, temp, duration })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setStatus(`✅ ${data.message}`);
      console.log('Vitals Debug Response:', data);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      console.error('Vitals error:', err);
      setStatus(`❌ ${err.message || 'Failed to connect to backend'}`);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomRfid = () => {
    setRfidUid(`TEST_${Math.random().toString(16).slice(2, 10).toUpperCase()}`);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Box
      position="fixed"
      bottom="24px"
      left="24px"
      zIndex={999}
      bg="gray.900"
      color="white"
      p={6}
      rounded="lg"
      boxShadow="2xl"
      width="400px"
      maxHeight="80vh"
      overflowY="auto"
      border="2px solid yellow.400"
    >
      {/* Header */}
      <HStack justifyContent="space-between" mb={4}>
        <HStack>
          <Zap size={20} color="#FBBF24" />
          <Heading size="md">Debug Panel</Heading>
        </HStack>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsVisible(false)}
          aria-label="Close debug panel"
        >
          <X size={20} />
        </Button>
      </HStack>

      <Box height="1px" bg="gray.700" my={4} />

      {/* API URL Info */}
      <Box mb={3} p={2} bg="gray.800" rounded="sm" fontSize="xs">
        <Text color="gray.300" fontFamily="monospace" wordBreak="break-all">
          API: {API_URL}
        </Text>
      </Box>

      {/* Status */}
      {debugStatus && (
        <VStack align="start" spacing={2} mb={4} bg="gray.800" p={3} rounded="md">
          <HStack>
            <Wifi size={16} color="#4ADE80" />
            <Text fontSize="sm">
              Connected Clients: {debugStatus.connected_clients}
            </Text>
          </HStack>
          <Tag.Root size="sm" colorPalette="yellow">
            <Tag.Label>Debug Mode Active</Tag.Label>
          </Tag.Root>
        </VStack>
      )}

      {/* Status Message */}
      {status && (
        <Box
          bg="blue.800"
          p={3}
          rounded="md"
          mb={4}
          fontSize="sm"
          fontFamily="monospace"
        >
          {status}
        </Box>
      )}

      {/* RFID Section */}
      <Box mb={6}>
        <Heading size="sm" mb={3}>
          🔴 RFID Simulation
        </Heading>
        <VStack spacing={3} align="stretch">
          <HStack>
            <Input
              size="sm"
              placeholder="RFID UID"
              value={rfidUid}
              onChange={(e) => setRfidUid(e.target.value)}
              fontFamily="monospace"
              fontSize="xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={generateRandomRfid}
              fontSize="xs"
            >
              Random
            </Button>
          </HStack>
          <Button
            width="100%"
            colorScheme="red"
            isLoading={loading}
            onClick={simulateRfid}
            size="sm"
          >
            Tap RFID
          </Button>
        </VStack>
      </Box>

      <Box height="1px" bg="gray.700" my={4} />

      {/* Vitals Section */}
      <Box mb={4}>
        <Heading size="sm" mb={3}>
          💓 Vitals Simulation
        </Heading>
        <VStack spacing={3} align="stretch">
          {/* BPM */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" mb={1}>
              BPM: {bpm}
            </Text>
            <Input
              size="sm"
              type="number"
              min="40"
              max="120"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value) || 75)}
            />
          </Box>

          {/* Temperature */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" mb={1}>
              Temp (°C): {temp.toFixed(1)}
            </Text>
            <Input
              size="sm"
              type="number"
              min="35"
              max="40"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(parseFloat(e.target.value) || 37.0)}
            />
          </Box>

          {/* Duration */}
          <Box>
            <Text fontSize="xs" fontWeight="bold" mb={1}>
              Duration (s): {duration}
            </Text>
            <Input
              size="sm"
              type="number"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 5)}
            />
          </Box>

          <Button
            width="100%"
            colorScheme="blue"
            isLoading={loading}
            onClick={simulateVitals}
            size="sm"
          >
            Send Vitals
          </Button>
        </VStack>
      </Box>

      {/* Footer */}
      <Box height="1px" bg="gray.700" my={4} />
      <Text fontSize="xs" color="gray.400" textAlign="center">
        Press <kbd>Ctrl+Alt+Shift+D</kbd> to toggle
      </Text>
    </Box>
  );
}
