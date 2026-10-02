import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "../config/firebase";
import { updateStockAggregateCount } from "./metricsService";

/**
 * SERVIÇO DE ESTOQUE DUAL (LOJA vs FÁBRICA) PARA CONFECÇÃO & MODA
 */

export const TAMANHOS_LETRAS = ["PP", "P", "M", "G", "GG", "EXG", "G1", "G2", "G3", "G4"];
export const TAMANHOS_NUMEROS = ["36", "38", "40", "42", "44", "46", "48", "50", "52", "54"];

export const CATEGORIAS_MODA = [
  "Camisa",
  "Camiseta",
  "Camisa Gola Polo",
  "Camisa de Botão",
  "Bermuda",
  "Short",
  "Calça",
  "Casaco",
  "Acessórios",
  "Outros"
];

export const STATUS_FABRICA = {
  MATERIA_PRIMA: "materia_prima",
  CORTE: "corte",
  COSTURA: "costura",
  ESTAMPA: "estampa",
  PRONTO: "pronto"
};

/**
 * Calcula o total de peças a partir de um objeto de grade { P: 10, M: 20 }
 */
export function calculateGradeTotal(gradeObj = {}) {
  if (!gradeObj || typeof gradeObj !== "object") return 0;
  return Object.values(gradeObj).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
}

/**
 * Converte string serializada "P: 10 | M: 20" para objeto { P: 10, M: 20 }
 */
export function parseGradeString(gradeStr) {
  if (!gradeStr || typeof gradeStr !== "string") return {};
  const result = {};
  gradeStr.split(" | ").forEach((part) => {
    const [tam, qtd] = part.split(":");
    if (tam && qtd) {
      result[tam.trim()] = parseInt(qtd.trim(), 10) || 0;
    }
  });
  return result;
}

/**
 * Converte objeto { P: 10, M: 20 } para formato amigável "P: 10 | M: 20"
 */
export function formatGradeString(gradeObj = {}) {
  const parts = [];
  Object.entries(gradeObj).forEach(([tam, qtd]) => {
    if (Number(qtd) > 0) {
      parts.push(`${tam}: ${qtd}`);
    }
  });
  return parts.length > 0 ? parts.join(" | ") : "Sem grade";
}

/**
 * Busca produtos do estoque (Loja ou Fábrica) com paginação ou limite
 * @param {string} tenantId - ID da empresa
 * @param {'loja'|'fabrica'} tipoEstoque - Tipo do estoque
 * @param {number} maxResults - Limite para controle de leituras no plano Blaze
 */
export async function fetchStockProducts(tenantId, tipoEstoque = "loja", maxResults = 100) {
  if (!tenantId) return [];

  const collectionName = tipoEstoque === "fabrica" ? "estoque_fabrica" : "produtos";
  const stockRef = collection(db, "empresas", tenantId, collectionName);
  const q = query(stockRef, limit(maxResults));

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (err) {
    console.error(`[stockService] Erro ao carregar estoque (${tipoEstoque}):`, err);
    return [];
  }
}

/**
 * Salva ou atualiza um item no estoque da Loja ou Fábrica
 */
export async function saveProduct(tenantId, tipoEstoque, productData, productId = null) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  const collectionName = tipoEstoque === "fabrica" ? "estoque_fabrica" : "produtos";
  const stockCol = collection(db, "empresas", tenantId, collectionName);

  const gradeTotal = calculateGradeTotal(productData.gradeTamanhos);
  const payload = {
    ...productData,
    tipoEstoque,
    estoqueTotal: gradeTotal || Number(productData.estoqueTotal) || 0,
    empresaId: tenantId,
    atualizadoEm: serverTimestamp()
  };

  if (productId) {
    const docRef = doc(stockCol, productId);
    await updateDoc(docRef, payload);
    return productId;
  } else {
    payload.criadoEm = serverTimestamp();
    const docRef = await addDoc(stockCol, payload);
    // Atualiza contador de agregados desnormalizados
    await updateStockAggregateCount(tenantId, tipoEstoque, payload.estoqueTotal);
    return docRef.id;
  }
}

/**
 * Exclui um produto do estoque
 */
export async function deleteProduct(tenantId, tipoEstoque, productId) {
  if (!tenantId || !productId) return;
  const collectionName = tipoEstoque === "fabrica" ? "estoque_fabrica" : "produtos";
  const docRef = doc(db, "empresas", tenantId, collectionName, productId);
  await deleteDoc(docRef);
}

/**
 * TRANSFERÊNCIA ATÔMICA DA FÁBRICA PARA A LOJA
 * Transfere lotes acabados da confecção direto para as prateleiras do PDV
 */
export async function transferFactoryToStore(tenantId, transfers = []) {
  if (!tenantId || transfers.length === 0) return;

  const batch = writeBatch(db);
  let totalPecasTransferidas = 0;

  for (const item of transfers) {
    const { factoryProductId, qtdTransferir, gradeTransferir, produtoInfo } = item;

    // 1. Decrementa do Estoque da Fábrica
    const factoryDocRef = doc(db, "empresas", tenantId, "estoque_fabrica", factoryProductId);
    batch.update(factoryDocRef, {
      estoqueTotal: increment(-qtdTransferir),
      atualizadoEm: serverTimestamp()
    });

    // 2. Incrementa ou adiciona no Estoque da Loja
    // Se o produto já existe na loja (por código de barras ou referência)
    if (item.storeProductId) {
      const storeDocRef = doc(db, "empresas", tenantId, "produtos", item.storeProductId);
      batch.update(storeDocRef, {
        estoqueTotal: increment(qtdTransferir),
        atualizadoEm: serverTimestamp()
      });
    } else {
      // Cria novo produto na loja pronto para venda
      const newStoreDocRef = doc(collection(db, "empresas", tenantId, "produtos"));
      batch.set(newStoreDocRef, {
        ...produtoInfo,
        tipoEstoque: "loja",
        estoqueTotal: qtdTransferir,
        gradeTamanhos: gradeTransferir || {},
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    totalPecasTransferidas += qtdTransferir;
  }

  // Comita as duas pontas em uma única transação atômica (sem inconsistência de estoque)
  await batch.commit();

  // Atualiza métricas agregadas desnormalizadas
  await updateStockAggregateCount(tenantId, "fabrica", -totalPecasTransferidas);
  await updateStockAggregateCount(tenantId, "loja", totalPecasTransferidas);
}
