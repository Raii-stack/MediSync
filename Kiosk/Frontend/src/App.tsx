import { RouterProvider } from "react-router";
import { router } from "./router";
import { DebugPanel } from "./components/DebugPanel";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <DebugPanel />
    </>
  );
}
