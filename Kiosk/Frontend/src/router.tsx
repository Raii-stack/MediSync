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

function isReloadNavigation() {
  try {
    const navEntries = window.performance.getEntriesByType("navigation");
    if (navEntries.length > 0) {
      return (navEntries[0] as PerformanceNavigationTiming).type === "reload";
    }

    const legacyNavigation = window.performance
      .navigation as PerformanceNavigation | undefined;
    return legacyNavigation?.type === 1;
  } catch {
    return false;
  }
}

function requireHomeFirst({ request }: { request: Request }) {
  const currentPath = new URL(request.url).pathname;
  const hasFlowSession = sessionStorage.getItem("navigatedFromHome") === "true";
  const isHardLoadToCurrentPath = window.location.pathname === currentPath;

  if (currentPath !== "/" && isHardLoadToCurrentPath && isReloadNavigation()) {
    sessionStorage.removeItem("navigatedFromHome");
    navigatedFromHome = false;
    return redirect("/");
  }

  if (!navigatedFromHome && !hasFlowSession) {
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
          sessionStorage.setItem("navigatedFromHome", "true");
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
