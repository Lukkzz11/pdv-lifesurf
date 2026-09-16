import { useState } from "react";
import Pdv from "./Pdv";
import Estoque from "./Estoque";
import Relatorio from "./Relatorio";
import Configuracoes from "./Configuracoes";
import A_ver from "./A_ver";
import PecasComFalha from "./PecasComFalha";

export default function MenuPrincipal(props) {
  const { 
    usuarioLogado, 
    cores, 
    voltarHome,
    produtos,
    vendas,
    caixaAberto,
    setCaixaAberto,
    ultimoFechamentoSalvo,
    setUltimoFechamentoSalvo,
    totalHistoricoConsolidado,
    setTotalHistoricoConsolidado,
    carregarDados,
    setDadosRecibo,
    setDadosFechamentoPdf,
    emitirRelatorioProdutos,
    tema,
    alternarTema,
    handleLogout
  } = props;

  const [telaAtiva, setTelaAtiva] = useState("menu");

  return (
    <div style={{ width: "100vw", minHeight: "100vh", padding: "20px", boxSizing: "border-box", fontFamily: "sans-serif", background: cores.bgGeral, color: cores.texto, margin: 0 }}>
      
      <style>{`
        .menu-card {
          transition: all 0.2s ease-in-out;
        }
        .menu-card:hover {
          border-color: #28a745 !important;
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.2);
        }
        .menu-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 25px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 900px) {
          .menu-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .menu-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* CABEÇALHO DO MENU PRINCIPAL (VOLTA PARA O HOME PRINCIPAL) */}
      {telaAtiva === "menu" && (
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", marginBottom: "20px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", color: cores.texto }}>Painel da Loja</h1>
            <span style={{ fontSize: "12px", color: cores.textoSecundario, borderLeft: `1px solid ${cores.bordaClara}`, paddingLeft: "10px" }}>
              👤 {usuarioLogado?.email}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {voltarHome && (
              <button
                onClick={voltarHome}
                style={{ padding: "8px 14px", borderRadius: "6px", border: `1px solid ${cores.borda}`, background: cores.bgCardSecundario, color: cores.texto, cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                ⬅️ Voltar ao Painel Inicial
              </button>
            )}
            <button
              onClick={alternarTema}
              style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${cores.borda}`, background: cores.bgCard, color: cores.texto, cursor: "pointer", fontSize: "13px" }}
            >
              {tema === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={handleLogout}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#e53e35", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
            >
              Sair 🚪
            </button>
          </div>
        </header>
      )}

      {/* CABEÇALHO DENTRO DAS TELAS OPERACIONAIS (VOLTA PARA O MENU PRINCIPAL) */}
      {telaAtiva !== "menu" && (
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", marginBottom: "20px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", color: cores.texto }}>
              {telaAtiva === "pdv" && "PDV"}
              {telaAtiva === "estoque" && "Produtos e Estoque"}
              {telaAtiva === "historico" && "Relatórios & Caixa"}
              {telaAtiva === "a_ver" && "Mercadorias A Ver / Prova"}
              {telaAtiva === "pecas_falha" && "Peças com Falha"}
              {telaAtiva === "config" && "Configurações"}
            </h1>
            {telaAtiva === "pdv" && (
              <span style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "12px", background: caixaAberto ? "#28a745" : "#e53e3e", color: "#fff", fontWeight: "bold" }}>
                {caixaAberto ? `Caixa Aberto (${caixaAberto.dataString})` : "Caixa Fechado"}
              </span>
            )}
            <span style={{ fontSize: "12px", color: cores.textoSecundario, borderLeft: `1px solid ${cores.bordaClara}`, paddingLeft: "10px" }}>
              👤 {usuarioLogado?.email}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setTelaAtiva("menu")}
              style={{ padding: "8px 14px", borderRadius: "6px", border: `1px solid ${cores.borda}`, background: cores.bgCardSecundario, color: cores.texto, cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
            >
              🏠 Menu Principal
            </button>
            <button
              onClick={alternarTema}
              style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${cores.borda}`, background: cores.bgCard, color: cores.texto, cursor: "pointer", fontSize: "13px" }}
            >
              {tema === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={handleLogout}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#e53e35", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
            >
              Sair 🚪
            </button>
          </div>
        </header>
      )}

      {/* TELA DE MENU PRINCIPAL (PAINEL CENTRALIZADO EM GRID 3x2) */}
      {telaAtiva === "menu" && (
        <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "40px 30px 60px 30px", boxSizing: "border-box", textAlign: "center" }}>
          <h1 style={{ marginBottom: "10px", color: cores.texto, fontSize: "28px" }}>Escolha uma Opção</h1>
          <p style={{ color: cores.textoSecundario, marginBottom: "40px", fontSize: "15px" }}>Gerencie sua frente de caixa, estoque e relatórios de forma isolada.</p>

          <div className="menu-grid">
            
            <div 
              className="menu-card"
              onClick={() => setTelaAtiva("pdv")}
              style={{ background: cores.bgCard, padding: "30px 20px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${cores.borda}`, transition: "0.2s" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🛒</div>
              <h3 style={{ margin: "0 0 6px 0", color: cores.texto, fontSize: "17px" }}>Frente de Caixa (PDV)</h3>
              <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Realizar vendas e cupons</p>
            </div>

            <div 
              className="menu-card"
              onClick={() => setTelaAtiva("estoque")}
              style={{ background: cores.bgCard, padding: "30px 20px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${cores.borda}`, transition: "0.2s" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📦</div>
              <h3 style={{ margin: "0 0 6px 0", color: cores.texto, fontSize: "17px" }}>Produtos e Estoque</h3>
              <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Cadastrar e gerenciar produtos</p>
            </div>

            <div 
              className="menu-card"
              onClick={() => {
                carregarDados();
                setTelaAtiva("historico");
              }}
              style={{ background: cores.bgCard, padding: "30px 20px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${cores.borda}`, transition: "0.2s" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📊</div>
              <h3 style={{ margin: "0 0 6px 0", color: cores.texto, fontSize: "17px" }}>Relatórios & Caixa</h3>
              <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Fechamento e histórico de vendas</p>
            </div>

            <div 
              className="menu-card"
              onClick={() => setTelaAtiva("a_ver")}
              style={{ background: cores.bgCard, padding: "30px 20px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${cores.borda}`, transition: "0.2s" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🛍️</div>
              <h3 style={{ margin: "0 0 6px 0", color: cores.texto, fontSize: "17px" }}>Mercadorias A Ver</h3>
              <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Controle de provas e pagamentos</p>
            </div>

            <div 
              className="menu-card"
              onClick={() => setTelaAtiva("pecas_falha")}
              style={{ background: cores.bgCard, padding: "30px 20px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${cores.borda}`, transition: "0.2s" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚠️</div>
              <h3 style={{ margin: "0 0 6px 0", color: cores.texto, fontSize: "17px" }}>Peças com Falha</h3>
              <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Controle de peças com defeito</p>
            </div>

            <div 
              className="menu-card"
              onClick={() => setTelaAtiva("config")}
              style={{ background: cores.bgCard, padding: "30px 20px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${cores.borda}`, transition: "0.2s" }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚙️</div>
              <h3 style={{ margin: "0 0 6px 0", color: cores.texto, fontSize: "17px" }}>Configurações</h3>
              <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Logo, cupom e dados da loja</p>
            </div>

          </div>
        </div>
      )}

      {/* RENDERIZAÇÃO DAS PÁGINAS */}
      {telaAtiva === "pdv" && (
        <Pdv
          produtos={produtos}
          caixaAberto={caixaAberto}
          usuarioLogado={usuarioLogado}
          cores={cores}
          tema={tema}
          recarregarDados={carregarDados}
          setDadosRecibo={(recibo) => {
            setDadosFechamentoPdf(null);
            setDadosRecibo(recibo);
          }}
        />
      )}

      {telaAtiva === "estoque" && (
        <Estoque
          produtos={produtos}
          cores={cores}
          recarregarDados={carregarDados}
          emitirRelatorioProdutos={emitirRelatorioProdutos}
          usuarioLogado={usuarioLogado}
        />
      )}

      {telaAtiva === "historico" && (
        <Relatorio
          vendas={vendas}
          produtos={produtos}
          caixaAberto={caixaAberto}
          setCaixaAberto={setCaixaAberto}
          usuarioLogado={usuarioLogado}
          cores={cores}
          ultimoFechamentoSalvo={ultimoFechamentoSalvo}
          setUltimoFechamentoSalvo={setUltimoFechamentoSalvo}
          totalHistoricoConsolidado={totalHistoricoConsolidado}
          setTotalHistoricoConsolidado={setTotalHistoricoConsolidado}
          recarregarDados={carregarDados}
          setDadosRecibo={setDadosRecibo}
          setDadosFechamentoPdf={(dados) => {
            setDadosRecibo(null);
            setDadosFechamentoPdf(dados);
          }}
        />
      )}

      {telaAtiva === "a_ver" && (
        <A_ver
          cores={cores}
          usuarioLogado={usuarioLogado}
          voltarHome={() => setTelaAtiva("menu")}
        />
      )}

      {telaAtiva === "pecas_falha" && (
        <PecasComFalha
          cores={cores}
          usuarioLogado={usuarioLogado}
          produtos={produtos}
          recarregarDados={carregarDados}
          irParaEstoque={() => setTelaAtiva("estoque")}
        />
      )}

      {telaAtiva === "config" && (
        <Configuracoes
          usuarioLogado={usuarioLogado}
          cores={cores}
          recarregarConfigLoja={carregarDados}
        />
      )}

    </div>
  );
}