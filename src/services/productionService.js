import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "../config/firebase";
import { calculateGradeTotal } from "./stockService";

/**
 * SERVIÇO DE FÁBRICA & GESTÃO DA PRODUÇÃO TÊXTIL (FASE 7)
 * Cobre: Ordens de Produção (OP), Estoque de Matéria-Prima, Gestão de Perdas e Transferência Atômica.
 */

export const STATUS_OP = {
  PLANEJAMENTO: "planejamento",
  CORTE: "corte",
  COSTURA: "costura",
  ESTAMPA: "estampa",
  ACABAMENTO: "acabamento",
  CONCLUIDO: "concluido",
  CANCELADO: "cancelado"
};

export const STATUS_OP_CONFIG = {
  [STATUS_OP.PLANEJAMENTO]: { label: "1. Planejamento", color: "sky", badge: "info" },
  [STATUS_OP.CORTE]: { label: "2. Em Corte", color: "amber", badge: "warning" },
  [STATUS_OP.COSTURA]: { label: "3. Costura & Montagem", color: "purple", badge: "info" },
  [STATUS_OP.ESTAMPA]: { label: "4. Estamparia / Silk", color: "pink", badge: "warning" },
  [STATUS_OP.ACABAMENTO]: { label: "5. Revisão & Acabamento", color: "emerald", badge: "success" },
  [STATUS_OP.CONCLUIDO]: { label: "6. Concluído (Pronto Loja)", color: "slate", badge: "neutral" },
  [STATUS_OP.CANCELADO]: { label: "Cancelado", color: "rose", badge: "danger" }
};

export const TIPOS_MATERIA_PRIMA = [
  "Tecido / Malha (Metros)",
  "Tecido / Malha (Kg)",
  "Aviamento / Botão / Ilhós",
  "Zíper",
  "Linha de Costura",
  "Etiqueta de Marca / Composição",
  "Elástico / Cós",
  "Embalagem / Saquinho"
];

// Dados de demonstração para matéria-prima
export const DEMO_RAW_MATERIALS = [
  {
    id: "mat-1",
    nome: "Malha 100% Algodão 30.1 Penteado Preto",
    tipo: "Tecido / Malha (Kg)",
    unidade: "kg",
    estoqueAtual: 145.5,
    estoqueMinimo: 30,
    custoUnitario: 42.00,
    fornecedor: "Têxtil Ceará",
    localizacao: "Prateleira A1"
  },
  {
    id: "mat-2",
    nome: "Tecido Tactel 4-Way Stretch Turquesa",
    tipo: "Tecido / Malha (Metros)",
    unidade: "metros",
    estoqueAtual: 320.0,
    estoqueMinimo: 50,
    custoUnitario: 18.50,
    fornecedor: "Malhas do Sul",
    localizacao: "Rolo 14B"
  },
  {
    id: "mat-3",
    nome: "Malha Piquet Premium Off-White",
    tipo: "Tecido / Malha (Kg)",
    unidade: "kg",
    estoqueAtual: 85.0,
    estoqueMinimo: 20,
    custoUnitario: 48.00,
    fornecedor: "Têxtil Brasil",
    localizacao: "Prateleira B3"
  },
  {
    id: "mat-4",
    nome: "Linha de Costura 120 Poliéster Preta",
    tipo: "Linha de Costura",
    unidade: "cones",
    estoqueAtual: 38,
    estoqueMinimo: 10,
    custoUnitario: 12.00,
    fornecedor: "Aviamentos Fortaleza",
    localizacao: "Armário 2"
  },
  {
    id: "mat-5",
    nome: "Zíper Tratorado para Boardshort 15cm",
    tipo: "Zíper",
    unidade: "unidades",
    estoqueAtual: 240,
    estoqueMinimo: 50,
    custoUnitario: 3.20,
    fornecedor: "Aviamentos Fortaleza",
    localizacao: "Caixa 08"
  }
];

// Demonstração de OPs
export const DEMO_PRODUCTION_ORDERS = [
  {
    id: "op-1",
    codigoOP: "OP-2026-084",
    modelo: "Camiseta Silk Waves Classic",
    referencia: "CAM-001",
    categoria: "Camiseta",
    status: STATUS_OP.COSTURA,
    previsaoTermino: "2026-10-15",
    gradePlanejada: { P: 30, M: 60, G: 60, GG: 30 },
    totalPecasPlanejadas: 180,
    tecidoUtilizado: "Malha 100% Algodão 30.1 Penteado Preto (45kg)",
    responsavel: "Mestre Raimundo",
    custoEstimadoPeca: 22.50,
    observacoes: "Estampa frontal silk screen em 2 cores (Branco e Turquesa)."
  },
  {
    id: "op-2",
    codigoOP: "OP-2026-085",
    modelo: "Bermuda Água Boardshort Rip",
    referencia: "BER-002",
    categoria: "Bermuda",
    status: STATUS_OP.CORTE,
    previsaoTermino: "2026-10-18",
    gradePlanejada: { "38": 20, "40": 40, "42": 40, "44": 20 },
    totalPecasPlanejadas: 120,
    tecidoUtilizado: "Tecido Tactel 4-Way Stretch Turquesa (110m)",
    responsavel: "Cortador Gilson",
    custoEstimadoPeca: 38.00,
    observacoes: "Atenção ao sentido do elastano no corte da perna."
  },
  {
    id: "op-3",
    codigoOP: "OP-2026-086",
    modelo: "Short Praia Tactel Floral Retrô",
    referencia: "SHO-004",
    categoria: "Short",
    status: STATUS_OP.ACABAMENTO,
    previsaoTermino: "2026-10-08",
    gradePlanejada: { P: 25, M: 50, G: 50, GG: 25 },
    totalPecasPlanejadas: 150,
    tecidoUtilizado: "Tactel Estampado Floral (130m)",
    responsavel: "Equipe Revisão",
    custoEstimadoPeca: 19.80,
    observacoes: "Colocar ilhoses inoxidáveis no cós com cordão cru."
  }
];

/* -------------------------------------------------------------
 * 1. ORDENS DE PRODUÇÃO (OP)
 * ------------------------------------------------------------- */

export async function fetchProductionOrders(tenantId) {
  if (!tenantId) return DEMO_PRODUCTION_ORDERS;

  try {
    const colRef = collection(db, "empresas", tenantId, "ordens_producao");
    const q = query(colRef, limit(50));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    }
  } catch (err) {
    console.warn("[productionService] Erro ao buscar OPs reais, usando base demonstrativa:", err);
  }

  return DEMO_PRODUCTION_ORDERS;
}

export async function createProductionOrder(tenantId, opData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  const agora = new Date();
  const codigo = `OP-${agora.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const totalPecas = calculateGradeTotal(opData.gradePlanejada);

  const payload = {
    codigoOP: codigo,
    modelo: opData.modelo,
    referencia: opData.referencia || "",
    categoria: opData.categoria || "Camiseta",
    status: opData.status || STATUS_OP.PLANEJAMENTO,
    previsaoTermino: opData.previsaoTermino || "",
    gradePlanejada: opData.gradePlanejada || {},
    totalPecasPlanejadas: totalPecas,
    tecidoUtilizado: opData.tecidoUtilizado || "",
    responsavel: opData.responsavel || "Fábrica LifeSurf",
    custoEstimadoPeca: Number(opData.custoEstimadoPeca) || 0,
    observacoes: opData.observacoes || "",
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  const colRef = collection(db, "empresas", tenantId, "ordens_producao");
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
}

export async function updateProductionOrderStatus(tenantId, opId, novoStatus) {
  if (!tenantId || !opId) return;
  const docRef = doc(db, "empresas", tenantId, "ordens_producao", opId);
  await updateDoc(docRef, {
    status: novoStatus,
    atualizadoEm: serverTimestamp()
  });
}

/* -------------------------------------------------------------
 * 2. ESTOQUE DE MATÉRIA-PRIMA
 * ------------------------------------------------------------- */

export async function fetchRawMaterials(tenantId) {
  if (!tenantId) return DEMO_RAW_MATERIALS;

  try {
    const colRef = collection(db, "empresas", tenantId, "materia_prima");
    const q = query(colRef, limit(60));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    }
  } catch (err) {
    console.warn("[productionService] Erro ao buscar matéria-prima real:", err);
  }

  return DEMO_RAW_MATERIALS;
}

export async function saveRawMaterial(tenantId, materialData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  const colRef = collection(db, "empresas", tenantId, "materia_prima");
  const payload = {
    nome: materialData.nome,
    tipo: materialData.tipo || "Tecido / Malha (Metros)",
    unidade: materialData.unidade || "metros",
    estoqueAtual: Number(materialData.estoqueAtual) || 0,
    estoqueMinimo: Number(materialData.estoqueMinimo) || 10,
    custoUnitario: Number(materialData.custoUnitario) || 0,
    fornecedor: materialData.fornecedor || "",
    localizacao: materialData.localizacao || "",
    atualizadoEm: serverTimestamp()
  };

  if (materialData.id && !materialData.id.startsWith("mat-")) {
    const docRef = doc(colRef, materialData.id);
    await updateDoc(docRef, payload);
    return { id: materialData.id, ...payload };
  } else {
    const docRef = await addDoc(colRef, {
      ...payload,
      criadoEm: serverTimestamp()
    });
    return { id: docRef.id, ...payload };
  }
}

/* -------------------------------------------------------------
 * 3. GESTÃO DE PERDAS & REFUGO TÊXTIL
 * ------------------------------------------------------------- */

export async function fetchProductionWaste(tenantId) {
  if (!tenantId) return [];

  try {
    const colRef = collection(db, "empresas", tenantId, "perdas_producao");
    const q = query(colRef, limit(50));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (err) {
    console.warn("[productionService] Erro ao buscar perdas:", err);
    return [];
  }
}

export async function recordProductionWaste(tenantId, wasteData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  const payload = {
    opCodigo: wasteData.opCodigo || "Geral",
    motivo: wasteData.motivo || "falha_corte", // falha_corte, defeito_tecido, erro_costura, falha_estampa, sobra_rolo
    materialNome: wasteData.materialNome || "Tecido Geral",
    quantidade: Number(wasteData.quantidade) || 0,
    unidade: wasteData.unidade || "kg",
    custoEstimadoPerda: Number(wasteData.custoEstimadoPerda) || 0,
    observacao: wasteData.observacao || "",
    registradoPor: wasteData.registradoPor || "Operador",
    data: new Date().toLocaleDateString("pt-BR"),
    criadoEm: serverTimestamp()
  };

  const colRef = collection(db, "empresas", tenantId, "perdas_producao");
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
}

/* -------------------------------------------------------------
 * 4. TRANSFERÊNCIA ATÔMICA DA FÁBRICA PARA A LOJA
 * ------------------------------------------------------------- */

export async function transferFinishedGoodsToStore(tenantId, transferData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  const batch = writeBatch(db);
  const totalPecas = calculateGradeTotal(transferData.gradeTransferir);

  // 1. Atualiza ou cria o produto na Loja (Balcão)
  const storeProdRef = doc(
    db,
    "empresas",
    tenantId,
    "produtos",
    transferData.produtoId || `prod-${Date.now()}`
  );

  const snapStore = await getDoc(storeProdRef);

  if (snapStore.exists()) {
    const dadosAtuais = snapStore.data();
    const gradeAtual = dadosAtuais.gradeTamanhos || {};
    const novaGrade = { ...gradeAtual };

    Object.entries(transferData.gradeTransferir).forEach(([tam, qtd]) => {
      novaGrade[tam] = (Number(novaGrade[tam]) || 0) + Number(qtd);
    });

    batch.update(storeProdRef, {
      gradeTamanhos: novaGrade,
      estoqueLoja: (Number(dadosAtuais.estoqueLoja) || 0) + totalPecas,
      atualizadoEm: serverTimestamp()
    });
  } else {
    batch.set(storeProdRef, {
      nome: transferData.nome,
      referencia: transferData.referencia || "",
      categoria: transferData.categoria || "Camiseta",
      precoVarejo: Number(transferData.precoVarejo) || 89.90,
      precoAtacado: Number(transferData.precoAtacado) || 59.90,
      cores: transferData.cores || ["Padrão"],
      gradeTamanhos: transferData.gradeTransferir,
      estoqueLoja: totalPecas,
      ativo: true,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  }

  // 2. Registra o histórico da transferência
  const historicoRef = doc(collection(db, "empresas", tenantId, "transferencias_estoque"));
  batch.set(historicoRef, {
    produtoNome: transferData.nome,
    referencia: transferData.referencia || "",
    totalPecas,
    gradeTransferida: transferData.gradeTransferir,
    origem: "Estoque Fábrica (Produção Concluída)",
    destino: "Estoque Loja (Balcão / Pronta-Entrega)",
    dataTransferencia: new Date().toLocaleDateString("pt-BR"),
    horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    criadoEm: serverTimestamp()
  });

  await batch.commit();
  return { sucesso: true, totalPecas };
}

/**
 * Exclui uma Ordem de Produção
 */
export async function deleteProductionOrder(tenantId, opId) {
  if (!tenantId || !opId) return false;
  try {
    const docRef = doc(db, "empresas", tenantId, "ordens_producao", opId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("[productionService] Erro ao excluir OP:", err);
    return true;
  }
}

/**
 * Exclui uma Matéria-Prima
 */
export async function deleteRawMaterial(tenantId, materialId) {
  if (!tenantId || !materialId) return false;
  try {
    const docRef = doc(db, "empresas", tenantId, "materia_prima", materialId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("[productionService] Erro ao excluir matéria-prima:", err);
    return true;
  }
}

/**
 * Exclui um Registro de Perda
 */
export async function deleteProductionWaste(tenantId, wasteId) {
  if (!tenantId || !wasteId) return false;
  try {
    const docRef = doc(db, "empresas", tenantId, "perdas_producao", wasteId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("[productionService] Erro ao excluir perda:", err);
    return true;
  }
}
