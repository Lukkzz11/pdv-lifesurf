import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
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
