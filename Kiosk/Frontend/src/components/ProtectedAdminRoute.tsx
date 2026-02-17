import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AdminScreen } from "../pages/AdminScreen";

export function ProtectedAdminRoute() {
  const navigate = useNavigate();
  const hasChecked = useRef(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Only check once, even in StrictMode
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Check if accessed via secret method (presence of admin access flag)
    const adminAccessGranted = sessionStorage.getItem("adminAccessGranted");

    if (!adminAccessGranted) {
      // Redirect to home if accessed directly via URL
      navigate("/", { replace: true });
      return;
    }

    // Clear the access flag after check (single use)
    sessionStorage.removeItem("adminAccessGranted");
    setIsAuthorized(true);
  }, [navigate]);

  // Only render AdminScreen after authorization check passes
  if (!isAuthorized) {
    return null;
  }

  return <AdminScreen />;
}
