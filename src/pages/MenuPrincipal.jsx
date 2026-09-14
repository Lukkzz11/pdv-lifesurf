import { useState } from "react";

export default function MenuPrincipal({ usuarioLogado, cores, recarregarDados }) {
  // Estado para controlar qual tela está aberta ("menu", "pdv", "estoque", "relatorio", "config")
  const [telaAtiva, setTelaAtiva] = useState("menu");

  // O ID da loja será o próprio UID do usuário logado no Firebase Auth
  const lojaId = usuarioLogado?.uid || "loja_padrao";

  return (
    <div style={{ minHeight: "100vh", background: cores?.bgGeral || "#f4f6f8", padding: "20px", color: cores?.texto || "#333" }}>
      
      {/* TOPO COM LOGO E INFO DO USUÁRIO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores?.bgCard || "#fff", padding: "15px 25px", borderRadius: "10px", marginBottom: "25px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>🏪 Painel da Loja</h2>
          <span style={{ fontSize: "13px", color: cores?.textoSecundario || "#666" }}>Logado como: <b>{usuarioLogado?.email}</b></span>
        </div>
        {telaAtiva !== "menu" && (
          <button 
            onClick={() => setTelaAtiva("menu")}
            style={{ background: "#6c757d", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            ⬅️ Voltar ao Menu
          </button>
        )}
      </div>

      {/* CONTEÚDO DA TELA ATIVA */}
      {telaAtiva === "menu" && (
        <div style={{ maxWidth: "800px", margin: "40px auto", textAlign: "center" }}>
          <h1 style={{ marginBottom: "10px" }}>Escolha uma Opção</h1>
          <p style={{ color: cores?.textoSecundario || "#666", marginBottom: "30px" }}>Gerencie sua frente de caixa, estoque e relatórios de forma isolada.</p>

          {/* GRID DE BOTÕES DO MENU */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            
            <div 
              onClick={() => setTelaAtiva("pdv")}
              style={{ background: cores?.bgCard || "#fff", padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #28a745`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🛒</div>
              <h3 style={{ margin: "0 0 5px 0" }}>Frente de Caixa (PDV)</h3>
              <p style={{ fontSize: "12px", color: cores?.textoSecundario || "#666", margin: 0 }}>Realizar vendas e emitir cupons</p>
            </div>

            <div 
              onClick={() => setTelaAtiva("estoque")}
              style={{ background: cores?.bgCard || "#fff", padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #007bff`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📦</div>
              <h3 style={{ margin: "0 0 5px 0" }}>Produtos e Estoque</h3>
              <p style={{ fontSize: "12px", color: cores?.textoSecundario || "#666", margin: 0 }}>Cadastrar e gerenciar produtos</p>
            </div>

            <div 
              onClick={() => setTelaAtiva("relatorio")}
              style={{ background: cores?.bgCard || "#fff", padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #ffc107`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📊</div>
              <h3 style={{ margin: "0 0 5px 0" }}>Relatórios & Arquivo</h3>
              <p style={{ fontSize: "12px", color: cores?.textoSecundario || "#666", margin: 0 }}>Fechamento e histórico de 30 dias</p>
            </div>

            <div 
              onClick={() => setTelaAtiva("config")}
              style={{ background: cores?.bgCard || "#fff", padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #a55eea`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚙️</div>
              <h3 style={{ margin: "0 0 5px 0" }}>Configurações</h3>
              <p style={{ fontSize: "12px", color: cores?.textoSecundario || "#666", margin: 0 }}>Logo, cupom e dados da loja</p>
            </div>

          </div>
        </div>
      )}

      {/* RENDERIZAÇÃO DAS TELAS ESCOLHIDAS */}
      {telaAtiva === "pdv" && (
        <div style={{ background: cores?.bgCard || "#fff", padding: "20px", borderRadius: "10px" }}>
          <h2>Frente de Caixa (PDV)</h2>
          <p>Aqui entrará o PDV conectado ao lojaId: <b>{lojaId}</b></p>
          {/* Vamos encaixar o seu PDV aqui */}
        </div>
      )}

      {telaAtiva === "estoque" && (
        <div style={{ background: cores?.bgCard || "#fff", padding: "20px", borderRadius: "10px" }}>
          <h2>Gerenciamento de Estoque</h2>
          <p>Aqui entrará o estoque conectado ao lojaId: <b>{lojaId}</b></p>
          {/* Vamos encaixar o seu Estoque aqui */}
        </div>
      )}

      {telaAtiva === "relatorio" && (
        <div style={{ background: cores?.bgCard || "#fff", padding: "20px", borderRadius: "10px" }}>
          <h2>Relatórios e Histórico (30 Dias)</h2>
          <p>Aqui entrará a listagem separada por dias (11, 12, 13...) e o aviso de limpeza.</p>
          {/* Vamos encaixar o Relatório aqui */}
        </div>
      )}

      {telaAtiva === "config" && (
        <div style={{ background: cores?.bgCard || "#fff", padding: "20px", borderRadius: "10px" }}>
          <h2>Configurações da Loja & Editor de Cupom</h2>
          <p>Aqui você poderá alterar a Logo e dados do cupom fiscal não fiscal.</p>
          {/* Vamos encaixar a tela de Configurações aqui */}
        </div>
      )}

    </div>
  );
}