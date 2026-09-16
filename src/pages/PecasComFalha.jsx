import { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];

export default function PecasComFalha({ cores, usuarioLogado, voltarHome, irParaEstoque }) {
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal de Novo Registro / Falha
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoNome, setProdutoNome] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [falha, setFalha] = useState("");
  const [cliente, setCliente] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");

  async function carregarPecasComFalha() {
    try {
      const snap = await getDocs(collection(db, "pecas_com_falha"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.lojaId || p.lojaId === lojaIdAtual);
      setPecas(lista);
    } catch (err) {
      console.error("Erro ao carregar peças com falha:", err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarPecasComFalha();
  }, []);

  async function handleSalvar(e) {
    e.preventDefault();
    if (!produtoNome.trim() || !falha.trim()) {
      alert("Preencha o nome do produto e a descrição da falha!");
      return;
    }

    setSalvando(true);
    try {
      await addDoc(collection(db, "pecas_com_falha"), {
        lojaId: lojaIdAtual,
        produtoNome: produtoNome.trim(),
        tamanho: tamanho.trim() || "Único",
        falha: falha.trim(),
        cliente: cliente.trim() || "Balcão / Loja",
        status: "pendente",
        data: serverTimestamp(),
        dataString: new Date().toLocaleDateString("pt-BR")
      });

      alert("Peça com falha registrada com sucesso!");
      setModalAberto(false);
      setProdutoNome("");
      setTamanho("");
      setFalha("");
      setCliente("");
      carregarPecasComFalha();
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(id, novoStatus) {
    try {
      await updateDoc(doc(db, "pecas_com_falha", id), { status: novoStatus });
      await carregarPecasComFalha();
      if (novoStatus === "resolvido" && typeof irParaEstoque === "function") {
        irParaEstoque();
      }
    } catch (err) {
      alert("Erro ao atualizar status: " + err.message);
    }
  }

  async function excluirRegistro(id) {
    if (!confirm("Deseja excluir este registro de peça com falha?")) return;
    try {
      await deleteDoc(doc(db, "pecas_com_falha", id));
      carregarPecasComFalha();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  }

  const pecasFiltradas = useMemo(() => {
    return pecas.filter(p => {
      const termo = busca.trim().toLowerCase();
      const bateBusca = !termo || 
        p.produtoNome?.toLowerCase().includes(termo) ||
        p.cliente?.toLowerCase().includes(termo) ||
        p.falha?.toLowerCase().includes(termo);

      const bateStatus = filtroStatus === "TODOS" || p.status === filtroStatus;

      return bateBusca && bateStatus;
    });
  }, [pecas, busca, filtroStatus]);

  function baixarRelatorioPdf() {
    if (pecasFiltradas.length === 0) {
      alert("Não há registros para exportar com os filtros atuais.");
      return;
    }

    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const dataAtualStr = `${dia}/${mes}/${ano}`;

    const perfilStr = usuarioLogado?.email ? `@${usuarioLogado.email.split('@')[0]}` : "@sistema";

    const doc = new jsPDF("portrait", "mm", "a4");

    // Cabeçalho Corporativo Monocromático
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text("PEÇAS COM FALHA", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Relatório de controle de peças com falha e defeito", 14, 26);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(`Data de emissão: ${dataAtualStr}`, 196, 20, { align: "right" });
    doc.text(`Responsável: ${perfilStr}`, 196, 26, { align: "right" });

    // Linha divisória do cabeçalho
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(14, 32, 196, 32);

    // Resumo / KPIs calculados a partir de pecasFiltradas
    const total = pecasFiltradas.length;
    const pendentes = pecasFiltradas.filter(p => !p.status || p.status === "pendente").length;
    const fornecedor = pecasFiltradas.filter(p => p.status === "fornecedor").length;
    const resolvidos = pecasFiltradas.filter(p => p.status === "resolvido").length;

    // Caixa de Resumo Executivo (Monocromática)
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(210, 210, 210);
    doc.roundedRect(14, 37, 182, 16, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("TOTAL DE REGISTROS", 20, 43);
    doc.text("PENDENTES", 68, 43);
    doc.text("COM FORNECEDOR", 115, 43);
    doc.text("RESOLVIDOS", 162, 43);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);
    doc.text(String(total), 20, 49);
    doc.text(String(pendentes), 68, 49);
    doc.text(String(fornecedor), 115, 49);
    doc.text(String(resolvidos), 162, 49);

    // Tabela de Dados
    const tableColumn = ["Data", "Cliente", "Produto", "Tamanho", "Descrição da Falha", "Status"];
    const tableRows = pecasFiltradas.map(p => {
      let statusText = "Pendente";
      if (p.status === "fornecedor") statusText = "C/ Fornecedor";
      else if (p.status === "resolvido") statusText = "Resolvido";

      return [
        p.dataString || "—",
        p.cliente || "—",
        p.produtoNome || "—",
        p.tamanho || "—",
        p.falha || "—",
        statusText
      ];
    });

    autoTable(doc, {
      startY: 58,
      head: [tableColumn],
      body: tableRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
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
        0: { cellWidth: 20 }, // Data
        1: { cellWidth: 32 }, // Cliente
        2: { cellWidth: 35 }, // Produto
        3: { cellWidth: 15 }, // Tamanho
        4: { cellWidth: 52 }, // Descrição da Falha
        5: { cellWidth: 28 }  // Status
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        
        const footerText = `Relatório de Peças com Falha  |  Página ${data.pageNumber} de ${pageCount}`;
        doc.text(footerText, 14, 290);

        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.4);
        doc.line(14, 286, 196, 286);
      },
      margin: { top: 58, right: 14, bottom: 20, left: 14 }
    });

    // Área de Assinatura Profissional
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 245) {
      doc.addPage();
      finalY = 30;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 50);
    doc.text("Assinatura do Responsável", 14, finalY);

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.5);
    doc.line(14, finalY + 22, 110, finalY + 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Nome / Assinatura", 14, finalY + 27);
    doc.text(`Responsável: ${perfilStr}`, 14, finalY + 32);

    doc.save(`relatorio-pecas-com-falha-${dia}-${mes}-${ano}.pdf`);
  }

  const inputStyle = {
    width: "100%",
    padding: "10px",
    background: cores.inputBg || cores.bgCard || "transparent",
    border: `1px solid ${cores.borda}`,
    color: cores.texto,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "13px",
    outline: "none"
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "20px", boxSizing: "border-box", background: cores.bgGeral, color: cores.texto, fontFamily: "sans-serif" }}>
      
      {/* CABEÇALHO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", color: cores.texto }}>⚠️ Controle de Peças com Falha / Defeito</h1>
          <span style={{ fontSize: "12px", color: cores.textoSecundario }}>Gerencie trocas por defeito, controle o histórico com fornecedores e o status das peças.</span>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => setModalAberto(true)} style={{ background: "#e67e22", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
            + Registrar Peça com Falha
          </button>
          <button onClick={baixarRelatorioPdf} style={{ background: cores.bgCardSecundario || cores.bgCard, color: cores.texto, border: `1px solid ${cores.borda}`, padding: "9px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
            📥 Baixar Relatório (PDF)
          </button>
          {voltarHome && (
            <button onClick={voltarHome} style={{ background: "#6c757d", color: "#fff", border: "none", padding: "9px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
              🏠 Início
            </button>
          )}
        </div>
      </div>

      {/* FILTROS E PESQUISA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>🔍 Pesquisar:</label>
          <input
            type="text"
            placeholder="Produto, cliente ou falha..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>📌 Filtrar por Status:</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={inputStyle}>
            <option value="TODOS" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>Todos os Status</option>
            <option value="pendente" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>Pendente / Análise</option>
            <option value="fornecedor" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>Enviado ao Fornecedor</option>
            <option value="resolvido" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>Resolvido / Solucionado</option>
          </select>
        </div>
      </div>

      {/* TABELA DE PEÇAS COM FALHA */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "750px" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.textoSecundario, fontSize: "12px" }}>
              <th style={{ padding: "12px" }}>Data</th>
              <th style={{ padding: "12px" }}>Cliente</th>
              <th style={{ padding: "12px" }}>Produto</th>
              <th style={{ padding: "12px" }}>Tamanho</th>
              <th style={{ padding: "12px" }}>Descrição da Falha</th>
              <th style={{ padding: "12px" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pecasFiltradas.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: "25px", textAlign: "center", color: cores.textoSecundario }}>
                  Nenhuma peça com falha registrada.
                </td>
              </tr>
            ) : (
              pecasFiltradas.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${cores.borda}`, fontSize: "13px", color: cores.texto }}>
                  <td style={{ padding: "12px", color: cores.textoSecundario }}>{p.dataString || "—"}</td>
                  <td style={{ padding: "12px", fontWeight: "bold" }}>{p.cliente}</td>
                  <td style={{ padding: "12px" }}>{p.produtoNome}</td>
                  <td style={{ padding: "12px", fontWeight: "bold", color: "#e67e22" }}>{p.tamanho}</td>
                  <td style={{ padding: "12px" }}>{p.falha}</td>
                  <td style={{ padding: "12px" }}>
                    <select
                      value={p.status || "pendente"}
                      onChange={(e) => alterarStatus(p.id, e.target.value)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        fontSize: "11px",
                        border: `1px solid ${cores.borda}`,
                        background: p.status === "resolvido" ? "rgba(40,167,69,0.2)" : p.status === "fornecedor" ? "rgba(0,123,255,0.2)" : "rgba(230,126,34,0.2)",
                        color: p.status === "resolvido" ? "#28a745" : p.status === "fornecedor" ? "#007bff" : "#e67e22"
                      }}
                    >
                      <option value="pendente" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>Pendente</option>
                      <option value="fornecedor" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>C/ Fornecedor</option>
                      <option value="resolvido" style={{ background: cores.bgCard || cores.bgGeral, color: cores.texto }}>Resolvido</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <button onClick={() => excluirRegistro(p.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                      🗑️ Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE NOVO REGISTRO */}
      {modalAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, color: cores.texto, padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "420px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 15px 0", fontSize: "18px", color: cores.texto }}>⚠️ Registrar Peça com Falha</h3>
            <form onSubmit={handleSalvar}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Nome do Produto / Peça *</label>
                <input type="text" placeholder="Ex: Camisa Polo Coringa" value={produtoNome} onChange={e => setProdutoNome(e.target.value)} style={inputStyle} required />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Tamanho</label>
                <input type="text" placeholder="Ex: G ou 42" value={tamanho} onChange={e => setTamanho(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Descrição da Falha / Defeito *</label>
                <textarea placeholder="Ex: Costura solta na gola, mancha de tecido..." value={falha} onChange={e => setFalha(e.target.value)} style={{ ...inputStyle, height: "80px", resize: "vertical" }} required />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Cliente / Origem</label>
                <input type="text" placeholder="Ex: Ana / Balcão" value={cliente} onChange={e => setCliente(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario || cores.bgCard, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{ flex: 1, padding: "10px", background: "#e67e22", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{salvando ? "Salvando..." : "Salvar Registro"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}