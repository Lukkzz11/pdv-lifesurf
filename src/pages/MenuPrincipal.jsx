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
            {/* BOTÃO VOLTAR AO MENU (só aparece se não estiver no menu) */}
            {abaAtiva !== "menu" && (
              <button
                onClick={() => setAbaAtiva("menu")}
                style={{ padding: "8px 14px", borderRadius: "6px", border: `1px solid ${cores.borda}`, background: cores.bgCardSecundario, color: cores.texto, cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                🏠 Menu Principal
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
              style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#e53e3e", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
            >
              Sair 🚪
            </button>
          </div>
        </header>

        {/* TELA DE MENU PRINCIPAL (CENTRAL) */}
        {abaAtiva === "menu" && (
          <div style={{ maxWidth: "800px", margin: "40px auto", textAlign: "center" }}>
            <h1 style={{ marginBottom: "10px" }}>Escolha uma Opção</h1>
            <p style={{ color: cores.textoSecundario, marginBottom: "30px" }}>Gerencie sua frente de caixa, estoque e relatórios de forma isolada.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
              
              <div 
                onClick={() => setAbaAtiva("pdv")}
                style={{ background: cores.bgCard, padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #28a745`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>🛒</div>
                <h3 style={{ margin: "0 0 5px 0", color: cores.texto }}>Frente de Caixa (PDV)</h3>
                <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Realizar vendas e emitir cupons</p>
              </div>

              <div 
                onClick={() => setAbaAtiva("estoque")}
                style={{ background: cores.bgCard, padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #007bff`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📦</div>
                <h3 style={{ margin: "0 0 5px 0", color: cores.texto }}>Produtos e Estoque</h3>
                <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Cadastrar e gerenciar produtos</p>
              </div>

              <div 
                onClick={() => {
                  carregarDados();
                  setAbaAtiva("historico");
                }}
                style={{ background: cores.bgCard, padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #ffc107`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📊</div>
                <h3 style={{ margin: "0 0 5px 0", color: cores.texto }}>Relatórios & Caixa</h3>
                <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Fechamento e histórico de vendas</p>
              </div>

              <div 
                onClick={() => setAbaAtiva("config")}
                style={{ background: cores.bgCard, padding: "30px", borderRadius: "12px", cursor: "pointer", border: `2px solid #a55eea`, transition: "0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}
              >
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚙️</div>
                <h3 style={{ margin: "0 0 5px 0", color: cores.texto }}>Configurações</h3>
                <p style={{ fontSize: "12px", color: cores.textoSecundario, margin: 0 }}>Logo, cupom e dados da loja</p>
              </div>

            </div>
          </div>
        )}

        {/* PÁGINAS RENDERIZADAS QUANDO ESCOLHIDAS */}
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
            usuarioLogado={usuarioLogado}
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

        {abaAtiva === "config" && (
          <div style={{ background: cores.bgCard, padding: "30px", borderRadius: "10px", maxWidth: "600px", margin: "20px auto" }}>
            <h2>⚙️ Configurações da Loja</h2>
            <p style={{ color: cores.textoSecundario }}>Aqui em breve teremos o editor de cupom fiscal e o upload da logo da loja.</p>
          </div>
        )}

      </div>