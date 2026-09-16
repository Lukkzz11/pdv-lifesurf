import { useState, useMemo } from "react";
import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

const CATEGORIAS_PADRAO = [
  "Camisa",
  "Camiseta",
  "Camisa Gola Polo",
  "Camisa de Botão",
  "Bermuda",
  "Short",
  "Calça",
  "Casaco",
  "Outros"
];

const LISTA_TAMANHOS = ["PP", "P", "M", "G", "GG", "EXG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10"];
const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];

function parseTamanhos(str) {
  const res = {};
  if (!str || str === "Tamanho único") return res;
  str.split(" | ").forEach(part => {
    const [k, v] = part.split(":");
    if (k && v) res[k.trim()] = parseInt(v.trim(), 10) || 0;
  });
  return res;
}

export default function Estoque({ 
  produtos, 
  cores, 
  recarregarDados, 
  emitirRelatorioProdutos,
  usuarioLogado 
}) {
  const [produtoEditandoId, setProdutoEditandoId] = useState(null);
  const [nome, setNome] = useState("");
  const [precoVarejo, setPrecoVarejo] = useState("");
  const [precoAtacado, setPrecoAtacado] = useState("");
  const [estoque, setEstoque] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [referencia, setReferencia] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_PADRAO[0]);
  const [permiteNegativo, setPermiteNegativo] = useState(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);

  // Estados dos Tamanhos e Modos
  const [modalTamanhosAberto, setModalTamanhosAberto] = useState(false);
  const [modoTamanho, setModoTamanho] = useState("adicionar"); // "adicionar" | "retirar" | "recontar"
  const [tamanhosTemp, setTamanhosTemp] = useState({});
  const [tamanhosSalvos, setTamanhosSalvos] = useState("");

  // Estados dos Filtros da Tabela
  const [buscaTabela, setBuscaTabela] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [ordenacao, setOrdenacao] = useState("nome_asc");

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");

  function abrirModalTamanhos() {
    const atualObj = parseTamanhos(tamanhosSalvos);
    const inicial = {};
    LISTA_TAMANHOS.forEach(t => {
      inicial[t] = modoTamanho === "recontar" ? (atualObj[t] !== undefined ? atualObj[t] : "") : "";
    });
    setTamanhosTemp(inicial);
    setModalTamanhosAberto(true);
  }

  function salvarTamanhosModal() {
    let estoqueAtualNum = parseInt(estoque, 10) || 0;
    const atualObj = parseTamanhos(tamanhosSalvos);

    if (modoTamanho === "adicionar") {
      let somaAdicionada = 0;
      const novoObj = { ...atualObj };
      Object.keys(tamanhosTemp).forEach(t => {
        const qtd = parseInt(tamanhosTemp[t], 10) || 0;
        if (qtd > 0) {
          somaAdicionada += qtd;
          novoObj[t] = (novoObj[t] || 0) + qtd;
        }
      });
      estoqueAtualNum += somaAdicionada;
      
      const descricoes = [];
      Object.keys(novoObj).forEach(t => {
        if (novoObj[t] > 0) descricoes.push(`${t}: ${novoObj[t]}`);
      });
      setTamanhosSalvos(descricoes.join(" | "));
      setEstoque(estoqueAtualNum > 0 ? estoqueAtualNum.toString() : "");

    } else if (modoTamanho === "retirar") {
      let somaRetirada = 0;
      const novoObj = { ...atualObj };
      let erro = false;

      Object.keys(tamanhosTemp).forEach(t => {
        const qtd = parseInt(tamanhosTemp[t], 10) || 0;
        const disp = novoObj[t] || 0;
        if (qtd > disp) {
          alert(`Você tentou retirar ${qtd} do tamanho ${t}, mas só há ${disp} disponíveis!`);
          erro = true;
          return;
        }
        if (qtd > 0) {
          somaRetirada += qtd;
          novoObj[t] = disp - qtd;
        }
      });

      if (erro) return;

      estoqueAtualNum = Math.max(0, estoqueAtualNum - somaRetirada);
      const descricoes = [];
      Object.keys(novoObj).forEach(t => {
        if (novoObj[t] > 0) descricoes.push(`${t}: ${novoObj[t]}`);
      });
      setTamanhosSalvos(descricoes.join(" | "));
      setEstoque(estoqueAtualNum > 0 ? estoqueAtualNum.toString() : "");

    } else if (modoTamanho === "recontar") {
      // Recalcula o estoque total automaticamente somando os tamanhos informados na contagem
      let somaTotalRecontada = 0;
      const descricoes = [];
      Object.keys(tamanhosTemp).forEach(t => {
        const qtd = parseInt(tamanhosTemp[t], 10) || 0;
        if (qtd > 0) {
          somaTotalRecontada += qtd;
          descricoes.push(`${t}: ${qtd}`);
        }
      });
      setTamanhosSalvos(descricoes.join(" | "));
      setEstoque(somaTotalRecontada > 0 ? somaTotalRecontada.toString() : "");
    }

    setModalTamanhosAberto(false);
  }

  async function handleSalvarProduto(e) {
    e.preventDefault();
    if (!nome.trim() || !precoVarejo || estoque === "") {
      alert("Preencha Nome, Preço Varejo e o Estoque.");
      return;
    }

    const codLimpo = codigoBarras.trim() || null;
    const refLimpa = referencia.trim() || null;

    const duplicado = produtos.find((p) => {
      if (produtoEditandoId && p.id === produtoEditandoId) return false;
      const mesmaRef = refLimpa && p.referencia && p.referencia.trim().toLowerCase() === refLimpa.toLowerCase();
      const mesmoCod = codLimpo && p.codigoBarras && p.codigoBarras.trim().toLowerCase() === codLimpo.toLowerCase();
      return mesmaRef && mesmoCod;
    });

    if (duplicado) {
      alert(`Produto duplicado! Já existe um item com a mesma Referência (${refLimpa}) e Código (${codLimpo}).`);
      return;
    }

    setSalvandoProduto(true);
    try {
      const dados = {
        nome: nome.trim(),
        precoVarejo: parseFloat(precoVarejo),
        precoAtacado: precoAtacado ? parseFloat(precoAtacado) : parseFloat(precoVarejo),
        estoque: parseInt(estoque, 10),
        codigoBarras: codLimpo,
        referencia: refLimpa,
        categoria: categoria,
        tamanhos: tamanhosSalvos || "Tamanho único",
        permiteNegativo: !!permiteNegativo,
        lojaId: lojaIdAtual
      };

      if (produtoEditandoId) {
        await updateDoc(doc(db, "produtos", produtoEditandoId), dados);
        alert("Produto atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "produtos"), { ...dados, criadoEm: serverTimestamp() });
        alert("Produto cadastrado na loja!");
      }

      limparFormularioProduto();
      await recarregarDados();
    } catch (err) {
      alert("Erro ao salvar produto: " + err.message);
    } finally {
      setSalvandoProduto(false);
    }
  }

  function carregarParaEdicao(p) {
    setProdutoEditandoId(p.id);
    setNome(p.nome || "");
    setPrecoVarejo(p.precoVarejo || p.preco || "");
    setPrecoAtacado(p.precoAtacado || "");
    setEstoque(p.estoque !== undefined ? p.estoque : "");
    setCodigoBarras(p.codigoBarras || "");
    setReferencia(p.referencia || "");
    setCategoria(p.categoria || CATEGORIAS_PADRAO[0]);
    setTamanhosSalvos(p.tamanhos || "");
    setPermiteNegativo(!!p.permiteNegativo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function limparFormularioProduto() {
    setProdutoEditandoId(null);
    setNome("");
    setPrecoVarejo("");
    setPrecoAtacado("");
    setEstoque("");
    setCodigoBarras("");
    setReferencia("");
    setCategoria(CATEGORIAS_PADRAO[0]);
    setTamanhosSalvos("");
    setTamanhosTemp({});
    setPermiteNegativo(false);
  }

  async function handleExcluirProduto(id, nomeProd) {
    if (!confirm(`Deseja excluir "${nomeProd}"?`)) return;
    try {
      await deleteDoc(doc(db, "produtos", id));
      await recarregarDados();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  }

  const produtosProcessados = useMemo(() => {
    return produtos
      .filter((p) => {
        const termo = buscaTabela.trim().toLowerCase();
        const bateBusca = !termo || 
          p.nome?.toLowerCase().includes(termo) ||
          p.referencia?.toLowerCase().includes(termo) ||
          p.codigoBarras?.toLowerCase().includes(termo);

        const bateCategoria = filtroCategoria === "TODAS" || p.categoria === filtroCategoria;

        return bateBusca && bateCategoria;
      })
      .sort((a, b) => {
        if (ordenacao === "nome_asc") return (a.nome || "").localeCompare(b.nome || "");
        if (ordenacao === "nome_desc") return (b.nome || "").localeCompare(a.nome || "");
        if (ordenacao === "estoque_desc") return (b.estoque || 0) - (a.estoque || 0);
        if (ordenacao === "estoque_asc") return (a.estoque || 0) - (b.estoque || 0);
        if (ordenacao === "preco_desc") return Number(b.precoVarejo || b.preco || 0) - Number(a.precoVarejo || a.preco || 0);
        if (ordenacao === "preco_asc") return Number(a.precoVarejo || a.preco || 0) - Number(b.precoVarejo || b.preco || 0);
        return 0;
      });
  }, [produtos, buscaTabela, filtroCategoria, ordenacao]);

  const inputStyle = {
    width: "100%",
    padding: "11px",
    background: "transparent",
    border: `1px solid ${cores.borda}`,
    color: cores.texto,
    borderRadius: "8px",
    boxSizing: "border-box",
    fontSize: "14px",
    outline: "none",
    transition: "all 0.2s ease-in-out"
  };

  return (
    <div style={{ width: "100%", boxSizing: "border-box", paddingBottom: "40px" }}>
      <style>{`
        .input-animado:focus {
          border-color: #28a745 !important;
          box-shadow: 0 0 10px rgba(40, 167, 69, 0.25);
          background: rgba(40, 167, 69, 0.03);
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ color: cores.texto, margin: 0, fontSize: "20px" }}>{produtoEditandoId ? "✏️ Editar Produto / Ajustar Tamanhos" : "Novo Cadastro de Produto na Loja"}</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={emitirRelatorioProdutos}
            style={{ background: "#28a745", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
          >
            📋 Inventário de Produtos
          </button>
          {produtoEditandoId && (
            <button
              onClick={limparFormularioProduto}
              style={{ background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, padding: "9px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
            >
              ✕ Cancelar Edição
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSalvarProduto}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px", marginBottom: "30px", background: cores.bgCard, padding: "20px", borderRadius: "12px", border: `1px solid ${cores.borda}` }}
      >
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Nome *</label>
          <input type="text" className="input-animado" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Preço Varejo (R$) *</label>
          <input type="number" step="0.01" className="input-animado" value={precoVarejo} onChange={(e) => setPrecoVarejo(e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Preço Atacado (R$)</label>
          <input type="number" step="0.01" className="input-animado" value={precoAtacado} onChange={(e) => setPrecoAtacado(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Estoque Total *</label>
          <input type="number" className="input-animado" value={estoque} onChange={(e) => setEstoque(e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Cód. Barras</label>
          <input type="text" className="input-animado" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Referência</label>
          <input type="text" className="input-animado" value={referencia} onChange={(e) => setReferencia(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle} className="input-animado">
            {CATEGORIAS_PADRAO.map(c => (
              <option key={c} value={c} style={{ background: cores.bgGeral, color: cores.texto }}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: cores.textoSecundario }}>Gerenciar Tamanhos</label>
          <button type="button" onClick={abrirModalTamanhos} style={{ width: "100%", padding: "11px", background: "#ffc107", color: "#000", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
            👕 {tamanhosSalvos ? "Editar Tamanhos" : "Definir Tamanhos"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "20px" }}>
          <input
            type="checkbox"
            id="chkNegativo"
            checked={permiteNegativo}
            onChange={(e) => setPermiteNegativo(e.target.checked)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <label htmlFor="chkNegativo" style={{ fontSize: "13px", cursor: "pointer", color: cores.texto }}>
            Não travar estoque (permite negativar)
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="submit" disabled={salvandoProduto} style={{ width: "100%", padding: "12px", background: produtoEditandoId ? "#007bff" : "#28a745", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
            {salvandoProduto ? "Gravando..." : produtoEditandoId ? "Atualizar Produto" : "+ Salvar Produto"}
          </button>
        </div>

        {tamanhosSalvos && (
          <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: "#28a745", fontWeight: "bold" }}>
            Tamanhos definidos: {tamanhosSalvos}
          </div>
        )}
      </form>

      {/* MODAL DE GERENCIAR TAMANHOS */}
      {modalTamanhosAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgGeral, border: `1px solid ${cores.borda}`, padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ marginTop: 0, marginBottom: "15px", textAlign: "center", fontSize: "16px" }}>👕 Gerenciar Tamanhos e Estoque</h3>
            
            <div style={{ display: "flex", gap: "6px", marginBottom: "15px" }}>
              <button
                type="button"
                onClick={() => setModoTamanho("adicionar")}
                style={{ flex: 1, padding: "8px", background: modoTamanho === "adicionar" ? "#28a745" : cores.bgCardSecundario, color: modoTamanho === "adicionar" ? "#fff" : cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "11px" }}
              >
                🟢 Adicionar
              </button>
              <button
                type="button"
                onClick={() => setModoTamanho("retirar")}
                style={{ flex: 1, padding: "8px", background: modoTamanho === "retirar" ? "#e53e3e" : cores.bgCardSecundario, color: modoTamanho === "retirar" ? "#fff" : cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "11px" }}
              >
                🔴 Retirar
              </button>
              <button
                type="button"
                onClick={() => setModoTamanho("recontar")}
                style={{ flex: 1, padding: "8px", background: modoTamanho === "recontar" ? "#ffc107" : cores.bgCardSecundario, color: modoTamanho === "recontar" ? "#000" : cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "11px" }}
              >
                🟡 Ajustar / Atacado
              </button>
            </div>

            <p style={{ fontSize: "11px", color: cores.textoSecundario, textAlign: "center", marginBottom: "15px" }}>
              {modoTamanho === "adicionar" && "Digite quanto deseja adicionar em cada tamanho (soma ao total)."}
              {modoTamanho === "retirar" && "Digite quanto deseja retirar de cada tamanho (subtrai do total)."}
              {modoTamanho === "recontar" && "Reconte a prateleira e atualize os tamanhos (atualiza o estoque total automaticamente)."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "20px" }}>
              {LISTA_TAMANHOS.map(tam => {
                const atualObj = parseTamanhos(tamanhosSalvos);
                const dispAtual = atualObj[tam] || 0;
                return (
                  <div key={tam} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "6px 10px", borderRadius: "6px", border: `1px solid ${cores.borda}` }}>
                    <div>
                      <span style={{ fontWeight: "bold", fontSize: "13px" }}>{tam}</span>
                      <span style={{ fontSize: "10px", color: cores.textoSecundario, display: "block" }}>Atual: {dispAtual}</span>
                    </div>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      className="input-animado"
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
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={salvarTamanhosModal} style={{ flex: 1, padding: "11px", background: "#28a745", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Confirmar Alteração
              </button>
              <button onClick={() => setModalTamanhosAberto(false)} style={{ padding: "11px 16px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", color: cores.texto }}>
          Estoque da Loja Cadastrado ({produtosProcessados.length} de {produtos.length})
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>🔍 Pesquisar:</label>
            <input
              type="text"
              className="input-animado"
              placeholder="Pesquisar..."
              value={buscaTabela}
              onChange={(e) => setBuscaTabela(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>🏷️ Categoria:</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={inputStyle}
              className="input-animado"
            >
              <option value="TODAS" style={{ background: cores.bgGeral, color: cores.texto }}>Todas as Categorias</option>
              {CATEGORIAS_PADRAO.map((c) => (
                <option key={c} value={c} style={{ background: cores.bgGeral, color: cores.texto }}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>↕️ Ordenar por:</label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              style={inputStyle}
              className="input-animado"
            >
              <option value="nome_asc" style={{ background: cores.bgGeral, color: cores.texto }}>Nome (A → Z)</option>
              <option value="nome_desc" style={{ background: cores.bgGeral, color: cores.texto }}>Nome (Z → A)</option>
              <option value="estoque_desc" style={{ background: cores.bgGeral, color: cores.texto }}>Maior Estoque</option>
              <option value="estoque_asc" style={{ background: cores.bgGeral, color: cores.texto }}>Menor Estoque</option>
              <option value="preco_desc" style={{ background: cores.bgGeral, color: cores.texto }}>Maior Preço Varejo</option>
              <option value="preco_asc" style={{ background: cores.bgGeral, color: cores.texto }}>Menor Preço Varejo</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", background: "transparent" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.texto, fontSize: "13px" }}>
              <th style={{ padding: "12px" }}>Nome</th>
              <th style={{ padding: "12px" }}>Categoria</th>
              <th style={{ padding: "12px" }}>Ref</th>
              <th style={{ padding: "12px" }}>Tamanhos / Prateleira</th>
              <th style={{ padding: "12px" }}>Varejo</th>
              <th style={{ padding: "12px" }}>Atacado</th>
              <th style={{ padding: "12px" }}>Estoque</th>
              <th style={{ padding: "12px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtosProcessados.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>
                  Nenhum produto encontrado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              produtosProcessados.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${cores.borda}`, color: cores.texto, fontSize: "13px" }}>
                  <td style={{ padding: "12px" }}>
                    {p.nome}
                    {p.permiteNegativo && <span style={{ marginLeft: "8px", fontSize: "10px", background: "#ff9f43", color: "#000", padding: "2px 5px", borderRadius: "3px", fontWeight: "bold" }}>Sem Trava</span>}
                  </td>
                  <td style={{ padding: "12px", color: cores.textoSecundario }}>{p.categoria || "—"}</td>
                  <td style={{ padding: "12px", color: cores.textoSecundario }}>{p.referencia || "—"}</td>
                  <td style={{ padding: "12px", fontSize: "11px", color: "#ff9f43", fontWeight: "bold" }}>
                    {p.tamanhos || "—"}
                  </td>
                  <td style={{ padding: "12px" }}>R$ {Number(p.precoVarejo || p.preco || 0).toFixed(2)}</td>
                  <td style={{ padding: "12px", color: "#3182ce" }}>R$ {Number(p.precoAtacado || p.precoVarejo || p.preco || 0).toFixed(2)}</td>
                  <td style={{ padding: "12px", color: p.estoque <= 0 ? "#e53e3e" : p.estoque <= 3 ? "#ff9f43" : "#38a169", fontWeight: "bold" }}>
                    {p.estoque} un
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                      <button onClick={() => carregarParaEdicao(p)} style={{ background: "#007bff", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}>Editar / Recorrer</button>
                      <button onClick={() => handleExcluirProduto(p.id, p.nome)} style={{ background: "#e53e3e", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}