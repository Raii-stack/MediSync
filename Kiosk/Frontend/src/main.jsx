import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/globals.css";
import App from "./App.jsx";
import { SocketProvider } from "./contexts/SocketContext";
import { KioskProvider } from "./contexts/KioskContext";
import { Toaster } from "sonner";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <KioskProvider>
          <App />
          <Toaster position="top-center" richColors />
        </KioskProvider>
      </SocketProvider>
    </QueryClientProvider>
  </StrictMode>,
);
