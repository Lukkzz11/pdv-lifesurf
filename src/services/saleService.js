import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit as firestoreLimit,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../config/firebase";
import { recordSaleMetrics } from "./metricsService";

/**
 * SERVIÇO DE VENDAS E FRENTE DE CAIXA (PDV)
 * Garante atomicidade: baixa de estoque por variação de grade + gravação de venda + métricas agregadas
 */

/**
 * Executa uma venda no PDV com transação no Firestore
 * @param {string} tenantId - ID da empresa ativa
 * @param {object} saleData - Dados da venda (itens, cliente, formaPagamento, total, desconto, etc.)
 */
export async function executeSale(tenantId, saleData) {
  if (!tenantId) throw new Error("tenantId é obrigatório para registrar a venda.");
  if (!saleData.itens || saleData.itens.length === 0) {
    throw new Error("A venda precisa conter pelo menos um item.");
  }

  const agora = new Date();
  const numeroVenda = `${agora.getFullYear().toString().slice(-2)}${(agora.getMonth() + 1).toString().padStart(2, "0")}${agora.getDate().toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const vendasCol = collection(db, "empresas", tenantId, "vendas");
  const newSaleDocRef = doc(vendasCol);

  // Executa transação atômica para garantir baixa consistente de estoque
  await runTransaction(db, async (transaction) => {
    // 1. Lê e valida estoque de todos os produtos do carrinho
    const productReads = [];
    for (const item of saleData.itens) {
      if (item.id) {
        const prodRef = doc(db, "empresas", tenantId, "produtos", item.id);
        const prodDoc = await transaction.get(prodRef);
        productReads.push({ item, prodRef, prodDoc });
      }
    }

    // 2. Aplica as baixas de estoque na grade e no estoque total
    for (const { item, prodRef, prodDoc } of productReads) {
      if (prodDoc && prodDoc.exists()) {
        const prodData = prodDoc.data();
        const qtdVendida = Number(item.quantidade) || 1;
        const currentGrade = prodData.gradeTamanhos || {};
        const tamanho = item.tamanho;

        const updatedGrade = { ...currentGrade };
        if (tamanho && updatedGrade[tamanho] !== undefined) {
          updatedGrade[tamanho] = Math.max(0, (Number(updatedGrade[tamanho]) || 0) - qtdVendida);
        }

        const novoEstoqueTotal = Math.max(
          0,
          (Number(prodData.estoqueTotal) || 0) - qtdVendida
        );

        transaction.update(prodRef, {
          gradeTamanhos: updatedGrade,
          estoqueTotal: novoEstoqueTotal,
          atualizadoEm: serverTimestamp()
        });
      }
    }

    // 3. Grava o documento da venda
    const payload = {
      numeroVenda,
      itens: saleData.itens,
      subtotal: Number(saleData.subtotal) || Number(saleData.total) || 0,
      desconto: Number(saleData.desconto) || 0,
      tipoDesconto: saleData.tipoDesconto || "reais",
      total: Number(saleData.total) || 0,
      formaPagamento: saleData.formaPagamento || "dinheiro",
      infoPagamento: saleData.infoPagamento || {},
      tipoVenda: saleData.tipoVenda || "varejo",
      cliente: saleData.cliente || { nome: "Consumidor Final" },
      operador: saleData.operador || "Caixa Geral",
      unidadeId: saleData.unidadeId || "matriz",
      empresaId: tenantId,
      criadoEm: serverTimestamp()
    };

    transaction.set(newSaleDocRef, payload);

    // 4. Se a venda for A Prazo ("A Ver" / Fiado), registra automaticamente o título a receber
    if (saleData.formaPagamento === "prazo") {
      const recCol = collection(db, "empresas", tenantId, "contas_receber");
      const recDocRef = doc(recCol);
      const hojeStr = agora.toISOString().split("T")[0];
      const vencimento = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      transaction.set(recDocRef, {
        numeroDocumento: `TIT-${numeroVenda}`,
        origemVendaId: newSaleDocRef.id,
        cliente: saleData.cliente || { nome: "Consumidor Final" },
        descricao: `Venda PDV #${numeroVenda} (${saleData.itens?.length || 1} itens)`,
        valorOriginal: Number(saleData.total) || 0,
        valorPago: 0,
        saldoRestante: Number(saleData.total) || 0,
        dataVenda: hojeStr,
        dataVencimento: vencimento,
        status: "pendente",
        historicoPagamentos: [],
        empresaId: tenantId,
        criadoEm: serverTimestamp()
      });
    }
  });

  // 4. Atualiza os contadores agregados (Regra Blaze: 0 leituras, incremento atômico no servidor)
  const fullSaleRecord = {
    id: newSaleDocRef.id,
    numeroVenda,
    ...saleData
  };
  await recordSaleMetrics(tenantId, fullSaleRecord);

  return fullSaleRecord;
}

/**
 * Executa uma venda no PDV/Estoque SEM debitar estoque
 * (Útil para mercadorias físicas recém-chegadas ainda não inventariadas)
 */
export async function executeSaleWithoutStockDeduction(tenantId, saleData) {
  if (!tenantId) throw new Error("tenantId é obrigatório para registrar a venda.");
  if (!saleData.itens || saleData.itens.length === 0) {
    throw new Error("A venda precisa conter pelo menos um item.");
  }

  const agora = new Date();
  const numeroVenda = `SB-${agora.getFullYear().toString().slice(-2)}${(agora.getMonth() + 1).toString().padStart(2, "0")}${agora.getDate().toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const vendasCol = collection(db, "empresas", tenantId, "vendas");
  const newSaleDocRef = doc(vendasCol);

  const payload = {
    numeroVenda,
    itens: saleData.itens,
    subtotal: Number(saleData.subtotal) || Number(saleData.total) || 0,
    desconto: Number(saleData.desconto) || 0,
    tipoDesconto: saleData.tipoDesconto || "reais",
    total: Number(saleData.total) || 0,
    formaPagamento: saleData.formaPagamento || "dinheiro",
    infoPagamento: saleData.infoPagamento || {},
    tipoVenda: saleData.tipoVenda || "varejo",
    cliente: saleData.cliente || { nome: "Consumidor Final" },
    operador: saleData.operador || "Caixa Geral",
    unidadeId: saleData.unidadeId || "matriz",
    semBaixaEstoque: true,
    motivoSemBaixa: saleData.motivoSemBaixa || "Mercadoria física sem inventário imediato",
    empresaId: tenantId,
    criadoEm: serverTimestamp()
  };

  await runTransaction(db, async (transaction) => {
    transaction.set(newSaleDocRef, payload);

    if (saleData.formaPagamento === "prazo") {
      const recCol = collection(db, "empresas", tenantId, "contas_receber");
      const recDocRef = doc(recCol);
      const hojeStr = agora.toISOString().split("T")[0];
      const vencimento = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      transaction.set(recDocRef, {
        numeroDocumento: `TIT-${numeroVenda}`,
        origemVendaId: newSaleDocRef.id,
        cliente: saleData.cliente || { nome: "Consumidor Final" },
        descricao: `Venda Sem Baixa #${numeroVenda} (${saleData.itens?.length || 1} itens)`,
        valorOriginal: Number(saleData.total) || 0,
        valorPago: 0,
        saldoRestante: Number(saleData.total) || 0,
        dataVenda: hojeStr,
        dataVencimento: vencimento,
        status: "pendente",
        historicoPagamentos: [],
        empresaId: tenantId,
        criadoEm: serverTimestamp()
      });
    }
  });

  const fullSaleRecord = {
    id: newSaleDocRef.id,
    numeroVenda,
    ...payload
  };
  await recordSaleMetrics(tenantId, fullSaleRecord);

  return fullSaleRecord;
}

/**
 * Busca histórico de vendas da empresa (Caixa Loja)
 */
export async function fetchSales(tenantId, maxResults = 100) {
  if (!tenantId) return [];

  try {
    const vendasCol = collection(db, "empresas", tenantId, "vendas");
    const q = query(vendasCol, orderBy("criadoEm", "desc"), firestoreLimit(maxResults));
    const snapshot = await getDocs(q);

    const vendas = [];
    snapshot.forEach((d) => {
      const data = d.data();
      vendas.push({
        id: d.id,
        ...data,
        dataHoraFormatada: data.criadoEm?.toDate ? data.criadoEm.toDate().toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR")
      });
    });

    return vendas;
  } catch (err) {
    console.warn("[saleService] Falha ao carregar vendas do Firestore:", err);
    return [];
  }
}

/**
 * Atualiza os dados de uma venda existente no Caixa Loja
 */
export async function updateSale(tenantId, saleId, updatedFields) {
  if (!tenantId || !saleId) throw new Error("tenantId e saleId são obrigatórios");

  const saleRef = doc(db, "empresas", tenantId, "vendas", saleId);
  const payload = {
    ...updatedFields,
    atualizadoEm: serverTimestamp()
  };

  await updateDoc(saleRef, payload);
  return { id: saleId, ...payload };
}

/**
 * Exclui registro de venda do Caixa Loja
 * Opcionalmente restaura os itens no estoque se a venda tiver feito baixa
 */
export async function deleteSale(tenantId, saleId, restoreStock = false, saleData = null) {
  if (!tenantId || !saleId) throw new Error("tenantId e saleId são obrigatórios");

  const saleRef = doc(db, "empresas", tenantId, "vendas", saleId);

  if (restoreStock && saleData?.itens && !saleData.semBaixaEstoque) {
    await runTransaction(db, async (transaction) => {
      for (const item of saleData.itens) {
        if (item.id) {
          const prodRef = doc(db, "empresas", tenantId, "produtos", item.id);
          const prodDoc = await transaction.get(prodRef);
          if (prodDoc.exists()) {
            const pData = prodDoc.data();
            const qtd = Number(item.quantidade) || 1;
            const updatedGrade = { ...(pData.gradeTamanhos || {}) };
            if (item.tamanho && updatedGrade[item.tamanho] !== undefined) {
              updatedGrade[item.tamanho] = (Number(updatedGrade[item.tamanho]) || 0) + qtd;
            }
            const novoEstoque = (Number(pData.estoqueTotal) || 0) + qtd;
            transaction.update(prodRef, {
              gradeTamanhos: updatedGrade,
              estoqueTotal: novoEstoque,
              atualizadoEm: serverTimestamp()
            });
          }
        }
      }
      transaction.delete(saleRef);
    });
  } else {
    await deleteDoc(saleRef);
  }

  return true;
}

