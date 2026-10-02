import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "../utils/formatters";

/**
 * Gera e realiza o download do relatório oficial de Fechamento de Caixa em PDF
 *
 * @param {object} fechamentoData - Dados consolidados do turno de caixa
 * @param {object} storeInfo - Informações da empresa/loja (nome, cnpj, filial)
 */
export function generateCashierClosingPDF(fechamentoData, storeInfo = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [14, 165, 233]; // Sky 500

  // 1. Cabeçalho Corporativo
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(storeInfo.nome || "LIFESURF - SISTEMA PDV", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text("FECHAMENTO DE CAIXA DIÁRIO & CONSOLIDAÇÃO DE TURNO", 14, 18);

  const agora = new Date();
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Emitido em: ${formatDate(agora)}`, 140, 18);

  // 2. Metadados do Turno
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Turno / Operação:", 14, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Operador: ${fechamentoData.operador || "Caixa Geral"}`, 14, 42);
  doc.text(`Unidade: ${storeInfo.unidade || "Matriz"}`, 80, 42);
  doc.text(`Data do Turno: ${fechamentoData.dataTurno || agora.toLocaleDateString("pt-BR")}`, 140, 42);

  // 3. Resumo Financeiro Consolidado (Cards em Tabela)
  const resumoFinanceiro = [
    ["Fundo Inicial (Troco)", formatCurrency(fechamentoData.trocoInicial || 0)],
    ["Total em Dinheiro", formatCurrency(fechamentoData.dinheiro || 0)],
    ["Total em Pix", formatCurrency(fechamentoData.pix || 0)],
    ["Total em Cartão Débito", formatCurrency(fechamentoData.debito || 0)],
    ["Total em Cartão Crédito", formatCurrency(fechamentoData.credito || 0)],
    ["Total a Prazo / A Ver", formatCurrency(fechamentoData.prazo || 0)],
    ["Total Geral Vendido", formatCurrency(fechamentoData.totalVendido || 0)],
    ["Total Físico em Gaveta (Troco + Dinheiro)", formatCurrency((Number(fechamentoData.trocoInicial) || 0) + (Number(fechamentoData.dinheiro) || 0))]
  ];

  autoTable(doc, {
    startY: 48,
    head: [["Indicador Financeiro", "Valor Consolidado"]],
    body: resumoFinanceiro,
    theme: "striped",
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold"
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: "bold" },
      1: { cellWidth: 60, halign: "right" }
    }
  });

  // 4. Detalhamento de Vendas do Turno
  const vendas = fechamentoData.vendas || [];
  if (vendas.length > 0) {
    const vendasBody = vendas.map((v, i) => [
      `#${v.numeroVenda || i + 1}`,
      v.hora || "--:--",
      v.tipoVenda ? v.tipoVenda.toUpperCase() : "VAREJO",
      v.itensDescricao || `${v.itens?.length || 1} itens`,
      v.formaPagamento ? v.formaPagamento.toUpperCase() : "DINHEIRO",
      formatCurrency(v.total || 0)
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["ID", "Hora", "Modalidade", "Resumo de Itens", "Pagamento", "Total"]],
      body: vendasBody,
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5
      },
      columnStyles: {
        5: { halign: "right", fontStyle: "bold" }
      }
    });
  }

  // 5. Linhas de Assinatura
  const finalY = (doc.lastAutoTable?.finalY || 120) + 25;
  if (finalY < 270) {
    doc.setDrawColor(150, 150, 150);
    doc.line(20, finalY, 85, finalY);
    doc.line(125, finalY, 190, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Assinatura do Operador", 30, finalY + 5);
    doc.text("Assinatura do Gerente / Conferência", 130, finalY + 5);
  }

  // Salva o arquivo com nome descritivo
  const fileName = `Fechamento_Caixa_${agora.toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
