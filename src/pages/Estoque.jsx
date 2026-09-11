import { useState } from "react";
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

export default function Estoque({ 
  produtos, 
  cores, 
  recarregarDados, 
  emitirRelatorioProdutos 
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

  async function handleSalvarProduto(e) {
    e.preventDefault();
    if (!nome.trim() || !precoVarejo || estoque === "") {
      alert("Preencha Nome, Preço Varejo e Estoque.");
      return;
    }

    const codLimpo = codigoBarras.trim() || null;
    const refLimpa = referencia.trim() || null;

    // Bloqueia duplicidade apenas se já existir a mesma Referência COM o mesmo Código de Barras
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
        permiteNegativo: !!permiteNegativo,
      };

      if (produtoEditandoId) {
        await updateDoc(doc(db, "produtos", produtoEditandoId), dados);
        alert("Produto atualizado!");
      } else {
        await addDoc(collection(db, "produtos"), { ...dados, criadoEm: serverTimestamp() });
        alert("Produto cadastrado!");
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2>{produtoEditandoId ? "✏️ Editar Produto" : "Novo Cadastro de Produto"}</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={emitirRelatorioProdutos}
            style={{ background: "#28a745", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            📋 Baixar Relação de Produtos (Inventário)
          </button>
          {produtoEditandoId && (
            <button
              onClick={limparFormularioProduto}
              style={{ background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, padding: "6px 14px", borderRadius: "4px", cursor: "pointer" }}
            >
              ✕ Cancelar Edição
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSalvarProduto}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "15px", background: cores.bgCard, padding: "20px", borderRadius: "8px", marginBottom: "30px", border: `1px solid ${cores.borda}` }}
      >
        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Nome *</label>
          <input type="text" placeholder="Ex: Camiseta Básica" value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Preço Varejo (R$) *</label>
          <input type="number" step="0.01" placeholder="Ex: 89.90" value={precoVarejo} onChange={(e) => setPrecoVarejo(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Preço Atacado (R$)</label>
          <input type="number" step="0.01" placeholder="Ex: 59.90" value={precoAtacado} onChange={(e) => setPrecoAtacado(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Estoque Atual *</label>
          <input type="number" placeholder="Ex: 20" value={estoque} onChange={(e) => setEstoque(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Cód. Barras</label>
          <input type="text" placeholder="Ex: 789123" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Referência</label>
          <input type="text" placeholder="Ex: 1435" value={referencia} onChange={(e) => setReferencia(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "14px", marginBottom: "5px", color: cores.textoSecundario }}>Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "4px", boxSizing: "border-box" }}>
            {CATEGORIAS_PADRAO.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "25px" }}>
          <input
            type="checkbox"
            id="chkNegativo"
            checked={permiteNegativo}
            onChange={(e) => setPermiteNegativo(e.target.checked)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <label htmlFor="chkNegativo" style={{ fontSize: "13px", cursor: "pointer" }}>
            Não travar estoque (permite negativar)
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="submit" disabled={salvandoProduto} style={{ width: "100%", padding: "11px", background: produtoEditandoId ? "#007bff" : "#28a745", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
            {salvandoProduto ? "Gravando..." : produtoEditandoId ? "Atualizar Produto" : "+ Salvar"}
          </button>
        </div>
      </form>

      <h2>Estoque Cadastrado ({produtos.length})</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", background: cores.bgCard, borderRadius: "8px", overflow: "hidden", border: `1px solid ${cores.borda}` }}>
          <thead>
            <tr style={{ background: cores.bgCardSecundario, borderBottom: `2px solid ${cores.borda}` }}>
              <th style={{ padding: "12px" }}>Nome</th>
              <th style={{ padding: "12px" }}>Categoria</th>
              <th style={{ padding: "12px" }}>Ref</th>
              <th style={{ padding: "12px" }}>Cód. Barras</th>
              <th style={{ padding: "12px" }}>Varejo</th>
              <th style={{ padding: "12px" }}>Atacado</th>
              <th style={{ padding: "12px" }}>Estoque</th>
              <th style={{ padding: "12px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${cores.borda}` }}>
                <td style={{ padding: "12px" }}>
                  {p.nome}
                  {p.permiteNegativo && <span style={{ marginLeft: "8px", fontSize: "10px", background: "#ff9f43", color: "#000", padding: "2px 5px", borderRadius: "3px", fontWeight: "bold" }}>Sem Trava</span>}
                </td>
                <td style={{ padding: "12px", color: cores.textoSecundario }}>{p.categoria || "—"}</td>
                <td style={{ padding: "12px", color: cores.textoSecundario }}>{p.referencia || "—"}</td>
                <td style={{ padding: "12px", color: cores.textoSecundario }}>{p.codigoBarras || "—"}</td>
                <td style={{ padding: "12px" }}>R$ {Number(p.precoVarejo || p.preco || 0).toFixed(2)}</td>
                <td style={{ padding: "12px", color: "#3182ce" }}>R$ {Number(p.precoAtacado || p.precoVarejo || p.preco || 0).toFixed(2)}</td>
                <td style={{ padding: "12px", color: p.estoque <= 0 ? "#e53e3e" : p.estoque <= 3 ? "#ff9f43" : "#38a169", fontWeight: "bold" }}>
                  {p.estoque} un
                </td>
                <td style={{ padding: "12px", textAlign: "center", display: "flex", justifyContent: "center", gap: "6px" }}>
                  <button onClick={() => carregarParaEdicao(p)} style={{ background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>Editar</button>
                  <button onClick={() => handleExcluirProduto(p.id, p.nome)} style={{ background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}