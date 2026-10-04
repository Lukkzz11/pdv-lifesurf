import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { hasAnyRole } from "./roles";
import LoadingScreen from "../components/common/LoadingScreen";

/**
 * Componente de proteção de rotas (Guarda de Autenticação e Autorização)
 *
 * @param {object} props
 * @param {string[]} [props.allowedRoles] - Lista opcional de papéis autorizados para a rota
 * @param {boolean} [props.requireTenant=false] - Se a rota exige uma empresa/tenant ativa
 * @param {React.ReactNode} [props.children] - Componente filho opcional (se não usar Outlet)
 * @param {string} [props.redirectTo="/login"] - Rota de redirecionamento caso não autenticado
 */
export default function ProtectedRoute({
  allowedRoles = [],
  requireTenant = false,
  children,
  redirectTo = "/login"
}) {
  const { isAuthenticated, isBlocked, role, loading } = useAuth();
  const { activeTenantId } = useTenant();
  const location = useLocation();

  // 1. Enquanto o Firebase verifica o token de sessão, exibe tela de carregamento segura
  if (loading) {
    return <LoadingScreen message="Validando credenciais de acesso..." />;
  }

  // 2. Se não estiver autenticado, redireciona para login guardando a rota de origem
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 3. Se a conta do usuário foi bloqueada/desativada administrativamente
  if (isBlocked) {
    return (
      <Navigate
        to="/login"
        state={{ error: "Sua conta está desativada. Contate o administrador." }}
        replace
      />
    );
  }

  // 4. Se a rota exige papéis específicos e o usuário não possui o nível necessário
  if (allowedRoles.length > 0 && !hasAnyRole(role, allowedRoles)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{ from: location, requiredRoles: allowedRoles }}
        replace
      />
    );
  }

  // 5. Se a rota exige seleção de empresa e ainda não há empresa ativa
  if (requireTenant && !activeTenantId) {
    return <Navigate to="/selecionar-empresa" state={{ from: location }} replace />;
  }

  // Se tudo estiver correto, renderiza os filhos diretos ou a rota aninhada (Outlet)
  return children ? children : <Outlet />;
}
