import { RouterProvider } from "react-router";
import { router } from "./router";
import { DebugPanel } from "./components/DebugPanel";
import KioskGuard from "./components/KioskGuard";
import WakeLock from "./components/WakeLock";
import NetworkStatus from "./components/NetworkStatus";

export default function App() {
  return (
    <KioskGuard>
      <WakeLock />
      <NetworkStatus />
      <RouterProvider router={router} />
      <DebugPanel />
    </KioskGuard>
  );
}
