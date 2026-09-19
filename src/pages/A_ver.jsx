import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  increment 
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FORMAS_PAGAMENTO = [
  "Pix",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Dinheiro"
];

const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];

export default function A_ver({ cores, usuarioLogado, voltarHome }) {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);

  // Estados para Modal de Detalhes / Histórico do Cliente
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [telefoneEdicao, setTelefoneEdicao] = useState("");
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);

  // Estado para Pagamento Parcial / Total
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [pedidoParaPagar, setPedidoParaPagar] = useState(null);
  const [valorParcialInput, setValorParcialInput] = useState("");
  const [formaPagamentoInput, setFormaPagamentoInput] = useState("Pix");
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Estado para controle isolado de impressão de recibo térmico
  const [reciboPagamentoLocal, setReciboPagamentoLocal] = useState(null);

  // Estado para Edição de Itens / Devolução parcial
  const [modalEdicaoItensAberto, setModalEdicaoItensAberto] = useState(false);
  const [pedidoParaEditar, setPedidoParaEditar] = useState(null);
  const [itensEditadosTemp, setItensEditadosTemp] = useState([]);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Estado para Limpeza de registros antigos
  const [processandoLimpeza, setProcessandoLimpeza] = useState(false);

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");
  const perfilStr = usuarioLogado?.email ? `@${usuarioLogado.email.split('@')[0]}` : "@sistema";

  const carregarPedidosAVer = useCallback(async () => {
    if (carregandoDados) return;
    setCarregandoDados(true);
    try {
      const snap = await getDocs(collection(db, "pedidos"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.tipo === "mercadoria_a_ver" && (!p.lojaId || p.lojaId === lojaIdAtual));
      
      // Log de depuração solicitado
      console.log("Pedidos carregados na A_Ver:", lista);
      console.log("lojaId usado na A_Ver:", lojaIdAtual);

      setPedidos(lista);
    } catch (err) {
      console.error("Erro ao carregar mercadorias a ver:", err);
    } finally {
      setCarregando(false);
      setCarregandoDados(false);
    }
  }, [lojaIdAtual, carregandoDados]);

  useEffect(() => {
    carregarPedidosAVer();
  }, [carregarPedidosAVer]);

  // Fechamento de modais via tecla ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setModalPagamentoAberto(false);
        setModalEdicaoItensAberto(false);
        setModalClienteAberto(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Agrupamento inteligente por cliente
  const clientesAgrupados = useMemo(() => {
    const mapa = {};
    pedidos.forEach(p => {
      const nomeCli = (p.cliente || "Desconhecido").trim();
      if (!mapa[nomeCli]) {
        mapa[nomeCli] = {
          cliente: nomeCli,
          telefone: p.telefone || "",
          isJarbasOuLucas: !!p.isJarbasOuLucas,
          pedidos: []
        };
      }
      mapa[nomeCli].pedidos.push(p);
      if (p.telefone && !mapa[nomeCli].telefone) {
        mapa[nomeCli].telefone = p.telefone;
      }
    });

    return Object.values(mapa).map(cli => {
      let totalDevido = 0;
      let totalPagoCli = 0;
      cli.pedidos.forEach(p => {
        const valTotal = Number(p.valorTotalMercadoria) || 0;
        const valPago = Number(p.valorPago) || 0;
        if (p.status !== "pago" && p.status !== "devolvido" && !cli.isJarbasOuLucas) {
          totalDevido += Math.max(0, valTotal - valPago);
        }
        if (p.status === "pago") {
          totalPagoCli += valTotal;
        }
      });
      return { ...cli, totalDevido, totalPagoCli };
    });
  }, [pedidos]);

  // Pagamento Parcial ou Total com Geração de Recibo Térmico Isolado
  async function confirmarPagamentoParcial(e) {
    e.preventDefault();
    if (!pedidoParaPagar || processandoPagamento) return;
    
    const valorPagoAgora = parseFloat(valorParcialInput);
    if (isNaN(valorPagoAgora) || valorPagoAgora <= 0) {
      alert("Informe um valor válido!");
      return;
    }

    const valorTotal = Number(pedidoParaPagar.valorTotalMercadoria) || 0;
    const jaPago = Number(pedidoParaPagar.valorPago) || 0;
    const restanteAtual = Math.max(0, valorTotal - jaPago);

    if (valorPagoAgora > restanteAtual) {
      alert(`O valor informado excede o saldo restante devido (R$ ${restanteAtual.toFixed(2)})!`);
      return;
    }

    const novoTotalPago = jaPago + valorPagoAgora;
    const novoStatus = novoTotalPago >= valorTotal ? "pago" : "pendente_prova";

    setProcessandoPagamento(true);
    try {
      await updateDoc(doc(db, "pedidos", pedidoParaPagar.id), {
        valorPago: novoTotalPago,
        status: novoStatus,
        formaPagamento: formaPagamentoInput
      });

      const reciboInfo = {
        cliente: pedidoParaPagar.cliente,
        dataHora: new Date().toLocaleString("pt-BR"),
        valorPagoAgora: valorPagoAgora,
        valorTotal: valorTotal,
        restante: Math.max(0, valorTotal - novoTotalPago),
        status: novoStatus === "pago" ? "QUITADO" : "PAGAMENTO PARCIAL",
        itens: pedidoParaPagar.itensDescricao,
        formaPagamento: formaPagamentoInput
      };

      document.title = `recibo_pagamento_${pedidoParaPagar.cliente.replace(/\s+/g, '_')}`;
      setReciboPagamentoLocal(reciboInfo);
      setModalPagamentoAberto(false);
      setPedidoParaPagar(null);
      setValorParcialInput("");
      await carregarPedidosAVer();

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setReciboPagamentoLocal(null);
        }, 500);
      }, 300);

    } catch (err) {
      alert("Erro ao registrar pagamento: " + err.message);
    } finally {
      setProcessandoPagamento(false);
    }
  }

  function imprimirReciboHistorico(p) {
    const totalP = Number(p.valorTotalMercadoria) || 0;
    const pagoP = Number(p.valorPago) || 0;
    const devendoP = Math.max(0, totalP - pagoP);

    const reciboInfo = {
      cliente: p.cliente,
      dataHora: new Date().toLocaleString("pt-BR"),
      valorPagoAgora: pagoP > 0 ? pagoP : totalP,
      valorTotal: totalP,
      restante: devendoP,
      status: p.status === "pago" ? "QUITADO" : "PENDENTE",
      itens: p.itensDescricao,
      formaPagamento: p.formaPagamento || "Pix"
    };

    document.title = `recibo_pagamento_${p.cliente.replace(/\s+/g, '_')}`;
    setReciboPagamentoLocal(reciboInfo);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setReciboPagamentoLocal(null);
      }, 500);
    }, 300);
  }

  // Relatório Geral em PDF Corporativo Profissional
  function baixarRelatorioGeral() {
    try {
      const docPdf = new jsPDF("portrait", "mm", "a4");
      const dataHoraEmissao = new Date().toLocaleString("pt-BR");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(16);
      docPdf.setTextColor(30, 30, 30);
      docPdf.text("MERCADORIAS A VER / PROVA", 14, 20);

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9.5);
      docPdf.setTextColor(100, 100, 100);
      docPdf.text("Relatório geral de clientes e mercadorias pendentes", 14, 26);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(9);
      docPdf.setTextColor(50, 50, 50);
      docPdf.text(`Data de emissão: ${dataHoraEmissao}`, 196, 20, { align: "right" });
      docPdf.text(`Responsável: ${perfilStr}`, 196, 25, { align: "right" });

      docPdf.setDrawColor(200, 200, 200);
      docPdf.setLineWidth(0.4);
      docPdf.line(14, 30, 196, 30);

      const totalGeralDevidoCalc = clientesAgrupados.reduce((acc, c) => acc + c.totalDevido, 0);

      // Caixa de Resumo
      docPdf.setFillColor(245, 245, 245);
      docPdf.setDrawColor(210, 210, 210);
      docPdf.roundedRect(14, 35, 182, 16, 1, 1, "FD");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(8);
      docPdf.setTextColor(100, 100, 100);
      docPdf.text("QUANTIDADE DE CLIENTES", 18, 41);
      docPdf.text("TOTAL GERAL DEVIDO", 120, 41);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(11);
      docPdf.setTextColor(30, 30, 30);
      docPdf.text(`${clientesAgrupados.length}`, 18, 48);
      docPdf.text(`R$ ${totalGeralDevidoCalc.toFixed(2)}`, 120, 48);

      const tableColumn = ["Cliente", "Telefone", "Total Devido (R$)"];
      const tableRows = clientesAgrupados.map(c => [
        c.cliente + (c.isJarbasOuLucas ? " (Sócio)" : ""),
        c.telefone || "—",
        c.isJarbasOuLucas ? "R$ 0,00 (Isento)" : `R$ ${c.totalDevido.toFixed(2)}`
      ]);

      autoTable(docPdf, {
        startY: 56,
        head: [tableColumn],
        body: tableRows,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 4,
          textColor: [40, 40, 40],
          lineColor: [210, 210, 210],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [60, 60, 60],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left"
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 50 },
          2: { cellWidth: 42, halign: "right" }
        },
        didDrawPage: (data) => {
          const pageCount = docPdf.internal.getNumberOfPages();
          docPdf.setFont("helvetica", "normal");
          docPdf.setFontSize(8);
          docPdf.setTextColor(100, 100, 100);
          
          const footerText = `Relatório de Mercadorias A Ver  |  Responsável: ${perfilStr}  |  Página ${data.pageNumber} de ${pageCount}`;
          docPdf.text(footerText, 14, 290);

          docPdf.setDrawColor(210, 210, 210);
          docPdf.setLineWidth(0.4);
          docPdf.line(14, 286, 196, 286);
        },
        margin: { top: 56, right: 14, bottom: 20, left: 14 }
      });

      docPdf.save(`relatorio-mercadorias-a-ver-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      alert("Erro ao gerar relatório PDF: " + err.message);
    }
  }

  // Excluir um registro específico com segurança
  async function excluirRegistro(id) {
    if (!confirm("Tem certeza que deseja excluir este registro permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "pedidos", id));
      alert("Registro excluído com sucesso!");
      await carregarPedidosAVer();
    } catch (err) {
      alert("Erro ao excluir registro: " + err.message);
    }
  }

  // Devolução ou ajuste de itens específicos com validações estritas de estoque
  async function salvarEdicaoItens() {
    if (!pedidoParaEditar || salvandoEdicao) return;
    
    for (let i = 0; i < pedidoParaEditar.itens.length; i++) {
      const itemAntigo = pedidoParaEditar.itens[i];
      const itemNovo = itensEditadosTemp[i];
      if (itemNovo.quantidade > itemAntigo.quantidade) {
        alert(`A quantidade nova para "${itemNovo.nome}" não pode ser maior que a registrada inicialmente (${itemAntigo.quantidade}). Para novas vendas, utilize o PDV principal.`);
        return;
      }
      if (itemNovo.quantidade < 0) {
        alert("A quantidade não pode ser negativa.");
        return;
      }
    }

    if (!confirm("Confirmar alteração dos itens? O estoque será recalculado proporcionalmente.")) return;

    setSalvandoEdicao(true);
    try {
      for (let i = 0; i < pedidoParaEditar.itens.length; i++) {
        const itemAntigo = pedidoParaEditar.itens[i];
        const itemNovo = itensEditadosTemp[i];
        const diffQtd = itemAntigo.quantidade - itemNovo.quantidade;

        if (diffQtd !== 0) {
          const prodRef = doc(db, "produtos", itemAntigo.id);
          await updateDoc(prodRef, {
            estoque: increment(diffQtd)
          });
        }
      }

      const novoValorTotal = itensEditadosTemp.reduce((acc, it) => acc + (it.quantidade * it.precoUnitario), 0);
      const descricoesNovas = itensEditadosTemp.filter(i => i.quantidade > 0).map(i => `${i.quantidade}x ${i.nome} ${i.tamanhoSelecionado ? `(${i.tamanhoSelecionado})` : ""}`).join("; ");

      await updateDoc(doc(db, "pedidos", pedidoParaEditar.id), {
        itens: itensEditadosTemp.filter(i => i.quantidade > 0),
        valorTotalMercadoria: novoValorTotal,
        itensDescricao: descricoesNovas,
        status: novoValorTotal === 0 ? "devolvido" : pedidoParaEditar.status
      });

      alert("Itens atualizados e estoque ajustado com sucesso!");
      setModalEdicaoItensAberto(false);
      setPedidoParaEditar(null);
      await carregarPedidosAVer();
    } catch (err) {
      alert("Erro ao atualizar itens: " + err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function salvarDadosCliente(nomeCli) {
    if (salvandoTelefone) return;
    setSalvandoTelefone(true);
    try {
      const clienteObj = clientesAgrupados.find(c => c.cliente === nomeCli);
      if (!clienteObj) return;

      for (const p of clienteObj.pedidos) {
        await updateDoc(doc(db, "pedidos", p.id), { telefone: telefoneEdicao });
      }
      alert("Telefone atualizado com sucesso!");
      await carregarPedidosAVer();
    } catch (err) {
      alert("Erro ao atualizar dados: " + err.message);
    } finally {
      setSalvandoTelefone(false);
    }
  }

  async function handleLimparRegistrosAntigos() {
    if (!confirm("⚠️ ATENÇÃO: Deseja apagar registros de mercadorias a ver com mais de 30 dias que já estejam pagos ou devolvidos? RECOMENDAÇÃO: Baixe o relatório geral antes de prosseguir!")) return;
    if (processandoLimpeza) return;

    setProcessandoLimpeza(true);
    try {
      const agora = new Date();
      const limite30Dias = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));

      let apagados = 0;
      for (const p of pedidos) {
        const dataP = p.data?.toDate ? p.data.toDate() : new Date(p.data || 0);
        if (dataP < limite30Dias && (p.status === "pago" || p.status === "devolvido")) {
          await deleteDoc(doc(db, "pedidos", p.id));
          apagados++;
        }
      }
      alert(`Limpeza concluída! ${apagados} registros antigos finalizados foram removidos.`);
      await carregarPedidosAVer();
    } catch (err) {
      alert("Erro ao limpar registros: " + err.message);
    } finally {
      setProcessandoLimpeza(false);
    }
  }

  const totalGeralDevido = clientesAgrupados.reduce((acc, c) => acc + c.totalDevido, 0);

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "20px", boxSizing: "border-box", background: cores.bgGeral, color: cores.texto, fontFamily: "sans-serif" }}>
      
      <style>{`
        @media print {
          body * { visibility: hidden !important; }

          /* MODO RECIBO DE PAGAMENTO (80mm) */
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          .print-recibo-pagamento, .print-recibo-pagamento * { visibility: visible !important; }
          .print-recibo-pagamento {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            background: #fff !important;
            color: #000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
            font-weight: bold !important;
            padding: 3mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
        }
        @media screen {
          .print-recibo-pagamento { display: none; }
        }
      `}</style>

      {/* MOLDE DO RECIBO DE PAGAMENTO (80mm) */}
      {reciboPagamentoLocal && (
        <div className="print-recibo-pagamento" style={{ color: "#000", background: "#fff", fontWeight: "bold" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>LIFE SURF</h2>
            <p style={{ margin: "2px 0", fontSize: "12px" }}>COMPROVANTE DE PAGAMENTO</p>
            <p style={{ margin: "2px 0", fontSize: "11px" }}>Cliente: {reciboPagamentoLocal.cliente}</p>
            <p style={{ margin: "2px 0", fontSize: "11px" }}>Data: {reciboPagamentoLocal.dataHora}</p>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ fontSize: "11px", marginBottom: "6px" }}>
            <strong>Itens/Produtos:</strong> {reciboPagamentoLocal.itens}
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Valor Total:</span>
            <span>R$ {reciboPagamentoLocal.valorTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>Valor Pago:</span>
            <span>R$ {reciboPagamentoLocal.valorPagoAgora.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>
            <span>SALDO RESTANTE:</span>
            <span>R$ {reciboPagamentoLocal.restante.toFixed(2)}</span>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ textAlign: "center", fontSize: "12px" }}>
            <p style={{ margin: "2px 0" }}>Forma: {reciboPagamentoLocal.formaPagamento}</p>
            <p style={{ margin: "2px 0" }}>Status: {reciboPagamentoLocal.status}</p>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ textAlign: "center", fontSize: "10px", marginTop: "8px" }}>
            OBRIGADO! VOLTE SEMPRE!
          </div>
        </div>
      )}

      {/* TELA NORMAL */}
      <div className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px" }}>🛍️ Controle de Mercadorias A Ver / Prova</h1>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>Clique no nome do cliente para ver o histórico, registrar pagamentos e emitir recibos térmicos.</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={baixarRelatorioGeral} style={{ background: "#17a2b8", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              🖨️ Baixar Relação Geral (PDF)
            </button>
            <button onClick={handleLimparRegistrosAntigos} disabled={processandoLimpeza} style={{ background: "#6366f1", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", opacity: processandoLimpeza ? 0.7 : 1 }}>
              {processandoLimpeza ? "Limpando..." : "🗑️ Limpar Antigos (+30 Dias)"}
            </button>
            {voltarHome && (
              <button onClick={voltarHome} style={{ background: "#6c757d", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
                🏠 Início
              </button>
            )}
          </div>
        </div>

        {/* CARDS DE RESUMO FINANCEIRO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <div style={{ background: cores.bgCard, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>⏳ Total Geral Devido na Loja:</span>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#e67e22", marginTop: "5px" }}>R$ {totalGeralDevido.toFixed(2)}</div>
          </div>
        </div>

        <h3 style={{ marginBottom: "15px", fontSize: "16px" }}>Clientes com Mercadorias Retiradas</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "600px" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.textoSecundario, fontSize: "12px" }}>
                <th style={{ padding: "12px" }}>Cliente / Responsável</th>
                <th style={{ padding: "12px" }}>Telefone</th>
                <th style={{ padding: "12px" }}>Qtd Registros Ativos</th>
                <th style={{ padding: "12px" }}>Total Devido</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Ação / Perfil</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan="5" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>Carregando registros...</td></tr>
              ) : clientesAgrupados.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>Nenhuma mercadoria a ver registrada.</td></tr>
              ) : (
                clientesAgrupados.map((cli, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${cores.borda}`, fontSize: "13px" }}>
                    <td style={{ padding: "12px", fontWeight: "bold" }}>
                      <span onClick={() => { setClienteSelecionado(cli.cliente); setTelefoneEdicao(cli.telefone || ""); setModalClienteAberto(true); }} style={{ color: "#007bff", cursor: "pointer", textDecoration: "underline" }}>
                        {cli.cliente}
                      </span>
                      {cli.isJarbasOuLucas && <span style={{ marginLeft: "8px", fontSize: "10px", background: "#8e44ad", color: "#fff", padding: "2px 6px", borderRadius: "3px" }}>Sócio (Isento)</span>}
                    </td>
                    <td style={{ padding: "12px", color: cores.textoSecundario }}>{cli.telefone || "Não cadastrado"}</td>
                    <td style={{ padding: "12px" }}>{cli.pedidos.filter(p => p.status !== "pago" && p.status !== "devolvido").length} pendentes</td>
                    <td style={{ padding: "12px", fontWeight: "bold", color: cli.isJarbasOuLucas ? "#8e44ad" : "#e67e22" }}>
                      {cli.isJarbasOuLucas ? "R$ 0,00 (Sócio)" : `R$ ${cli.totalDevido.toFixed(2)}`}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <button onClick={() => { setClienteSelecionado(cli.cliente); setTelefoneEdicao(cli.telefone || ""); setModalClienteAberto(true); }} style={{ background: "#007bff", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
                        📂 Abrir Perfil & Histórico
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE PERFIL E HISTÓRICO DO CLIENTE */}
      {modalClienteAberto && clienteSelecionado && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${cores.borda}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "12px", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", color: cores.texto }}>👤 Perfil de: {clienteSelecionado}</h2>
              <button onClick={() => setModalClienteAberto(false)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>✕ Fechar</button>
            </div>

            {/* Edição de Telefone */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center", background: cores.bgCardSecundario, padding: "12px", borderRadius: "8px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "11px", color: cores.textoSecundario, marginBottom: "3px" }}>Telefone de Contato:</label>
                <input type="text" placeholder="(00) 00000-0000" value={telefoneEdicao} onChange={e => setTelefoneEdicao(e.target.value)} style={{ width: "100%", padding: "8px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => salvarDadosCliente(clienteSelecionado)} disabled={salvandoTelefone} style={{ marginTop: "17px", background: "#28a745", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", opacity: salvandoTelefone ? 0.7 : 1 }}>{salvandoTelefone ? "Salvando..." : "Salvar Tel"}</button>
            </div>

            <h4 style={{ marginBottom: "10px", fontSize: "15px", color: cores.texto }}>📅 Histórico de Retiradas</h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {pedidos.filter(p => p.cliente === clienteSelecionado).map(p => {
                const totalP = Number(p.valorTotalMercadoria) || 0;
                const pagoP = Number(p.valorPago) || 0;
                const devendoP = Math.max(0, totalP - pagoP);

                return (
                  <div key={p.id} style={{ background: cores.bgCardSecundario, padding: "14px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px", color: cores.textoSecundario }}>
                      <span>Data: <strong style={{ color: cores.texto }}>{p.dataRetirada || "—"}</strong></span>
                      <span>Status: <strong style={{ color: p.status === "pago" ? "#28a745" : "#e67e22" }}>{p.status?.toUpperCase() || "PENDENTE"}</strong></span>
                    </div>
                    <div style={{ fontSize: "13px", marginBottom: "8px", color: cores.texto }}>
                      <strong>Itens:</strong> {p.itensDescricao} {p.observacao ? `| Obs: ${p.observacao}` : ""}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", borderTop: `1px solid ${cores.borda}`, paddingTop: "8px", flexWrap: "wrap", gap: "8px", color: cores.texto }}>
                      <div>
                        Total: <strong style={{ color: cores.texto }}>R$ {totalP.toFixed(2)}</strong> | Pago: <strong style={{ color: "#28a745" }}>R$ {pagoP.toFixed(2)}</strong> | Resta: <strong style={{ color: "#e53e3e" }}>R$ {devendoP.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={() => imprimirReciboHistorico(p)} style={{ background: "#17a2b8", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>🖨️ Recibo</button>
                        <button onClick={() => excluirRegistro(p.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>🗑️ Excluir</button>
                        {p.status !== "pago" && p.status !== "devolvido" && (
                          <>
                            <button onClick={() => { setPedidoParaPagar(p); setValorParcialInput(devendoP.toFixed(2)); setModalPagamentoAberto(true); }} style={{ background: "#28a745", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>💲 Pagar</button>
                            <button onClick={() => { setPedidoParaEditar(p); setItensEditadosTemp(p.itens ? JSON.parse(JSON.stringify(p.itens)) : []); setModalEdicaoItensAberto(true); }} style={{ background: "#ffc107", color: "#000", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>✏️ Editar/Devolver</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO PARCIAL */}
      {modalPagamentoAberto && pedidoParaPagar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "20px", borderRadius: "10px", width: "100%", maxWidth: "360px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>💲 Registrar Pagamento / Acerto</h3>
            <form onSubmit={confirmarPagamentoParcial}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Valor Pago Agora (R$):</label>
                <input type="number" step="0.01" value={valorParcialInput} onChange={e => setValorParcialInput(e.target.value)} style={{ width: "100%", padding: "12px", fontSize: "18px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `2px solid #28a745`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", outline: "none" }} autoFocus required />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Forma de Pagamento:</label>
                <select value={formaPagamentoInput} onChange={e => setFormaPagamentoInput(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}>
                  {FORMAS_PAGAMENTO.map(fp => (
                    <option key={fp} value={fp} style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>{fp}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => setModalPagamentoAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" disabled={processandoPagamento} style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", opacity: processandoPagamento ? 0.7 : 1 }}>{processandoPagamento ? "Processando..." : "Confirmar e Emitir Recibo"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE ITENS (DEVOLUÇÃO PARCIAL) */}
      {modalEdicaoItensAberto && pedidoParaEditar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "20px", borderRadius: "10px", width: "100%", maxWidth: "455px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>🔄 Ajustar Quantidade / Devolver Peças</h3>
            <p style={{ fontSize: "11px", color: cores.textoSecundario, marginBottom: "15px" }}>Reduza a quantidade das peças que o cliente devolveu. O estoque será reposto automaticamente.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", maxHeight: "40vh", overflowY: "auto" }}>
              {itensEditadosTemp.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCardSecundario, padding: "10px", borderRadius: "6px" }}>
                  <div>
                    <strong style={{ fontSize: "13px", display: "block", color: cores.texto }}>{it.nome} {it.tamanhoSelecionado ? `[${it.tamanhoSelecionado}]` : ""}</strong>
                    <span style={{ fontSize: "11px", color: cores.textoSecundario }}>Preço: R$ {Number(it.precoUnitario).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "11px", color: cores.textoSecundario }}>Qtd:</label>
                    <input type="number" min="0" value={it.quantidade} onChange={e => {
                      const novaQtd = parseInt(e.target.value) || 0;
                      const copia = [...itensEditadosTemp];
                      copia[idx].quantidade = novaQtd;
                      setItensEditadosTemp(copia);
                    }} style={{ width: "55px", padding: "6px", textAlign: "center", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "4px", fontWeight: "bold" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={() => setModalEdicaoItensAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={salvarEdicaoItens} disabled={salvandoEdicao} style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", opacity: salvandoEdicao ? 0.7 : 1 }}>{salvandoEdicao ? "Salvando..." : "Salvar e Atualizar Estoque"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}