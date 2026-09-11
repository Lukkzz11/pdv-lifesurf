import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where, 
  getDoc 
} from "firebase/firestore";

// Páginas Modularizadas
import Login from "./pages/Login";
import Pdv from "./pages/Pdv";
import Estoque from "./pages/Estoque";
import Relatorio from "./pages/Relatorio";

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [verificandoAuth, setVerificandoAuth] = useState(true);

  const [abaAtiva, setAbaAtiva] = useState("pdv");
  const [tema, setTema] = useState(() => localStorage.getItem("tema_lifesurf") || "dark");
  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [caixaAberto, setCaixaAberto] = useState(null);
  const [ultimoFechamentoSalvo, setUltimoFechamentoSalvo] = useState(null);
  const [totalHistoricoConsolidado, setTotalHistoricoConsolidado] = useState(0);

  // Estados de Impressão Global
  const [dadosRecibo, setDadosRecibo] = useState(null);
  const [dadosFechamentoPdf, setDadosFechamentoPdf] = useState(null);
  const [dadosRelatorioProdutosPdf, setDadosRelatorioProdutosPdf] = useState(false);

  // Escuta autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuarioLogado(user);
      setVerificandoAuth(false);
    });
    return () => unsubscribe();
  }, []);

  function alternarTema() {
    const novo = tema === "dark" ? "light" : "dark";
    setTema(novo);
    localStorage.setItem("tema_lifesurf", novo);
  }

  async function handleLogout() {
    if (confirm("Deseja sair do sistema?")) {
      await signOut(auth);
    }
  }

  const cores = tema === "dark" ? {
    bgGeral: "#121212",
    bgCard: "#1c1c1c",
    bgCardSecundario: "#252525",
    bgItem: "#1e1e1e",
    borda: "#333333",
    bordaClara: "#444444",
    texto: "#ffffff",
    textoSecundario: "#aaaaaa",
    textoSuave: "#777777",
    inputBg: "#2a2a2a",
    itemAtivoBg: "#1a365d",
    itemAtivoBorda: "#3182ce"
  } : {
    bgGeral: "#f4f5f7",
    bgCard: "#ffffff",
    bgCardSecundario: "#eaecef",
    bgItem: "#ffffff",
    borda: "#dcdfe6",
    bordaClara: "#e2e8f0",
    texto: "#1a202c",
    textoSecundario: "#4a5568",
    textoSuave: "#a0aec0",
    inputBg: "#ffffff",
    itemAtivoBg: "#ebf8ff",
    itemAtivoBorda: "#3182ce"
  };

  async function carregarDados() {
    try {
      // 1. Produtos
      const snapProdutos = await getDocs(collection(db, "produtos"));
      setProdutos(snapProdutos.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 2. Vendas
      const qVendas = query(collection(db, "vendas"), orderBy("data", "desc"));
      const snapVendas = await getDocs(qVendas);
      setVendas(snapVendas.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 3. Caixa Aberto
      const qCaixa = query(collection(db, "caixas"), where("status", "==", "aberto"));
      const snapCaixa = await getDocs(qCaixa);
      if (!snapCaixa.empty) {
        setCaixaAberto({ id: snapCaixa.docs[0].id, ...snapCaixa.docs[0].data() });
      } else {
        setCaixaAberto(null);
      }

      // 4. Último Fechamento para Reimpressão
      const qFechados = query(collection(db, "caixas"), where("status", "==", "fechado"), orderBy("fechadoEm", "desc"));
      const snapFechados = await getDocs(qFechados);
      if (!snapFechados.empty) {
        setUltimoFechamentoSalvo(snapFechados.docs[0].data());
      }

      // 5. Histórico Consolidado (+30 dias arquivados)
      const consDoc = await getDoc(doc(db, "configuracoes", "historicoConsolidado"));
      if (consDoc.exists()) {
        setTotalHistoricoConsolidado(consDoc.data().totalAcumulado || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Firebase:", err);
    }
  }

  useEffect(() => {
    if (usuarioLogado) {
      carregarDados();
    }
  }, [usuarioLogado]);

  // Função para emitir PDF do Inventário da aba Estoque
  function emitirRelatorioProdutos() {
    if (produtos.length === 0) {
      alert("Nenhum produto cadastrado!");
      return;
    }
    setDadosRecibo(null);
    setDadosFechamentoPdf(null);
    setDadosRelatorioProdutosPdf(true);
    setTimeout(() => {
      window.print();
    }, 300);
  }

  // Se ainda estiver verificando a sessão do usuário
  if (verificandoAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: cores.bgGeral, color: cores.texto, fontFamily: "sans-serif" }}>
        Carregando sistema...
      </div>
    );
  }

  // Se não estiver logado, exibe tela de login
  if (!usuarioLogado) {
    return <Login tema={tema} alternarTema={alternarTema} />;
  }

  return (
    <>
      {/* CSS DE IMPRESSÃO (RECIBO EM BOBINA, RELATÓRIOS EM PAISAGEM) */}
      <style>{`
        @media print {
          @page {
            size: ${dadosRecibo ? "80mm auto" : "landscape"};
            margin: ${dadosRecibo ? "0" : "10mm"};
          }
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-recibo {
            display: ${dadosRecibo ? "block" : "none"} !important;
            width: 80mm;
            margin: 0 auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #000;
          }
          .print-fechamento {
            display: ${dadosFechamentoPdf ? "block" : "none"} !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, sans-serif;
            color: #000;
          }
          .print-produtos {
            display: ${dadosRelatorioProdutosPdf ? "block" : "none"} !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, sans-serif;
            color: #000;
          }
        }
        @media screen {
          .print-recibo, .print-fechamento, .print-produtos {
            display: none !important;
          }
        }
      `}</style>

      {/* 1. RECIBO TÉRMICO */}
      {dadosRecibo && (
        <div className="print-recibo">
          <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "8px" }}>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>LIFESURF </h2>
            <div style={{ fontSize: "11px" }}>COMPROVANTE DE VENDA</div>
            <div style={{ fontSize: "11px" }}>Pedido: #{dadosRecibo.id}</div>
            <div style={{ fontSize: "11px" }}>{dadosRecibo.dataHora}</div>
          </div>

          <div style={{ margin: "10px 0", borderBottom: "1px dashed #000", paddingBottom: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>
              <span>ITEM / QTD x VL.UN</span>
              <span>TOTAL</span>
            </div>
            {dadosRecibo.itens.map((it, idx) => (
              <div key={idx} style={{ marginBottom: "5px" }}>
                <div style={{ fontSize: "11px" }}>{it.nome} {it.referencia ? `(${it.referencia})` : ""}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span>{it.quantidade} un x R$ {Number(it.precoUnitario).toFixed(2)}</span>
                  <span>R$ {(it.quantidade * Number(it.precoUnitario)).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", fontSize: "11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal:</span>
              <span>R$ {Number(dadosRecibo.subtotalBruto).toFixed(2)}</span>
            </div>
            {dadosRecibo.desconto > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Desconto:</span>
                <span>- R$ {Number(dadosRecibo.desconto).toFixed(2)}</span>
              </div>
            )}
            {dadosRecibo.infoParcelas && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Taxa Cartão ({dadosRecibo.infoParcelas.taxaPercentual}%):</span>
                <span>R$ {(Number(dadosRecibo.total) - (Number(dadosRecibo.subtotalBruto) - Number(dadosRecibo.desconto))).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", marginTop: "4px" }}>
              <span>TOTAL PAGO:</span>
              <span>R$ {Number(dadosRecibo.total).toFixed(2)}</span>
            </div>
          </div>

          <div style={{ marginTop: "6px", fontSize: "11px", borderBottom: "1px dashed #000", paddingBottom: "6px" }}>
            <div>Forma: {dadosRecibo.formaPagamento}</div>
            {dadosRecibo.infoParcelas && (
              <div>Parcelamento: {dadosRecibo.infoParcelas.qtdParcelas}x de R$ {dadosRecibo.infoParcelas.valorParcela.toFixed(2)}</div>
            )}
            {dadosRecibo.infoDinheiro && (
              <>
                <div>Valor Recebido: R$ {dadosRecibo.infoDinheiro.valorEntregue.toFixed(2)}</div>
                <div style={{ fontWeight: "bold" }}>TROCO: R$ {dadosRecibo.infoDinheiro.troco.toFixed(2)}</div>
              </>
            )}
            <div>Modo: {dadosRecibo.tipoVenda.toUpperCase()}</div>
          </div>

          <div style={{ textAlign: "center", marginTop: "12px", fontSize: "11px" }}>
            <div>OBRIGADO PELA PREFERENCIA!</div>
            <div>VOLTE SEMPRE!</div>
          </div>
        </div>
      )}

      {/* 2. RELATÓRIO DO FECHAMENTO DO DIA */}
      {dadosFechamentoPdf && (
        <div className="print-fechamento">
          <div style={{ borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "15px" }}>
            <h1 style={{ margin: 0, fontSize: "20px" }}>LIFESURF - FECHAMENTO DE CAIXA DIÁRIO</h1>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Data: <strong>{dadosFechamentoPdf.dataHoje}</strong> | Fechamento: <strong>{dadosFechamentoPdf.horaFechamento}</strong>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px", marginBottom: "20px", background: "#f5f5f5", padding: "12px", borderRadius: "4px" }}>
            <div><small>Fundo Troco:</small><br /><strong>R$ {Number(dadosFechamentoPdf.trocoInicial || 0).toFixed(2)}</strong></div>
            <div><small>Vendas:</small><br /><strong>{dadosFechamentoPdf.qtdVendas}</strong></div>
            <div><small>Dinheiro:</small><br /><strong>R$ {Number(dadosFechamentoPdf.dinheiroHoje || 0).toFixed(2)}</strong></div>
            <div><small>Pix:</small><br /><strong>R$ {Number(dadosFechamentoPdf.pixHoje || 0).toFixed(2)}</strong></div>
            <div><small>Cartões:</small><br /><strong>R$ {(Number(dadosFechamentoPdf.debitoHoje || 0) + Number(dadosFechamentoPdf.creditoHoje || 0)).toFixed(2)}</strong></div>
            <div><small>TOTAL TURNO:</small><br /><strong style={{ fontSize: "15px", color: "#000" }}>R$ {Number(dadosFechamentoPdf.totalVendido || 0).toFixed(2)}</strong></div>
          </div>

          <h3 style={{ fontSize: "14px", margin: "10px 0" }}>Vendas Registradas no Turno</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000", background: "#eaeaea" }}>
                <th style={{ padding: "6px", textAlign: "left" }}>Hora</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Modo</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Itens</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Pagamento</th>
                <th style={{ padding: "6px", textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {dadosFechamentoPdf.vendas?.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "6px", whiteSpace: "nowrap" }}>{v.data?.toDate ? v.data.toDate().toLocaleTimeString("pt-BR") : "—"}</td>
                  <td style={{ padding: "6px" }}>{(v.tipoVenda || "varejo").toUpperCase()}</td>
                  <td style={{ padding: "6px" }}>
                    {v.itens?.map((it, idx) => (
                      <span key={idx} style={{ marginRight: "6px" }}>{it.quantidade}x {it.nome};</span>
                    ))}
                  </td>
                  <td style={{ padding: "6px" }}>{v.formaPagamento}</td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: "bold" }}>R$ {Number(v.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between" }}>
            <div style={{ borderTop: "1px solid #000", width: "35%", textAlign: "center", paddingTop: "5px", fontSize: "11px" }}>Assinatura do Caixa</div>
            <div style={{ borderTop: "1px solid #000", width: "35%", textAlign: "center", paddingTop: "5px", fontSize: "11px" }}>Conferência do Gerente</div>
          </div>
        </div>
      )}

      {/* 3. RELAÇÃO GERAL DE PRODUTOS / INVENTÁRIO */}
      {dadosRelatorioProdutosPdf && (
        <div className="print-produtos">
          <div style={{ borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "15px" }}>
            <h1 style={{ margin: 0, fontSize: "20px" }}>LIFESURF - RELAÇÃO GERAL DE PRODUTOS / ESTOQUE</h1>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Emitido em: <strong>{new Date().toLocaleString("pt-BR")}</strong> | Total de Itens: <strong>{produtos.length}</strong>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000", background: "#f0f0f0" }}>
                <th style={{ padding: "6px", textAlign: "left" }}>Produto</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Categoria</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Ref</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Cód. Barras</th>
                <th style={{ padding: "6px", textAlign: "right" }}>Preço Varejo</th>
                <th style={{ padding: "6px", textAlign: "right" }}>Preço Atacado</th>
                <th style={{ padding: "6px", textAlign: "center" }}>Qtd Estoque</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "6px" }}><strong>{p.nome}</strong></td>
                  <td style={{ padding: "6px" }}>{p.categoria || "—"}</td>
                  <td style={{ padding: "6px" }}>{p.referencia || "—"}</td>
                  <td style={{ padding: "6px" }}>{p.codigoBarras || "—"}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>R$ {Number(p.precoVarejo || p.preco || 0).toFixed(2)}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>R$ {Number(p.precoAtacado || p.precoVarejo || p.preco || 0).toFixed(2)}</td>
                  <td style={{ padding: "6px", textAlign: "center", fontWeight: "bold" }}>
                    {p.estoque} un {p.permiteNegativo ? "*" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "15px", fontSize: "10px", color: "#666" }}>
            * Itens marcados com asterisco (*) possuem autorização para estoque negativo.
          </div>
        </div>
      )}

      {/* ÁREA DA APLICAÇÃO VISÍVEL */}
      <div className="no-print" style={{ padding: "20px", fontFamily: "sans-serif", background: cores.bgGeral, color: cores.texto, minHeight: "100vh" }}>
        
        {/* CABEÇALHO DO SISTEMA */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ margin: 0, fontSize: "22px" }}>⚡ LifeSurf</h1>
            <span style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "12px", background: caixaAberto ? "#28a745" : "#e53e3e", color: "#fff", fontWeight: "bold" }}>
              {caixaAberto ? `Caixa Aberto (${caixaAberto.dataString})` : "Caixa Fechado"}
            </span>
            <span style={{ fontSize: "12px", color: cores.textoSecundario, borderLeft: `1px solid ${cores.bordaClara}`, paddingLeft: "10px" }}>
              👤 {usuarioLogado?.email}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setAbaAtiva("pdv")}
              style={{ padding: "10px 18px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold", background: abaAtiva === "pdv" ? "#007bff" : cores.bgCardSecundario, color: abaAtiva === "pdv" ? "#fff" : cores.texto }}
            >
              🛒 Frente de Caixa
            </button>
            <button
              onClick={() => setAbaAtiva("estoque")}
              style={{ padding: "10px 18px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold", background: abaAtiva === "estoque" ? "#007bff" : cores.bgCardSecundario, color: abaAtiva === "estoque" ? "#fff" : cores.texto }}
            >
              📦 Produtos & Estoque
            </button>
            <button
              onClick={() => {
                carregarDados();
                setAbaAtiva("historico");
              }}
              style={{ padding: "10px 18px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold", background: abaAtiva === "historico" ? "#007bff" : cores.bgCardSecundario, color: abaAtiva === "historico" ? "#fff" : cores.texto }}
            >
              📊 Relatório & Caixa
            </button>
            <button
              onClick={alternarTema}
              style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${cores.borda}`, background: cores.bgCard, color: cores.texto, cursor: "pointer", fontSize: "13px" }}
            >
              {tema === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={handleLogout}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#e53e3e", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
            >
              Sair 🚪
            </button>
          </div>
        </header>

        {/* PÁGINAS RENDERIZADAS */}
        {abaAtiva === "pdv" && (
          <Pdv
            produtos={produtos}
            caixaAberto={caixaAberto}
            usuarioLogado={usuarioLogado}
            cores={cores}
            tema={tema}
            recarregarDados={carregarDados}
            setDadosRecibo={(recibo) => {
              setDadosFechamentoPdf(null);
              setDadosRelatorioProdutosPdf(false);
              setDadosRecibo(recibo);
            }}
          />
        )}

        {abaAtiva === "estoque" && (
          <Estoque
            produtos={produtos}
            cores={cores}
            recarregarDados={carregarDados}
            emitirRelatorioProdutos={emitirRelatorioProdutos}
          />
        )}

        {abaAtiva === "historico" && (
          <Relatorio
            vendas={vendas}
            caixaAberto={caixaAberto}
            setCaixaAberto={setCaixaAberto}
            usuarioLogado={usuarioLogado}
            cores={cores}
            ultimoFechamentoSalvo={ultimoFechamentoSalvo}
            setUltimoFechamentoSalvo={setUltimoFechamentoSalvo}
            totalHistoricoConsolidado={totalHistoricoConsolidado}
            setTotalHistoricoConsolidado={setTotalHistoricoConsolidado}
            recarregarDados={carregarDados}
            setDadosFechamentoPdf={(dados) => {
              setDadosRecibo(null);
              setDadosRelatorioProdutosPdf(false);
              setDadosFechamentoPdf(dados);
            }}
          />
        )}
      </div>
    </>
  );
}