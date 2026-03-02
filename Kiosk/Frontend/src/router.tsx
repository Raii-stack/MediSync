import { createBrowserRouter, redirect } from "react-router";
import { WelcomeScreen } from "./pages/WelcomeScreen";
import { VitalSignsScreen } from "./pages/VitalSignsScreen";
import { SymptomsScreen } from "./pages/SymptomsScreen";
import { RecommendationScreen } from "./pages/RecommendationScreen";
import { ReceiptScreen } from "./pages/ReceiptScreen";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";

import { Outlet } from "react-router";
import { IdleTimeoutProvider } from "./components/IdleTimeoutProvider";

// Module-level flag: resets to false on every page refresh (JS bundle reload).
// Set to true only when the user lands on the home page via normal navigation.
let navigatedFromHome = false;

function requireHomeFirst() {
  if (!navigatedFromHome) {
    return redirect("/");
  }
  return null;
}

const AppLayout = () => {
  return (
    <IdleTimeoutProvider>
      <Outlet />
    </IdleTimeoutProvider>
  );
};

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        Component: WelcomeScreen,
        loader: () => {
          navigatedFromHome = true;
          return null;
        },
      },
      {
        path: "/vitals",
        Component: VitalSignsScreen,
        loader: requireHomeFirst,
      },
      {
        path: "/symptoms",
        Component: SymptomsScreen,
        loader: requireHomeFirst,
      },
      {
        path: "/recommendation",
        Component: RecommendationScreen,
        loader: requireHomeFirst,
      },
      {
        path: "/receipt",
        Component: ReceiptScreen,
        loader: requireHomeFirst,
      },
      {
        path: "/admin",
        Component: ProtectedAdminRoute,
      },
    ]
  }
]);
