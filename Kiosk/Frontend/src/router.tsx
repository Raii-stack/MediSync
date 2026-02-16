import { createBrowserRouter } from "react-router";
import { WelcomeScreen } from "./pages/WelcomeScreen";
import { VitalSignsScreen } from "./pages/VitalSignsScreen";
import { SymptomsScreen } from "./pages/SymptomsScreen";
import { RecommendationScreen } from "./pages/RecommendationScreen";
import { ReceiptScreen } from "./pages/ReceiptScreen";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: WelcomeScreen,
  },
  {
    path: "/vitals",
    Component: VitalSignsScreen,
  },
  {
    path: "/symptoms",
    Component: SymptomsScreen,
  },
  {
    path: "/recommendation",
    Component: RecommendationScreen,
  },
  {
    path: "/receipt",
    Component: ReceiptScreen,
  },
  {
    path: "/admin",
    Component: ProtectedAdminRoute,
  },
]);
