import { useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc, deleteDoc, setDoc, collection } from "firebase/firestore";

const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];

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
  setDadosFechamentoPdf,
  setDadosRecibo
}) {
  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaId = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");

  const [vendaEditando, setVendaEditando] = useState(null);
  const [novaFormaPagamento, setNovaFormaPagamento] = useState("");
  const [novoTipoVenda, setNovoTipoVenda] = useState("varejo");
  const [novosItens, setNovosItens] = useState([]);
  
  const [modalAbertura, setModalAbertura] = useState(false);
  const [trocoInicialInput, setTrocoInicialInput] = useState("0.00");
  const [abrindoCaixa, setAbrindoCaixa] = useState(false);

  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [processandoLimpeza, setProcessandoLimpeza] = useState(false);

  const inputStyle = {
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: `1px solid ${cores.borda}`,
    color: cores.texto,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "13px"
  };

  const vendasDoCaixaAtual = vendas.filter((v) => {
    if (!caixaAberto || !v.data) return false;
    const dataVenda = v.data.toDate ? v.data.toDate() : new Date(v.data);
    const dataCaixaAbertura = caixaAberto.abertoEm?.toDate ? caixaAberto.abertoEm.toDate() : new Date(caixaAberto.abertoEm || 0);
    return dataVenda >= dataCaixaAbertura;
  });

  let totalDinheiro = 0;
  let totalPix = 0;
  let totalCartao = 0;

  vendasDoCaixaAtual.forEach(v => {
    const valor = Number(v.total || 0);
    const pg = (v.formaPagamento || "").toLowerCase();
    if (pg.includes("dinheiro")) totalDinheiro += valor;
    else if (pg.includes("pix")) totalPix += valor;
    else if (pg.includes("cartão") || pg.includes("cartao") || pg.includes("débito") || pg.includes("crédito")) totalCartao += valor;
  });

  const somaTotalCaixa = totalDinheiro + totalPix + totalCartao;

  function abrirEdicaoVenda(v) {
    setVendaEditando(v);
    setNovaFormaPagamento(v.formaPagamento || "Dinheiro");
    setNovoTipoVenda(v.tipoVenda || "varejo");
    setNovosItens(v.itens ? [...v.itens] : []);
  }

  async function handleSalvarEdicaoVenda(e) {
    e.preventDefault();
    if (!vendaEditando) return;

    setSalvandoEdicao(true);
    try {
      const vendaRef = doc(db, "vendas", vendaEditando.id);
      const subtotalAtual = novosItens.reduce((acc, it) => acc + (Number(it.quantidade) * Number(it.precoUnitario)), 0);
      const diferencaNum = Number(vendaEditando.infoTroca?.valorDiferenca) || 0;
      const totalFinal = subtotalAtual + diferencaNum;

      const dadosAtualizados = {
        formaPagamento: novaFormaPagamento,
        tipoVenda: novoTipoVenda,
        itens: novosItens,
        subtotalBruto: subtotalAtual,
        total: totalFinal,
        editadoEm: new Date()
      };

      await updateDoc(vendaRef, dadosAtualizados);
      alert("Venda atualizada com sucesso!");
      setVendaEditando(null);
      await recarregarDados();
    } catch (err) {
      alert("Erro ao atualizar venda: " + err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleExcluirVenda(id) {
    if (!confirm("Tem certeza que deseja excluir esta venda permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "vendas", id));
      alert("Venda excluída com sucesso!");
      await recarregarDados();
    } catch (err) {
      alert("Erro ao excluir venda: " + err.message);
    }
  }

  function reimprimirCupom(venda) {
    if (setDadosRecibo) {
      const dataHoraStr = venda.data?.toDate ? venda.data.toDate().toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
      setDadosRecibo({
        id: venda.id.slice(-6).toUpperCase(),
        dataHora: dataHoraStr,
        itens: venda.itens || [],
        subtotalBruto: venda.subtotalBruto || venda.total,
        desconto: venda.desconto || 0,
        total: venda.total,
        formaPagamento: venda.formaPagamento,
        tipoVenda: venda.tipoVenda || "varejo",
        infoParcelas: venda.parcelas || null,
        infoDinheiro: venda.dadosDinheiro || null
      });
      setTimeout(() => {
        window.print();
      }, 300);
    }
  }

  async function handleAbrirCaixa(e) {
    e.preventDefault();
    setAbrindoCaixa(true);
    try {
      const dataHojeStr = new Date().toLocaleDateString("pt-BR");
      const novoCaixaRef = doc(collection(db, "caixas"));
      const dadosNovoCaixa = {
        lojaId,
        status: "aberto",
        abertoEm: new Date(),
        dataString: dataHojeStr,
        trocoInicial: Number(trocoInicialInput) || 0
      };

      await setDoc(novoCaixaRef, dadosNovoCaixa);
      setCaixaAberto({ id: novoCaixaRef.id, ...dadosNovoCaixa });
      setModalAbertura(false);
      setTrocoInicialInput("0.00");
      await recarregarDados();
      alert("Caixa aberto com sucesso!");
    } catch (err) {
      alert("Erro ao abrir caixa: " + err.message);
    } finally {
      setAbrindoCaixa(false);
    }
  }

  async function emitirFechamentoPdfEFecharCaixa() {
    if (!caixaAberto) {
      alert("Não há caixa aberto no momento!");
      return;
    }

    const agora = new Date();
    const dataHoje = caixaAberto?.dataString || agora.toLocaleDateString("pt-BR");
    const horaFechamento = agora.toLocaleTimeString("pt-BR");

    document.title = `vendas ${dataHoje.replace(/\//g, '-')}`;

    setDadosFechamentoPdf({
      dataHoje,
      horaFechamento,
      trocoInicial: caixaAberto?.trocoInicial || 0,
      qtdVendas: vendasDoCaixaAtual.length,
      dinheiroHoje: totalDinheiro,
      pixHoje: totalPix,
      debitoHoje: totalCartao,
      creditoHoje: 0,
      totalVendido: somaTotalCaixa,
      vendas: vendasDoCaixaAtual
    });

    try {
      const caixaRef = doc(db, "caixas", caixaAberto.id);
      await updateDoc(caixaRef, {
        status: "fechado",
        fechadoEm: agora,
        totalVendido: somaTotalCaixa,
        dinheiro: totalDinheiro,
        pix: totalPix,
        cartao: totalCartao
      });

      setCaixaAberto(null);
      await recarregarDados();
    } catch (err) {
      console.error("Erro ao fechar caixa no banco:", err);
    }

    setTimeout(() => {
      window.print();
    }, 300);
  }

  async function handleLimparVendasAntigas() {
    if (!confirm("Deseja arquivar e limpar do sistema as vendas com mais de 30 dias para liberar memória?")) return;
    setProcessandoLimpeza(true);
    try {
      const agora = new Date();
      const limite30Dias = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));

      let somaAntigas = 0;
      const vendasAntigas = vendas.filter(v => {
        const dataV = v.data?.toDate ? v.data.toDate() : new Date(v.data || 0);
        return dataV < limite30Dias;
      });

      for (let v of vendasAntigas) {
        somaAntigas += Number(v.total || 0);
        await deleteDoc(doc(db, "vendas", v.id));
      }

      const novoTotalConsolidado = totalHistoricoConsolidado + somaAntigas;
      await setDoc(doc(db, "configuracoes", `${lojaId}_historico`), {
        totalAcumulado: novoTotalConsolidado,
        atualizadoEm: new Date()
      }, { merge: true });

      setTotalHistoricoConsolidado(novoTotalConsolidado);
      alert(`Limpeza concluída! ${vendasAntigas.length} vendas antigas foram arquivadas com sucesso.`);
      await recarregarDados();
    } catch (err) {
      alert("Erro ao limpar vendas antigas: " + err.message);
    } finally {
      setProcessandoLimpeza(false);
    }
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <h2 style={{ color: cores.texto, marginTop: 0 }}>📊 Relatórios & Fechamento de Caixa</h2>

      <div style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "15px" }}>
          <h3 style={{ color: cores.texto, fontSize: "18px", margin: 0 }}>
            Caixa Atual ({caixaAberto ? caixaAberto.dataString : "Fechado"})
          </h3>
          
          <div>
            {!caixaAberto && (
              <button
                onClick={() => setModalAbertura(true)}
                style={{ background: "#28a745", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
              >
                🔓 Abrir Caixa
              </button>
            )}
          </div>
        </div>
        
        {caixaAberto ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px", marginBottom: "20px" }}>
              <div style={{ border: `1px solid ${cores.borda}`, padding: "15px", borderRadius: "8px" }}>
                <span style={{ fontSize: "12px", color: cores.textoSecundario }}>💵 Dinheiro</span>
                <h3 style={{ margin: "5px 0 0 0", color: "#38a169" }}>R$ {totalDinheiro.toFixed(2)}</h3>
              </div>
              <div style={{ border: `1px solid ${cores.borda}`, padding: "15px", borderRadius: "8px" }}>
                <span style={{ fontSize: "12px", color: cores.textoSecundario }}>💠 Pix</span>
                <h3 style={{ margin: "5px 0 0 0", color: "#00b4d8" }}>R$ {totalPix.toFixed(2)}</h3>
              </div>
              <div style={{ border: `1px solid ${cores.borda}`, padding: "15px", borderRadius: "8px" }}>
                <span style={{ fontSize: "12px", color: cores.textoSecundario }}>💳 Cartão</span>
                <h3 style={{ margin: "5px 0 0 0", color: "#3182ce" }}>R$ {totalCartao.toFixed(2)}</h3>
              </div>
              <div style={{ border: `2px solid #28a745`, padding: "15px", borderRadius: "8px" }}>
                <span style={{ fontSize: "12px", color: cores.textoSecundario, fontWeight: "bold" }}>💰 SOMA TOTAL DO CAIXA</span>
                <h3 style={{ margin: "5px 0 0 0", color: cores.texto, fontSize: "20px" }}>R$ {somaTotalCaixa.toFixed(2)}</h3>
              </div>
            </div>

            <div style={{ display: "flex", gap: "15px", marginBottom: "25px", flexWrap: "wrap" }}>
              <button 
                onClick={emitirFechamentoPdfEFecharCaixa}
                style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                🔒 Fechar Caixa & Imprimir / Salvar PDF
              </button>
            </div>

            <h4 style={{ color: cores.texto, fontSize: "16px", marginTop: "20px" }}>Vendas e Movimentos Registrados no Caixa Atual</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", background: "transparent" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.texto }}>
                    <th style={{ padding: "10px" }}>Hora</th>
                    <th style={{ padding: "10px" }}>Modo</th>
                    <th style={{ padding: "10px" }}>Itens / Observações</th>
                    <th style={{ padding: "10px" }}>Pagamento</th>
                    <th style={{ padding: "10px" }}>Total</th>
                    <th style={{ padding: "10px", textAlign: "center" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasDoCaixaAtual.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: "15px", textAlign: "center", color: cores.textoSecundario }}>
                        Nenhuma venda registrada neste turno ainda.
                      </td>
                    </tr>
                  ) : (
                    vendasDoCaixaAtual.map((v) => (
                      <tr key={v.id} style={{ borderBottom: `1px solid ${cores.borda}`, color: cores.texto }}>
                        <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                          {v.data?.toDate ? v.data.toDate().toLocaleTimeString("pt-BR") : "—"}
                        </td>
                        <td style={{ padding: "10px" }}>{(v.tipoVenda || "varejo").toUpperCase()}</td>
                        <td style={{ padding: "10px" }}>
                          {v.itens?.map((it, idx) => (
                            <span key={idx} style={{ display: "block", fontSize: "12px" }}>{it.quantidade}x {it.nome}</span>
                          ))}
                          {v.infoTroca?.itemTrocado && (
                            <div style={{ marginTop: "4px", fontSize: "11px", color: v.tipoVenda === "a_ver" ? "#8e44ad" : "#ff9f43", fontWeight: "bold" }}>
                              {v.tipoVenda === "a_ver" ? `📌 [A Ver] ${v.infoTroca.itemTrocado}` : `🔄 Troca: ${v.infoTroca.itemTrocado} | Dif: R$ ${Number(v.infoTroca.valorDiferenca || 0).toFixed(2)}${v.infoTroca.levouAlgoMais ? ` | Levou: ${v.infoTroca.levouAlgoMais}` : ""}`}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px" }}>{v.formaPagamento}</td>
                        <td style={{ padding: "10px", fontWeight: "bold", color: Number(v.total || 0) === 0 ? "#8e44ad" : cores.texto }}>
                          R$ {Number(v.total || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                            {v.tipoVenda !== "a_ver" && (
                              <button 
                                onClick={() => abrirEdicaoVenda(v)}
                                style={{ background: "#ffc107", color: "#000", border: "none", borderRadius: "4px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
                              >
                                Editar
                              </button>
                            )}
                            <button 
                              onClick={() => reimprimirCupom(v)}
                              style={{ background: "#6c757d", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
                            >
                              Reimprimir
                            </button>
                            <button 
                              onClick={() => handleExcluirVenda(v.id)}
                              style={{ background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: "20px", background: cores.bgCardSecundario, borderRadius: "8px", textAlign: "center" }}>
            <p style={{ color: cores.textoSecundario, marginBottom: "15px" }}>O caixa está fechado no momento.</p>
            <button
              onClick={() => setModalAbertura(true)}
              style={{ background: "#28a745", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
            >
              🔓 Abrir Caixa Agora
            </button>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${cores.borda}`, paddingTop: "25px", marginTop: "30px" }}>
        <h3 style={{ color: cores.texto, fontSize: "16px" }}>🗄️ Manutenção & Histórico (+30 Dias)</h3>
        <p style={{ color: cores.textoSecundario, fontSize: "13px", marginBottom: "15px" }}>
          Total acumulado em vendas arquivadas: <b>R$ {totalHistoricoConsolidado.toFixed(2)}</b>
        </p>
        <button
          onClick={handleLimparVendasAntigas}
          disabled={processandoLimpeza}
          style={{ background: "#6366f1", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}
        >
          {processandoLimpeza ? "Limpando e Arquivando..." : "🗑️ Limpar Vendas com Mais de 30 Dias (Otimizar Memória)"}
        </button>
      </div>

      {modalAbertura && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
            <h3 style={{ color: cores.texto, marginTop: 0 }}>🔓 Abertura de Caixa Diário</h3>
            <form onSubmit={handleAbrirCaixa}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Fundo de Troco Inicial (R$):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={trocoInicialInput} 
                  onChange={(e) => setTrocoInicialInput(e.target.value)} 
                  style={inputStyle} 
                  required 
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  type="submit" 
                  disabled={abrindoCaixa} 
                  style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                  {abrindoCaixa ? "Abrindo..." : "Confirmar Abertura"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setModalAbertura(false)} 
                  style={{ flex: 1, padding: "10px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {vendaEditando && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ color: cores.texto, marginTop: 0 }}>✏️ Editar Venda Atual</h3>
            
            <form onSubmit={handleSalvarEdicaoVenda}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Forma de Pagamento:</label>
                <select 
                  value={novaFormaPagamento} 
                  onChange={(e) => setNovaFormaPagamento(e.target.value)}
                  style={inputStyle}
                >
                  <option value="Dinheiro" style={{ background: cores.bgGeral }}>Dinheiro</option>
                  <option value="Pix" style={{ background: cores.bgGeral }}>Pix</option>
                  <option value="Cartão Débito" style={{ background: cores.bgGeral }}>Cartão Débito</option>
                  <option value="Cartão Crédito" style={{ background: cores.bgGeral }}>Cartão Crédito</option>
                  <option value="Troca" style={{ background: cores.bgGeral }}>Troca</option>
                  <option value="A Ver" style={{ background: cores.bgGeral }}>A Ver</option>
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Modo de Venda:</label>
                <select 
                  value={novoTipoVenda} 
                  onChange={(e) => setNovoTipoVenda(e.target.value)}
                  style={inputStyle}
                >
                  <option value="varejo" style={{ background: cores.bgGeral }}>Varejo</option>
                  <option value="atacado" style={{ background: cores.bgGeral }}>Atacado</option>
                  <option value="troca" style={{ background: cores.bgGeral }}>Troca</option>
                  <option value="a_ver" style={{ background: cores.bgGeral }}>A Ver</option>
                </select>
              </div>

              <h4 style={{ color: cores.texto, fontSize: "14px", marginBottom: "8px" }}>Itens Vendidos</h4>
              {novosItens.map((it, idx) => (
                <div key={idx} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ color: cores.texto, flex: 2, fontSize: "13px" }}>{it.nome}</span>
                  <input 
                    type="number" 
                    value={it.quantidade} 
                    min="1"
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const copia = [...novosItens];
                      copia[idx].quantidade = val;
                      setNovosItens(copia);
                    }}
                    style={{ ...inputStyle, flex: 1 }} 
                  />
                  <input 
                    type="number" 
                    step="0.01"
                    value={it.precoUnitario} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const copia = [...novosItens];
                      copia[idx].precoUnitario = val;
                      setNovosItens(copia);
                    }}
                    style={{ ...inputStyle, flex: 1 }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setNovosItens(novosItens.filter((_, i) => i !== idx))}
                    style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "8px", borderRadius: "4px", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button 
                  type="submit" 
                  disabled={salvandoEdicao}
                  style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                  {salvandoEdicao ? "Salvando..." : "Salvar Alterações"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setVendaEditando(null)}
                  style={{ flex: 1, padding: "10px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}