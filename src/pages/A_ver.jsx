import { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  increment 
} from "firebase/firestore";

const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];

export default function A_ver({ cores, usuarioLogado, voltarHome }) {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");

  async function carregarPedidosAVer() {
    try {
      const snap = await getDocs(collection(db, "pedidos"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.tipo === "mercadoria_a_ver" && (!p.lojaId || p.lojaId === lojaIdAtual));
      setPedidos(lista);
    } catch (err) {
      console.error("Erro ao carregar mercadorias a ver:", err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarPedidosAVer();
  }, []);

  async function marcarComoPago(id, cliente) {
    if (!confirm(`Confirmar que ${cliente} pagou esta mercadoria?`)) return;
    try {
      await updateDoc(doc(db, "pedidos", id), { status: "pago" });
      alert("Marcado como Pago com sucesso!");
      carregarPedidosAVer();
    } catch (err) {
      alert("Erro ao atualizar: " + err.message);
    }
  }

  async function marcarComoDevolvido(pedido) {
    if (!confirm(`Confirmar devolução dos itens de ${pedido.cliente}? O estoque será reposto automaticamente.`)) return;
    try {
      if (pedido.itens && Array.isArray(pedido.itens)) {
        for (const item of pedido.itens) {
          const prodRef = doc(db, "produtos", item.id);
          await updateDoc(prodRef, {
            estoque: increment(item.quantidade)
          });
        }
      }

      await updateDoc(doc(db, "pedidos", pedido.id), { status: "devolvido" });
      alert("Mercadoria devolvida e estoque reposto!");
      carregarPedidosAVer();
    } catch (err) {
      alert("Erro ao processar devolução: " + err.message);
    }
  }

  const totalPago = pedidos
    .filter(p => p.status === "pago")
    .reduce((acc, p) => acc + (Number(p.valorTotalMercadoria) || 0), 0);

  const totalPendente = pedidos
    .filter(p => p.status === "pendente_prova" || !p.status)
    .reduce((acc, p) => acc + (Number(p.valorTotalMercadoria) || 0), 0);

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "20px", boxSizing: "border-box", background: cores.bgGeral, color: cores.texto, fontFamily: "sans-serif" }}>
      
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-content { display: block !important; width: 100% !important; font-family: Arial, sans-serif; }
        }
        @media screen {
          .print-content { display: none; }
        }
      `}</style>

      {/* ÁREA DE IMPRESSÃO / PDF */}
      <div className="print-content" style={{ padding: "20px", color: "#000" }}>
        <h1 style={{ fontSize: "20px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>RELAÇÃO DE MERCADORIAS A VER / PROVA</h1>
        <p style={{ fontSize: "12px" }}>Emitido em: {new Date().toLocaleString("pt-BR")}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "15px", fontSize: "11px" }}>
          <thead>
            <tr style={{ background: "#f0f0f0", borderBottom: "2px solid #000" }}>
              <th style={{ padding: "6px", textAlign: "left" }}>Data</th>
              <th style={{ padding: "6px", textAlign: "left" }}>Cliente / Responsável</th>
              <th style={{ padding: "6px", textAlign: "left" }}>Itens / O que pegou</th>
              <th style={{ padding: "6px", textAlign: "right" }}>Valor (R$)</th>
              <th style={{ padding: "6px", textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "6px" }}>{p.dataRetirada || "—"}</td>
                <td style={{ padding: "6px" }}><strong>{p.cliente}</strong> {p.isJarbasOuLucas ? "(Sócio)" : ""}</td>
                <td style={{ padding: "6px" }}>{p.itensDescricao}</td>
                <td style={{ padding: "6px", textAlign: "right" }}>R$ {Number(p.valorTotalMercadoria || 0).toFixed(2)}</td>
                <td style={{ padding: "6px", textAlign: "center" }}>{p.status === "pago" ? "PAGO" : p.status === "devolvido" ? "DEVOLVIDO" : "PENDENTE"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TELA NORMAL */}
      <div className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px" }}>🛍️ Controle de Mercadorias A Ver / Prova</h1>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>Acompanhe quem retirou peças, valores e dê baixa por pagamento ou devolução.</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => window.print()} style={{ background: "#17a2b8", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              🖨️ Baixar Relação (PDF)
            </button>
            {voltarHome && (
              <button onClick={voltarHome} style={{ background: "#6c757d", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
                🏠 Início
              </button>
            )}
          </div>
        </div>

        {/* CARDS DE RESUMO FINANCEIRO */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <div style={{ background: cores.bgCard, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>💰 Total Entrado (Pago):</span>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#28a745", marginTop: "5px" }}>R$ {totalPago.toFixed(2)}</div>
          </div>
          <div style={{ background: cores.bgCard, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>⏳ Total Pendente:</span>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#e67e22", marginTop: "5px" }}>R$ {totalPendente.toFixed(2)}</div>
          </div>
        </div>

        <h3 style={{ marginBottom: "15px", fontSize: "16px" }}>Lista de Registros</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "700px" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.textoSecundario, fontSize: "12px" }}>
                <th style={{ padding: "10px" }}>Data</th>
                <th style={{ padding: "10px" }}>Nome (Quem pegou)</th>
                <th style={{ padding: "10px" }}>O que pegou (Itens)</th>
                <th style={{ padding: "10px" }}>Valor</th>
                <th style={{ padding: "10px" }}>Status</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>Nenhuma mercadoria a ver registrada.</td></tr>
              ) : (
                pedidos.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${cores.borda}`, fontSize: "13px" }}>
                    <td style={{ padding: "10px", color: cores.textoSecundario }}>{p.dataRetirada || "—"}</td>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>
                      {p.cliente}
                      {p.isJarbasOuLucas && <span style={{ marginLeft: "6px", fontSize: "10px", background: "#8e44ad", color: "#fff", padding: "2px 5px", borderRadius: "3px" }}>Sócio</span>}
                    </td>
                    <td style={{ padding: "10px", fontSize: "12px" }}>{p.itensDescricao} {p.observacao ? `| Obs: ${p.observacao}` : ""}</td>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>R$ {Number(p.valorTotalMercadoria || 0).toFixed(2)}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ 
                        padding: "3px 8px", 
                        borderRadius: "4px", 
                        fontSize: "11px", 
                        fontWeight: "bold",
                        background: p.status === "pago" ? "rgba(40,167,69,0.2)" : p.status === "devolvido" ? "rgba(108,117,125,0.2)" : "rgba(230,126,34,0.2)",
                        color: p.status === "pago" ? "#28a745" : p.status === "devolvido" ? "#6c757d" : "#e67e22"
                      }}>
                        {p.status === "pago" ? "PAGO" : p.status === "devolvido" ? "DEVOLVIDO" : "PENDENTE"}
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      {p.status !== "pago" && p.status !== "devolvido" && (
                        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                          <button onClick={() => marcarComoPago(p.id, p.cliente)} style={{ background: "#28a745", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Marcar Pago</button>
                          <button onClick={() => marcarComoDevolvido(p)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Devolveu</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}