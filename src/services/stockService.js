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
import {
  isPdvOnline,
  cacheProductCatalog,
  getCachedProductCatalog
} from "./pdvOfflineService";

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

  // Se for estoque da loja e estiver operando offline, retorna imediatamente do cache local
  if (tipoEstoque === "loja" && !isPdvOnline()) {
    return getCachedProductCatalog(tenantId);
  }

  const collectionName = tipoEstoque === "fabrica" ? "estoque_fabrica" : "produtos";
  const stockRef = collection(db, "empresas", tenantId, collectionName);
  const q = query(stockRef, limit(maxResults));

  try {
    const snapshot = await getDocs(q);
    const produtos = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // Se for estoque da loja, atualiza o cache local para uso em contingência
    if (tipoEstoque === "loja") {
      if (produtos.length > 0) {
        cacheProductCatalog(tenantId, produtos);
      } else {
        // Se a empresa ainda não tiver cadastrado produtos na nuvem, providencia o catálogo inicial
        return getCachedProductCatalog(tenantId);
      }
    }

    return produtos;
  } catch (err) {
    console.error(`[stockService] Erro ao carregar estoque (${tipoEstoque}):`, err);
    if (tipoEstoque === "loja") {
      return getCachedProductCatalog(tenantId);
    }
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
export async function transferFactoryToStore(tenantId, transfers = [], userAuth = null) {
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
    let storeId = item.storeProductId;
    if (storeId) {
      const storeDocRef = doc(db, "empresas", tenantId, "produtos", storeId);
      batch.update(storeDocRef, {
        estoqueTotal: increment(qtdTransferir),
        atualizadoEm: serverTimestamp()
      });
    } else {
      const newStoreDocRef = doc(collection(db, "empresas", tenantId, "produtos"));
      storeId = newStoreDocRef.id;
      batch.set(newStoreDocRef, {
        ...produtoInfo,
        tipoEstoque: "loja",
        estoqueTotal: qtdTransferir,
        gradeTamanhos: gradeTransferir || {},
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    // 3. Registra movimentação no Kardex
    const movRef = doc(collection(db, "empresas", tenantId, "movimentacoes_estoque"));
    batch.set(movRef, {
      tipo: TIPOS_MOVIMENTACAO.TRANSFERENCIA_FABRICA_LOJA,
      produtoId: storeId,
      produtoNome: produtoInfo?.nome || "Produto da Confecção",
      referencia: produtoInfo?.referencia || "",
      quantidade: Number(qtdTransferir),
      gradeMovimentada: gradeTransferir || {},
      origem: "Estoque Fábrica (Produção Concluída)",
      destino: "Estoque Loja (Balcão de Venda)",
      motivo: "Transferência de lote finalizado da fábrica para o balcão",
      justificativa: "Abastecimento das prateleiras da loja",
      responsavel: userAuth ? {
        uid: userAuth.uid || userAuth.id || "operador",
        nome: userAuth.nome || userAuth.email || "Operador",
        email: userAuth.email || "",
        role: userAuth.role || "gerente"
      } : { nome: "Sistema", role: "admin" },
      criadoEm: serverTimestamp(),
      dataHora: new Date().toLocaleString("pt-BR")
    });

    totalPecasTransferidas += qtdTransferir;
  }

  // Comita as duas pontas em uma única transação atômica (sem inconsistência de estoque)
  await batch.commit();

  // Atualiza métricas agregadas desnormalizadas
  await updateStockAggregateCount(tenantId, "fabrica", -totalPecasTransferidas);
  await updateStockAggregateCount(tenantId, "loja", totalPecasTransferidas);
}

/* =========================================================================
 * MÓDULO DE GESTÃO DE ESTOQUE ERP (KARDEX, NF-E & CONTROLE DE PERDAS)
 * ========================================================================= */

export const TIPOS_MOVIMENTACAO = {
  ENTRADA_NFE: "ENTRADA_NFE",
  ENTRADA_AVULSA: "ENTRADA_AVULSA",
  SAIDA_VENDA: "SAIDA_VENDA",
  TRANSFERENCIA_LOJA_FABRICA: "TRANSFERENCIA_LOJA_FABRICA",
  TRANSFERENCIA_FABRICA_LOJA: "TRANSFERENCIA_FABRICA_LOJA",
  BAIXA_AVARIA: "BAIXA_AVARIA",
  AJUSTE_INVENTARIO: "AJUSTE_INVENTARIO"
};

export const CONFIG_MOVIMENTACOES = {
  [TIPOS_MOVIMENTACAO.ENTRADA_NFE]: {
    label: "Entrada por NF-e",
    badge: "success",
    color: "text-emerald-400",
    sinal: "+"
  },
  [TIPOS_MOVIMENTACAO.ENTRADA_AVULSA]: {
    label: "Entrada Avulsa",
    badge: "info",
    color: "text-sky-400",
    sinal: "+"
  },
  [TIPOS_MOVIMENTACAO.SAIDA_VENDA]: {
    label: "Venda PDV",
    badge: "neutral",
    color: "text-slate-300",
    sinal: "-"
  },
  [TIPOS_MOVIMENTACAO.TRANSFERENCIA_FABRICA_LOJA]: {
    label: "Fábrica ➔ Loja",
    badge: "info",
    color: "text-cyan-400",
    sinal: "⇄"
  },
  [TIPOS_MOVIMENTACAO.TRANSFERENCIA_LOJA_FABRICA]: {
    label: "Loja ➔ Fábrica",
    badge: "warning",
    color: "text-amber-400",
    sinal: "⇄"
  },
  [TIPOS_MOVIMENTACAO.BAIXA_AVARIA]: {
    label: "Baixa por Avaria",
    badge: "danger",
    color: "text-rose-400",
    sinal: "-"
  },
  [TIPOS_MOVIMENTACAO.AJUSTE_INVENTARIO]: {
    label: "Ajuste de Balanço",
    badge: "warning",
    color: "text-purple-400",
    sinal: "±"
  }
};

export const MOTIVOS_AJUSTE_PERDA = [
  { value: "defeito_fabricacao", label: "Defeito de Fabricação / Costura" },
  { value: "avaria_transporte", label: "Avaria no Transporte / Logística" },
  { value: "mancha_sujeira", label: "Peça Manchada / Suja em Loja" },
  { value: "rasgo_manuseio", label: "Rasgo / Furo no Manuseio de Balcão" },
  { value: "furto_extravio", label: "Furto / Extravio Identificado" },
  { value: "mostruario_avariado", label: "Peça de Mostruário Danificada" },
  { value: "sobra_corte", label: "Refugo / Sobra de Corte" },
  { value: "divergencia_inventario", label: "Divergência em Balanço Físico" },
  { value: "outro", label: "Outro Motivo (Especificar)" }
];

// Movimentações demonstrativas de estoque para inicialização rápida do Kardex
export const DEMO_STOCK_MOVEMENTS = [
  {
    id: "mov-001",
    tipo: TIPOS_MOVIMENTACAO.ENTRADA_NFE,
    produtoId: "prod-1",
    produtoNome: "Camiseta Classic Waves",
    referencia: "CAM-001",
    quantidade: 50,
    gradeMovimentada: { P: 10, M: 20, G: 15, GG: 5 },
    saldoAnterior: 10,
    saldoNovo: 60,
    documentoRef: "NF-004820",
    origem: "Fornecedor: Têxtil Ceará Ltda",
    destino: "Estoque Loja (Balcão)",
    motivo: "Entrada por NF-e de Compra #004820",
    justificativa: "Reposição de estoque de primavera/verão",
    responsavel: {
      nome: "Lucas Gerente",
      email: "gerente@lifesurf.com.br",
      role: "gerente"
    },
    dataHora: "02/10/2026 10:15"
  },
  {
    id: "mov-002",
    tipo: TIPOS_MOVIMENTACAO.TRANSFERENCIA_FABRICA_LOJA,
    produtoId: "prod-2",
    produtoNome: "Short Boardshort Rip 4-Way",
    referencia: "SHO-002",
    quantidade: 30,
    gradeMovimentada: { "38": 10, "40": 10, "42": 10 },
    saldoAnterior: 5,
    saldoNovo: 35,
    documentoRef: "OP-2026-084",
    origem: "Estoque Fábrica (Produção)",
    destino: "Estoque Loja (Balcão)",
    motivo: "Transferência de lote finalizado da confecção",
    justificativa: "Lote de produção OP-2026-084 aprovado na revisão",
    responsavel: {
      nome: "Mestre Raimundo",
      email: "fabrica@lifesurf.com.br",
      role: "gerente"
    },
    dataHora: "02/10/2026 11:40"
  },
  {
    id: "mov-003",
    tipo: TIPOS_MOVIMENTACAO.BAIXA_AVARIA,
    produtoId: "prod-1",
    produtoNome: "Camiseta Classic Waves",
    referencia: "CAM-001",
    quantidade: -2,
    gradeMovimentada: { M: 1, G: 1 },
    saldoAnterior: 60,
    saldoNovo: 58,
    documentoRef: "AVARIA-2026-012",
    origem: "Estoque Loja (Balcão)",
    destino: "Descarte / Refugo",
    motivo: "Peça Manchada / Suja em Loja",
    justificativa: "Cliente derramou líquido no provador, mancha irreversível no tecido.",
    custoEstimado: 45.00,
    responsavel: {
      nome: "Ana Operadora",
      email: "balcao@lifesurf.com.br",
      role: "operador"
    },
    dataHora: "02/10/2026 14:05"
  },
  {
    id: "mov-004",
    tipo: TIPOS_MOVIMENTACAO.AJUSTE_INVENTARIO,
    produtoId: "prod-3",
    produtoNome: "Bermuda Água Hawaii 2.0",
    referencia: "BER-005",
    quantidade: -1,
    gradeMovimentada: { "42": 1 },
    saldoAnterior: 16,
    saldoNovo: 15,
    documentoRef: "BALANCO-SET/26",
    origem: "Estoque Loja (Balcão)",
    destino: "Ajuste de Balanço",
    motivo: "Divergência em Balanço Físico",
    justificativa: "Contagem física mensal apurou 15 unidades ao invés de 16.",
    responsavel: {
      nome: "Lucas Gerente",
      email: "gerente@lifesurf.com.br",
      role: "gerente"
    },
    dataHora: "02/10/2026 14:30"
  }
];

// Demonstração de notas fiscais de compra
export const DEMO_PURCHASE_INVOICES = [
  {
    id: "nfe-004820",
    numeroNota: "004820",
    serie: "1",
    chaveAcesso: "23261007892123000144550010000048201987654321",
    fornecedorNome: "Têxtil Ceará Confecções Ltda",
    fornecedorCnpj: "07.892.123/0001-44",
    dataEmissao: "2026-10-01",
    dataEntrada: "02/10/2026",
    destinoEstoque: "loja",
    valorTotalNota: 2450.00,
    valorFrete: 85.00,
    totalItens: 50,
    itens: [
      {
        nome: "Camiseta Classic Waves",
        referencia: "CAM-001",
        categoria: "Camiseta",
        quantidade: 50,
        gradeTamanhos: { P: 10, M: 20, G: 15, GG: 5 },
        custoUnitario: 49.00,
        precoVarejoSugerido: 99.90,
        precoAtacadoSugerido: 69.90,
        subtotal: 2450.00
      }
    ],
    responsavelNome: "Lucas Gerente"
  }
];

/**
 * Busca histórico detalhado de movimentações de estoque (Kardex ERP)
 * Suporta filtros por produto, tipo e ordenação temporal
 */
export async function fetchStockMovements(tenantId, filters = {}, maxResults = 50) {
  if (!tenantId) return DEMO_STOCK_MOVEMENTS;

  try {
    const colRef = collection(db, "empresas", tenantId, "movimentacoes_estoque");
    const q = query(colRef, limit(maxResults));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    }
  } catch (err) {
    console.warn("[stockService] Erro ao buscar movimentações reais do Firestore, usando fallback demonstrativo:", err);
  }

  return DEMO_STOCK_MOVEMENTS;
}

/**
 * Registra entrada rápida por Nota Fiscal de Compra (NF-e Simulada)
 * Atualiza estoques, custos médios e grava o log de auditoria no Kardex
 */
export async function registerPurchaseInvoice(tenantId, invoiceData, userAuth = null) {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!invoiceData.numeroNota) throw new Error("Número da NF é obrigatório");
  if (!invoiceData.itens || invoiceData.itens.length === 0) throw new Error("A nota deve conter ao menos um item");

  const batch = writeBatch(db);
  const dataHojeFormatada = new Date().toLocaleDateString("pt-BR");
  const dataHoraAtual = new Date().toLocaleString("pt-BR");
  let totalPecasEntrada = 0;

  // 1. Processa cada item da nota
  for (const item of invoiceData.itens) {
    const qtdItem = Number(item.quantidade) || calculateGradeTotal(item.gradeTamanhos) || 1;
    totalPecasEntrada += qtdItem;

    const collectionName = invoiceData.destinoEstoque === "fabrica" ? "estoque_fabrica" : "produtos";
    let targetDocRef;

    if (item.produtoId) {
      targetDocRef = doc(db, "empresas", tenantId, collectionName, item.produtoId);
      // Lê para calcular custo médio ponderado
      try {
        const snap = await getDoc(targetDocRef);
        if (snap.exists()) {
          const currentData = snap.data();
          const saldoAtual = Number(currentData.estoqueTotal) || 0;
          const custoAtual = Number(currentData.custoUnitario) || Number(item.custoUnitario) || 0;
          const novoCusto = Number(item.custoUnitario) || custoAtual;
          const custoMedioPonderado = saldoAtual + qtdItem > 0
            ? ((saldoAtual * custoAtual) + (qtdItem * novoCusto)) / (saldoAtual + qtdItem)
            : novoCusto;

          // Atualiza grade de tamanhos somando as novas peças
          const gradeAtual = currentData.gradeTamanhos || {};
          const novaGrade = { ...gradeAtual };
          if (item.gradeTamanhos) {
            Object.entries(item.gradeTamanhos).forEach(([tam, qtd]) => {
              novaGrade[tam] = (Number(novaGrade[tam]) || 0) + Number(qtd);
            });
          }

          batch.update(targetDocRef, {
            estoqueTotal: increment(qtdItem),
            gradeTamanhos: novaGrade,
            ultimoCusto: novoCusto,
            custoUnitario: Number(custoMedioPonderado.toFixed(2)),
            atualizadoEm: serverTimestamp()
          });
        } else {
          batch.update(targetDocRef, {
            estoqueTotal: increment(qtdItem),
            ultimoCusto: Number(item.custoUnitario) || 0,
            atualizadoEm: serverTimestamp()
          });
        }
      } catch {
        batch.update(targetDocRef, {
          estoqueTotal: increment(qtdItem),
          atualizadoEm: serverTimestamp()
        });
      }
    } else {
      // Cria novo produto a partir da NF-e
      targetDocRef = doc(collection(db, "empresas", tenantId, collectionName));
      batch.set(targetDocRef, {
        nome: item.nome,
        referencia: item.referencia || `REF-${Math.floor(100 + Math.random() * 900)}`,
        categoria: item.categoria || "Camiseta",
        precoVarejo: Number(item.precoVarejoSugerido) || Number(item.custoUnitario) * 2,
        precoAtacado: Number(item.precoAtacadoSugerido) || Number(item.custoUnitario) * 1.5,
        custoUnitario: Number(item.custoUnitario) || 0,
        ultimoCusto: Number(item.custoUnitario) || 0,
        gradeTamanhos: item.gradeTamanhos || {},
        estoqueTotal: qtdItem,
        tipoEstoque: invoiceData.destinoEstoque || "loja",
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    // 2. Grava registro no Kardex de Movimentações
    const movRef = doc(collection(db, "empresas", tenantId, "movimentacoes_estoque"));
    batch.set(movRef, {
      tipo: TIPOS_MOVIMENTACAO.ENTRADA_NFE,
      produtoId: targetDocRef.id,
      produtoNome: item.nome,
      referencia: item.referencia || "",
      quantidade: qtdItem,
      gradeMovimentada: item.gradeTamanhos || {},
      custoUnitario: Number(item.custoUnitario) || 0,
      documentoRef: invoiceData.numeroNota,
      chaveNfe: invoiceData.chaveAcesso || "",
      origem: `Fornecedor: ${invoiceData.fornecedorNome || "Fornecedor"}`,
      destino: invoiceData.destinoEstoque === "fabrica" ? "Estoque Fábrica" : "Estoque Loja (Balcão)",
      motivo: `Entrada por NF-e de Compra #${invoiceData.numeroNota}`,
      justificativa: invoiceData.observacoes || "Aquisição e reposição por nota de compra fiscal",
      responsavel: userAuth ? {
        uid: userAuth.uid || userAuth.id || "admin",
        nome: userAuth.nome || userAuth.email || "Administrador",
        email: userAuth.email || "",
        role: userAuth.role || "gerente"
      } : { nome: "Gerente", role: "gerente" },
      criadoEm: serverTimestamp(),
      dataHora: dataHoraAtual
    });
  }

  // 3. Grava o documento fiscal da Nota de Compra
  const nfeDocRef = doc(collection(db, "empresas", tenantId, "notas_compra"));
  const nfePayload = {
    numeroNota: invoiceData.numeroNota,
    serie: invoiceData.serie || "1",
    chaveAcesso: invoiceData.chaveAcesso || `352610${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
    fornecedorNome: invoiceData.fornecedorNome,
    fornecedorCnpj: invoiceData.fornecedorCnpj || "",
    dataEmissao: invoiceData.dataEmissao || dataHojeFormatada,
    dataEntrada: dataHojeFormatada,
    destinoEstoque: invoiceData.destinoEstoque || "loja",
    valorTotalNota: Number(invoiceData.valorTotalNota) || 0,
    valorFrete: Number(invoiceData.valorFrete) || 0,
    totalItens: totalPecasEntrada,
    itens: invoiceData.itens,
    status: "PROCESSADA",
    responsavelNome: userAuth?.nome || "Operador",
    criadoEm: serverTimestamp()
  };
  batch.set(nfeDocRef, nfePayload);

  // 4. Comita o lote atômico
  await batch.commit();

  // 5. Atualiza contadores agregados
  await updateStockAggregateCount(tenantId, invoiceData.destinoEstoque || "loja", totalPecasEntrada);

  return { id: nfeDocRef.id, ...nfePayload };
}

/**
 * Registra Perda / Baixa por Avaria / Ajuste de Inventário com Justificativa Obrigatória
 * Garante rastreabilidade total de quem realizou a baixa, quando e o motivo.
 */
export async function registerStockLossOrAdjustment(tenantId, adjustmentData, userAuth = null) {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!adjustmentData.produtoId) throw new Error("Selecione um produto para ajuste");
  if (!adjustmentData.justificativa || adjustmentData.justificativa.trim().length < 5) {
    throw new Error("A justificativa detalhada é obrigatória (mínimo 5 caracteres)");
  }

  const batch = writeBatch(db);
  const collectionName = adjustmentData.tipoEstoque === "fabrica" ? "estoque_fabrica" : "produtos";
  const prodDocRef = doc(db, "empresas", tenantId, collectionName, adjustmentData.produtoId);

  // Lê produto para verificar saldo e grade atual
  const snap = await getDoc(prodDocRef);
  if (!snap.exists()) {
    throw new Error("Produto não encontrado no estoque");
  }

  const currentData = snap.data();
  const saldoAnterior = Number(currentData.estoqueTotal) || 0;
  const qtdAjuste = Number(adjustmentData.quantidade) || 0; // Se for baixa, virá como valor positivo que iremos subtrair

  const isBaixa = adjustmentData.tipoAjuste === TIPOS_MOVIMENTACAO.BAIXA_AVARIA || adjustmentData.tipoAjuste === "BAIXA_AVARIA";
  const multiplicador = isBaixa ? -1 : 1;
  const deltaEstoque = isBaixa ? -Math.abs(qtdAjuste) : qtdAjuste;
  const saldoNovo = Math.max(0, saldoAnterior + deltaEstoque);

  // Atualiza grade de tamanhos
  const gradeAtual = currentData.gradeTamanhos || {};
  const novaGrade = { ...gradeAtual };

  if (adjustmentData.gradeAjuste && Object.keys(adjustmentData.gradeAjuste).length > 0) {
    Object.entries(adjustmentData.gradeAjuste).forEach(([tam, qtd]) => {
      const qtdAlterar = Number(qtd) || 0;
      if (isBaixa) {
        novaGrade[tam] = Math.max(0, (Number(novaGrade[tam]) || 0) - qtdAlterar);
      } else {
        novaGrade[tam] = (Number(novaGrade[tam]) || 0) + qtdAlterar;
      }
    });
  }

  // 1. Atualiza documento do produto
  batch.update(prodDocRef, {
    estoqueTotal: saldoNovo,
    gradeTamanhos: novaGrade,
    atualizadoEm: serverTimestamp()
  });

  // 2. Grava registro rastreável no Kardex de Movimentações
  const movRef = doc(collection(db, "empresas", tenantId, "movimentacoes_estoque"));
  const movPayload = {
    tipo: isBaixa ? TIPOS_MOVIMENTACAO.BAIXA_AVARIA : (adjustmentData.tipoAjuste || TIPOS_MOVIMENTACAO.AJUSTE_INVENTARIO),
    produtoId: adjustmentData.produtoId,
    produtoNome: currentData.nome || adjustmentData.produtoNome || "Produto",
    referencia: currentData.referencia || adjustmentData.referencia || "",
    quantidade: deltaEstoque,
    gradeMovimentada: adjustmentData.gradeAjuste || {},
    saldoAnterior,
    saldoNovo,
    origem: adjustmentData.tipoEstoque === "fabrica" ? "Estoque Fábrica" : "Estoque Loja (Balcão)",
    destino: isBaixa ? "Refugo / Descarte por Avaria" : "Ajuste de Balanço",
    motivo: adjustmentData.motivo || "Avaria / Defeito",
    justificativa: adjustmentData.justificativa.trim(),
    custoEstimado: Number(adjustmentData.custoEstimado) || (isBaixa ? (Number(currentData.custoUnitario || 0) * Math.abs(qtdAjuste)) : 0),
    documentoRef: `AJU-${Date.now().toString().slice(-6)}`,
    responsavel: userAuth ? {
      uid: userAuth.uid || userAuth.id || "operador",
      nome: userAuth.nome || userAuth.email || "Operador",
      email: userAuth.email || "",
      role: userAuth.role || "gerente"
    } : { nome: "Operador", role: "operador" },
    criadoEm: serverTimestamp(),
    dataHora: new Date().toLocaleString("pt-BR")
  };
  batch.set(movRef, movPayload);

  // 3. Comita o lote atômico
  await batch.commit();

  // 4. Atualiza métricas agregadas
  await updateStockAggregateCount(tenantId, adjustmentData.tipoEstoque || "loja", deltaEstoque);

  return { id: movRef.id, ...movPayload };
}

/**
 * Busca histórico de notas de compra
 */
export async function fetchPurchaseInvoices(tenantId, maxResults = 25) {
  if (!tenantId) return DEMO_PURCHASE_INVOICES;

  try {
    const colRef = collection(db, "empresas", tenantId, "notas_compra");
    const q = query(colRef, limit(maxResults));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    }
  } catch (err) {
    console.warn("[stockService] Erro ao buscar notas de compra reais:", err);
  }

  return DEMO_PURCHASE_INVOICES;
}

/**
 * Transferência Bilateral entre Unidades (Loja ⇄ Fábrica) com Kardex
 */
export async function transferStockBetweenUnits(tenantId, transferData, userAuth = null) {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  const { origemTipo, destinoTipo, produtoId, quantidade, gradeTransferir, motivo, justificativa } = transferData;

  const batch = writeBatch(db);
  const origemCol = origemTipo === "fabrica" ? "estoque_fabrica" : "produtos";
  const destinoCol = destinoTipo === "fabrica" ? "estoque_fabrica" : "produtos";

  const origRef = doc(db, "empresas", tenantId, origemCol, produtoId);
  const origSnap = await getDoc(origRef);

  if (!origSnap.exists()) {
    throw new Error("Produto de origem não encontrado");
  }

  const origData = origSnap.data();
  const qtdNum = Number(quantidade) || 1;

  // 1. Decrementa na origem
  batch.update(origRef, {
    estoqueTotal: increment(-qtdNum),
    atualizadoEm: serverTimestamp()
  });

  // 2. Incrementa ou cria no destino
  const destRef = doc(db, "empresas", tenantId, destinoCol, produtoId);
  const destSnap = await getDoc(destRef);

  if (destSnap.exists()) {
    batch.update(destRef, {
      estoqueTotal: increment(qtdNum),
      atualizadoEm: serverTimestamp()
    });
  } else {
    batch.set(destRef, {
      ...origData,
      tipoEstoque: destinoTipo,
      estoqueTotal: qtdNum,
      gradeTamanhos: gradeTransferir || origData.gradeTamanhos || {},
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  }

  // 3. Kardex
  const movRef = doc(collection(db, "empresas", tenantId, "movimentacoes_estoque"));
  batch.set(movRef, {
    tipo: origemTipo === "fabrica" ? TIPOS_MOVIMENTACAO.TRANSFERENCIA_FABRICA_LOJA : TIPOS_MOVIMENTACAO.TRANSFERENCIA_LOJA_FABRICA,
    produtoId,
    produtoNome: origData.nome,
    referencia: origData.referencia || "",
    quantidade: qtdNum,
    gradeMovimentada: gradeTransferir || {},
    origem: origemTipo === "fabrica" ? "Estoque Fábrica" : "Estoque Loja (Balcão)",
    destino: destinoTipo === "fabrica" ? "Estoque Fábrica" : "Estoque Loja (Balcão)",
    motivo: motivo || "Transferência entre unidades",
    justificativa: justificativa || "Movimentação operacional entre setores",
    responsavel: userAuth ? {
      uid: userAuth.uid || userAuth.id,
      nome: userAuth.nome || userAuth.email,
      role: userAuth.role
    } : { nome: "Operador", role: "gerente" },
    criadoEm: serverTimestamp(),
    dataHora: new Date().toLocaleString("pt-BR")
  });

  await batch.commit();

  await updateStockAggregateCount(tenantId, origemTipo, -qtdNum);
  await updateStockAggregateCount(tenantId, destinoTipo, qtdNum);

  return true;
}

/**
 * Exclui um registro do Kardex de movimentação
 */
export async function deleteStockMovement(tenantId, movementId) {
  if (!tenantId || !movementId) return false;
  try {
    const docRef = doc(db, "empresas", tenantId, "movimentacoes_estoque", movementId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("[stockService] Erro ao excluir movimentação:", err);
    return true;
  }
}

/**
 * Exclui uma Nota Fiscal de Compra
 */
export async function deletePurchaseInvoice(tenantId, invoiceId) {
  if (!tenantId || !invoiceId) return false;
  try {
    const docRef = doc(db, "empresas", tenantId, "notas_compra", invoiceId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("[stockService] Erro ao excluir nota de compra:", err);
    return true;
  }
}

