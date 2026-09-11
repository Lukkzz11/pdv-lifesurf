import { useState } from "react";
import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  setDoc
} from "firebase/firestore";

export default function Relatorio({ 
  vendas, 
  caixaAberto, 
  setCaixaAberto, 
  usuarioLogado, 
  cores, 
  ultimoFechamentoSalvo, 
  setUltimoFechamentoSalvo, 
  totalHistoricoConsolidado, 
  setTotalHistoricoConsolidado, 
  recarregarDados, 
  setDadosFechamentoPdf 
}) {
  const [modalAbrirCaixa, setModalAbrirCaixa] = useState(false);
  const [valorAberturaInput, setValorAberturaInput] = useState("0.00");

  async function handleAbrirCaixa(e) {
    e.preventDefault();
    const troco = parseFloat(valorAberturaInput) || 0;
    try {
      const hoje = new Date();
      const novoCaixaRef = await addDoc(collection(db, "caixas"), {
        abertoEm: serverTimestamp(),
        dataString: hoje.toLocaleDateString("pt-BR"),
        trocoInicial: troco,
        status: "aberto",
        abertoPor: usuarioLogado?.email || "operador"
      });
      setCaixaAberto({ 
        id: novoCaixaRef.id, 
        dataString: hoje.toLocaleDateString("pt-BR"), 
        trocoInicial: troco, 
        status: "aberto" 
      });
      setModalAbrirCaixa(false);
      alert("Caixa aberto com sucesso!");
    } catch (err) {
      alert("Erro ao abrir caixa: " + err.message);
    }
  }

  async function handleFecharCaixaEEmitirRelatorio() {
    if (!caixaAberto) {
      alert("Não há nenhum caixa aberto no momento!");
      return;
    }

    const vendasDoCaixa = vendas.filter(v => v.caixaId === caixaAberto.id || v.dataString === caixaAberto.dataString);
    const totalVendido = vendasDoCaixa.reduce((acc, v) => acc + Number(v.total || 0), 0);
    const pixTotal = vendasDoCaixa.filter(v => v.formaPagamento === "Pix").reduce((acc, v) => acc + Number(v.total || 0), 0);
    const debitoTotal = vendasDoCaixa.filter(v => v.formaPagamento === "Cartão de Débito").reduce((acc, v) => acc + Number(v.total || 0), 0);
    const creditoTotal = vendasDoCaixa.filter(v => v.formaPagamento?.includes("Crédito")).reduce((acc, v) => acc + Number(v.total || 0), 0);
    const dinheiroTotal = vendasDoCaixa.filter(v => v.formaPagamento === "Dinheiro").reduce((acc, v) => acc + Number(v.total || 0), 0);

    const dadosFechamento = {
      dataHoje: caixaAberto.dataString,
      horaFechamento: new Date().toLocaleTimeString("pt-BR"),
      trocoInicial: caixaAberto.trocoInicial || 0,
      qtdVendas: vendasDoCaixa.length,
      totalVendido,
      pixTotal,
      debitoTotal,
      creditoTotal,
      dinheiroTotal,
      fechadoPor: usuarioLogado?.email || "operador",
      vendas: vendasDoCaixa
    };

    await updateDoc(doc(db, "caixas", caixaAberto.id), {
      fechadoEm: serverTimestamp(),
      status: "fechado",
      ...dadosFechamento
    });

    setUltimoFechamentoSalvo(dadosFechamento);
    setDadosFechamentoPdf(dadosFechamento);
    setCaixaAberto(null);
    await recarregarDados();

    setTimeout(() => {
      window.print();
    }, 300);
  }

  function reemitirUltimoFechamento() {
    if (!ultimoFechamentoSalvo) {
      alert("Nenhum fechamento registrado para reimprimir!");
      return;
    }
    setDadosFechamentoPdf(ultimoFechamentoSalvo);
    setTimeout(() => {
      window.print();
    }, 300);
  }

  async function excluirVenda(id, valor) {
    if (!confirm(`Deseja realmente excluir a venda de R$ ${Number(valor).toFixed(2)}? O estoque não será alterado.`)) return;
    try {
      await deleteDoc(doc(db, "vendas", id));
      await recarregarDados();
      alert("Venda excluída.");
    } catch (err) {
      alert("Erro ao excluir venda: " + err.message);
    }
  }

  async function limparVendasAntigasMaisDe30Dias() {
    if (!confirm("Isso apagará as vendas com mais de 30 dias do histórico detalhado e guardará o valor total acumulado no Caixa Geral. Deseja continuar?")) return;

    const agora = new Date();
    const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const vendasParaLimpar = vendas.filter(v => {
      if (!v.data?.toDate) return false;
      return v.data.toDate() < trintaDiasAtras;
    });

    if (vendasParaLimpar.length === 0) {
      alert("Nenhuma venda tem mais de 30 dias para limpeza.");
      return;
    }

    const valorSoma = vendasParaLimpar.reduce((acc, v) => acc + Number(v.total || 0), 0);

    for (const v of vendasParaLimpar) {
      await deleteDoc(doc(db, "vendas", v.id));
    }

    const novoTotal = totalHistoricoConsolidado + valorSoma;
    await setDoc(doc(db, "configuracoes", "historicoConsolidado"), { totalAcumulado: novoTotal }, { merge: true });
    setTotalHistoricoConsolidado(novoTotal);

    await recarregarDados();
    alert(`Limpeza realizada! ${vendasParaLimpar.length} vendas consolidadas (+ R$ ${valorSoma.toFixed(2)}).`);
  }

  const vendasExibidas = caixaAberto
    ? vendas.filter(v => v.caixaId === caixaAberto.id || v.dataString === caixaAberto.dataString)
    : [];

  const totalFaturadoAtivo = vendasExibidas.reduce((acc, v) => acc + Number(v.total || 0), 0);
  const totalPix = vendasExibidas.filter(v => v.formaPagamento === "Pix").reduce((acc, v) => acc + Number(v.total || 0), 0);
  const totalCartao = vendasExibidas.filter(v => v.formaPagamento?.includes("Crédito") || v.formaPagamento?.includes("Débito")).reduce((acc, v) => acc + Number(v.total || 0), 0);
  const totalDinheiro = vendasExibidas.filter(v => v.formaPagamento === "Dinheiro").reduce((acc, v) => acc + Number(v.total || 0), 0);

  return (
    <div>
      {/* MODAL ABRIR CAIXA */}
      {modalAbrirCaixa && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "340px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0" }}>🟢 Abertura de Caixa</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px" }}>Informe o valor do fundo de troco inicial:</p>
            <form onSubmit={handleAbrirCaixa}>
              <input
                type="number"
                step="0.01"
                value={valorAberturaInput}
                onChange={(e) => setValorAberturaInput(e.target.value)}
                style={{ width: "100%", padding: "12px", fontSize: "20px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", marginBottom: "15px" }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setModalAbrirCaixa(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Confirmar Abertura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOPO RELATÓRIO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Fechamento & Movimento do Caixa</h2>
          <div style={{ color: cores.textoSecundario, fontSize: "13px", marginTop: "4px" }}>
            Status: {caixaAberto ? `Caixa Aberto (${caixaAberto.dataString}) | Fundo: R$ ${Number(caixaAberto.trocoInicial || 0).toFixed(2)}` : "Caixa FECHADO"}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {!caixaAberto ? (
            <button
              onClick={() => setModalAbrirCaixa(true)}
              style={{ background: "#007bff", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
            >
              🟢 Abrir Caixa do Dia
            </button>
          ) : (
            <button
              onClick={handleFecharCaixaEEmitirRelatorio}
              style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
            >
              🔴 Fechar Caixa & Baixar Relatório (PDF)
            </button>
          )}

          {ultimoFechamentoSalvo && (
            <button
              onClick={reemitirUltimoFechamento}
              style={{ background: "#ff9f43", color: "#000", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}
            >
              🔄 Reemitir Último Relatório (PDF)
            </button>
          )}

          <button
            onClick={limparVendasAntigasMaisDe30Dias}
            style={{ background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, padding: "10px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
          >
            🧹 Limpar Vendas (+30 dias)
          </button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px", marginBottom: "30px" }}>
        <div style={{ background: cores.bgCard, padding: "16px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
          <div style={{ color: cores.textoSecundario, fontSize: "12px" }}>VENDAS NESTE TURNO</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#28a745", marginTop: "5px" }}>R$ {totalFaturadoAtivo.toFixed(2)}</div>
          <div style={{ color: cores.textoSuave, fontSize: "12px", marginTop: "4px" }}>{vendasExibidas.length} vendas</div>
        </div>
        <div style={{ background: cores.bgCard, padding: "16px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
          <div style={{ color: cores.textoSecundario, fontSize: "12px" }}>PIX (TURNO)</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#00b4d8", marginTop: "5px" }}>R$ {totalPix.toFixed(2)}</div>
        </div>
        <div style={{ background: cores.bgCard, padding: "16px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
          <div style={{ color: cores.textoSecundario, fontSize: "12px" }}>CARTÃO (TURNO)</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#007bff", marginTop: "5px" }}>R$ {totalCartao.toFixed(2)}</div>
        </div>
        <div style={{ background: cores.bgCard, padding: "16px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
          <div style={{ color: cores.textoSecundario, fontSize: "12px" }}>DINHEIRO (TURNO)</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#d97706", marginTop: "5px" }}>R$ {totalDinheiro.toFixed(2)}</div>
        </div>
        <div style={{ background: cores.bgCard, padding: "16px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
          <div style={{ color: cores.textoSecundario, fontSize: "12px" }}>ACUMULADO CONSOLIDADO</div>
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#a55eea", marginTop: "5px" }}>R$ {totalHistoricoConsolidado.toFixed(2)}</div>
          <div style={{ color: cores.textoSuave, fontSize: "11px", marginTop: "4px" }}>Meses arquivados</div>
        </div>
      </div>

      <h2>Vendas do Caixa Atual ({vendasExibidas.length})</h2>
      {vendasExibidas.length === 0 ? (
        <p style={{ color: cores.textoSuave }}>
          {caixaAberto ? "Nenhuma venda registrada neste turno ainda." : "O caixa está fechado. Abra um caixa para registrar novas vendas."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", background: cores.bgCard, borderRadius: "8px", overflow: "hidden", border: `1px solid ${cores.borda}` }}>
            <thead>
              <tr style={{ background: cores.bgCardSecundario, borderBottom: `2px solid ${cores.borda}` }}>
                <th style={{ padding: "12px" }}>Hora</th>
                <th style={{ padding: "12px" }}>Modo</th>
                <th style={{ padding: "12px" }}>Itens Vendidos</th>
                <th style={{ padding: "12px" }}>Pagamento</th>
                <th style={{ padding: "12px" }}>Total</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {vendasExibidas.map((v) => {
                const dataFormatada = v.data?.toDate
                  ? v.data.toDate().toLocaleTimeString("pt-BR")
                  : "Recente";
                return (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${cores.borda}` }}>
                    <td style={{ padding: "12px", color: cores.textoSecundario, whiteSpace: "nowrap" }}>{dataFormatada}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "11px", padding: "3px 6px", borderRadius: "4px", background: v.tipoVenda === "atacado" ? "#007bff" : "#28a745", color: "#fff", fontWeight: "bold" }}>
                        {(v.tipoVenda || "varejo").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {v.itens?.map((it, idx) => (
                        <span key={idx} style={{ display: "inline-block", background: cores.bgCardSecundario, padding: "2px 8px", borderRadius: "4px", marginRight: "6px", fontSize: "12px", border: `1px solid ${cores.borda}` }}>
                          {it.quantidade}x {it.nome}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: "12px", color: cores.textoSecundario }}>{v.formaPagamento}</td>
                    <td style={{ padding: "12px", fontWeight: "bold", color: "#28a745" }}>
                      R$ {Number(v.total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <button
                        onClick={() => excluirVenda(v.id, v.total)}
                        style={{ background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px" }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}