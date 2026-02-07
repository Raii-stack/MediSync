import { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import EmergencyBtn from './components/EmergencyBtn';
import Home from './pages/Home';
import Vitals from './pages/Vitals';
import Triage from './pages/Triage';
import Prescription from './pages/Prescription';
import { socket } from './lib/socket';

const IDLE_TIMEOUT_MS = 60000;

function RouteResetOnReload() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasResetRef = useRef(false);

  useEffect(() => {
    if (hasResetRef.current) return;
    hasResetRef.current = true;

    if (location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

function IdleTimeout() {
  const navigate = useNavigate();
  const lastActiveRef = useRef(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    const listenerOptions = { passive: true };
    const markActive = () => {
      lastActiveRef.current = Date.now();
    };

    markActive();

    intervalRef.current = setInterval(() => {
      if (Date.now() - lastActiveRef.current >= IDLE_TIMEOUT_MS) {
        navigate('/', { replace: true });
      }
    }, 1000);

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'];
    events.forEach((event) => window.addEventListener(event, markActive, listenerOptions));

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      events.forEach((event) => window.removeEventListener(event, markActive, listenerOptions));
    };
  }, [navigate]);

  return null;
}

function Layout({ children }) {
  const location = useLocation();
  
  // Show emergency button on all pages
  return (
    <div className="kiosk-wrapper">
      <IdleTimeout />
      <EmergencyBtn />
      {children}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    socket.connect();
  }, []);

  return (
    <Router>
      <Layout>
        <RouteResetOnReload />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vitals" element={<Vitals />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/prescription" element={<Prescription />} />
        </Routes>
      </Layout>
    </Router>
  );
}
