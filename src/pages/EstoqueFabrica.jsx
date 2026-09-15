import { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  increment 
} from "firebase/firestore";

const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];
const LISTA_TAMANHOS = ["PP", "P", "M", "G", "GG", "EXG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10"];

// Funções auxiliares para manipular strings de tamanhos
function parseTamanhos(str) {
  const res = {};
  if (!str || str === "Tamanho único") return res;
  str.split(" | ").forEach(part => {
    const [k, v] = part.split(":");
    if (k && v) res[k.trim()] = parseInt(v.trim(), 10) || 0;
  });
  return res;
}

function serializeTamanhos(obj) {
  const arr = [];
  Object.keys(obj).forEach(k => {
    if (obj[k] > 0) arr.push(`${k}: ${obj[k]}`);
  });
  return arr.length > 0 ? arr.join(" | ") : "Tamanho único";
}

export default function EstoqueFabrica({ cores, usuarioLogado, voltarHome }) {
  const [produtosFabrica, setProdutosFabrica] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Formulário de Cadastro da Fábrica
  const [nome, setNome] = useState("");
  const [precoVarejo, setPrecoVarejo] = useState("");
  const [precoAtacado, setPrecoAtacado] = useState("");
  const [estoque, setEstoque] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [referencia, setReferencia] = useState("");
  const [categoria, setCategoria] = useState("Camisa");
  
  // Estado dos Tamanhos (Cadastro)
  const [modalTamanhosAberto, setModalTamanhosAberto] = useState(false);
  const [tamanhosTemp, setTamanhosTemp] = useState({});
  const [tamanhosSalvos, setTamanhosSalvos] = useState("");

  // Estados dos Modais de Envio para a Loja
  const [modalSelecaoAberto, setModalSelecaoAberto] = useState(false);
  const [modalListaSelecionadosAberto, setModalListaSelecionadosAberto] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState({}); // { [id]: { qtdTotal, tamanhosStr, tamanhosObj, factoryRemainingObj } }

  // Estado do Modal de Tamanhos para Envio Específico
  const [modalEnvioTamanhosAberto, setModalEnvioTamanhosAberto] = useState(false);
  const [itemEditandoEnvioId, setItemEditandoEnvioId] = useState(null);
  const [tamanhosEnvioTemp, setTamanhosEnvioTemp] = useState({});
  const [fabricaDisponivelAtual, setFabricaDisponivelAtual] = useState({});

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");

  async function carregarEstoqueFabrica() {
    try {
      const snap = await getDocs(collection(db, "estoque_fabrica"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProdutosFabrica(lista.filter(p => !p.lojaId || p.lojaId === lojaIdAtual));
    } catch (err) {
      console.error("Erro ao carregar estoque da fábrica:", err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEstoqueFabrica();
  }, []);

  function abrirModalTamanhos() {
    const inicial = {};
    LISTA_TAMANHOS.forEach(t => {
      inicial[t] = tamanhosTemp[t] !== undefined ? tamanhosTemp[t] : "";
    });
    setTamanhosTemp(inicial);
    setModalTamanhosAberto(true);
  }

  function salvarTamanhosModal() {
    let somaTotal = 0;
    const descricoes = [];

    Object.keys(tamanhosTemp).forEach(t => {
      const qtd = parseInt(tamanhosTemp[t], 10) || 0;
      if (qtd > 0) {
        somaTotal += qtd;
        descricoes.push(`${t}: ${qtd}`);
      }
    });

    const stringResumo = descricoes.join(" | ");
    setTamanhosSalvos(stringResumo);
    setEstoque(somaTotal > 0 ? somaTotal.toString() : "");
    setModalTamanhosAberto(false);
  }

  // Abertura do Modal de Tamanhos na hora de Enviar para a Loja
  function abrirModalEnvioTamanhos(prodId) {
    const prod = produtosFabrica.find(p => p.id === prodId);
    if (!prod) return;

    setItemEditandoEnvioId(prodId);
    const disponivel = parseTamanhos(prod.tamanhos);
    setFabricaDisponivelAtual(disponivel);

    const salvoAnterior = itensSelecionados[prodId]?.tamanhosObj || {};
    const inicial = {};
    Object.keys(disponivel).forEach(t => {
      inicial[t] = salvoAnterior[t] !== undefined ? salvoAnterior[t] : "";
    });
    setTamanhosEnvioTemp(inicial);
    setModalEnvioTamanhosAberto(true);
  }

  function salvarTamanhosEnvioModal() {
    let somaTotal = 0;
    const descricoes = [];
    const objTamanhosEnvio = {};
    const factoryRemaining = { ...fabricaDisponivelAtual };

    let erroExcesso = false;

    Object.keys(tamanhosEnvioTemp).forEach(t => {
      const qtdEnviada = parseInt(tamanhosEnvioTemp[t], 10) || 0;
      const qtdDisponivel = fabricaDisponivelAtual[t] || 0;

      if (qtdEnviada > qtdDisponivel) {
        alert(`Você digitou ${qtdEnviada} para o tamanho ${t}, mas na fábrica há apenas ${qtdDisponivel} disponíveis!`);
        erroExcesso = true;
        return;
      }

      if (qtdEnviada > 0) {
        somaTotal += qtdEnviada;
        descricoes.push(`${t}: ${qtdEnviada}`);
        objTamanhosEnvio[t] = qtdEnviada;
        factoryRemaining[t] = qtdDisponivel - qtdEnviada;
      }
    });

    if (erroExcesso) return;

    const stringResumo = descricoes.join(" | ");

    setItensSelecionados(prev => ({
      ...prev,
      [itemEditandoEnvioId]: {
        qtdTotal: somaTotal,
        tamanhosStr: stringResumo || "Lote geral",
        tamanhosObj: objTamanhosEnvio,
        factoryRemainingObj: factoryRemaining
      }
    }));

    setModalEnvioTamanhosAberto(false);
  }

  async function handleSalvarProdutoFabrica(e) {
    e.preventDefault();
    if (!nome.trim() || !precoVarejo || !estoque) {
      alert("Preencha Nome, Preço Varejo e defina os Tamanhos (Estoque).");
      return;
    }

    try {
      const dados = {
        nome: nome.trim(),
        precoVarejo: parseFloat(precoVarejo),
        precoAtacado: precoAtacado ? parseFloat(precoAtacado) : parseFloat(precoVarejo),
        estoque: parseInt(estoque, 10),
        codigoBarras: codigoBarras.trim() || null,
        referencia: referencia.trim() || null,
        categoria,
        tamanhos: tamanhosSalvos || "Tamanho único",
        lojaId: lojaIdAtual,
        criadoEm: serverTimestamp()
      };

      await addDoc(collection(db, "estoque_fabrica"), dados);
      alert("Produto cadastrado na fábrica!");
      setNome("");
      setPrecoVarejo("");
      setPrecoAtacado("");
      setEstoque("");
      setCodigoBarras("");
      setReferencia("");
      setTamanhosSalvos("");
      setTamanhosTemp({});
      carregarEstoqueFabrica();
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  }

  async function handleExcluir(id) {
    if (!confirm("Deseja excluir este item da fábrica?")) return;
    try {
      await deleteDoc(doc(db, "estoque_fabrica", id));
      carregarEstoqueFabrica();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  }

  async function enviarParaLoja() {
    const idsParaEnviar = Object.keys(itensSelecionados).filter(id => itensSelecionados[id]?.qtdTotal > 0);
    if (idsParaEnviar.length === 0) {
      alert("Selecione ao menos um produto e defina os tamanhos/quantidade a enviar!");
      return;
    }

    if (!confirm("Tem certeza que deseja enviar essas mercadorias para o estoque da loja?")) return;

    try {
      for (const id of idsParaEnviar) {
        const dadosEnvio = itensSelecionados[id];
        const qtdEnviada = dadosEnvio.qtdTotal;
        const prodFabrica = produtosFabrica.find(p => p.id === id);

        if (!prodFabrica) continue;

        if (prodFabrica.estoque < qtdEnviada) {
          alert(`Estoque insuficiente na fábrica para o produto: ${prodFabrica.nome}`);
          return;
        }

        // Atualiza a fábrica com o novo estoque total e os tamanhos restantes recalculados
        const refFabrica = doc(db, "estoque_fabrica", id);
        const novoEstoqueFabrica = prodFabrica.estoque - qtdEnviada;
        const novoTamanhosFabricaStr = serializeTamanhos(dadosEnvio.factoryRemainingObj);

        await updateDoc(refFabrica, {
          estoque: novoEstoqueFabrica,
          tamanhos: novoTamanhosFabricaStr
        });

        // Adiciona ou soma no estoque da Loja
        const produtosLojaSnap = await getDocs(collection(db, "produtos"));
        const produtoLojaExistente = produtosLojaSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .find(p => p.nome.toLowerCase() === prodFabrica.nome.toLowerCase() && (!p.lojaId || p.lojaId === lojaIdAtual));

        if (produtoLojaExistente) {
          const refLoja = doc(db, "produtos", produtoLojaExistente.id);
          await updateDoc(refLoja, {
            estoque: increment(qtdEnviada),
            tamanhos: dadosEnvio.tamanhosStr || produtoLojaExistente.tamanhos
          });
        } else {
          await addDoc(collection(db, "produtos"), {
            nome: prodFabrica.nome,
            precoVarejo: prodFabrica.precoVarejo,
            precoAtacado: prodFabrica.precoAtacado,
            estoque: qtdEnviada,
            codigoBarras: prodFabrica.codigoBarras,
            referencia: prodFabrica.referencia,
            categoria: prodFabrica.categoria,
            tamanhos: dadosEnvio.tamanhosStr || "Tamanho único",
            lojaId: lojaIdAtual,
            criadoEm: serverTimestamp()
          });
        }
      }

      alert("Mercadorias enviadas para o estoque da loja com sucesso!");
      setItensSelecionados({});
      setModalListaSelecionadosAberto(false);
      setModalSelecaoAberto(false);
      carregarEstoqueFabrica();
    } catch (err) {
      alert("Erro ao enviar mercadorias: " + err.message);
    }
  }

  function emitirRelatorioPdf() {
    if (produtosFabrica.length === 0) {
      alert("Nenhum produto na fábrica para gerar o relatório!");
      return;
    }
    window.print();
  }

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

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "15px", boxSizing: "border-box", fontFamily: "sans-serif", background: cores.bgGeral, color: cores.texto }}>
      
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-fabrica { display: block !important; width: 100% !important; font-family: Arial, sans-serif; color: #000; }
        }
        @media screen {
          .print-fabrica { display: none; }
        }
      `}</style>

      {/* ÁREA DE IMPRESSÃO PDF */}
      <div className="print-fabrica" style={{ padding: "20px" }}>
        <h1 style={{ fontSize: "20px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>RELATÓRIO - ESTOQUE DA FÁBRICA</h1>
        <p style={{ fontSize: "12px" }}>Emitido em: {new Date().toLocaleString("pt-BR")}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "15px", fontSize: "11px" }}>
          <thead>
            <tr style={{ background: "#f0f0f0", borderBottom: "2px solid #000" }}>
              <th style={{ padding: "6px", textAlign: "left" }}>Produto</th>
              <th style={{ padding: "6px", textAlign: "left" }}>Ref</th>
              <th style={{ padding: "6px", textAlign: "left" }}>Tamanhos</th>
              <th style={{ padding: "6px", textAlign: "right" }}>Varejo</th>
              <th style={{ padding: "6px", textAlign: "center" }}>Estoque</th>
            </tr>
          </thead>
          <tbody>
            {produtosFabrica.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "6px" }}><strong>{p.nome}</strong></td>
                <td style={{ padding: "6px" }}>{p.referencia || "—"}</td>
                <td style={{ padding: "6px" }}>{p.tamanhos || "—"}</td>
                <td style={{ padding: "6px", textAlign: "right" }}>R$ {Number(p.precoVarejo || 0).toFixed(2)}</td>
                <td style={{ padding: "6px", textAlign: "center", fontWeight: "bold" }}>{p.estoque} un</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px" }}>🏭 Estoque da Fábrica & Produção</h1>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>Gerencie a fabricação e envie lotes para a loja.</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={emitirRelatorioPdf} style={{ background: "#17a2b8", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              🖨️ Salvar PDF
            </button>
            {voltarHome && (
              <button onClick={voltarHome} style={{ background: "#6c757d", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
                🏠 Início
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
          <button
            onClick={() => setModalSelecaoAberto(true)}
            style={{ width: "100%", maxWidth: "350px", background: "#28a745", color: "#fff", border: "none", padding: "12px 16px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 12px rgba(40,167,69,0.3)" }}
          >
            📦 Retirar Mercadoria (Enviar para Loja)
          </button>
        </div>

        <form onSubmit={handleSalvarProdutoFabrica} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "30px", background: cores.bgCard, padding: "15px", borderRadius: "10px", border: `1px solid ${cores.borda}` }}>
          <h3 style={{ gridColumn: "1 / -1", margin: "0 0 5px 0", fontSize: "15px" }}>Cadastrar Novo Produto na Fábrica</h3>
          <div>
            <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: cores.textoSecundario }}>Nome *</label>
            <input type="text" placeholder="Ex: Short" value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: cores.textoSecundario }}>Preço Varejo *</label>
            <input type="number" step="0.01" placeholder="50.00" value={precoVarejo} onChange={e => setPrecoVarejo(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: cores.textoSecundario }}>Preço Atacado</label>
            <input type="number" step="0.01" placeholder="40.00" value={precoAtacado} onChange={e => setPrecoAtacado(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: cores.textoSecundario }}>Estoque Total (Auto)</label>
            <input type="text" placeholder="Defina os tamanhos" value={estoque} readOnly style={{ ...inputStyle, background: cores.bgCardSecundario, cursor: "not-allowed", fontWeight: "bold", color: "#28a745" }} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: cores.textoSecundario }}>Ref</label>
            <input type="text" placeholder="1460" value={referencia} onChange={e => setReferencia(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", color: cores.textoSecundario }}>Gerenciar Tamanhos</label>
            <button type="button" onClick={abrirModalTamanhos} style={{ width: "100%", padding: "10px", background: "#ffc107", color: "#000", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}>
              👕 {tamanhosSalvos ? "Editar Tamanhos" : "Definir Tamanhos"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" style={{ width: "100%", padding: "11px", background: "#007bff", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              + Cadastrar
            </button>
          </div>

          {tamanhosSalvos && (
            <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: "#28a745", fontWeight: "bold" }}>
              Tamanhos definidos: {tamanhosSalvos}
            </div>
          )}
        </form>

        <h3 style={{ marginBottom: "15px", fontSize: "16px" }}>Produtos Cadastrados na Fábrica</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "600px" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.textoSecundario, fontSize: "12px" }}>
                <th style={{ padding: "10px" }}>Nome</th>
                <th style={{ padding: "10px" }}>Ref</th>
                <th style={{ padding: "10px" }}>Tamanhos / Distribuição</th>
                <th style={{ padding: "10px" }}>Varejo</th>
                <th style={{ padding: "10px" }}>Atacado</th>
                <th style={{ padding: "10px" }}>Estoque</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtosFabrica.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>Nenhum produto cadastrado na fábrica ainda.</td></tr>
              ) : (
                produtosFabrica.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${cores.borda}`, fontSize: "13px" }}>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>{p.nome}</td>
                    <td style={{ padding: "10px", color: cores.textoSecundario }}>{p.referencia || "—"}</td>
                    <td style={{ padding: "10px", fontSize: "11px", color: cores.textoSecundario }}>{p.tamanhos || "—"}</td>
                    <td style={{ padding: "10px" }}>R$ {Number(p.precoVarejo || 0).toFixed(2)}</td>
                    <td style={{ padding: "10px", color: "#3182ce" }}>R$ {Number(p.precoAtacado || 0).toFixed(2)}</td>
                    <td style={{ padding: "10px", fontWeight: "bold", color: "#38a169" }}>{p.estoque} un</td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <button onClick={() => handleExcluir(p.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Excluir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE SELEÇÃO DE TAMANHOS (CADASTRO) */}
      {modalTamanhosAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "450px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ marginTop: 0, marginBottom: "15px", textAlign: "center", fontSize: "16px" }}>👕 Distribuir Quantidades por Tamanho</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "20px" }}>
              {LISTA_TAMANHOS.map(tam => (
                <div key={tam} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "6px 10px", borderRadius: "6px", border: `1px solid ${cores.borda}` }}>
                  <span style={{ fontWeight: "bold", fontSize: "13px" }}>{tam}:</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={tamanhosTemp[tam] === 0 ? "" : (tamanhosTemp[tam] ?? "")}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "");
                      setTamanhosTemp(prev => ({ 
                        ...prev, 
                        [tam]: val === "" ? "" : parseInt(val, 10) 
                      }));
                    }}
                    style={{ width: "55px", padding: "5px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "4px", textAlign: "center", fontWeight: "bold", fontSize: "13px", outline: "none" }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={salvarTamanhosModal} style={{ flex: 1, padding: "11px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Salvar Tamanhos
              </button>
              <button onClick={() => setModalTamanhosAberto(false)} style={{ padding: "11px 16px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SELEÇÃO DE TAMANHOS PARA ENVIO (MOSTRA DISPONÍVEL) */}
      {modalEnvioTamanhosAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1300, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "450px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ marginTop: 0, marginBottom: "5px", textAlign: "center", fontSize: "16px" }}>📦 Quantidade e Tamanhos do Envio</h3>
            <p style={{ textAlign: "center", fontSize: "11px", color: cores.textoSecundario, marginBottom: "15px" }}>Informe quanto deseja enviar de cada tamanho disponível:</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {Object.keys(fabricaDisponivelAtual).length === 0 ? (
                <p style={{ textAlign: "center", color: cores.textoSecundario }}>Nenhum tamanho registrado neste produto.</p>
              ) : (
                Object.keys(fabricaDisponivelAtual).map(tam => {
                  const disp = fabricaDisponivelAtual[tam];
                  if (disp <= 0) return null;
                  return (
                    <div key={tam} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${cores.borda}` }}>
                      <div>
                        <span style={{ fontWeight: "bold", fontSize: "14px" }}>{tam}:</span>
                        <span style={{ fontSize: "11px", color: cores.textoSecundario, marginLeft: "8px" }}>(Disp: {disp} un)</span>
                      </div>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder="0"
                        value={tamanhosEnvioTemp[tam] === 0 ? "" : (tamanhosEnvioTemp[tam] ?? "")}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, "");
                          setTamanhosEnvioTemp(prev => ({ 
                            ...prev, 
                            [tam]: val === "" ? "" : parseInt(val, 10) 
                          }));
                        }}
                        style={{ width: "70px", padding: "6px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "4px", textAlign: "center", fontWeight: "bold", fontSize: "13px", outline: "none" }}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={salvarTamanhosEnvioModal} style={{ flex: 1, padding: "11px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Confirmar Lote
              </button>
              <button onClick={() => setModalEnvioTamanhosAberto(false)} style={{ padding: "11px 16px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: SELECIONAR PRODUTOS */}
      {modalSelecaoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "850px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, fontSize: "16px" }}>📦 Selecionar Produtos da Fábrica</h2>
              <button onClick={() => setModalSelecaoAberto(false)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>✕ Fechar</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px", minWidth: "500px" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${cores.borda}`, fontSize: "12px", color: cores.textoSecundario }}>
                    <th style={{ padding: "8px" }}>Nome</th>
                    <th style={{ padding: "8px" }}>Ref</th>
                    <th style={{ padding: "8px" }}>Tamanhos</th>
                    <th style={{ padding: "8px" }}>Estoque</th>
                    <th style={{ padding: "8px", textAlign: "center" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFabrica.map(p => {
                    const selecionado = itensSelecionados[p.id]?.qtdTotal > 0;
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${cores.borda}`, fontSize: "13px" }}>
                        <td style={{ padding: "8px" }}>{p.nome}</td>
                        <td style={{ padding: "8px" }}>{p.referencia || "—"}</td>
                        <td style={{ padding: "8px", fontSize: "11px", color: cores.textoSecundario }}>{p.tamanhos || "—"}</td>
                        <td style={{ padding: "8px", color: "#38a169", fontWeight: "bold" }}>{p.estoque} un</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button 
                            onClick={() => {
                              if (!selecionado) {
                                setItensSelecionados(prev => ({ ...prev, [p.id]: { qtdTotal: 0, tamanhosStr: "", tamanhosObj: {}, factoryRemainingObj: parseTamanhos(p.tamanhos) } }));
                                abrirModalEnvioTamanhos(p.id);
                              } else {
                                setItensSelecionados(prev => {
                                  const copia = { ...prev };
                                  delete copia[p.id];
                                  return copia;
                                });
                              }
                            }}
                            style={{ background: selecionado ? "#28a745" : "#007bff", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}
                          >
                            {selecionado ? "✓ Selecionado" : "Selecionar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setModalListaSelecionadosAberto(true)}
                style={{ width: "100%", maxWidth: "250px", background: "#28a745", color: "#fff", border: "none", padding: "11px 16px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}
              >
                Avançar ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LISTA DOS SELECIONADOS */}
      {modalListaSelecionadosAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "750px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h2 style={{ textAlign: "center", marginTop: 0, fontSize: "17px" }}>LISTA DOS PRODUTOS SELECIONADOS</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "15px 0" }}>
              {Object.keys(itensSelecionados).filter(id => itensSelecionados[id]?.qtdTotal > 0).length === 0 ? (
                <p style={{ textAlign: "center", color: cores.textoSecundario }}>Nenhum produto selecionado ou quantidade em 0.</p>
              ) : (
                Object.keys(itensSelecionados).filter(id => itensSelecionados[id]?.qtdTotal > 0).map(id => {
                  const prod = produtosFabrica.find(p => p.id === id);
                  const dadosEnvio = itensSelecionados[id];
                  if (!prod) return null;
                  return (
                    <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "12px 15px", borderRadius: "6px", border: `1px solid ${cores.borda}`, gap: "10px", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ fontSize: "14px" }}>{prod.nome}</strong>
                        <div style={{ fontSize: "11px", color: cores.textoSecundario }}>Ref: {prod.referencia || "—"} | Disp: {prod.estoque} un</div>
                        <div style={{ fontSize: "12px", color: "#28a745", fontWeight: "bold", marginTop: "4px" }}>
                          Envio: {dadosEnvio.tamanhosStr} (Total: {dadosEnvio.qtdTotal} un)
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button 
                          onClick={() => abrirModalEnvioTamanhos(id)}
                          style={{ background: "#ffc107", color: "#000", border: "none", padding: "8px 12px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}
                        >
                          👕 Alterar Quantidades
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "15px", flexWrap: "wrap" }}>
              <button onClick={enviarParaLoja} style={{ flex: 1, padding: "12px", background: "#28a745", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
                ENVIAR PARA A LOJA
              </button>
              <button onClick={() => setModalListaSelecionadosAberto(false)} style={{ padding: "12px 16px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}