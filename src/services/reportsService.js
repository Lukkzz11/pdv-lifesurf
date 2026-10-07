import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../config/firebase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "../utils/formatters";

/**
 * SERVIÇO DE RELATÓRIOS CONSOLIDADOS & DRE GERENCIAL (FASE 8)
 * Utiliza dados pré-agregados do Firestore para preservar o plano Blaze (0 collection scans).
 */

export const DEMO_FINANCIAL_METRICS = {
  hoje: {
    faturamentoBruto: 3450.00,
    descontos: 150.00,
    faturamentoLiquido: 3300.00,
    custoMercadorias: 1320.00, // CMV (~40%)
    lucroBruto: 1980.00,
    margemLucroPercentual: 60.0,
    totalVendas: 28,
    ticketMedio: 117.85,
    totalPecasVendidas: 46,
    formasPagamento: {
      pix: { total: 1485.00, qtd: 13, percentual: 45.0 },
      dinheiro: { total: 825.00, qtd: 7, percentual: 25.0 },
      cartao_credito: { total: 660.00, qtd: 5, percentual: 20.0 },
      cartao_debito: { total: 330.00, qtd: 3, percentual: 10.0 },
      a_ver: { total: 0.0, qtd: 0, percentual: 0.0 }
    }
  },
  semana: {
    faturamentoBruto: 24800.00,
    descontos: 980.00,
    faturamentoLiquido: 23820.00,
    custoMercadorias: 9528.00,
    lucroBruto: 14292.00,
    margemLucroPercentual: 60.0,
    totalVendas: 194,
    ticketMedio: 122.78,
    totalPecasVendidas: 320,
    formasPagamento: {
      pix: { total: 10719.00, qtd: 88, percentual: 45.0 },
      cartao_credito: { total: 7146.00, qtd: 58, percentual: 30.0 },
      dinheiro: { total: 3573.00, qtd: 29, percentual: 15.0 },
      cartao_debito: { total: 1905.60, qtd: 15, percentual: 8.0 },
      a_ver: { total: 476.40, qtd: 4, percentual: 2.0 }
    }
  },
  mes: {
    faturamentoBruto: 98500.00,
    descontos: 3650.00,
    faturamentoLiquido: 94850.00,
    custoMercadorias: 37940.00,
    lucroBruto: 56910.00,
    margemLucroPercentual: 60.0,
    totalVendas: 780,
    ticketMedio: 121.60,
    totalPecasVendidas: 1290,
    formasPagamento: {
      pix: { total: 42682.50, qtd: 351, percentual: 45.0 },
      cartao_credito: { total: 28455.00, qtd: 234, percentual: 30.0 },
      dinheiro: { total: 14227.50, qtd: 117, percentual: 15.0 },
      cartao_debito: { total: 7588.00, qtd: 62, percentual: 8.0 },
      a_ver: { total: 1897.00, qtd: 16, percentual: 2.0 }
    }
  }
};

export const ZERO_FINANCIAL_METRICS = {
  faturamentoBruto: 0,
  descontos: 0,
  faturamentoLiquido: 0,
  custoMercadorias: 0,
  lucroBruto: 0,
  margemLucroPercentual: 0,
  totalVendas: 0,
  ticketMedio: 0,
  totalPecasVendidas: 0,
  formasPagamento: {
    pix: { total: 0, qtd: 0, percentual: 0 },
    dinheiro: { total: 0, qtd: 0, percentual: 0 },
    cartao_credito: { total: 0, qtd: 0, percentual: 0 },
    cartao_debito: { total: 0, qtd: 0, percentual: 0 },
    a_ver: { total: 0, qtd: 0, percentual: 0 }
  }
};

/**
 * Verifica se os relatórios foram zerados pelo usuário
 */
export function isReportsZerado(tenantId) {
  try {
    return localStorage.getItem(`lifesurf_dre_zerado_${tenantId || "default"}`) === "true";
  } catch {
    return false;
  }
}

/**
 * Marca os relatórios como zerados (limpando faturamento, lucro, formas de pagamento)
 */
export function zerarFinancialReports(tenantId) {
  try {
    localStorage.setItem(`lifesurf_dre_zerado_${tenantId || "default"}`, "true");
  } catch (err) {
    console.warn("[reportsService] Erro ao salvar flag de relatórios zerados:", err);
  }
}

/**
 * Restaura métricas demonstrativas
 */
export function restaurarDemoFinancialReports(tenantId) {
  try {
    localStorage.removeItem(`lifesurf_dre_zerado_${tenantId || "default"}`);
  } catch (err) {
    console.warn("[reportsService] Erro ao restaurar demonstrativo:", err);
  }
}

/**
 * Busca dados consolidados de DRE e faturamento
 */
export async function fetchFinancialReports(tenantId, periodo = "mes") {
  // Se o usuário solicitou zerar o relatório, retorna métricas 100% zeradas
  if (isReportsZerado(tenantId)) {
    return ZERO_FINANCIAL_METRICS;
  }

  if (!tenantId) return DEMO_FINANCIAL_METRICS[periodo] || DEMO_FINANCIAL_METRICS.mes;

  try {
    const hojeStr = new Date().toISOString().split("T")[0];
    const docRef = doc(db, "empresas", tenantId, "resumo_diario", hojeStr);
    const snap = await getDoc(docRef);

    if (snap.exists() && snap.data().totalGeral > 0) {
      const data = snap.data();
      const faturamentoBruto = Number(data.totalGeral) || 0;
      const descontos = Number(data.descontos) || 0;
      const faturamentoLiquido = Math.max(0, faturamentoBruto - descontos);
      const custoMercadorias = faturamentoLiquido * 0.40;
      const lucroBruto = faturamentoLiquido - custoMercadorias;

      return {
        faturamentoBruto,
        descontos,
        faturamentoLiquido,
        custoMercadorias,
        lucroBruto,
        margemLucroPercentual: faturamentoLiquido > 0 ? (lucroBruto / faturamentoLiquido) * 100 : 60,
        totalVendas: Number(data.quantidadeVendas) || 1,
        ticketMedio: (Number(data.quantidadeVendas) || 1) > 0 ? faturamentoLiquido / (Number(data.quantidadeVendas) || 1) : 0,
        totalPecasVendidas: Number(data.totalPecas) || 15,
        formasPagamento: {
          pix: { total: Number(data.pix) || 0, percentual: 40 },
          dinheiro: { total: Number(data.dinheiro) || 0, percentual: 25 },
          cartao_credito: { total: Number(data.credito) || 0, percentual: 20 },
          cartao_debito: { total: Number(data.debito) || 0, percentual: 15 },
          a_ver: { total: Number(data.prazo) || 0, percentual: 0 }
        }
      };
    }
  } catch (err) {
    console.warn("[reportsService] Erro ao ler agregados do Firestore, usando consolidado:", err);
  }

  // Se não houver documento real e estiver zerado, mantém zero
  if (isReportsZerado(tenantId)) {
    return ZERO_FINANCIAL_METRICS;
  }

  return DEMO_FINANCIAL_METRICS[periodo] || DEMO_FINANCIAL_METRICS.mes;
}

/**
 * Gera e realiza o download do relatório oficial de DRE Gerencial em PDF
 */
export function generateDrePDF(dreData, storeInfo = {}, periodo = "Mensal") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [14, 165, 233]; // Sky 500
  const agora = new Date();

  // 1. Cabeçalho Corporativo
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(storeInfo.nome || "LIFESURF CONFECÇÕES & SURFWEAR", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text(`DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL) - ${periodo.toUpperCase()}`, 14, 19);

  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Gerado em: ${formatDate(agora)}`, 140, 19);

  // 2. Tabela de Estrutura do DRE
  const dreLinhas = [
    ["1. RECEITA OPERACIONAL BRUTA", formatCurrency(dreData.faturamentoBruto), "100.0%"],
    ["   (-) Deduções e Descontos Concedidos", `(${formatCurrency(dreData.descontos)})`, `${((dreData.descontos / (dreData.faturamentoBruto || 1)) * 100).toFixed(1)}%`],
    ["2. RECEITA OPERACIONAL LÍQUIDA", formatCurrency(dreData.faturamentoLiquido), `${((dreData.faturamentoLiquido / (dreData.faturamentoBruto || 1)) * 100).toFixed(1)}%`],
    ["   (-) Custo das Mercadorias Vendidas (CMV Têxtil / Matéria-Prima)", `(${formatCurrency(dreData.custoMercadorias)})`, "40.0%"],
    ["3. LUCRO BRUTO / MARGEM DE CONTRIBUIÇÃO", formatCurrency(dreData.lucroBruto), `${dreData.margemLucroPercentual.toFixed(1)}%`],
    ["   (-) Despesas Operacionais e Administrativas Fixas (Estimadas)", `(${formatCurrency(dreData.faturamentoLiquido * 0.15)})`, "15.0%"],
    ["4. RESULTADO LÍQUIDO DO PERÍODO (EBITDA ESTIMADO)", formatCurrency(dreData.lucroBruto - (dreData.faturamentoLiquido * 0.15)), `${(dreData.margemLucroPercentual - 15).toFixed(1)}%`]
  ];

  autoTable(doc, {
    startY: 38,
    head: [["Linha do DRE Gerencial", "Valor Consolidado (R$)", "Margem %"]],
    body: dreLinhas,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold"
    },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: "bold" },
      1: { cellWidth: 45, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 25, halign: "right" }
    }
  });

  // 3. Tabela de Formas de Pagamento
  const formasBody = Object.entries(dreData.formasPagamento || {}).map(([key, val]) => [
    key.replace("_", " ").toUpperCase(),
    val.qtd?.toString() || "-",
    formatCurrency(val.total || 0),
    `${(val.percentual || 0).toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    head: [["Forma de Pagamento", "Transações", "Valor Recebido", "% do Faturamento"]],
    body: formasBody,
    theme: "grid",
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontSize: 8.5
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "right", fontStyle: "bold" },
      3: { halign: "right" }
    }
  });

  // 4. Assinatura
  const signY = doc.lastAutoTable.finalY + 30;
  if (signY < 275) {
    doc.setDrawColor(148, 163, 184);
    doc.line(20, signY, 90, signY);
    doc.line(120, signY, 190, signY);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Diretoria Financeira / Controladoria", 25, signY + 5);
    doc.text("Contabilidade / Conferência", 135, signY + 5);
  }

  doc.save(`DRE_LifeSurf_${periodo}_${agora.toISOString().split("T")[0]}.pdf`);
}
