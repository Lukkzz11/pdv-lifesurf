import { useState } from "react";
import MenuPrincipal from "./MenuPrincipal";
import EstoqueFabrica from "./EstoqueFabrica";
import Clientes from "./Clientes";

export default function HomePrincipal(props) {
  const [telaAtual, setTelaAtual] = useState("home"); // "home" | "menuPrincipal" | "bi" | "fabrica" | "clientes"
  const [buscaModulo, setBuscaModulo] = useState("");
  const { cores, tema, alternarTema, handleLogout, usuarioLogado, vendas } = props;

  if (telaAtual === "menuPrincipal") {
    return <MenuPrincipal {...props} voltarHome={() => setTelaAtual("home")} />;
  }

  if (telaAtual === "fabrica") {
    return <EstoqueFabrica {...props} voltarHome={() => setTelaAtual("home")} />;
  }

  if (telaAtual === "clientes") {
    return <Clientes {...props} voltarHome={() => setTelaAtual("home")} />;
  }

  // Cálculo dos produtos mais vendidos para o BI
  const rankingProdutos = {};
  if (vendas && Array.isArray(vendas)) {
    vendas.forEach(v => {
      if (v.itens && Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          const nome = item.nome || "Produto Desconhecido";
          const qtd = Number(item.quantidade) || 0;
          rankingProdutos[nome] = (rankingProdutos[nome] || 0) + qtd;
        });
      }
    });
  }

  const rankingOrdenado = Object.entries(rankingProdutos)
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 10);

  const maxQtd = rankingOrdenado.length > 0 ? rankingOrdenado[0].qtd : 1;

  // Tela de BI / Peças Mais Vendidas
  if (telaAtual === "bi") {
    return (
      <div style={{ minHeight: "100vh", background: cores.bgGeral, color: cores.texto, padding: "30px", boxSizing: "border-box", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "22px" }}>📊 BI & Desempenho (Peças Mais Vendidas)</h2>
            <span style={{ fontSize: "13px", color: cores.textoSecundario }}>Análise gráfica baseada nas vendas registradas no PDV.</span>
          </div>
          <button 
            onClick={() => setTelaAtual("home")}
            style={{ background: "#6c757d", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            ⬅️ Voltar ao Painel
          </button>
        </div>

        <div style={{ maxWidth: "800px", margin: "0 auto", background: cores.bgCard, border: `1px solid ${cores.borda}`, borderRadius: "12px", padding: "25px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px" }}>Top 10 Peças com Maior Saída</h3>
          
          {rankingOrdenado.length === 0 ? (
            <p style={{ color: cores.textoSecundario, textAlign: "center", padding: "30px 0" }}>Nenhuma venda registrada até o momento para gerar o gráfico.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {rankingOrdenado.map((item, idx) => {
                const percentual = Math.round((item.qtd / maxQtd) * 100);
                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "5px" }}>
                      <span><strong>{idx + 1}.</strong> {item.nome}</span>
                      <strong style={{ color: "#28a745" }}>{item.qtd} unidades</strong>
                    </div>
                    <div style={{ width: "100%", background: cores.bgCardSecundario || "#2a2a2a", borderRadius: "6px", height: "14px", overflow: "hidden" }}>
                      <div style={{ width: `${percentual}%`, background: "#28a745", height: "100%", borderRadius: "6px", transition: "width 0.4s ease" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const modulos = [
    { 
      id: "pdv", 
      titulo: "Frente de Caixa (PDV)", 
      subtitulo: "Acessar PDV e menu completo", 
      ativo: true, 
      onClick: () => setTelaAtual("menuPrincipal"), 
      icone: "🛒" 
    },
    { 
      id: "bi", 
      titulo: "BI & Peças Mais Saem", 
      subtitulo: "Gráfico de desempenho de vendas", 
      ativo: true, 
      onClick: () => setTelaAtual("bi"), 
      icone: "📈" 
    },
    { 
      id: "estoque_fabrica", 
      titulo: "Estoque & Fábrica", 
      subtitulo: "Controle de produção e envio", 
      ativo: true, 
      onClick: () => setTelaAtual("fabrica"), 
      icone: "🏭" 
    },
    { 
      id: "clientes", 
      titulo: "Clientes", 
      subtitulo: "Cadastro e histórico de clientes", 
      ativo: true, 
      onClick: () => setTelaAtual("clientes"), 
      icone: "👥" 
    },
    { id: "pedido_atacado", titulo: "Pedido Atacado", subtitulo: "Gerenciar pedidos em lote", icone: "📦", ativo: false },
    { id: "catalogos", titulo: "Catálogos Digitais", subtitulo: "Vitrine de produtos", icone: "🌐", ativo: false },
    { id: "relatorios", titulo: "Relatórios Mensais", subtitulo: "Balanço de vendas", icone: "📊", ativo: false },
    { id: "produtos", titulo: "Gestão de Produtos", subtitulo: "Preços e inventário", icone: "🏷️", ativo: false },
    { id: "configuracoes", titulo: "Configurações", subtitulo: "Dados da loja e cupom", icone: "⚙️", ativo: false },
  ];

  const modulosFiltrados = modulos.filter(m => m.titulo.toLowerCase().includes(buscaModulo.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: cores.bgGeral, color: cores.texto, boxSizing: "border-box", fontFamily: "sans-serif", display: "flex", flexDirection: "column" }}>
      
      <style>{`
        .home-card {
          transition: all 0.2s ease-in-out;
        }
        .home-card:hover {
          border-color: #28a745 !important;
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.2);
        }
      `}</style>

      {/* TOPO COM PERFIL NA ESQUERDA E BOTÕES NA DIREITA */}
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 30px", boxSizing: "border-box" }}>
        
        {/* Perfil colado na esquerda */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#3182ce", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontWeight: "bold", fontSize: "15px" }}>
            {usuarioLogado?.email ? usuarioLogado.email[0].toUpperCase() : "U"}
          </div>
          <span style={{ fontSize: "14px", fontWeight: "bold", color: cores.texto }}>{usuarioLogado?.email}</span>
        </div>

        {/* Botões colados na direita */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button onClick={alternarTema} style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${cores.borda}`, background: cores.bgCard, color: cores.texto, cursor: "pointer", fontSize: "14px" }}>
            {tema === "dark" ? "☀️" : "🌙"}
          </button>
          <button onClick={handleLogout} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#e53e35", color: "#fff", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>
            Sair
          </button>
        </div>

      </div>

      {/* CORPO CENTRAL */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 20px 40px 20px", boxSizing: "border-box" }}>
        
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h1 style={{ margin: "0 0 5px 0", fontSize: "26px", color: cores.texto, fontWeight: "600" }}>Painel Inicial</h1>
          <p style={{ margin: 0, color: cores.textoSecundario, fontSize: "14px" }}>Selecione um módulo para começar.</p>
        </div>

        {/* BARRA DE PESQUISA */}
        <div style={{ width: "100%", maxWidth: "700px", position: "relative", marginBottom: "35px" }}>
          <span style={{ position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: cores.textoSecundario }}>🔍</span>
          <input
            type="text"
            placeholder="Pesquisar módulo..."
            value={buscaModulo}
            onChange={(e) => setBuscaModulo(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 14px 14px 50px",
              borderRadius: "30px",
              border: `1px solid ${cores.borda}`,
              background: cores.bgCard,
              color: cores.texto,
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* GRID DE CARDS (5 POR LINHA) */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(5, 1fr)", 
          gap: "20px", 
          width: "100%", 
          maxWidth: "1250px" 
        }}>
          {modulosFiltrados.map((m) => (
            <div
              key={m.id}
              className="home-card"
              onClick={m.onClick}
              style={{
                background: cores.bgCard,
                border: `1px solid ${cores.borda}`,
                borderRadius: "12px",
                padding: "35px 15px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                minHeight: "120px",
                cursor: "pointer",
                boxSizing: "border-box"
              }}
            >
              {m.icone && <div style={{ fontSize: "30px", marginBottom: "10px" }}>{m.icone}</div>}
              <div style={{ fontSize: "13px", fontWeight: "bold", color: cores.texto, letterSpacing: "0.3px" }}>{m.titulo}</div>
              {m.subtitulo && <div style={{ fontSize: "11px", color: cores.textoSecundario, marginTop: "6px" }}>{m.subtitulo}</div>}
            </div>
          ))}
        </div>

      </div>

    </div>
  );
}