/**
 * Constantes globais do sistema LifeSurf PDV
 */

// Níveis de acesso / Papéis no sistema
export const USER_ROLES = {
  SUPERADMIN: "superadmin", // Acesso global ao sistema e a todas as empresas
  ADMIN: "admin",           // Dono / Administrador da empresa
  GERENTE: "gerente",       // Gerente da filial / loja
  OPERADOR: "operador"      // Operador de caixa / Vendedor
};

// Chaves de armazenamento local (LocalStorage)
export const STORAGE_KEYS = {
  ACTIVE_TENANT: "lifesurf_active_tenant",
  ACTIVE_UNIT: "lifesurf_active_unit",
  THEME: "lifesurf_theme"
};

// Coleções base do Firestore preparadas para arquitetura Multi-Tenant
export const COLLECTIONS = {
  USERS: "usuarios",
  TENANTS: "empresas",
  UNITS: "unidades",
  PRODUCTS: "produtos",
  SALES: "vendas",
  CASH_REGISTERS: "caixas",
  CUSTOMERS: "clientes"
};
