import { createBrowserRouter } from "react-router";
import { WelcomeScreen } from "./pages/WelcomeScreen";
import { VitalSignsScreen } from "./pages/VitalSignsScreen";
import { SymptomsScreen } from "./pages/SymptomsScreen";
import { RecommendationScreen } from "./pages/RecommendationScreen";
import { DispensingScreen } from "./pages/DispensingScreen";
import { ReceiptScreen } from "./pages/ReceiptScreen";

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
    path: "/dispensing",
    Component: DispensingScreen,
  },
  {
    path: "/receipt",
    Component: ReceiptScreen,
  },
]);