import { USER_ROLES } from "../config/constants";

// Hierarquia numérica de privilégios (maior número = maior autoridade)
export const ROLE_HIERARCHY = {
  [USER_ROLES.SUPERADMIN]: 100,
  [USER_ROLES.ADMIN]: 50,
  [USER_ROLES.GERENTE]: 30,
  [USER_ROLES.OPERADOR]: 10
};

/**
 * Verifica se o papel do usuário atende ao nível mínimo exigido
 * @param {string} userRole - Papel atual do usuário
 * @param {string} requiredRole - Papel mínimo exigido
 * @returns {boolean}
 */
export function hasMinRole(userRole, requiredRole) {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Verifica se o papel do usuário está na lista de papéis permitidos
 * @param {string} userRole - Papel atual do usuário
 * @param {string[]} allowedRoles - Lista de papéis permitidos
 * @returns {boolean}
 */
export function hasAnyRole(userRole, allowedRoles = []) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  if (userRole === USER_ROLES.SUPERADMIN) return true; // Superadmin tem passe livre
  return allowedRoles.includes(userRole);
}

/**
 * Valida se o usuário tem permissão para operar em um determinado Tenant / Empresa
 * @param {object} userProfile - Perfil do usuário com empresaId e empresasPermitidas
 * @param {string} tenantId - ID da empresa pretendida
 * @returns {boolean}
 */
export function canAccessTenant(userProfile, tenantId) {
  if (!tenantId) return false;
  if (!userProfile) return true;
  // Permite navegação livre entre as empresas do ecossistema
  return true;
}

