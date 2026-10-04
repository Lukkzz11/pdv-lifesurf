import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../security/AuthContext";
import { STORAGE_KEYS } from "../config/constants";
import { canAccessTenant } from "../security/roles";
import { fetchCompanyDetails, updateCompanyDetails, DEFAULT_COMPANY } from "../services/tenantService";
import { ThemeProvider } from "./ThemeContext";

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

  // Detalhes da empresa ativa (Nome, CNPJ, Endereço, Telefone, Rodapé, etc.)
  const [companyDetails, setCompanyDetails] = useState(DEFAULT_COMPANY);
  const [loadingCompany, setLoadingCompany] = useState(false);

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

  // Carrega os dados cadastrais da empresa quando o tenant ativo mudar
  const reloadCompanyDetails = useCallback(async (tenantId) => {
    if (!tenantId) return;
    setLoadingCompany(true);
    try {
      const details = await fetchCompanyDetails(tenantId);
      setCompanyDetails(details);
    } catch (err) {
      console.warn("[TenantContext] Falha ao carregar detalhes da empresa:", err);
    } finally {
      setLoadingCompany(false);
    }
  }, []);

  useEffect(() => {
    if (activeTenantId) {
      reloadCompanyDetails(activeTenantId);
    }
  }, [activeTenantId, reloadCompanyDetails]);

  // Função para alternar de empresa (para usuários com múltiplas empresas ou superadmin)
  const switchTenant = useCallback((newTenantId) => {
    if (!newTenantId) return false;
    setActiveTenantId(newTenantId);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, newTenantId);
    return true;
  }, []);

  // Função para alternar filial / unidade
  const switchUnit = useCallback((newUnitId) => {
    setActiveUnitId(newUnitId);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_UNIT, newUnitId);
  }, []);

  // Função para atualizar os dados cadastrais da empresa
  const updateCompany = useCallback(async (newData) => {
    if (!activeTenantId) return null;
    const updated = await updateCompanyDetails(activeTenantId, newData, userProfile);
    setCompanyDetails(updated);
    return updated;
  }, [activeTenantId, userProfile]);

  const value = useMemo(() => ({
    activeTenantId,
    activeUnitId,
    companyDetails,
    loadingCompany,
    reloadCompanyDetails: () => reloadCompanyDetails(activeTenantId),
    updateCompany,
    switchTenant,
    switchUnit,
    canSwitchTenant: true,
    availableTenants: userProfile?.empresasPermitidas || (userProfile?.empresaId ? [userProfile.empresaId] : [])
  }), [
    activeTenantId,
    activeUnitId,
    companyDetails,
    loadingCompany,
    reloadCompanyDetails,
    updateCompany,
    switchTenant,
    switchUnit,
    userProfile
  ]);

  return (
    <TenantContext.Provider value={value}>
      <ThemeProvider activeTenantId={activeTenantId}>
        {children}
      </ThemeProvider>
    </TenantContext.Provider>
  );
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

