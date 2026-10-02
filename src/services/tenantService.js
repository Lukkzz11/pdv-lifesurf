import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { COLLECTIONS, USER_ROLES } from "../config/constants";

/**
 * Serviço de Gestão e Descoberta Multiempresa
 * Otimizado para leitura mínima e segurança por papel/permissão.
 */

// Empresa padrão de fallback quando o Firestore ainda estiver sendo populado
const DEFAULT_COMPANY = {
  id: "lifesurf-principal",
  nome: "LifeSurf Moda & Surfwear",
  cnpj: "00.000.000/0001-00",
  cidade: "Fortaleza - CE",
  segmento: "Confecção e Varejo",
  ativo: true,
  unidades: ["matriz", "fabrica"]
};

/**
 * Busca as empresas às quais o usuário autenticado tem permissão de acesso
 * @param {object} userProfile - Perfil do usuário contendo role e empresasPermitidas
 * @returns {Promise<Array>} Lista de empresas autorizadas
 */
export async function fetchUserTenants(userProfile) {
  if (!userProfile) return [DEFAULT_COMPANY];

  try {
    const empresasRef = collection(db, COLLECTIONS.TENANTS);

    // Se for SUPERADMIN, busca todas as empresas ativas no sistema
    if (userProfile.role === USER_ROLES.SUPERADMIN) {
      const q = query(empresasRef, where("ativo", "==", true));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      return [DEFAULT_COMPANY];
    }

    // Se o usuário tem uma lista explícita de empresas permitidas
    const allowedIds = userProfile.empresasPermitidas || (userProfile.empresaId ? [userProfile.empresaId] : []);

    if (allowedIds.length === 0) {
      return [DEFAULT_COMPANY];
    }

    // Busca pontual por IDs para evitar varredura desnecessária (regra Blaze)
    const companyPromises = allowedIds.map(async (id) => {
      try {
        const docSnap = await getDoc(doc(db, COLLECTIONS.TENANTS, id));
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
      } catch (err) {
        console.warn(`[tenantService] Não foi possível ler a empresa ${id}:`, err);
      }
      // Se não encontrou no banco mas é o ID padrão
      if (id === DEFAULT_COMPANY.id || id === "lifesurf") {
        return DEFAULT_COMPANY;
      }
      return {
        id,
        nome: id.toUpperCase().replace("-", " "),
        segmento: "Loja / Filial",
        ativo: true,
        unidades: ["matriz"]
      };
    });

    const companies = (await Promise.all(companyPromises)).filter(Boolean);
    return companies.length > 0 ? companies : [DEFAULT_COMPANY];
  } catch (error) {
    console.error("[tenantService] Erro ao buscar empresas do usuário:", error);
    return [DEFAULT_COMPANY];
  }
}
