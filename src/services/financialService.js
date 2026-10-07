/**
 * SERVIÇO DE GESTÃO FINANCEIRA: CONTAS A RECEBER ("A VER" / FIADO) & CONTAS A PAGAR
 * Suporte a quitações parciais, recibos de pagamento em PDF e projeção de fluxo de caixa.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "../utils/formatters";
import { adjustCustomerDebt } from "./customerService";

export const CATEGORIAS_DESPESA = [
  { id: "materia_prima", label: "Matéria-Prima (Tecidos / Malhas)" },
  { id: "faccao_costura", label: "Facção & Costura Externa" },
  { id: "aviamentos_estampa", label: "Aviamentos, Etiquetas & Silk" },
  { id: "aluguel_predial", label: "Aluguel da Loja / Galpão" },
  { id: "energia_agua", label: "Energia Elétrica & Água" },
  { id: "folha_pagamento", label: "Salários & Comissões" },
  { id: "logistica_frete", label: "Frete & Motoboy" },
  { id: "impostos_taxas", label: "Impostos, DAS & Taxas" },
  { id: "outros", label: "Outras Despesas Operacionais" }
];

export const DEMO_RECEIVABLES = [
  {
    id: "rec-1",
    numeroDocumento: "TIT-2610-001",
    origemVendaId: "vnd-8492",
    cliente: {
      id: "cli-1",
      nome: "Surf House Boardshop Ltda",
      documento: "34.567.890/0001-12",
      telefone: "(85) 99123-4567"
    },
    descricao: "Venda Atacado - 30x Camisetas Silk Waves + 10x Boardshorts",
    valorOriginal: 1850.0,
    valorPago: 600.0,
    saldoRestante: 1250.0,
    dataVenda: "2026-09-20",
    dataVencimento: "2026-10-10",
    status: "pendente", // "pendente", "pago_parcial", "liquidado", "vencido"
    historicoPagamentos: [
      {
        data: "2026-09-25",
        valor: 600.0,
        forma: "pix",
        operador: "Caixa Geral",
        observacao: "Entrada via PIX"
      }
    ]
  },
  {
    id: "rec-2",
    numeroDocumento: "TIT-2610-002",
    origemVendaId: "vnd-8501",
    cliente: {
      id: "cli-2",
      nome: "Carlos Eduardo P. Silva",
      documento: "847.291.034-55",
      telefone: "(85) 98844-1122"
    },
    descricao: "Venda Balcão A Prazo - 2x Bermudas Elastano 40",
    valorOriginal: 189.9,
    valorPago: 0.0,
    saldoRestante: 189.9,
    dataVenda: "2026-09-28",
    dataVencimento: "2026-10-05",
    status: "pendente",
    historicoPagamentos: []
  },
  {
    id: "rec-3",
    numeroDocumento: "TIT-2610-003",
    origemVendaId: "vnd-8515",
    cliente: {
      id: "cli-3",
      nome: "Maresia Distribuidora Ceará",
      documento: "19.876.543/0001-99",
      telefone: "(85) 99877-3344"
    },
    descricao: "Pedido Atacado OP-2026-078 - Lote 120 Peças",
    valorOriginal: 6400.0,
    valorPago: 3000.0,
    saldoRestante: 3400.0,
    dataVenda: "2026-09-15",
    dataVencimento: "2026-10-15",
    status: "pago_parcial",
    historicoPagamentos: [
      {
        data: "2026-09-15",
        valor: 3000.0,
        forma: "transferencia",
        operador: "Gerente Loja",
        observacao: "Sinal de 50% na abertura do pedido"
      }
    ]
  }
];

export const DEMO_PAYABLES = [
  {
    id: "pay-1",
    fornecedor: "Têxtil Ceará Ltda",
    categoria: "materia_prima",
    descricao: "Compra de 150kg de Malha Algodão 30.1 Penteada (NF-e 8491)",
    valor: 4350.0,
    dataVencimento: "2026-10-12",
    status: "pendente", // "pendente", "pago", "vencido"
    pagoEm: null
  },
  {
    id: "pay-2",
    fornecedor: "Oficina de Costura Dona Rita",
    categoria: "faccao_costura",
    descricao: "Facção e Costura de 200 Camisetas Waves (R$ 4,50/peça)",
    valor: 900.0,
    dataVencimento: "2026-10-06",
    status: "pendente",
    pagoEm: null
  },
  {
    id: "pay-3",
    fornecedor: "Enel Distribuição Ceará",
    categoria: "energia_agua",
    descricao: "Conta de Energia Fábrica & Loja - Ref Setembro",
    valor: 742.8,
    dataVencimento: "2026-10-15",
    status: "pendente",
    pagoEm: null
  },
  {
    id: "pay-4",
    fornecedor: "Imobiliária Beira Mar",
    categoria: "aluguel_predial",
    descricao: "Aluguel Loja Física - Competência Outubro/2026",
    valor: 2800.0,
    dataVencimento: "2026-10-05",
    status: "pago",
    pagoEm: "2026-10-02"
  }
];

/**
 * Verifica se as contas a receber e pagar foram zeradas pelo usuário
 */
export function isContasAVerZerado(tenantId) {
  try {
    return localStorage.getItem(`lifesurf_contas_aver_zerado_${tenantId || "default"}`) === "true";
  } catch {
    return false;
  }
}

/**
 * Zera todas as contas a receber e pagar da empresa ativa (R$ 0,00)
 */
export async function zerarTodasContas(tenantId, options = { receber: true, pagar: true }) {
  try {
    localStorage.setItem(`lifesurf_contas_aver_zerado_${tenantId || "default"}`, "true");

    if (tenantId) {
      const promises = [];
      if (options.receber) {
        try {
          const colRec = collection(db, "empresas", tenantId, "contas_receber");
          const snapRec = await getDocs(colRec);
          snapRec.docs.forEach((d) => promises.push(deleteDoc(d.ref)));
        } catch (e) {
          console.warn("[financialService] Erro ao limpar contas_receber do Firestore:", e);
        }
      }

      if (options.pagar) {
        try {
          const colPay = collection(db, "empresas", tenantId, "contas_pagar");
          const snapPay = await getDocs(colPay);
          snapPay.docs.forEach((d) => promises.push(deleteDoc(d.ref)));
        } catch (e) {
          console.warn("[financialService] Erro ao limpar contas_pagar do Firestore:", e);
        }
      }

      await Promise.all(promises);
    }

    return true;
  } catch (err) {
    console.error("[financialService] Erro ao zerar contas:", err);
    throw err;
  }
}

/**
 * Restaura dados demonstrativos de contas a receber e pagar
 */
export function restaurarDemoContas(tenantId) {
  try {
    localStorage.removeItem(`lifesurf_contas_aver_zerado_${tenantId || "default"}`);
  } catch (err) {
    console.warn("[financialService] Erro ao restaurar contas:", err);
  }
}

/**
 * Busca títulos de Contas a Receber ("A Ver" / Fiado)
 */
export async function fetchReceivables(tenantId) {
  if (isContasAVerZerado(tenantId)) {
    return [];
  }

  if (!tenantId) return DEMO_RECEIVABLES;

  try {
    const colRef = collection(db, "empresas", tenantId, "contas_receber");
    const q = query(colRef, limit(100));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn("[financialService] Usando demo receivables:", err.message);
  }

  return isContasAVerZerado(tenantId) ? [] : DEMO_RECEIVABLES;
}

/**
 * Registra pagamento parcial ou total de um título a receber
 */
export async function registerReceivablePayment(tenantId, receivable, paymentData) {
  if (!tenantId || !receivable) throw new Error("Parâmetros inválidos");

  const valorPagoAgora = Number(paymentData.valor) || 0;
  if (valorPagoAgora <= 0) throw new Error("O valor de pagamento deve ser superior a zero.");

  const novoValorPago = (Number(receivable.valorPago) || 0) + valorPagoAgora;
  const novoSaldo = Math.max(0, (Number(receivable.valorOriginal) || 0) - novoValorPago);
  const novoStatus = novoSaldo <= 0.01 ? "liquidado" : "pago_parcial";

  const novoHistorico = [
    ...(receivable.historicoPagamentos || []),
    {
      data: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      valor: valorPagoAgora,
      forma: paymentData.forma || "dinheiro",
      operador: paymentData.operador || "Caixa Geral",
      observacao: paymentData.observacao || "Amortização de saldo devedor"
    }
  ];

  // Ajusta saldo devedor do cliente
  if (receivable.cliente?.id) {
    await adjustCustomerDebt(tenantId, receivable.cliente.id, -valorPagoAgora);
  }

  // Tenta persistir no Firestore
  try {
    const docRef = doc(db, "empresas", tenantId, "contas_receber", receivable.id);
    await updateDoc(docRef, {
      valorPago: novoValorPago,
      saldoRestante: novoSaldo,
      status: novoStatus,
      historicoPagamentos: novoHistorico,
      atualizadoEm: serverTimestamp()
    });
  } catch (err) {
    console.warn("[financialService] Não foi possível atualizar no Firestore, atualizando em memória:", err.message);
  }

  return {
    ...receivable,
    valorPago: novoValorPago,
    saldoRestante: novoSaldo,
    status: novoStatus,
    historicoPagamentos: novoHistorico
  };
}

/**
 * Busca despesas e Contas a Pagar
 */
export async function fetchPayables(tenantId) {
  if (isContasAVerZerado(tenantId)) {
    return [];
  }

  if (!tenantId) return DEMO_PAYABLES;

  try {
    const colRef = collection(db, "empresas", tenantId, "contas_pagar");
    const q = query(colRef, limit(100));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn("[financialService] Usando demo payables:", err.message);
  }

  return isContasAVerZerado(tenantId) ? [] : DEMO_PAYABLES;
}

/**
 * Registra uma nova conta a pagar
 */
export async function createPayable(tenantId, payableData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!payableData.fornecedor?.trim()) throw new Error("Fornecedor é obrigatório");

  const payload = {
    fornecedor: payableData.fornecedor.trim(),
    categoria: payableData.categoria || "outros",
    descricao: payableData.descricao?.trim() || "",
    valor: Number(payableData.valor) || 0,
    dataVencimento: payableData.dataVencimento || new Date().toISOString().split("T")[0],
    status: "pendente",
    pagoEm: null,
    empresaId: tenantId,
    criadoEm: serverTimestamp()
  };

  const colRef = collection(db, "empresas", tenantId, "contas_pagar");
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
}

/**
 * Realiza a baixa (pagamento) de uma conta a pagar
 */
export async function markPayableAsPaid(tenantId, payableId) {
  if (!tenantId || !payableId) return;

  const hoje = new Date().toISOString().split("T")[0];
  try {
    const docRef = doc(db, "empresas", tenantId, "contas_pagar", payableId);
    await updateDoc(docRef, {
      status: "pago",
      pagoEm: hoje,
      atualizadoEm: serverTimestamp()
    });
  } catch (err) {
    console.warn("[financialService] Erro ao pagar conta:", err.message);
  }
}

/**
 * Gera e baixa o Recibo Oficial de Quitação / Amortização em PDF
 */
export function generatePaymentReceiptPDF(receivable, paymentRecord, storeInfo = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5" // Formato A5 elegante para recibos
  });

  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [14, 165, 233]; // Sky 500
  const agora = new Date();

  // Cabeçalho
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 148, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(storeInfo.nome || "LIFESURF SURFWEAR & CONFECÇÕES", 10, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(186, 230, 253);
  doc.text("RECIBO OFICIAL DE QUITAÇÃO & AMORTIZAÇÃO DE DÉBITO", 10, 16);

  doc.setTextColor(255, 255, 255);
  doc.text(`Data: ${formatDate(agora)}`, 105, 16);

  // Dados do Recibo
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Recibo Ref.: ${receivable.numeroDocumento || "TIT-001"}`, 10, 30);

  const dadosTabela = [
    ["Cliente / Sacado:", receivable.cliente?.nome || "Consumidor"],
    ["CPF / CNPJ:", receivable.cliente?.documento || "Não informado"],
    ["Telefone / Contato:", receivable.cliente?.telefone || "Não informado"],
    ["Descrição do Débito:", receivable.descricao || "Venda a Prazo"],
    ["Valor Total da Venda:", formatCurrency(receivable.valorOriginal || 0)],
    ["Valor Pago Neste Recibo:", formatCurrency(paymentRecord.valor || 0)],
    ["Forma de Pagamento:", (paymentRecord.forma || "Dinheiro").toUpperCase()],
    ["Saldo Restante Devedor:", formatCurrency(receivable.saldoRestante || 0)],
    ["Status Atual do Título:", (receivable.status || "pendente").toUpperCase()]
  ];

  autoTable(doc, {
    startY: 34,
    body: dadosTabela,
    theme: "striped",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold", textColor: [71, 85, 105] },
      1: { cellWidth: 78, textColor: [15, 23, 42] }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 18;

  // Assinatura
  doc.setDrawColor(180, 180, 180);
  doc.line(25, finalY, 125, finalY);

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura do Recebedor / Responsável Caixa", 40, finalY + 4);
  doc.text(`${storeInfo.nome || "LifeSurf"} • ${storeInfo.cidade || "Fortaleza - CE"}`, 48, finalY + 9);

  const fileName = `Recibo_${receivable.numeroDocumento || "quitacao"}.pdf`;
  doc.save(fileName);
}

/* =========================================================================
 * 4. LIVRO CAIXA & CONTROLE DE GASTOS / ENTRADAS COM COMPROVANTES NO GOOGLE DRIVE
 * ========================================================================= */

export const CATEGORIAS_ENTRADA = [
  "Venda Balcão / PDV",
  "Vendas Atacado",
  "Recebimento de Fiado (A Ver)",
  "Aporte / Capital de Giro",
  "Rendimentos & Outras Entradas"
];

export const CATEGORIAS_GASTO = [
  "Matéria-Prima (Tecidos / Malhas)",
  "Facção & Costura Externa",
  "Aviamentos, Etiquetas & Silk",
  "Aluguel & Condomínio",
  "Energia Elétrica & Água",
  "Salários & Comissões",
  "Logística, Frete & Motoboy",
  "Impostos, DAS & Taxas",
  "Manutenção de Máquinas & Equipamentos",
  "Alimentação & Despesas Diárias",
  "Marketing & Tráfego Pago",
  "Outros Gastos Operacionais"
];

export const FORMAS_PAGAMENTO_FINANCEIRO = [
  { id: "pix", label: "PIX" },
  { id: "dinheiro", label: "Dinheiro em Espécie" },
  { id: "cartao_credito", label: "Cartão de Crédito" },
  { id: "cartao_debito", label: "Cartão de Débito" },
  { id: "boleto", label: "Boleto Bancário" },
  { id: "transferencia", label: "Transferência / TED" }
];

export const DEMO_CASHFLOW_TRANSACTIONS = [
  {
    id: "tx-1",
    tipo: "entrada",
    descricao: "Vendas Loja Balcão & PDV (Fechamento Sexta-Feira)",
    categoria: "Venda Balcão / PDV",
    valor: 2450.0,
    data: "2026-10-02",
    formaPagamento: "pix",
    status: "concluido",
    fornecedorOuCliente: "Clientes Balcão",
    comprovante: null
  },
  {
    id: "tx-2",
    tipo: "saida",
    descricao: "Compra de Tecido Malha 30.1 Penteada (Fornecedor Têxtil Ceará)",
    categoria: "Matéria-Prima (Tecidos / Malhas)",
    valor: 1350.0,
    data: "2026-10-02",
    formaPagamento: "pix",
    status: "concluido",
    fornecedorOuCliente: "Têxtil Ceará Ltda",
    comprovante: {
      nomeArquivo: "Comprovante_PIX_Textil_1350.jpg",
      driveUrl: "https://drive.google.com",
      driveFolderName: "2026-10 (Outubro)",
      enviadoDrive: true
    }
  },
  {
    id: "tx-3",
    tipo: "entrada",
    descricao: "Entrada Pedido Atacado #OP-2026-081 (50x Bermudas)",
    categoria: "Vendas Atacado",
    valor: 3995.0,
    data: "2026-10-01",
    formaPagamento: "transferencia",
    status: "concluido",
    fornecedorOuCliente: "Surf House Boardshop",
    comprovante: null
  },
  {
    id: "tx-4",
    tipo: "saida",
    descricao: "Pagamento Oficina Costura Dona Rita (Lote 200 Camisetas)",
    categoria: "Facção & Costura Externa",
    valor: 900.0,
    data: "2026-10-01",
    formaPagamento: "pix",
    status: "concluido",
    fornecedorOuCliente: "Oficina Dona Rita",
    comprovante: {
      nomeArquivo: "Comprovante_Faccao_900.jpg",
      driveUrl: "https://drive.google.com",
      driveFolderName: "2026-10 (Outubro)",
      enviadoDrive: true
    }
  },
  {
    id: "tx-5",
    tipo: "saida",
    descricao: "Aluguel Loja Física - Competência Outubro/2026",
    categoria: "Aluguel & Condomínio",
    valor: 2800.0,
    data: "2026-10-01",
    formaPagamento: "boleto",
    status: "concluido",
    fornecedorOuCliente: "Imobiliária Beira Mar",
    comprovante: null
  }
];

export async function fetchCashFlowTransactions(tenantId, options = {}) {
  const companyId = tenantId || "lifesurf";
  try {
    const colRef = collection(db, "empresas", companyId, "transacoes_financeiras");
    const q = query(colRef, limit(200));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const dbDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      saveLocalTransactions(companyId, dbDocs);
      return dbDocs;
    }
  } catch (err) {
    console.warn("[financialService] Erro ao buscar transações no Firestore:", err.message);
  }

  // Tenta ler localmente
  try {
    const raw = localStorage.getItem(`lifesurf_fluxo_caixa_${companyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return DEMO_CASHFLOW_TRANSACTIONS;
}

export function saveLocalTransactions(companyId, transactions) {
  try {
    localStorage.setItem(`lifesurf_fluxo_caixa_${companyId || "lifesurf"}`, JSON.stringify(transactions));
  } catch (err) {
    console.warn("Erro ao salvar cache local de transações:", err);
  }
}

export async function saveCashFlowTransaction(tenantId, transactionData, transactionId = null) {
  const companyId = tenantId || "lifesurf";

  const payload = {
    ...transactionData,
    tipo: transactionData.tipo || "saida",
    valor: Number(transactionData.valor) || 0,
    data: transactionData.data || new Date().toISOString().split("T")[0],
    categoria:
      transactionData.categoria ||
      (transactionData.tipo === "entrada" ? "Venda Balcão / PDV" : "Outros Gastos Operacionais"),
    formaPagamento: transactionData.formaPagamento || "pix",
    status: transactionData.status || "concluido",
    atualizadoEm: serverTimestamp()
  };

  let savedId = transactionId;
  try {
    const colRef = collection(db, "empresas", companyId, "transacoes_financeiras");
    if (transactionId && !transactionId.startsWith("tx-")) {
      const docRef = doc(colRef, transactionId);
      await setDoc(docRef, payload, { merge: true });
    } else {
      payload.criadoEm = serverTimestamp();
      const docRef = await addDoc(colRef, payload);
      savedId = docRef.id;
    }
  } catch (err) {
    console.warn("[financialService] Erro ao salvar no Firestore, usando fallback local:", err.message);
    if (!savedId) {
      savedId = `tx-local-${Date.now()}`;
    }
  }

  const current = await fetchCashFlowTransactions(companyId);
  let updated;
  if (transactionId) {
    updated = current.map((t) => (t.id === transactionId ? { ...t, ...payload, id: savedId } : t));
  } else {
    updated = [{ ...payload, id: savedId }, ...current];
  }
  saveLocalTransactions(companyId, updated);
  return { id: savedId, ...payload };
}

export async function deleteCashFlowTransaction(tenantId, transactionId) {
  const companyId = tenantId || "lifesurf";
  try {
    const docRef = doc(db, "empresas", companyId, "transacoes_financeiras", transactionId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("[financialService] Aviso ao deletar do Firestore:", err.message);
  }

  const current = await fetchCashFlowTransactions(companyId);
  const updated = current.filter((t) => t.id !== transactionId);
  saveLocalTransactions(companyId, updated);
  return updated;
}

export function calculateCashFlowSummary(transactions = [], mesAnoFiltro = null) {
  const filtradas = mesAnoFiltro
    ? transactions.filter((t) => t.data?.startsWith(mesAnoFiltro))
    : transactions;

  let totalEntradas = 0;
  let totalGastos = 0;
  let countComprovantesDrive = 0;

  filtradas.forEach((t) => {
    const valor = Number(t.valor) || 0;
    if (t.tipo === "entrada") {
      totalEntradas += valor;
    } else {
      totalGastos += valor;
    }
    if (t.comprovante?.driveUrl || t.comprovante?.enviadoDrive) {
      countComprovantesDrive += 1;
    }
  });

  const saldoLiquido = totalEntradas - totalGastos;
  return {
    totalEntradas,
    totalGastos,
    saldoLiquido,
    countTransacoes: filtradas.length,
    countComprovantesDrive
  };
}

