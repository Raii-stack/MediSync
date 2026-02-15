import { Box, Text } from '@chakra-ui/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import KioskLayout from './layouts/KioskLayout.jsx';
import Home from './pages/Home.jsx';
import Vitals from './pages/Vitals.jsx';
import Triage from './pages/Triage.jsx';
import Prescription from './pages/Prescription.jsx';
import AdminSlots from './pages/AdminSlots.jsx';
import VitalsScreen from './pages/VitalsScreen.js';

function App() {
  return (
    <BrowserRouter>
      <KioskLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vitals" element={<VitalsScreen />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/prescription" element={<Prescription />} />
          <Route
            path="/admin/slots"
            element={<AdminSlots />}
          />
        </Routes>
      </KioskLayout>
    </BrowserRouter>
  );
}

export default App;
