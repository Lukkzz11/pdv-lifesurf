import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "../utils/formatters";
import { uploadPdfToGoogleDrive, isGoogleConnected } from "./googleApiService";

/**
 * Gera e realiza o download do relatório oficial de Fechamento de Caixa em PDF
 * com layout executivo, moderno, limpo e coerente.
 *
 * @param {object} fechamentoData - Dados consolidados do turno de caixa
 * @param {object} storeInfo - Informações da empresa/loja (nome, cnpj, filial)
 * @param {object} options - Opções adicionais ({ download, uploadDrive })
 */
export function generateCashierClosingPDF(fechamentoData, storeInfo = {}, options = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const agora = new Date();
  const primaryNavy = [15, 23, 42];     // #0f172a Slate 900
  const brandSky = [2, 132, 199];       // #0284c7 Sky 600
  const emeraldGreen = [16, 185, 129];  // #10b981 Emerald 500
  const textDark = [30, 41, 59];        // #1e293b
  const textMuted = [100, 116, 139];    // #64748b

  // 1. Faixa Superior Executiva
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, 210, 26, "F");

  // Detalhe sutil colorido na borda inferior da faixa
  doc.setFillColor(...brandSky);
  doc.rect(0, 25, 210, 1.5, "F");

  // Nome da Empresa
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(storeInfo.nome || "LIFESURF CONFECÇÕES & SURFWEAR", 14, 11);

  // Subtítulo do Documento
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(186, 230, 253);
  doc.text("RELATÓRIO DE FECHAMENTO DE CAIXA • CONSOLIDAÇÃO DO TURNO", 14, 18);

  // Data / Hora de Emissão
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  const dataFormatada = fechamentoData.dataTurno || agora.toLocaleDateString("pt-BR");
  const horaFormatada = fechamentoData.horaFechamento || agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  doc.text(`Data: ${dataFormatada} às ${horaFormatada}`, 145, 18);

  // 2. Bloco de Identificação Operacional (Card limpo)
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(14, 32, 182, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text("Operador Responsável:", 18, 39);
  doc.text("Unidade / PDV:", 85, 39);
  doc.text("Status do Turno:", 145, 39);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text(fechamentoData.operador || "Caixa Geral", 18, 45);
  doc.text(storeInfo.unidade || "Matriz (Balcão)", 85, 45);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...emeraldGreen);
  doc.text("ENCERRADO & CONCILIADO", 145, 45);

  // 3. Quadros de Resumo Financeiro (Cards Executivos Lado a Lado)
  const troco = Number(fechamentoData.trocoInicial) || 0;
  const dinheiro = Number(fechamentoData.dinheiro) || 0;
  const pix = Number(fechamentoData.pix) || 0;
  const debito = Number(fechamentoData.debito) || 0;
  const credito = Number(fechamentoData.credito) || 0;
  const cartoesTotal = debito + credito;
  const prazo = Number(fechamentoData.prazo) || 0;
  const totalVendido = Number(fechamentoData.totalVendido || (dinheiro + pix + cartoesTotal + prazo));
  const dinheiroEmGaveta = troco + dinheiro;

  // Tabela 1: Resumo das Formas de Pagamento Recebidas
  const linhasRecebimentos = [
    ["Vendas em Dinheiro (Espécie)", formatCurrency(dinheiro)],
    ["Vendas no PIX", formatCurrency(pix)],
    ["Cartões de Débito", formatCurrency(debito)],
    ["Cartões de Crédito", formatCurrency(credito)],
    ["A Prazo / Crediário", formatCurrency(prazo)],
    ["TOTAL FATURADO NO TURNO", formatCurrency(totalVendido)]
  ];

  autoTable(doc, {
    startY: 55,
    margin: { left: 14, right: 14 },
    head: [["FORMA DE RECEBIMENTO", "VALOR TOTAL"]],
    body: linhasRecebimentos,
    theme: "striped",
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left"
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: textDark
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 62, halign: "right", fontStyle: "bold" }
    },
    didParseCell: (data) => {
      // Destaque na linha de total
      if (data.row.index === linhasRecebimentos.length - 1) {
        data.cell.styles.fillColor = [240, 253, 244]; // emerald-50
        data.cell.styles.textColor = [5, 150, 105];   // emerald-600
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  // Tabela 2: Conferência Física da Gaveta
  const linhasGaveta = [
    ["Fundo de Troco Inicial (Abertura)", formatCurrency(troco)],
    ["(+) Dinheiro Recebido nas Vendas", formatCurrency(dinheiro)],
    ["(=) TOTAL ESPERADO NA GAVETA (ESPÉCIE)", formatCurrency(dinheiroEmGaveta)]
  ];

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    margin: { left: 14, right: 14 },
    head: [["APURAÇÃO DA GAVETA DE DINHEIRO", "VALOR CONFERIDO"]],
    body: linhasGaveta,
    theme: "striped",
    headStyles: {
      fillColor: brandSky,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left"
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: textDark
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 62, halign: "right", fontStyle: "bold" }
    },
    didParseCell: (data) => {
      if (data.row.index === linhasGaveta.length - 1) {
        data.cell.styles.fillColor = [238, 242, 255];
        data.cell.styles.textColor = [30, 58, 138];
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  // 4. Detalhamento de Vendas do Turno (se houver)
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
      startY: doc.lastAutoTable.finalY + 8,
      margin: { left: 14, right: 14 },
      head: [["Nº", "Hora", "Tipo", "Itens da Venda", "Pagamento", "Total"]],
      body: vendasBody,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: textDark,
        fontSize: 7.5,
        fontStyle: "bold"
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: textDark,
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 16, fontStyle: "bold" },
        1: { cellWidth: 18 },
        2: { cellWidth: 20 },
        3: { cellWidth: 78 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25, halign: "right", fontStyle: "bold" }
      }
    });
  }

  // 5. Linhas de Assinatura
  const finalY = (doc.lastAutoTable?.finalY || 140) + 18;
  if (finalY < 270) {
    doc.setDrawColor(203, 213, 225); // #cbd5e1
    doc.line(25, finalY, 90, finalY);
    doc.line(120, finalY, 185, finalY);

    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text("Assinatura do Operador do Caixa", 34, finalY + 4);
    doc.text("Assinatura do Gerente / Conferência", 128, finalY + 4);
  }

  // 6. Rodapé do Documento
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento gerado automaticamente pelo Sistema LifeSurf ERP • Página 1 de 1`, 14, 290);

  // Salva o arquivo localmente
  const fileName = `Fechamento_Caixa_${dataFormatada.replace(/\//g, "-")}.pdf`;
  if (options.download !== false) {
    doc.save(fileName);
  }

  // Gera o Blob para upload em nuvem
  const pdfBlob = doc.output("blob");
  let driveResult = null;

  // Upload automático para a pasta segura no Google Drive se conectado
  if (options.uploadDrive !== false && isGoogleConnected()) {
    uploadPdfToGoogleDrive({
      pdfBlob,
      fileName,
      folderName: "LifeSurf ERP - Fechamentos de Caixa",
      description: `Relatório oficial de Fechamento de Caixa diário gerado em ${dataFormatada}`
    })
      .then((res) => {
        console.log("[pdfService] Fechamento de Caixa salvo no Google Drive com sucesso:", res.webViewLink);
      })
      .catch((err) => {
        console.warn("[pdfService] Não foi possível salvar o Fechamento no Google Drive:", err.message);
      });
  }

  return { doc, blob: pdfBlob, fileName, driveResult };
}


