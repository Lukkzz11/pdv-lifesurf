import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp 
} from "firebase/firestore";

const TAXAS_CARTAO = {
  1: { taxa: 0.05, label: "1x (5%)" },
  2: { taxa: 0.07, label: "2x (7%)" },
  3: { taxa: 0.09, label: "3x (9%)" },
  4: { taxa: 0.10, label: "4x (10%)" },
};

const FORMAS_PAGAMENTO = [
  "Pix",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Dinheiro"
];

export default function Pdv({ 
  produtos, 
  caixaAberto, 
  usuarioLogado, 
  cores, 
  tema, 
  recarregarDados, 
  setDadosRecibo 
}) {
  const [tipoTabela, setTipoTabela] = useState("varejo");
  const [carrinho, setCarrinho] = useState([]);
  const [buscaPdv, setBuscaPdv] = useState("");
  const [indiceFocoBusca, setIndiceFocoBusca] = useState(0);
  const [processandoVenda, setProcessandoVenda] = useState(false);

  // Modais de Quantidade e Preço
  const [produtoModal, setProdutoModal] = useState(null);
  const [qtdInput, setQtdInput] = useState("1");
  const inputQtdRef = useRef(null);
  const inputBuscaRef = useRef(null);

  // Modal de Edição de Preço do Item no Carrinho
  const [itemEditandoPreco, setItemEditandoPreco] = useState(null);
  const [novoPrecoInput, setNovoPrecoInput] = useState("");
  const inputPrecoRef = useRef(null);

  // Modal de Ajuda / Atalhos (F1)
  const [modalAtalhosAberto, setModalAtalhosAberto] = useState(false);

  // Fluxo de Fechamento por Teclado
  const [modalDescontoAberto, setModalDescontoAberto] = useState(false);
  const [tipoDesconto, setTipoDesconto] = useState("reais");
  const [valorDescontoInput, setValorDescontoInput] = useState("");
  const [descontoAplicado, setDescontoAplicado] = useState({ tipo: "reais", valor: 0, totalDescontado: 0 });
  const inputDescontoRef = useRef(null);

  const [modalFormaPagtoAberto, setModalFormaPagtoAberto] = useState(false);
  const [indiceFormaPagto, setIndiceFormaPagto] = useState(0);

  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [indiceParcela, setIndiceParcela] = useState(0);

  const [modalDinheiroAberto, setModalDinheiroAberto] = useState(false);
  const [valorEntregueInput, setValorEntregueInput] = useState("");
  const inputDinheiroRef = useRef(null);

  // Foco inteligente
  useEffect(() => {
    if (produtoModal && inputQtdRef.current) {
      inputQtdRef.current.focus();
      inputQtdRef.current.select();
    } else if (itemEditandoPreco && inputPrecoRef.current) {
      inputPrecoRef.current.focus();
      inputPrecoRef.current.select();
    } else if (modalDescontoAberto && inputDescontoRef.current) {
      inputDescontoRef.current.focus();
      inputDescontoRef.current.select();
    } else if (modalDinheiroAberto && inputDinheiroRef.current) {
      inputDinheiroRef.current.focus();
      inputDinheiroRef.current.select();
    } else if (
      !produtoModal && 
      !itemEditandoPreco &&
      !modalAtalhosAberto &&
      !modalDescontoAberto && 
      !modalFormaPagtoAberto && 
      !modalCartaoAberto && 
      !modalDinheiroAberto && 
      inputBuscaRef.current
    ) {
      inputBuscaRef.current.focus();
    }
  }, [produtoModal, itemEditandoPreco, modalAtalhosAberto, modalDescontoAberto, modalFormaPagtoAberto, modalCartaoAberto, modalDinheiroAberto]);

  // Recalcular carrinho ao alternar atacado/varejo
  useEffect(() => {
    setCarrinho((prev) =>
      prev.map((item) => {
        const prod = produtos.find((p) => p.id === item.id);
        const preco = prod
          ? tipoTabela === "atacado"
            ? Number(prod.precoAtacado || prod.precoVarejo || 0)
            : Number(prod.precoVarejo || prod.preco || 0)
          : item.precoUnitario;
        return { ...item, precoUnitario: preco };
      })
    );
  }, [tipoTabela, produtos]);

  function getPrecoAtual(produto) {
    if (tipoTabela === "atacado") {
      return Number(produto.precoAtacado || produto.precoVarejo || produto.preco || 0);
    }
    return Number(produto.precoVarejo || produto.preco || 0);
  }

  function abrirModalQtd(produto) {
    if (!produto.permiteNegativo && produto.estoque <= 0) {
      alert("Produto esgotado!");
      return;
    }
    setProdutoModal(produto);
    setQtdInput("1");
  }

  function confirmarAdicaoModal(e) {
    if (e) e.preventDefault();
    const quantidade = parseInt(qtdInput, 10);

    if (isNaN(quantidade) || quantidade <= 0) {
      alert("Informe uma quantidade válida!");
      return;
    }

    const itemExistente = carrinho.find((item) => item.id === produtoModal.id);
    const qtdTotal = (itemExistente ? itemExistente.quantidade : 0) + quantidade;

    if (!produtoModal.permiteNegativo && qtdTotal > produtoModal.estoque) {
      alert(`Quantidade indisponível! Estoque atual: ${produtoModal.estoque} un`);
      return;
    }

    const precoCobrado = getPrecoAtual(produtoModal);

    if (itemExistente) {
      setCarrinho(
        carrinho.map((item) =>
          item.id === produtoModal.id
            ? { ...item, quantidade: qtdTotal, precoUnitario: precoCobrado }
            : item
        )
      );
    } else {
      setCarrinho([
        ...carrinho,
        {
          id: produtoModal.id,
          nome: produtoModal.nome,
          referencia: produtoModal.referencia || null,
          codigoBarras: produtoModal.codigoBarras || null,
          permiteNegativo: !!produtoModal.permiteNegativo,
          precoUnitario: precoCobrado,
          quantidade: quantidade,
        }
      ]);
    }

    setProdutoModal(null);
    setBuscaPdv("");
    setIndiceFocoBusca(0);
  }

  function salvarPrecoItemModal(e) {
    if (e) e.preventDefault();
    const val = parseFloat(novoPrecoInput);
    if (isNaN(val) || val < 0) {
      alert("Informe um preço válido!");
      return;
    }

    setCarrinho(
      carrinho.map((item) =>
        item.id === itemEditandoPreco.id ? { ...item, precoUnitario: val } : item
      )
    );
    setItemEditandoPreco(null);
  }

  function removerDoCarrinho(id) {
    setCarrinho(carrinho.filter((item) => item.id !== id));
  }

  const subtotalBruto = carrinho.reduce(
    (acc, item) => acc + item.precoUnitario * item.quantidade,
    0
  );

  let valorDescontoCalculado = 0;
  if (descontoAplicado.valor > 0) {
    if (descontoAplicado.tipo === "porcentagem") {
      valorDescontoCalculado = (subtotalBruto * descontoAplicado.valor) / 100;
    } else {
      valorDescontoCalculado = Math.min(descontoAplicado.valor, subtotalBruto);
    }
  }

  const subtotalComDesconto = Math.max(0, subtotalBruto - valorDescontoCalculado);

  // Eventos de teclado global para modais, F1 e tecla Q
  useEffect(() => {
    function handleTecladoGlobal(e) {
      if (e.key === "F1") {
        e.preventDefault();
        setModalAtalhosAberto((prev) => !prev);
        return;
      }

      // Atalho Q para alterar preço do último item (somente se busca estiver vazia e nenhum modal aberto)
      if (e.key.toLowerCase() === "q" && !produtoModal && !itemEditandoPreco && !modalDescontoAberto && !modalFormaPagtoAberto && !modalCartaoAberto && !modalDinheiroAberto && !modalAtalhosAberto) {
        if (buscaPdv.trim() === "" && carrinho.length > 0) {
          e.preventDefault();
          const ultimoItem = carrinho[carrinho.length - 1];
          setItemEditandoPreco(ultimoItem);
          setNovoPrecoInput(ultimoItem.precoUnitario.toString());
          return;
        }
      }

      if (modalDescontoAberto) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setTipoDesconto("reais");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setTipoDesconto("porcentagem");
        }
        return;
      }

      if (modalFormaPagtoAberto) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIndiceFormaPagto((prev) => (prev < FORMAS_PAGAMENTO.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIndiceFormaPagto((prev) => (prev > 0 ? prev - 1 : FORMAS_PAGAMENTO.length - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const formaEscolhida = FORMAS_PAGAMENTO[indiceFormaPagto];
          setModalFormaPagtoAberto(false);

          if (formaEscolhida === "Cartão de Crédito") {
            setIndiceParcela(0);
            setModalCartaoAberto(true);
          } else if (formaEscolhida === "Dinheiro") {
            setValorEntregueInput("");
            setModalDinheiroAberto(true);
          } else {
            executarVendaNoBanco(subtotalComDesconto, formaEscolhida, null, null);
          }
        } else if (e.key === "Escape") {
          setModalFormaPagtoAberto(false);
        }
        return;
      }

      if (modalCartaoAberto) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIndiceParcela((prev) => (prev < 3 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIndiceParcela((prev) => (prev > 0 ? prev - 1 : 3));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const parcelasNum = indiceParcela + 1;
          const conf = TAXAS_CARTAO[parcelasNum];
          const acrescimo = subtotalComDesconto * conf.taxa;
          const totalComTaxa = subtotalComDesconto + acrescimo;
          const valorParcela = totalComTaxa / parcelasNum;

          const descPagamento = `Crédito ${conf.label}`;
          const info = {
            qtdParcelas: parcelasNum,
            taxaPercentual: conf.taxa * 100,
            valorParcela: valorParcela
          };

          setModalCartaoAberto(false);
          executarVendaNoBanco(totalComTaxa, descPagamento, info, null);
        } else if (e.key === "Escape") {
          setModalCartaoAberto(false);
          setModalFormaPagtoAberto(true);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleTecladoGlobal);
    return () => window.removeEventListener("keydown", handleTecladoGlobal);
  }, [modalDescontoAberto, modalFormaPagtoAberto, modalCartaoAberto, indiceFormaPagto, indiceParcela, subtotalComDesconto, buscaPdv, carrinho, produtoModal, itemEditandoPreco, modalAtalhosAberto, modalDinheiroAberto]);

  function iniciarFluxoFechamentoTeclado() {
    if (carrinho.length === 0) {
      alert("O carrinho está vazio! Adicione itens antes de finalizar.");
      return;
    }
    if (!caixaAberto) {
      alert("O caixa está fechado! Abra o caixa na aba 'Relatório & Caixa'.");
      return;
    }
    setValorDescontoInput("");
    setModalDescontoAberto(true);
  }

  function confirmarDescontoTeclado(e) {
    if (e) e.preventDefault();
    const val = parseFloat(valorDescontoInput);
    if (!isNaN(val) && val > 0) {
      setDescontoAplicado({
        tipo: tipoDesconto,
        valor: val,
        totalDescontado: tipoDesconto === "porcentagem" ? (subtotalBruto * val) / 100 : val
      });
    }
    setModalDescontoAberto(false);
    setIndiceFormaPagto(0);
    setModalFormaPagtoAberto(true);
  }

  const valorEntregueNum = parseFloat(valorEntregueInput) || 0;
  const trocoCalculado = Math.max(0, valorEntregueNum - subtotalComDesconto);

  function confirmarDinheiroTeclado(e) {
    if (e) e.preventDefault();
    if (valorEntregueNum < subtotalComDesconto) {
      alert(`Valor insuficiente! O total da venda é R$ ${subtotalComDesconto.toFixed(2)}.`);
      return;
    }

    const infoDinheiro = {
      valorEntregue: valorEntregueNum,
      troco: trocoCalculado
    };

    setModalDinheiroAberto(false);
    executarVendaNoBanco(subtotalComDesconto, "Dinheiro", null, infoDinheiro);
  }

  async function executarVendaNoBanco(valorFinal, pagtoDescricao, infoParcelas, infoDinheiro) {
    setProcessandoVenda(true);
    try {
      let vendaCriadaId = "";
      const hoje = new Date();
      const dataString = hoje.toLocaleDateString("pt-BR");

      await runTransaction(db, async (transaction) => {
        const leituras = [];
        for (const item of carrinho) {
          const ref = doc(db, "produtos", item.id);
          const snap = await transaction.get(ref);
          if (!snap.exists()) throw new Error(`Produto ${item.nome} não encontrado!`);
          
          const estoqueAtual = snap.data().estoque;
          const aceitaNegativo = snap.data().permiteNegativo || false;

          if (!aceitaNegativo && estoqueAtual < item.quantidade) {
            throw new Error(`Estoque insuficiente para ${item.nome}!`);
          }

          leituras.push({ ref, novoEstoque: estoqueAtual - item.quantidade });
        }

        for (const item of leituras) {
          transaction.update(item.ref, { estoque: item.novoEstoque });
        }

        const vendaRef = doc(collection(db, "vendas"));
        vendaCriadaId = vendaRef.id;

        transaction.set(vendaRef, {
          data: serverTimestamp(),
          dataString: dataString,
          caixaId: caixaAberto ? caixaAberto.id : "sem_caixa",
          tipoVenda: tipoTabela,
          operadorEmail: usuarioLogado?.email || "operador",
          lojaId: usuarioLogado?.uid || "loja_padrao",
          itens: carrinho.map((item) => ({
            id: item.id,
            nome: item.nome,
            referencia: item.referencia,
            codigoBarras: item.codigoBarras,
            precoUnitario: item.precoUnitario,
            quantidade: item.quantidade,
          })),
          subtotalBruto: subtotalBruto,
          desconto: valorDescontoCalculado,
          total: valorFinal,
          formaPagamento: pagtoDescricao,
          parcelas: infoParcelas || null,
          dadosDinheiro: infoDinheiro || null
        });
      });

      const recibo = {
        id: vendaCriadaId.substring(0, 8).toUpperCase(),
        dataHora: hoje.toLocaleString("pt-BR"),
        itens: [...carrinho],
        subtotalBruto: subtotalBruto,
        desconto: valorDescontoCalculado,
        total: valorFinal,
        formaPagamento: pagtoDescricao,
        infoParcelas: infoParcelas,
        infoDinheiro: infoDinheiro,
        tipoVenda: tipoTabela
      };

      setDadosRecibo(recibo);
      setCarrinho([]);
      setDescontoAplicado({ tipo: "reais", valor: 0, totalDescontado: 0 });
      await recarregarDados();

      setTimeout(() => {
        window.print();
      }, 300);

    } catch (err) {
      alert("Falha na venda: " + err.message);
    } finally {
      setProcessandoVenda(false);
    }
  }

  const termo = buscaPdv.trim().toLowerCase();
  const produtosFiltrados = termo.length > 0
    ? produtos.filter((p) => {
        return (
          p.nome?.toLowerCase().includes(termo) ||
          p.codigoBarras?.toLowerCase().includes(termo) ||
          p.referencia?.toLowerCase().includes(termo)
        );
      })
    : [];

  useEffect(() => {
    setIndiceFocoBusca(0);
  }, [buscaPdv]);

  function handleKeyDownBusca(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (termo.length === 0) {
        iniciarFluxoFechamentoTeclado();
        return;
      }
      if (produtosFiltrados.length > 0) {
        const itemEscolhido = produtosFiltrados[indiceFocoBusca] || produtosFiltrados[0];
        if (itemEscolhido) abrirModalQtd(itemEscolhido);
      }
    } else if (e.key === "ArrowDown" && produtosFiltrados.length > 0) {
      e.preventDefault();
      setIndiceFocoBusca((prev) => (prev < produtosFiltrados.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp" && produtosFiltrados.length > 0) {
      e.preventDefault();
      setIndiceFocoBusca((prev) => (prev > 0 ? prev - 1 : produtosFiltrados.length - 1));
    }
  }

  return (
    <>
      {/* MODAL DE AJUDA / ATALHOS (F1) */}
      {modalAtalhosAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "400px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 15px 0" }}>⌨️ Atalhos do Sistema</h3>
            <ul style={{ paddingLeft: "20px", color: cores.textoSecundario, lineHeight: "1.8", margin: "0 0 20px 0" }}>
              <li><strong>Enter (com busca vazia):</strong> Inicia o fechamento da venda.</li>
              <li><strong>Setas (↑ ↓):</strong> Navegam pelos produtos na busca.</li>
              <li><strong>Tecla Q (com busca vazia):</strong> Altera o preço do último item do carrinho.</li>
              <li><strong>Clique no preço/item:</strong> Altera o valor unitário direto no mouse.</li>
              <li><strong>F1:</strong> Abre / fecha este painel de ajuda.</li>
            </ul>
            <button onClick={() => setModalAtalhosAberto(false)} style={{ width: "100%", padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
              Fechar (Esc / F1)
            </button>
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO DE PREÇO DO ITEM */}
      {itemEditandoPreco && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "340px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>✏️ Alterar Preço Unitário</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "14px", margin: "0 0 15px 0" }}>
              Item: <strong>{itemEditandoPreco.nome}</strong>
            </p>

            <form onSubmit={salvarPrecoItemModal}>
              <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: cores.textoSecundario }}>Novo Preço Unitário (R$):</label>
              <input
                ref={inputPrecoRef}
                type="number"
                step="0.01"
                value={novoPrecoInput}
                onChange={(e) => setNovoPrecoInput(e.target.value)}
                style={{ width: "100%", padding: "12px", fontSize: "22px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", marginBottom: "15px" }}
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setItemEditandoPreco(null)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Salvar (Enter)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DESCONTO */}
      {modalDescontoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "360px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 10px 0" }}>🎟️ Desconto na Venda</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px", margin: "0 0 12px 0" }}>
              Subtotal: <strong>R$ {subtotalBruto.toFixed(2)}</strong> <br />
              <span style={{ color: cores.textoSuave }}>Use [← / →] para alternar tipo | [Enter] avança</span>
            </p>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <button
                type="button"
                onClick={() => setTipoDesconto("reais")}
                style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoDesconto === "reais" ? "#007bff" : cores.bgCardSecundario, color: tipoDesconto === "reais" ? "#fff" : cores.texto }}
              >
                Em Reais (R$) ←
              </button>
              <button
                type="button"
                onClick={() => setTipoDesconto("porcentagem")}
                style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoDesconto === "porcentagem" ? "#007bff" : cores.bgCardSecundario, color: tipoDesconto === "porcentagem" ? "#fff" : cores.texto }}
              >
                Porcentagem (%) →
              </button>
            </div>

            <form onSubmit={confirmarDescontoTeclado}>
              <input
                ref={inputDescontoRef}
                type="number"
                step="0.01"
                placeholder="0.00"
                value={valorDescontoInput}
                onChange={(e) => setValorDescontoInput(e.target.value)}
                style={{ width: "100%", padding: "14px", fontSize: "22px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `2px solid #007bff`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", marginBottom: "15px", outline: "none" }}
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setModalDescontoAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Continuar (Enter)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORMA DE PAGAMENTO */}
      {modalFormaPagtoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "360px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 10px 0" }}>💳 Escolha a Forma de Pagamento</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px", margin: "0 0 15px 0" }}>
              Total a pagar: <strong style={{ color: "#28a745", fontSize: "16px" }}>R$ {subtotalComDesconto.toFixed(2)}</strong> <br />
              <span style={{ color: cores.textoSuave }}>Navegue com [↑ / ↓] e confirme com [Enter]</span>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" }}>
              {FORMAS_PAGAMENTO.map((fp, idx) => {
                const focado = idx === indiceFormaPagto;
                return (
                  <div
                    key={fp}
                    onClick={() => {
                      setIndiceFormaPagto(idx);
                      setModalFormaPagtoAberto(false);
                      if (fp === "Cartão de Crédito") {
                        setIndiceParcela(0);
                        setModalCartaoAberto(true);
                      } else if (fp === "Dinheiro") {
                        setValorEntregueInput("");
                        setModalDinheiroAberto(true);
                      } else {
                        executarVendaNoBanco(subtotalComDesconto, fp, null, null);
                      }
                    }}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "6px",
                      border: focado ? `2px solid ${cores.itemAtivoBorda}` : `1px solid ${cores.borda}`,
                      background: focado ? cores.itemAtivoBg : cores.bgItem,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <strong style={{ fontSize: "16px" }}>{fp}</strong>
                    {focado && <span style={{ fontSize: "11px", background: "#007bff", color: "#fff", padding: "2px 6px", borderRadius: "3px" }}>Enter ↵</span>}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setModalFormaPagtoAberto(false)}
              style={{ width: "100%", padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}
            >
              Voltar (Esc)
            </button>
          </div>
        </div>
      )}

      {/* MODAL PARCELAS CRÉDITO */}
      {modalCartaoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "380px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>💳 Parcelamento Cartão de Crédito</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px", margin: "0 0 15px 0" }}>
              Total base: <strong>R$ {subtotalComDesconto.toFixed(2)}</strong> <br />
              <span style={{ color: cores.textoSuave }}>Navegue com [↑ / ↓] e confirme com [Enter]</span>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {[1, 2, 3, 4].map((num, idx) => {
                const conf = TAXAS_CARTAO[num];
                const valorComTaxa = subtotalComDesconto * (1 + conf.taxa);
                const valorParc = valorComTaxa / num;
                const focado = indiceParcela === idx;

                return (
                  <div
                    key={num}
                    onClick={() => setIndiceParcela(idx)}
                    style={{
                      padding: "12px",
                      borderRadius: "6px",
                      border: focado ? `2px solid ${cores.itemAtivoBorda}` : `1px solid ${cores.borda}`,
                      background: focado ? cores.itemAtivoBg : cores.bgCardSecundario,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong>{conf.label}</strong>
                      <div style={{ fontSize: "12px", color: cores.textoSecundario }}>{num}x de R$ {valorParc.toFixed(2)}</div>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#28a745" }}>
                      Total: R$ {valorComTaxa.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setModalCartaoAberto(false);
                setModalFormaPagtoAberto(true);
              }}
              style={{ width: "100%", padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}
            >
              Voltar (Esc)
            </button>
          </div>
        </div>
      )}

      {/* MODAL DINHEIRO E TROCO */}
      {modalDinheiroAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "360px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 10px 0" }}>💵 Pagamento em Dinheiro</h3>
            
            <div style={{ background: cores.bgCardSecundario, padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px" }}>
                <span>Total a Pagar:</span>
                <strong style={{ color: "#28a745" }}>R$ {subtotalComDesconto.toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={confirmarDinheiroTeclado}>
              <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: cores.textoSecundario }}>
                Valor Entregue pelo Cliente (R$):
              </label>
              <input
                ref={inputDinheiroRef}
                type="number"
                step="0.01"
                placeholder="Ex: 50.00"
                value={valorEntregueInput}
                onChange={(e) => setValorEntregueInput(e.target.value)}
                style={{ width: "100%", padding: "14px", fontSize: "22px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `2px solid #007bff`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", marginBottom: "15px", outline: "none" }}
              />

              <div style={{ background: valorEntregueNum >= subtotalComDesconto ? "rgba(40, 167, 69, 0.15)" : "rgba(229, 62, 62, 0.15)", border: `1px solid ${valorEntregueNum >= subtotalComDesconto ? "#28a745" : "#e53e3e"}`, padding: "14px", borderRadius: "6px", textAlign: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "13px", display: "block", color: cores.textoSecundario }}>TROCO A DEVOLVER:</span>
                <strong style={{ fontSize: "24px", color: valorEntregueNum >= subtotalComDesconto ? "#28a745" : "#e53e3e" }}>
                  R$ {trocoCalculado.toFixed(2)}
                </strong>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => { setModalDinheiroAberto(false); setModalFormaPagtoAberto(true); }} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Voltar</button>
                <button type="submit" disabled={processandoVenda || valorEntregueNum < subtotalComDesconto} style={{ flex: 1, padding: "10px", background: valorEntregueNum >= subtotalComDesconto ? "#28a745" : cores.bgCardSecundario, color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: valorEntregueNum >= subtotalComDesconto ? "pointer" : "not-allowed" }}>
                  Finalizar (Enter)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUANTIDADE DE PRODUTO */}
      {produtoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "340px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>Adicionar Item</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "14px", margin: "0 0 15px 0" }}>
              <strong>{produtoModal.nome}</strong><br />
              <span style={{ color: tipoTabela === "atacado" ? "#3182ce" : "#38a169", fontWeight: "bold" }}>
                R$ {getPrecoAtual(produtoModal).toFixed(2)} ({tipoTabela.toUpperCase()})
              </span> | Estoque: {produtoModal.estoque} un {produtoModal.permiteNegativo ? "(Sem trava)" : ""}
            </p>

            <form onSubmit={confirmarAdicaoModal}>
              <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: cores.textoSecundario }}>Quantidade:</label>
              <input
                ref={inputQtdRef}
                type="number"
                min="1"
                max={produtoModal.permiteNegativo ? undefined : produtoModal.estoque}
                value={qtdInput}
                onChange={(e) => setQtdInput(e.target.value)}
                style={{ width: "100%", padding: "12px", fontSize: "22px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", marginBottom: "15px" }}
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setProdutoModal(null)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Confirmar (Enter)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÁREA DA FRENTE DE CAIXA */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "25px", width: "100%" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", border: `1px solid ${cores.borda}` }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>Modo de Venda:</span>
              <button
                onClick={() => setTipoTabela("varejo")}
                style={{ padding: "6px 16px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoTabela === "varejo" ? "#28a745" : cores.bgCardSecundario, color: tipoTabela === "varejo" ? "#fff" : cores.texto }}
              >
                Varejo
              </button>
              <button
                onClick={() => setTipoTabela("atacado")}
                style={{ padding: "6px 16px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoTabela === "atacado" ? "#007bff" : cores.bgCardSecundario, color: "#fff" }}
              >
                Atacado
              </button>
            </div>
            <button
              onClick={() => setModalAtalhosAberto(true)}
              style={{ background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, padding: "6px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}
            >
              ⌨️ Atalhos (F1)
            </button>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <input
              ref={inputBuscaRef}
              type="text"
              placeholder="🔍 Digite Nome, Ref ou Código de Barras..."
              value={buscaPdv}
              onChange={(e) => setBuscaPdv(e.target.value)}
              onKeyDown={handleKeyDownBusca}
              style={{
                width: "100%",
                padding: "16px",
                background: cores.inputBg,
                border: "2px solid #007bff",
                borderRadius: "8px",
                color: cores.texto,
                boxSizing: "border-box",
                fontSize: "17px",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "12px", color: cores.textoSuave, padding: "0 4px" }}>
              <span>{termo.length === 0 ? "Com a busca vazia: tecle Enter para Fechar ou Q para alterar preço" : "Navegue com as setas ↑ ↓"}</span>
              <span>Pressione F1 para ver os atalhos</span>
            </div>
          </div>

          {termo.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "55vh", overflowY: "auto" }}>
              {produtosFiltrados.length === 0 ? (
                <p style={{ color: cores.textoSuave, padding: "10px" }}>Nenhum produto com "{buscaPdv}".</p>
              ) : (
                produtosFiltrados.map((p, idx) => {
                  const precoCobrado = getPrecoAtual(p);
                  const focado = idx === indiceFocoBusca;

                  return (
                    <div
                      key={p.id}
                      onClick={() => abrirModalQtd(p)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: focado ? cores.itemAtivoBg : cores.bgItem,
                        padding: "14px 18px",
                        borderRadius: "6px",
                        border: focado ? `2px solid ${cores.itemAtivoBorda}` : `1px solid ${cores.borda}`,
                        cursor: "pointer"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "16px", color: cores.texto }}>{p.nome}</strong>
                          {focado && <span style={{ fontSize: "11px", background: "#007bff", color: "#fff", padding: "2px 6px", borderRadius: "3px" }}>Enter ↵</span>}
                        </div>
                        <div style={{ color: cores.textoSecundario, fontSize: "13px", marginTop: "4px" }}>
                          <span style={{ color: tipoTabela === "atacado" ? "#3182ce" : "#38a169", fontWeight: "bold" }}>
                            R$ {precoCobrado.toFixed(2)}
                          </span>
                          {" | "}Estoque: {p.estoque} un {p.permiteNegativo ? "(Sem trava)" : ""}
                          {p.referencia ? ` | Ref: ${p.referencia}` : ""}
                          {p.codigoBarras ? ` | Cód: ${p.codigoBarras}` : ""}
                        </div>
                      </div>
                      <span style={{ background: focado ? "#007bff" : cores.bgCardSecundario, color: focado ? "#fff" : cores.texto, padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
                        + Adicionar
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ITENS DA VENDA */}
        <div style={{ background: cores.bgCard, padding: "20px", borderRadius: "8px", border: `1px solid ${cores.borda}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>Itens da Venda</h2>
              <span style={{ fontSize: "12px", background: tipoTabela === "atacado" ? "#007bff" : "#28a745", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                {tipoTabela.toUpperCase()}
              </span>
            </div>

            {carrinho.length === 0 ? (
              <p style={{ color: cores.textoSuave, marginTop: "20px" }}>Nenhum item adicionado à venda.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "35vh", overflowY: "auto", margin: "15px 0" }}>
                {carrinho.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.bordaClara}`, paddingBottom: "8px" }}>
                    <div>
                      <div>{item.nome}</div>
                      <div 
                        onClick={() => {
                          setItemEditandoPreco(item);
                          setNovoPrecoInput(item.precoUnitario.toString());
                        }}
                        title="Clique para alterar o preço"
                        style={{ fontSize: "12px", color: cores.textoSecundario, cursor: "pointer" }}
                      >
                        {item.referencia ? `Ref: ${item.referencia} | ` : ""}
                        {item.quantidade}x <span style={{ color: "#3182ce", textDecoration: "underline" }}>R$ {Number(item.precoUnitario).toFixed(2)}</span> = <strong>R$ {(Number(item.precoUnitario) * item.quantidade).toFixed(2)}</strong> 
                        <span style={{ fontSize: "10px", marginLeft: "5px", color: cores.textoSuave }}>(✏️ editar)</span>
                      </div>
                    </div>
                    <button onClick={() => removerDoCarrinho(item.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: `2px solid ${cores.borda}`, paddingTop: "15px" }}>
            {descontoAplicado.valor > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ color: cores.textoSecundario, fontSize: "14px" }}>Desconto:</span>
                <span style={{ color: "#e53e3e", fontWeight: "bold", fontSize: "15px" }}>
                  - R$ {valorDescontoCalculado.toFixed(2)} ({descontoAplicado.tipo === "porcentagem" ? `${descontoAplicado.valor}%` : "R$"})
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <span style={{ fontSize: "18px" }}>Total da Venda:</span>
              <span style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745" }}>
                R$ {subtotalComDesconto.toFixed(2)}
              </span>
            </div>

            <button
              onClick={iniciarFluxoFechamentoTeclado}
              disabled={processandoVenda || carrinho.length === 0}
              style={{ width: "100%", padding: "14px", background: carrinho.length > 0 ? "#28a745" : cores.bgCardSecundario, color: "#fff", border: "none", borderRadius: "6px", fontSize: "16px", fontWeight: "bold", cursor: carrinho.length > 0 ? "pointer" : "not-allowed" }}
            >
              {processandoVenda ? "Processando..." : "Finalizar Venda (Enter no campo vazio)"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}