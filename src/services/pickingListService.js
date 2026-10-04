import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "../utils/formatters";
import { uploadPdfToGoogleDrive, isGoogleConnected } from "./googleApiService";

/**
 * SERVIÇO DE GERAÇÃO DE LISTA DE SEPARAÇÃO (PICKING LIST) EM PDF E BOBINA TÉRMICA 80MM
 * Otimizado para conferência física na expedição e estoque da confecção.
 */

/**
 * Gera e baixa o PDF oficial da Ordem de Separação (A4)
 * e opcionalmente salva no Google Drive da empresa (Free Tier)
 * @param {object} order - Dados do pedido
 * @param {object} storeInfo - Informações da empresa
 * @param {object} options - Opções ({ download, uploadDrive })
 */
export function generateOrderPickingListPDF(order, storeInfo = {}, options = {}) {
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
  doc.rect(0, 0, 210, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(storeInfo.nome || "LIFESURF CONFECÇÕES & SURFWEAR", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text("ORDEM DE SEPARAÇÃO E EXPEDIÇÃO DE MERCADORIAS (PICKING LIST)", 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Emissão: ${formatDate(agora)}`, 140, 18);

  // 2. Caixa de Identificação do Pedido & Cliente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 32, 182, 30, 2, 2, "FD");

  // Coluna 1: Dados do Pedido
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Nº do Pedido: ${order.numeroPedido || order.id || "SEM NÚMERO"}`, 18, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Origem: ${(order.origem || "Balcão").toUpperCase()}`, 18, 46);
  doc.text(`Status: ${(order.status || "Separado").toUpperCase()}`, 18, 52);
  doc.text(`Forma Pagto: ${(order.formaPagamento || "A Combinar").toUpperCase()}`, 18, 58);

  // Coluna 2: Dados do Cliente
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Dados para Separação / Envio:", 100, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Cliente: ${order.cliente?.nome || "Consumidor Final"}`, 100, 46);
  doc.text(`Contato: ${order.cliente?.telefone || "Não informado"}`, 100, 52);
  if (order.observacoes) {
    doc.text(`Obs: ${order.observacoes.slice(0, 50)}`, 100, 58);
  } else {
    doc.text("Expedição: Conferir todas as etiquetas e embalagens.", 100, 58);
  }

  // 3. Tabela de Peças a Separar
  const itens = order.itens || [];
  let totalPecas = 0;

  const tableBody = itens.map((item, index) => {
    const qtd = Number(item.quantidade) || 1;
    totalPecas += qtd;
    return [
      "[   ]", // Caixa de Checkbox para conferir à mão
      item.referencia || item.codigoBarras || `ITM-${index + 1}`,
      item.nome || "Produto Não Identificado",
      item.cor || "Padrão",
      item.tamanho || item.tamanhoEscolhido || "U",
      qtd.toString(),
      "______" // Campo para escrever a quantidade real conferida
    ];
  });

  autoTable(doc, {
    startY: 68,
    head: [["Conf.", "Ref / Cód", "Descrição da Peça / Produto", "Cor", "Tam.", "Qtd. Solicitada", "Qtd. Conferida"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left"
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 26, fontStyle: "bold" },
      2: { cellWidth: 70 },
      3: { cellWidth: 22 },
      4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 15, halign: "center" }
    }
  });

  // 4. Caixa de Totais da Separação
  const finalTableY = doc.lastAutoTable?.finalY || 120;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, finalTableY + 4, 182, 14, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL DE PEÇAS A CONFERIR: ${totalPecas} PEÇAS`, 20, finalTableY + 13);
  doc.text(`VALOR TOTAL DO PEDIDO: ${formatCurrency(order.total || 0)}`, 120, finalTableY + 13);

  // 5. Linhas de Assinatura e Conferência
  const signY = finalTableY + 38;
  if (signY < 275) {
    doc.setDrawColor(148, 163, 184);
    doc.line(18, signY, 95, signY);
    doc.line(115, signY, 192, signY);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Conferido e Separado por (Estoque/Expedição)", 20, signY + 5);
    doc.text("Retirado / Recebido por (Cliente/Entregador)", 120, signY + 5);

    doc.text(`Data e Hora da Conferência: ____/____/________  às  ____:____`, 18, signY + 15);
  }

  // Salva o PDF localmente
  const nomeArquivo = `Separacao_${order.numeroPedido || "pedido"}.pdf`;
  if (options.download !== false) {
    doc.save(nomeArquivo);
  }

  // Gera o Blob para upload no Google Drive
  const pdfBlob = doc.output("blob");
  let drivePromise = null;

  if (options.uploadDrive !== false && isGoogleConnected()) {
    drivePromise = uploadPdfToGoogleDrive({
      pdfBlob,
      fileName: nomeArquivo,
      folderName: "LifeSurf ERP - Listas de Separação",
      description: `Lista de separação e expedição do pedido ${order.numeroPedido || order.id} para o cliente ${order.cliente?.nome || "Consumidor"}`
    })
      .then((res) => {
        console.log("[pickingListService] Lista de separação salva no Google Drive:", res.webViewLink);
        return res;
      })
      .catch((err) => {
        console.warn("[pickingListService] Não foi possível salvar lista no Google Drive:", err.message);
        throw err;
      });
  }

  return { doc, blob: pdfBlob, fileName: nomeArquivo, drivePromise };
}

/**
 * Envia manualmente uma lista de separação de pedido para o Google Drive
 */
export async function uploadPickingListToGoogleDriveManual(order, storeInfo = {}) {
  const { blob, fileName } = generateOrderPickingListPDF(order, storeInfo, { download: false, uploadDrive: false });
  return await uploadPdfToGoogleDrive({
    pdfBlob: blob,
    fileName,
    folderName: "LifeSurf ERP - Listas de Separação",
    description: `Lista de separação do pedido ${order.numeroPedido || order.id}`
  });
}


/**
 * Dispara impressão direta para bobina térmica (80mm) de Ordem de Separação
 * @param {object} order - Dados do pedido
 * @param {object} storeInfo - Informações da empresa
 */
export function printThermalPickingList(order, storeInfo = {}) {
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para imprimir a lista de separação.");
    return;
  }

  const itens = order.itens || [];
  const totalPecas = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 1), 0);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Separação - ${order.numeroPedido || "Pedido"}</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 76mm;
          margin: 0 auto;
          padding: 8px 4px;
          color: #000;
          font-size: 11px;
          line-height: 1.3;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-top: 2px dashed #000;
          margin: 8px 0;
        }
        .item-row {
          margin-bottom: 5px;
        }
        .item-header {
          font-weight: bold;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        .checkbox-box {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 1px solid #000;
          margin-right: 4px;
          vertical-align: middle;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 25px;
          text-align: center;
          font-size: 9px;
          padding-top: 3px;
        }
      </style>
    </head>
    <body>
      <div class="text-center bold" style="font-size: 13px;">
        ${storeInfo.nome || "LIFESURF CONFECÇÕES"}
      </div>
      <div class="text-center bold" style="font-size: 11px; margin-top: 2px;">
        ORDEM DE SEPARAÇÃO (PICKING)
      </div>
      <div class="text-center" style="font-size: 9px;">
        ${new Date().toLocaleString("pt-BR")}
      </div>

      <div class="double-divider"></div>

      <div><span class="bold">PEDIDO:</span> ${order.numeroPedido || order.id}</div>
      <div><span class="bold">CLIENTE:</span> ${order.cliente?.nome || "Consumidor Final"}</div>
      <div><span class="bold">CONTATO:</span> ${order.cliente?.telefone || "Não informado"}</div>
      <div><span class="bold">ORIGEM:</span> ${(order.origem || "Balcão").toUpperCase()}</div>
      ${order.observacoes ? `<div><span class="bold">OBS:</span> ${order.observacoes}</div>` : ""}

      <div class="divider"></div>
      <div class="bold text-center">ITENS A CONFERIR:</div>
      <div class="divider"></div>

      ${itens
        .map(
          (it, idx) => `
        <div class="item-row">
          <div class="item-header">
            <span class="checkbox-box"></span>
            ${idx + 1}. ${it.nome || "Item"}
          </div>
          <div class="item-details" style="padding-left: 16px;">
            <span>Tam: <strong style="font-size: 11px;">${it.tamanho || "U"}</strong> | Cor: ${it.cor || "Padrão"}</span>
            <span class="bold" style="font-size: 11px;">QTD: ${it.quantidade || 1} un</span>
          </div>
        </div>
      `
        )
        .join("")}

      <div class="double-divider"></div>

      <div style="display: flex; justify-content: space-between;">
        <span class="bold">TOTAL DE PEÇAS:</span>
        <span class="bold" style="font-size: 13px;">${totalPecas} un</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 2px;">
        <span class="bold">VALOR DO PEDIDO:</span>
        <span class="bold">${formatCurrency(order.total || 0)}</span>
      </div>

      <div class="signature-line">
        Conferente / Estoque
      </div>

      <div class="signature-line" style="margin-top: 20px;">
        Assinatura do Recebedor
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
