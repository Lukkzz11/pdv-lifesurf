import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./security/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { Toaster } from "react-hot-toast";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                fontSize: "12px",
                borderRadius: "12px"
              }
            }}
          />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

