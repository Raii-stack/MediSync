import { createBrowserRouter, redirect } from "react-router";
import { WelcomeScreen } from "./pages/WelcomeScreen";
import { VitalSignsScreen } from "./pages/VitalSignsScreen";
import { SymptomsScreen } from "./pages/SymptomsScreen";
import { RecommendationScreen } from "./pages/RecommendationScreen";
import { ReceiptScreen } from "./pages/ReceiptScreen";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";

// On page refresh, sessionStorage is cleared, so flow pages redirect to home.
// The WelcomeScreen sets this flag when a session begins.
function requireSession() {
  if (!sessionStorage.getItem("kiosk_session_active")) {
    return redirect("/");
  }
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: WelcomeScreen,
    loader: () => {
      // Mark session as active when user lands on the welcome page
      sessionStorage.setItem("kiosk_session_active", "true");
      return null;
    },
  },
  {
    path: "/vitals",
    Component: VitalSignsScreen,
    loader: requireSession,
  },
  {
    path: "/symptoms",
    Component: SymptomsScreen,
    loader: requireSession,
  },
  {
    path: "/recommendation",
    Component: RecommendationScreen,
    loader: requireSession,
  },
  {
    path: "/receipt",
    Component: ReceiptScreen,
    loader: requireSession,
  },
  {
    path: "/admin",
    Component: ProtectedAdminRoute,
  },
]);
