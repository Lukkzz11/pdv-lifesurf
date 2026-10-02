import { formatCurrency, formatDate } from "../utils/formatters";

/**
 * SERVIÇO DE IMPRESSÃO DE CUPOM NÃO FISCAL (80mm TÉRMICO)
 * Compatível com impressoras térmicas ESC/POS (Epson, Elgin, Bematech, Daruma) via driver do Windows/Navegador.
 */

export function printThermalReceipt(receiptData, storeInfo = {}) {
  const printWindow = window.open("", "_blank", "width=380,height=600");
  if (!printWindow) {
    alert("Por favor, permita popups para imprimir o cupom.");
    return;
  }

  const itensHtml = (receiptData.itens || [])
    .map(
      (item) => `
      <tr>
        <td style="text-align: left; padding: 2px 0;">
          ${item.nome || "Produto"} ${item.tamanho ? `(${item.tamanho})` : ""}
          <br/>
          <small>${item.quantidade}x ${formatCurrency(item.precoUnitario || item.precoVarejo || 0)}</small>
        </td>
        <td style="text-align: right; vertical-align: bottom; padding: 2px 0;">
          ${formatCurrency((item.quantidade || 1) * (item.precoUnitario || item.precoVarejo || 0))}
        </td>
      </tr>
    `
    )
    .join("");

  const content = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Cupom Não Fiscal #${receiptData.numeroVenda || receiptData.id || "001"}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 72mm;
          margin: 0 auto;
          padding: 8px 0;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: #fff;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .header-title {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .badge-nao-fiscal {
          font-size: 10px;
          border: 1px solid #000;
          padding: 1px 4px;
          display: inline-block;
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      <div class="text-center">
        <img
          src="/assets/logo-black.png"
          alt="LifeSurf"
          style="max-height: 42px; max-width: 150px; margin: 0 auto 4px auto; display: block; filter: grayscale(100%) contrast(150%);"
          onerror="this.style.display='none'"
        />
        <div class="header-title">${storeInfo.nome || "LIFESURF SURFWEAR"}</div>
        <div>${storeInfo.cidade || "Fortaleza - CE"}</div>
        ${storeInfo.cnpj ? `<div>CNPJ: ${storeInfo.cnpj}</div>` : ""}
        ${storeInfo.telefone ? `<div>WhatsApp / Tel: ${storeInfo.telefone}</div>` : ""}
        <div class="badge-nao-fiscal bold">CUPOM NÃO FISCAL</div>
      </div>

      <div class="divider"></div>

      <div>
        <div><strong>Venda / Pedido:</strong> #${receiptData.numeroVenda || receiptData.id || "001"}</div>
        <div><strong>Data/Hora:</strong> ${formatDate(new Date())}</div>
        ${receiptData.operador ? `<div><strong>Operador:</strong> ${receiptData.operador}</div>` : ""}
        ${receiptData.cliente ? `<div><strong>Cliente:</strong> ${receiptData.cliente.nome || receiptData.cliente}</div>` : ""}
      </div>

      <div class="divider"></div>

      <div class="bold" style="margin-bottom: 4px;">ITENS DA VENDA</div>
      <table>
        <tbody>
          ${itensHtml}
        </tbody>
      </table>

      <div class="divider"></div>

      <table>
        <tbody>
          <tr>
            <td>Subtotal:</td>
            <td class="text-right">${formatCurrency(receiptData.subtotal || receiptData.total || 0)}</td>
          </tr>
          ${
            receiptData.desconto > 0
              ? `<tr>
                  <td>Desconto:</td>
                  <td class="text-right">- ${formatCurrency(receiptData.desconto)}</td>
                </tr>`
              : ""
          }
          <tr class="bold" style="font-size: 13px;">
            <td style="padding-top: 4px;">TOTAL A PAGAR:</td>
            <td class="text-right" style="padding-top: 4px;">${formatCurrency(receiptData.total || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div class="divider"></div>

      <div>
        <div><strong>Forma de Pagamento:</strong> ${(receiptData.formaPagamento || "Dinheiro").toUpperCase()}</div>
        ${
          receiptData.troco > 0
            ? `<div><strong>Recebido:</strong> ${formatCurrency(receiptData.valorEntregue || 0)}</div>
               <div class="bold"><strong>TROCO:</strong> ${formatCurrency(receiptData.troco)}</div>`
            : ""
        }
      </div>

      <div class="divider"></div>

      <div class="text-center" style="margin-top: 8px;">
        <div>${storeInfo.mensagemRodape || "OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!"}</div>
        <small style="color: #666; display: block; margin-top: 4px;">LifeSurf PDV v2 • Impresso em 80mm</small>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
}
