import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../security/AuthContext";
import { STORAGE_KEYS } from "../config/constants";
import { canAccessTenant } from "../security/roles";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { userProfile, isAuthenticated } = useAuth();

  // Recupera empresa previamente selecionada ou atribui o padrão do usuário
  const [activeTenantId, setActiveTenantId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT) || null;
  });

  const [activeUnitId, setActiveUnitId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_UNIT) || "matriz";
  });

  // Sincroniza a empresa ativa quando o perfil do usuário for carregado
  useEffect(() => {
    if (!isAuthenticated || !userProfile) {
      return;
    }

    const savedTenant = localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT);
    const primaryTenant = userProfile.empresaId || import.meta.env.VITE_DEFAULT_TENANT_ID || "lifesurf-principal";

    // Se o usuário já tiver uma empresa salva válida que ele pode acessar, mantém
    if (savedTenant && canAccessTenant(userProfile, savedTenant)) {
      setActiveTenantId(savedTenant);
    } else {
      setActiveTenantId(primaryTenant);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, primaryTenant);
    }

    if (userProfile.unidadeId) {
      setActiveUnitId(userProfile.unidadeId);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_UNIT, userProfile.unidadeId);
    }
  }, [isAuthenticated, userProfile]);

  // Função para alternar de empresa (para usuários com múltiplas empresas ou superadmin)
  const switchTenant = useCallback((newTenantId) => {
    if (!canAccessTenant(userProfile, newTenantId)) {
      console.error(`[TenantContext] Usuário não possui acesso à empresa ${newTenantId}`);
      return false;
    }
    setActiveTenantId(newTenantId);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, newTenantId);
    return true;
  }, [userProfile]);

  // Função para alternar filial / unidade
  const switchUnit = useCallback((newUnitId) => {
    setActiveUnitId(newUnitId);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_UNIT, newUnitId);
  }, []);

  const value = useMemo(() => ({
    activeTenantId,
    activeUnitId,
    switchTenant,
    switchUnit,
    canSwitchTenant: Boolean(userProfile?.empresasPermitidas?.length > 1 || userProfile?.role === "superadmin"),
    availableTenants: userProfile?.empresasPermitidas || (userProfile?.empresaId ? [userProfile.empresaId] : [])
  }), [activeTenantId, activeUnitId, switchTenant, switchUnit, userProfile]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Hook customizado para acessar o contexto Multi-Empresa
 */
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser utilizado dentro de um <TenantProvider />");
  }
  return context;
}
