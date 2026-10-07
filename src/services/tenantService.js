import { collection, getDocs, doc, getDoc, setDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { COLLECTIONS, USER_ROLES, STORAGE_KEYS } from "../config/constants";

/**
 * Serviço de Gestão e Descoberta Multiempresa & Configurações da Loja
 * Otimizado para leitura mínima e segurança por papel/permissão.
 */

// Empresa padrão de fallback quando o Firestore ainda estiver sendo populado
// Empresa padrão de fallback quando o Firestore ainda estiver sendo populado
export const DEFAULT_COMPANY = {
  id: "lifesurf-principal",
  nome: "LifeSurf Moda & Surfwear",
  razaoSocial: "LifeSurf Confecções e Comércio do Vestuário Ltda",
  cnpj: "12.345.678/0001-90",
  inscricaoEstadual: "06.123.456-7",
  cidade: "Fortaleza - CE",
  endereco: "Av. Beira Mar, 2100",
  numero: "2100",
  bairro: "Meireles",
  estado: "CE",
  cep: "60165-121",
  telefone: "(85) 98888-7777",
  email: "contato@lifesurf.com.br",
  mensagemRodape: "OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!\nTROCAS EM ATÉ 15 DIAS COM A ETIQUETA.",
  segmento: "Confecção e Varejo de Moda Surfwear",
  ativo: true,
  unidades: ["matriz", "fabrica"],
  margemPadrao: 100, // % markup sugerido
  alertaEstoqueMinimoPadrao: 5,
  exigirJustificativaPerda: true,
  temaConfig: {
    id: "lifesurf-blue",
    primaryColor: "#0284c7",
    accentColor: "#38bdf8",
    mode: "dark"
  },
  painelConfig: {
    exibirAlertasCriticos: true,
    exibirAcoesCabecalho: true,
    colunasGrid: "3",
    densidadeCards: "padrao",
    ordemModulos: [
      "pdv",
      "caixa-loja",
      "estoque-loja",
      "estoque-fabrica",
      "estoque",
      "pedidos",
      "calendario",
      "etiquetas",
      "relatorios",
      "catalogo",
      "clientes",
      "a-ver",
      "financeiro",
      "configuracoes"
    ],
    modulosDesativados: []
  }
};

// Empresas padrão integradas ao ecossistema
export const DEFAULT_COMPANIES = [
  DEFAULT_COMPANY,
  {
    id: "arena-sandplay",
    nome: "Arena Sandplay",
    razaoSocial: "Arena Sandplay Esportes, Beach Tennis & Lazer Ltda",
    cnpj: "34.567.890/0001-12",
    inscricaoEstadual: "06.987.654-3",
    cidade: "Fortaleza - CE",
    endereco: "Av. Washington Soares, 4500",
    numero: "4500",
    bairro: "Edson Queiroz",
    estado: "CE",
    cep: "60811-341",
    telefone: "(85) 99123-4567",
    email: "contato@arenasandplay.com.br",
    mensagemRodape: "ARENA SANDPLAY • BEACH TENNIS, ESPORTES & GASTRONOMIA\nOBRIGADO PELA PREFERÊNCIA!",
    segmento: "Complexo Esportivo, Beach Tennis & Lazer",
    ativo: true,
    unidades: ["arena-principal", "bar-quiosque"],
    margemPadrao: 80,
    alertaEstoqueMinimoPadrao: 10,
    exigirJustificativaPerda: false,
    temaConfig: {
      id: "sandplay-amber",
      primaryColor: "#f59e0b",
      accentColor: "#fbbf24",
      mode: "dark"
    }
  },
  {
    id: "jarbas-alugueis",
    nome: "Jarbas Aluguéis",
    razaoSocial: "Jarbas Gestão Imobiliária & Locações Ltda",
    cnpj: "45.678.901/0001-23",
    inscricaoEstadual: "06.555.444-1",
    cidade: "Fortaleza - CE",
    endereco: "Rua Desembargador Moreira, 1800",
    numero: "1800",
    bairro: "Aldeota",
    estado: "CE",
    cep: "60170-001",
    telefone: "(85) 98765-4321",
    email: "locacoes@jarbasalugueis.com.br",
    mensagemRodape: "JARBAS ALUGUÉIS • CONFORTO & PRATICIDADE EM CADA LOCAÇÃO.",
    segmento: "Locação de Imóveis, Equipamentos & Temporada",
    ativo: true,
    unidades: ["escritorio", "unidades-locadas"],
    margemPadrao: 50,
    alertaEstoqueMinimoPadrao: 2,
    exigirJustificativaPerda: false,
    temaConfig: {
      id: "jarbas-emerald",
      primaryColor: "#059669",
      accentColor: "#10b981",
      mode: "dark"
    }
  },
  {
    id: "financas-pessoal",
    nome: "Finanças & Gastos Pessoais",
    razaoSocial: "Controle Financeiro Pessoal & Físico Compartilhado",
    cnpj: "00.000.000/0001-00",
    inscricaoEstadual: "ISENTO",
    cidade: "Fortaleza - CE",
    endereco: "Controle Físico Pessoal",
    numero: "S/N",
    bairro: "Pessoal",
    estado: "CE",
    cep: "60000-000",
    telefone: "(85) 99999-0000",
    email: "financeiro.pessoal@lifesurf.com.br",
    mensagemRodape: "CONTROLE DE GASTOS & ENTRADAS PESSOAIS • COLABORATIVO",
    segmento: "Gestão de Gastos, Entradas & Dinheiro Físico",
    ativo: true,
    unidades: ["pessoal", "compartilhado"],
    margemPadrao: 0,
    alertaEstoqueMinimoPadrao: 1,
    exigirJustificativaPerda: false,
    temaConfig: {
      id: "pessoal-indigo",
      primaryColor: "#6366f1",
      accentColor: "#818cf8",
      mode: "dark"
    }
  }
];

/**
 * Retorna a chave do cache local de dados da empresa
 */
function getCompanyStorageKey(tenantId) {
  return `lifesurf_company_settings_${tenantId || "default"}`;
}

/**
 * Busca as empresas às quais o usuário tem acesso ou cadastradas no sistema
 */
export async function fetchUserTenants(userProfile) {
  // 1. Carrega empresas salvas no localStorage (customizadas)
  let customCompanies = [];
  try {
    const raw = localStorage.getItem("lifesurf_custom_tenants");
    if (raw) {
      customCompanies = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Erro ao ler lifesurf_custom_tenants:", e);
  }

  // 2. Base inicial: empresas padrão (LifeSurf, Arena Sandplay, Jarbas Aluguéis, Finanças Pessoais)
  const baseCompaniesMap = new Map();
  DEFAULT_COMPANIES.forEach((c) => baseCompaniesMap.set(c.id, c));
  customCompanies.forEach((c) => baseCompaniesMap.set(c.id, c));

  // 3. Tenta buscar no Firestore caso conectado
  try {
    const empresasRef = collection(db, COLLECTIONS.TENANTS);
    const q = query(empresasRef, where("ativo", "==", true));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.ativo !== false) {
          baseCompaniesMap.set(d.id, { id: d.id, ...data });
        }
      });
    }
  } catch (err) {
    console.warn("[tenantService] Consulta Firestore falhou ou offline, usando base local:", err);
  }

  return Array.from(baseCompaniesMap.values());
}

/**
 * Cria ou cadastra uma nova empresa no sistema
 */
export async function createCompany(companyData, userProfile = null) {
  const slug = (companyData.nome || "nova-empresa")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const newId = companyData.id || `${slug}-${Date.now().toString(36)}`;

  const newCompany = {
    ...DEFAULT_COMPANY,
    ...companyData,
    id: newId,
    ativo: true,
    unidades: companyData.unidades || ["matriz"],
    criadoEm: new Date().toISOString()
  };

  // 1. Salva no localStorage
  try {
    let custom = [];
    const raw = localStorage.getItem("lifesurf_custom_tenants");
    if (raw) custom = JSON.parse(raw);
    custom = custom.filter((c) => c.id !== newId);
    custom.push(newCompany);
    localStorage.setItem("lifesurf_custom_tenants", JSON.stringify(custom));
  } catch (err) {
    console.warn("Erro ao salvar empresa no localStorage:", err);
  }

  // 2. Salva no Firestore
  try {
    const docRef = doc(db, COLLECTIONS.TENANTS, newId);
    await setDoc(docRef, { ...newCompany, criadoEm: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn("Erro ao persistir empresa no Firestore:", err);
  }

  return newCompany;
}

/**
 * Exclui ou desativa uma empresa customizada
 */
export async function deleteCompany(companyId) {
  const protectedIds = ["lifesurf-principal", "lifesurf", "arena-sandplay", "jarbas-alugueis", "financas-pessoal"];
  if (protectedIds.includes(companyId)) {
    throw new Error("Esta empresa padrão do sistema não pode ser removida.");
  }

  // Remove do localStorage
  try {
    const raw = localStorage.getItem("lifesurf_custom_tenants");
    if (raw) {
      let custom = JSON.parse(raw);
      custom = custom.filter((c) => c.id !== companyId);
      localStorage.setItem("lifesurf_custom_tenants", JSON.stringify(custom));
    }
  } catch (err) {
    console.warn("Erro ao remover empresa do localStorage:", err);
  }

  // Desativa no Firestore
  try {
    const docRef = doc(db, COLLECTIONS.TENANTS, companyId);
    await setDoc(docRef, { ativo: false, removidoEm: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn("Erro ao desativar empresa no Firestore:", err);
  }

  return true;
}

/**
 * Busca dados detalhados da empresa ativa (Nome, CNPJ, Endereço, Telefone, Rodapé, etc.)
 * Com fallback em cache do LocalStorage para operação offline instantânea
 */
export async function fetchCompanyDetails(tenantId) {
  if (!tenantId) return DEFAULT_COMPANY;

  // 1. Tenta carregar do cache local primeiro para resposta instantânea
  let cachedData = null;
  try {
    const raw = localStorage.getItem(getCompanyStorageKey(tenantId));
    if (raw) {
      cachedData = JSON.parse(raw);
    }
  } catch {}

  // 2. Busca na lista padrão
  const defaultMatch = DEFAULT_COMPANIES.find((c) => c.id === tenantId);

  // 3. Busca nas empresas customizadas salvas localmente
  let customMatch = null;
  try {
    const rawCustom = localStorage.getItem("lifesurf_custom_tenants");
    if (rawCustom) {
      const customList = JSON.parse(rawCustom);
      customMatch = customList.find((c) => c.id === tenantId);
    }
  } catch {}

  try {
    const docRef = doc(db, COLLECTIONS.TENANTS, tenantId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const firestoreData = { id: docSnap.id, ...(defaultMatch || DEFAULT_COMPANY), ...docSnap.data() };
      try {
        localStorage.setItem(getCompanyStorageKey(tenantId), JSON.stringify(firestoreData));
      } catch {}
      return firestoreData;
    }
  } catch (err) {
    console.warn(`[tenantService] Falha ao ler empresa no Firestore (${tenantId}), usando fallback:`, err);
  }

  return cachedData || customMatch || defaultMatch || { ...DEFAULT_COMPANY, id: tenantId, nome: tenantId.toUpperCase().replace(/-/g, " ") };
}

/**
 * Salva ou atualiza os dados da empresa no Firestore e no cache local
 * Acessível somente por gerentes / administradores
 */
export async function updateCompanyDetails(tenantId, companyData, userProfile = null) {
  if (!tenantId) throw new Error("ID da empresa é obrigatório");

  const payload = {
    ...companyData,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: userProfile ? {
      uid: userProfile.uid || userProfile.id || "admin",
      nome: userProfile.nome || userProfile.email || "Administrador",
      email: userProfile.email || "",
      role: userProfile.role || "admin"
    } : null
  };

  // 1. Salva no Firestore
  const docRef = doc(db, COLLECTIONS.TENANTS, tenantId);
  await setDoc(docRef, payload, { merge: true });

  // 2. Atualiza no cache local
  const completeData = { id: tenantId, ...DEFAULT_COMPANY, ...companyData };
  try {
    localStorage.setItem(getCompanyStorageKey(tenantId), JSON.stringify(completeData));
  } catch (err) {
    console.warn("[tenantService] Não foi possível persistir no localStorage:", err);
  }

  return completeData;
}

/**
 * Salva a preferência de tema da empresa no Firestore e no localStorage
 */
export async function updateCompanyTheme(tenantId, themeConfig) {
  if (!themeConfig) return;

  // Atualiza LocalStorage
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(themeConfig));
  } catch (err) {
    console.warn("[tenantService] Erro ao salvar tema no localStorage:", err);
  }

  // Atualiza no Firestore se houver empresa ativa
  if (tenantId) {
    try {
      const docRef = doc(db, COLLECTIONS.TENANTS, tenantId);
      await setDoc(docRef, { temaConfig: themeConfig, atualizadoEm: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn(`[tenantService] Não foi possível salvar tema no Firestore (${tenantId}):`, err);
    }
  }
}

/**
 * Configuração Padrão do Painel Geral (Workspace)
 */
export const DEFAULT_PAINEL_CONFIG = {
  exibirAlertasCriticos: true,
  exibirAcoesCabecalho: true,
  colunasGrid: "3", // "2" (Amplo) | "3" (Padrão) | "4" (Compacto)
  densidadeCards: "padrao", // "compacto" | "padrao" | "detalhado"
  ordemModulos: [
    "pdv",
    "caixa-loja",
    "estoque-loja",
    "estoque-fabrica",
    "estoque",
    "pedidos",
    "calendario",
    "etiquetas",
    "relatorios",
    "catalogo",
    "clientes",
    "a-ver",
    "financeiro",
    "configuracoes"
  ],
  modulosDesativados: []
};

/**
 * Catálogo canônico de todos os módulos gerenciáveis do Painel Geral
 */
export const LISTA_MODULOS_DISPONIVEIS = [
  { id: "pdv", titulo: "Frente de Caixa (PDV)", descricao: "Vendas rápidas no balcão, leitor de código de barras e cupom 80mm.", rota: "/pdv" },
  { id: "caixa-loja", titulo: "Caixa Loja", descricao: "Centralização de vendas PDV, operador, cancelamentos e relatórios.", rota: "/caixa-loja" },
  { id: "estoque-loja", titulo: "Estoque Loja (Balcão)", descricao: "Produtos prontos para venda direta e grade de tamanhos.", rota: "/estoque-loja" },
  { id: "estoque-fabrica", titulo: "Estoque Fábrica (Produção)", descricao: "Matéria-prima, rolos, lotes em confecção e transferência à loja.", rota: "/estoque-fabrica" },
  { id: "estoque", titulo: "Produtos & Catálogo", descricao: "Cadastro de produtos, preços de atacado/varejo e referências.", rota: "/estoque" },
  { id: "pedidos", titulo: "Pedidos & Encomendas", descricao: "Controle de pedidos de clientes, WhatsApp e produção sob demanda.", rota: "/pedidos" },
  { id: "calendario", titulo: "Calendário Operacional", descricao: "Centralização visual de entregas, retiradas no balcão e prazos.", rota: "/calendario" },
  { id: "etiquetas", titulo: "Editor de Etiquetas", descricao: "Templates visuais com código de barras Code128 e impressão térmica.", rota: "/etiquetas" },
  { id: "relatorios", titulo: "Relatórios & DRE Gerencial", descricao: "Consolidação de faturamento, canais de pagamento e DRE.", rota: "/relatorios" },
  { id: "catalogo", titulo: "Catálogo & Vitrine Digital", descricao: "Link público para clientes finais comprarem com checkout sem senha.", rota: "/catalogo" },
  { id: "clientes", titulo: "Clientes & Atacado (CRM)", descricao: "Carteira de lojistas e revendedores, limites de crediário.", rota: "/clientes" },
  { id: "a-ver", titulo: "Contas A Ver & Financeiro", descricao: "Controle de vendas a prazo (fiado), contas e recibos de quitação.", rota: "/a-ver" },
  { id: "financeiro", titulo: "Gastos & Comprovantes", descricao: "Controle financeiro com foto de comprovantes enviada ao Google Drive.", rota: "/financeiro" },
  { id: "configuracoes", titulo: "Configurações da Empresa", descricao: "Dados fiscais, personalização de tema, cupom e regras do ERP.", rota: "/configuracoes" }
];

/**
 * Obtém as configurações do painel geral (com fallback local e compatibilidade multi-tenant)
 */
export function getCompanyPainelConfig(tenantId) {
  try {
    const key = `lifesurf_painel_config_${tenantId || "default"}`;
    let local = localStorage.getItem(key);

    // Fallbacks para compatibilidade cruzada entre lifesurf e lifesurf-principal
    if (!local && (tenantId === "lifesurf-principal" || tenantId === "lifesurf")) {
      local = localStorage.getItem("lifesurf_painel_config_lifesurf-principal") ||
              localStorage.getItem("lifesurf_painel_config_lifesurf");
    }

    if (!local) {
      local = localStorage.getItem("lifesurf_painel_config_current");
    }

    if (local) {
      const parsed = JSON.parse(local);
      return { ...DEFAULT_PAINEL_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn("[tenantService] Erro ao ler painelConfig:", err);
  }
  return DEFAULT_PAINEL_CONFIG;
}

/**
 * Salva as configurações de formação e módulos do Painel Geral no Firestore e localStorage
 */
export async function updateCompanyPainelConfig(tenantId, painelConfig) {
  if (!painelConfig) return;
  const merged = { ...DEFAULT_PAINEL_CONFIG, ...painelConfig };
  const key = `lifesurf_painel_config_${tenantId || "default"}`;

  try {
    localStorage.setItem(key, JSON.stringify(merged));
    localStorage.setItem("lifesurf_painel_config_current", JSON.stringify(merged));
    if (tenantId === "lifesurf-principal" || tenantId === "lifesurf" || !tenantId) {
      localStorage.setItem("lifesurf_painel_config_lifesurf-principal", JSON.stringify(merged));
      localStorage.setItem("lifesurf_painel_config_lifesurf", JSON.stringify(merged));
    }
  } catch (err) {
    console.warn("[tenantService] Erro ao salvar painel no localStorage:", err);
  }

  // Atualiza cache de configurações da empresa para sincronização com TenantContext
  if (tenantId) {
    try {
      const compKey = getCompanyStorageKey(tenantId);
      const rawComp = localStorage.getItem(compKey);
      if (rawComp) {
        const compParsed = JSON.parse(rawComp);
        compParsed.painelConfig = merged;
        localStorage.setItem(compKey, JSON.stringify(compParsed));
      }
    } catch {}
  }

  // Notifica o Workspace e a aplicação inteira em tempo real via CustomEvent
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lifesurf:painel_config_changed", { detail: merged }));
  }

  // Persiste no Firestore da empresa
  if (tenantId) {
    try {
      const docRef = doc(db, COLLECTIONS.TENANTS, tenantId);
      await setDoc(docRef, { painelConfig: merged, atualizadoEm: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn(`[tenantService] Não foi possível salvar painel no Firestore (${tenantId}):`, err);
    }
  }
  return merged;
}


