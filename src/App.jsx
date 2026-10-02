import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./security/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <AppRoutes />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
