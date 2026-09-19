import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  addDoc,
  getDoc
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

function serializeTamanhos(obj) {
  const arr = [];
  Object.keys(obj).forEach(k => {
    if (obj[k] > 0) arr.push(`${k}: ${obj[k]}`);
  });
  return arr.length > 0 ? arr.join(" | ") : "Tamanho único";
}

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

  // Etapa central do fluxo de teclado solicitada na arquitetura
  const [etapaTeclado, setEtapaTeclado] = useState("busca");

  // Configurações da Loja puxadas do Firestore
  const [configLoja, setConfigLoja] = useState({
    nomeLoja: "LIFESURF",
    logoUrl: "",
    endereco: "",
    telefone: "",
    mensagemRodape: "OBRIGADO PELA PREFERENCIA! VOLTE SEMPRE!"
  });

  const [produtoModal, setProdutoModal] = useState(null);
  const [qtdInput, setQtdInput] = useState("1");
  const inputQtdRef = useRef(null);
  const inputBuscaRef = useRef(null);

  const [itemEditandoPreco, setItemEditandoPreco] = useState(null);
  const [novoPrecoInput, setNovoPrecoInput] = useState("");
  const inputPrecoRef = useRef(null);

  const [modalAtalhosAberto, setModalAtalhosAberto] = useState(false);
  const [descontoAplicado, setDescontoAplicado] = useState({ tipo: "reais", valor: 0, totalDescontado: 0 });

  // Modal de Tamanho Avançado no Carrinho (Tecla F2)
  const [modalTamanhoCarrinhoAberto, setModalTamanhoCarrinhoAberto] = useState(false);
  const [itemSelecionadoCarrinhoIdx, setItemSelecionadoCarrinhoIdx] = useState(null);
  const [etapaTamanhoModal, setEtapaTamanhoModal] = useState("lista");
  const [tamanhoSelecionadoTemp, setTamanhoSelecionadoTemp] = useState("");
  const [qtdTamanhoTemp, setQtdTamanhoTemp] = useState("1");
  const [tamanhosDisponiveisTemp, setTamanhosDisponiveisTemp] = useState({});
  const inputQtdTamRef = useRef(null);

  // Modos de Troca Avançada
  const [modalTipoTrocaAberto, setModalTipoTrocaAberto] = useState(false);
  const [indiceTrocaTipo, setIndiceTrocaTipo] = useState(0);

  const [modalTrocaTamanhoAberto, setModalTrocaTamanhoAberto] = useState(false);
  const [tamanhoDevolvidoTroca, setTamanhoDevolvidoTroca] = useState("");
  const [tamanhoNovoTroca, setTamanhoNovoTroca] = useState("");
  const [tamanhosDisponiveisDevolucao, setTamanhosDisponiveisDevolucao] = useState({});
  const [tamanhosDisponiveisNovo, setTamanhosDisponiveisNovo] = useState({});
  const [tipoPrecoTrocaTamanho, setTipoPrecoTrocaTamanho] = useState("varejo");

  const [modalTrocaOutroProdutoAberto, setModalTrocaOutroProdutoAberto] = useState(false);
  const [buscaTrocaProduto, setBuscaTrocaProduto] = useState("");
  const [produtoSubstitutoTroca, setProdutoSubstitutoTroca] = useState(null);
  const [tamanhoSubstitutoTroca, setTamanhoSubstitutoTroca] = useState("");
  const [tamanhosSubstitutosDisponiveis, setTamanhosSubstitutosDisponiveis] = useState({});
  const [tipoPrecoOutroProd, setTipoPrecoOutroProd] = useState("varejo");

  const [modalTrocaFalhaAberto, setModalTrocaFalhaAberto] = useState(false);
  const [descricaoFalha, setDescricaoFalha] = useState("");
  const [tamanhoFalhaDevolvido, setTamanhoFalhaDevolvido] = useState("");
  const [valorDiferencaFalha, setValorDiferencaFalha] = useState("0.00");

  const [modalAVerInfoAberto, setModalAVerInfoAberto] = useState(false);
  const [nomeResponsavelAVer, setNomeResponsavelAVer] = useState("");
  const [telefoneAVer, setTelefoneAVer] = useState("");
  const [dataAVer, setDataAVer] = useState(new Date().toISOString().split("T")[0]);
  const [observacaoAVer, setObservacaoAVer] = useState("");
  const inputAVer1Ref = useRef(null);
  const inputAVer2Ref = useRef(null);
  const inputAVerTelRef = useRef(null);

  const [modalDescontoAberto, setModalDescontoAberto] = useState(false);
  const [tipoDesconto, setTipoDesconto] = useState("reais");
  const [valorDescontoInput, setValorDescontoInput] = useState("");
  const inputDescontoRef = useRef(null);

  const [modalFormaPagtoAberto, setModalFormaPagtoAberto] = useState(false);
  const [indiceFormaPagto, setIndiceFormaPagto] = useState(0);

  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [indiceParcela, setIndiceParcela] = useState(0);

  const [modalDinheiroAberto, setModalDinheiroAberto] = useState(false);
  const [valorEntregueInput, setValorEntregueInput] = useState("");
  const inputDinheiroRef = useRef(null);

  const [dadosReciboLocal, setDadosReciboLocal] = useState(null);
  const listaBuscaRef = useRef(null);

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");

  useEffect(() => {
    async function carregarConfigLoja() {
      try {
        const snap = await getDoc(doc(db, "configuracoes", lojaIdAtual));
        if (snap.exists()) {
          const d = snap.data();
          setConfigLoja({
            nomeLoja: d.nomeLoja || "LIFESURF",
            logoUrl: d.logoUrl || "",
            endereco: d.endereco || "",
            telefone: d.telefone || "",
            mensagemRodape: d.mensagemRodape || "OBRIGADO PELA PREFERENCIA! VOLTE SEMPRE!"
          });
        }
      } catch (err) {
        console.error("Erro ao carregar config da loja no PDV:", err);
      }
    }
    carregarConfigLoja();
  }, [lojaIdAtual]);

  const corModo =
    tipoTabela === "atacado" ? "#007bff" :
    tipoTabela === "troca" ? "#e67e22" :
    tipoTabela === "a_ver" ? "#8e44ad" : "#28a745";

  // Gerenciamento consistente de Foco Automático por Etapa
  useEffect(() => {
    if (etapaTeclado === "busca") {
      setTimeout(() => inputBuscaRef.current?.focus(), 50);
    } else if (etapaTeclado === "adicionarItem") {
      setTimeout(() => {
        if (inputQtdRef.current) {
          inputQtdRef.current.focus();
          inputQtdRef.current.select();
        }
      }, 50);
    } else if (etapaTeclado === "desconto") {
      setTimeout(() => {
        if (inputDescontoRef.current) {
          inputDescontoRef.current.focus();
          inputDescontoRef.current.select();
        }
      }, 50);
    } else if (etapaTeclado === "dinheiro") {
      setTimeout(() => {
        if (inputDinheiroRef.current) {
          inputDinheiroRef.current.focus();
          inputDinheiroRef.current.select();
        }
      }, 50);
    }
  }, [etapaTeclado]);

  useEffect(() => {
    if (tipoTabela === "varejo" || tipoTabela === "atacado" || tipoTabela === "a_ver") {
      setCarrinho((prev) =>
        prev.map((item) => {
          const prod = produtos.find((p) => p.id === item.id);
          const preco = prod
            ? (tipoTabela === "atacado" || tipoTabela === "a_ver")
              ? Number(prod.precoAtacado || prod.precoVarejo || prod.preco || 0)
              : Number(prod.precoVarejo || prod.preco || 0)
            : item.precoUnitario;
          return { ...item, precoUnitario: preco };
        })
      );
    }
  }, [tipoTabela, produtos]);

  function getPrecoAtual(produto, modoPreco = tipoTabela) {
    if (modoPreco === "atacado" || modoPreco === "a_ver") {
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
    setEtapaTeclado("adicionarItem");
  }

  function confirmarAdicaoModal(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
          tamanhosDisponiveis: produtoModal.tamanhos || "Tamanho único",
          tamanhoSelecionado: ""
        }
      ]);
    }

    setProdutoModal(null);
    setBuscaPdv("");
    setIndiceFocoBusca(0);
    setEtapaTeclado("busca");
  }

  function abrirModalTamanhoCarrinho(idx) {
    setItemSelecionadoCarrinhoIdx(idx);
    const item = carrinho[idx];
    if (!item) return;

    const prodReal = produtos.find(p => p.id === item.id);
    const dispStr = prodReal ? prodReal.tamanhos : item.tamanhosDisponiveis;
    const baseObj = parseTamanhos(dispStr);

    const jaSelecionados = parseTamanhosObs(item.tamanhoSelecionado);
    Object.keys(jaSelecionados).forEach(t => {
      if (baseObj[t] !== undefined) {
        baseObj[t] = Math.max(0, baseObj[t] - jaSelecionados[t]);
      }
    });

    setTamanhosDisponiveisTemp(baseObj);
    setEtapaTamanhoModal("lista");
    setTamanhoSelecionadoTemp("");
    setQtdTamanhoTemp("1");
    setModalTamanhoCarrinhoAberto(true);
  }

  function confirmarQtdTamanhoModal(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const qtdRetirada = parseInt(qtdTamanhoTemp, 10);
    if (isNaN(qtdRetirada) || qtdRetirada <= 0) {
      alert("Informe uma quantidade válida!");
      return;
    }

    const dispAtual = tamanhosDisponiveisTemp[tamanhoSelecionadoTemp] || 0;
    if (qtdRetirada > dispAtual) {
      alert(`Quantidade indisponível para o tamanho ${tamanhoSelecionadoTemp}! Disponível: ${dispAtual}`);
      return;
    }

    const itemAtual = carrinho[itemSelecionadoCarrinhoIdx];
    const obsAtual = itemAtual.tamanhoSelecionado ? parseTamanhosObs(itemAtual.tamanhoSelecionado) : {};
    obsAtual[tamanhoSelecionadoTemp] = (obsAtual[tamanhoSelecionadoTemp] || 0) + qtdRetirada;

    const novaStringObs = serializeTamanhos(obsAtual);

    setCarrinho(carrinho.map((it, idx) => 
      idx === itemSelecionadoCarrinhoIdx ? { ...it, tamanhoSelecionado: novaStringObs } : it
    ));

    const novoDisp = { ...tamanhosDisponiveisTemp, [tamanhoSelecionadoTemp]: dispAtual - qtdRetirada };
    setTamanhosDisponiveisTemp(novoDisp);
    setEtapaTamanhoModal("lista");
    setTamanhoSelecionadoTemp("");
    setQtdTamanhoTemp("1");
  }

  function parseTamanhosObs(str) {
    const res = {};
    if (!str) return res;
    str.split(" | ").forEach(part => {
      const [k, v] = part.split(":");
      if (k && v) res[k.trim()] = parseInt(v.trim(), 10) || 0;
    });
    return res;
  }

  function salvarPrecoItemModal(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
    setEtapaTeclado("busca");
  }

  function removerDoCarrinho(id) {
    setCarrinho(carrinho.filter((item) => item.id !== id));
  }

  const subtotalBruto = carrinho.reduce(
    (acc, item) => acc + item.precoUnitario * item.quantidade,
    0
  );

  let valorDescontoCalculado = 0;
  if (descontoAplicado.valor > 0 && tipoTabela !== "a_ver") {
    if (descontoAplicado.tipo === "porcentagem") {
      valorDescontoCalculado = (subtotalBruto * descontoAplicado.valor) / 100;
    } else {
      valorDescontoCalculado = Math.min(descontoAplicado.valor, subtotalBruto);
    }
  }

  const subtotalComDesconto = tipoTabela === "a_ver" ? subtotalBruto : Math.max(0, subtotalBruto - valorDescontoCalculado);
  const formasPagamentoDisponiveis = FORMAS_PAGAMENTO;

  // ESC Universal (Voltar Etapa)
  function voltarComEscape(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (modalAtalhosAberto) { setModalAtalhosAberto(false); setEtapaTeclado("busca"); return; }
    if (modalDinheiroAberto) { setModalDinheiroAberto(false); setModalFormaPagtoAberto(true); setEtapaTeclado("pagamento"); return; }
    if (modalCartaoAberto) { setModalCartaoAberto(false); setModalFormaPagtoAberto(true); setEtapaTeclado("pagamento"); return; }
    if (modalFormaPagtoAberto) { setModalFormaPagtoAberto(false); setModalDescontoAberto(true); setEtapaTeclado("desconto"); return; }
    if (modalDescontoAberto) { setModalDescontoAberto(false); setEtapaTeclado("busca"); return; }
    if (produtoModal) { setProdutoModal(null); setEtapaTeclado("busca"); return; }
    if (itemEditandoPreco) { setItemEditandoPreco(null); setEtapaTeclado("busca"); return; }
    if (modalTamanhoCarrinhoAberto) { setModalTamanhoCarrinhoAberto(false); setEtapaTamanhoModal("lista"); setEtapaTeclado("busca"); return; }
    if (modalTipoTrocaAberto) { setModalTipoTrocaAberto(false); setEtapaTeclado("busca"); return; }
    if (modalTrocaTamanhoAberto) { setModalTrocaTamanhoAberto(false); setModalTipoTrocaAberto(true); return; }
    if (modalTrocaOutroProdutoAberto) { setModalTrocaOutroProdutoAberto(false); setModalTipoTrocaAberto(true); return; }
    if (modalTrocaFalhaAberto) { setModalTrocaFalhaAberto(false); setModalTipoTrocaAberto(true); return; }
    if (modalAVerInfoAberto) { setModalAVerInfoAberto(false); setEtapaTeclado("busca"); return; }
  }

  // Lógica Central de Teclado Global
  useEffect(() => {
    function handleTecladoGlobal(e) {
      const isInputBuscaFocado = document.activeElement === inputBuscaRef.current;

      if (e.key === "F1") {
        e.preventDefault();
        setModalAtalhosAberto((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        voltarComEscape(e);
        return;
      }

      // Navegação por teclado no Modal de Escolha de Troca
      if (modalTipoTrocaAberto) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIndiceTrocaTipo((prev) => (prev < 2 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIndiceTrocaTipo((prev) => (prev > 0 ? prev - 1 : 2));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (indiceTrocaTipo === 0) {
            setModalTipoTrocaAberto(false);
            const item = carrinho[0];
            const prodReal = produtos.find(p => p.id === item.id);
            const prateleira = prodReal ? parseTamanhos(prodReal.tamanhos) : parseTamanhos(item.tamanhosDisponiveis);
            setTamanhosDisponiveisDevolucao(prateleira);
            setTamanhosDisponiveisNovo(prateleira);
            setTamanhoDevolvidoTroca("");
            setTamanhoNovoTroca("");
            setTipoPrecoTrocaTamanho(tipoTabela);
            setModalTrocaTamanhoAberto(true);
          } else if (indiceTrocaTipo === 1) {
            setModalTipoTrocaAberto(false);
            setBuscaTrocaProduto("");
            setProdutoSubstitutoTroca(null);
            setTamanhoSubstitutoTroca("");
            setTamanhosSubstitutosDisponiveis({});
            setTipoPrecoOutroProd(tipoTabela);
            setModalTrocaOutroProdutoAberto(true);
          } else if (indiceTrocaTipo === 2) {
            setModalTipoTrocaAberto(false);
            setDescricaoFalha("");
            setTamanhoFalhaDevolvido(carrinho[0]?.tamanhoSelecionado || "");
            setValorDiferencaFalha("0.00");
            setModalTrocaFalhaAberto(true);
          }
        }
        return;
      }

      const anyModalOpen = modalAtalhosAberto || modalDescontoAberto || modalFormaPagtoAberto || modalCartaoAberto || modalDinheiroAberto || produtoModal || itemEditandoPreco || modalTamanhoCarrinhoAberto || modalTipoTrocaAberto || modalTrocaTamanhoAberto || modalTrocaOutroProdutoAberto || modalTrocaFalhaAberto || modalAVerInfoAberto;

      if (!anyModalOpen && !isInputBuscaFocado) {
        if (buscaPdv.trim() === "") {
          if (e.key === "1") { e.preventDefault(); setTipoTabela("varejo"); return; }
          if (e.key === "2") { e.preventDefault(); setTipoTabela("atacado"); return; }
          if (e.key === "3") { e.preventDefault(); setTipoTabela("troca"); return; }
          if (e.key === "4") { e.preventDefault(); setTipoTabela("a_ver"); return; }
        }
      }

      if (!anyModalOpen && buscaPdv.trim() === "" && !isInputBuscaFocado) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          if (tipoTabela === "varejo") setTipoTabela("atacado");
          else if (tipoTabela === "atacado") setTipoTabela("troca");
          else if (tipoTabela === "troca") setTipoTabela("a_ver");
          else if (tipoTabela === "a_ver") setTipoTabela("varejo");
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (tipoTabela === "varejo") setTipoTabela("a_ver");
          else if (tipoTabela === "a_ver") setTipoTabela("troca");
          else if (tipoTabela === "troca") setTipoTabela("atacado");
          else if (tipoTabela === "atacado") setTipoTabela("varejo");
          return;
        }
      }

      if (e.key === "F2" && !anyModalOpen && buscaPdv.trim() === "" && carrinho.length > 0 && !isInputBuscaFocado) {
        e.preventDefault();
        abrirModalTamanhoCarrinho(carrinho.length - 1);
        return;
      }

      if (e.key.toLowerCase() === "q" && !anyModalOpen && buscaPdv.trim() === "" && carrinho.length > 0 && tipoTabela !== "a_ver" && !isInputBuscaFocado) {
        e.preventDefault();
        const ultimoItem = carrinho[carrinho.length - 1];
        setItemEditandoPreco(ultimoItem);
        setNovoPrecoInput(ultimoItem.precoUnitario.toString());
        return;
      }

      if (modalFormaPagtoAberto) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIndiceFormaPagto((prev) => (prev < formasPagamentoDisponiveis.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIndiceFormaPagto((prev) => (prev > 0 ? prev - 1 : formasPagamentoDisponiveis.length - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const formaEscolhida = formasPagamentoDisponiveis[indiceFormaPagto];
          setModalFormaPagtoAberto(false);

          if (formaEscolhida === "Cartão de Crédito") {
            setIndiceParcela(0);
            setModalCartaoAberto(true);
            setEtapaTeclado("cartao");
          } else if (formaEscolhida === "Dinheiro") {
            setValorEntregueInput("");
            setModalDinheiroAberto(true);
            setEtapaTeclado("dinheiro");
          } else {
            executarVendaNoBanco(subtotalComDesconto, formaEscolhida, null, null);
            setEtapaTeclado("busca");
          }
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
          const info = { qtdParcelas: parcelasNum, taxaPercentual: conf.taxa * 100, valorParcela: valorParcela };

          setModalCartaoAberto(false);
          setEtapaTeclado("busca");
          executarVendaNoBanco(totalComTaxa, descPagamento, info, null);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleTecladoGlobal);
    return () => window.removeEventListener("keydown", handleTecladoGlobal);
  }, [modalDescontoAberto, modalFormaPagtoAberto, modalCartaoAberto, indiceFormaPagto, indiceParcela, subtotalComDesconto, buscaPdv, carrinho, produtoModal, itemEditandoPreco, modalAtalhosAberto, modalDinheiroAberto, formasPagamentoDisponiveis, modalTipoTrocaAberto, modalTrocaTamanhoAberto, modalTrocaOutroProdutoAberto, modalTrocaFalhaAberto, modalAVerInfoAberto, indiceTrocaTipo]);

  function iniciarFluxoFechamentoTeclado() {
    if (carrinho.length === 0) {
      alert("O carrinho está vazio! Adicione itens antes de finalizar.");
      return;
    }
    if (!caixaAberto) {
      alert("O caixa está fechado! Abra o caixa na aba 'Relatório & Caixa'.");
      return;
    }

    if (tipoTabela === "troca") {
      setIndiceTrocaTipo(0);
      setModalTipoTrocaAberto(true);
      return;
    }

    if (tipoTabela === "a_ver") {
      setNomeResponsavelAVer("");
      setTelefoneAVer("");
      setDataAVer(new Date().toISOString().split("T")[0]);
      setObservacaoAVer("");
      setModalAVerInfoAberto(true);
      setEtapaTeclado("aVer");
      return;
    }

    setValorDescontoInput("");
    setModalDescontoAberto(true);
    setEtapaTeclado("desconto");
  }

  // 1️⃣ Lógica de Troca por Tamanho
  async function concluirTrocaPorTamanho() {
    if (!tamanhoDevolvidoTroca || !tamanhoNovoTroca) {
      alert("Selecione o tamanho devolvido e o novo tamanho!");
      return;
    }

    const itemRef = carrinho[0];
    setProcessandoVenda(true);
    try {
      let vendaCriadaId = "";
      await runTransaction(db, async (transaction) => {
        const prodDocRef = doc(db, "produtos", itemRef.id);
        const snap = await transaction.get(prodDocRef);
        if (!snap.exists()) throw new Error("Produto não encontrado no estoque!");

        const objT = parseTamanhos(snap.data().tamanhos);
        objT[tamanhoDevolvidoTroca] = (objT[tamanhoDevolvidoTroca] || 0) + itemRef.quantidade;
        if ((objT[tamanhoNovoTroca] || 0) < itemRef.quantidade) {
          throw new Error(`Estoque insuficiente para o tamanho ${tamanhoNovoTroca}!`);
        }
        objT[tamanhoNovoTroca] -= itemRef.quantidade;

        transaction.update(prodDocRef, { tamanhos: serializeTamanhos(objT) });

        const vendaRef = doc(collection(db, "vendas"));
        vendaCriadaId = vendaRef.id;

        transaction.set(vendaRef, {
          data: serverTimestamp(),
          dataString: new Date().toLocaleDateString("pt-BR"),
          caixaId: caixaAberto.id,
          tipoVenda: "troca",
          operadorEmail: usuarioLogado?.email || "operador",
          lojaId: lojaIdAtual,
          itens: [{ ...itemRef, tamanhoSelecionado: `De: ${tamanhoDevolvidoTroca} Para: ${tamanhoNovoTroca}` }],
          subtotalBruto: 0,
          desconto: 0,
          total: 0,
          formaPagamento: "Troca por Tamanho",
          infoTroca: { itemTrocado: `Troca de tamanho: ${itemRef.nome} [De ${tamanhoDevolvidoTroca} para ${tamanhoNovoTroca}]`, valorDiferenca: 0 }
        });
      });

      const recibo = {
        id: vendaCriadaId.substring(0, 8).toUpperCase(),
        dataHora: new Date().toLocaleString("pt-BR"),
        itens: [{ ...itemRef, tamanhoSelecionado: `De: ${tamanhoDevolvidoTroca} Para: ${tamanhoNovoTroca}` }],
        subtotalBruto: 0,
        desconto: 0,
        total: 0,
        formaPagamento: "Troca por Tamanho",
        tipoVenda: "troca"
      };

      setDadosRecibo(recibo);
      setDadosReciboLocal(recibo);
      alert("Troca por tamanho realizada e estoque atualizado com sucesso!");
      setModalTipoTrocaAberto(false);
      setModalTrocaTamanhoAberto(false);
      setCarrinho([]);
      setEtapaTeclado("busca");
      await recarregarDados();

      setTimeout(() => { window.print(); }, 300);
    } catch (err) {
      alert("Erro na troca por tamanho: " + err.message);
    } finally {
      setProcessandoVenda(false);
    }
  }

  // 2️⃣ Lógica de Troca por Outro Produto
  async function confirmarTrocaOutroProduto(e) {
    e.preventDefault();
    if (!produtoSubstitutoTroca || !tamanhoSubstitutoTroca) {
      alert("Selecione o produto substituto e o tamanho!");
      return;
    }

    const itemDevolvido = carrinho[0];
    const precoAntigo = Number(itemDevolvido.precoUnitario) * itemDevolvido.quantidade;
    const precoNovoUnitario = getPrecoAtual(produtoSubstitutoTroca, tipoPrecoOutroProd);
    const precoNovoTotal = precoNovoUnitario * itemDevolvido.quantidade;
    const diferenca = Math.max(0, precoNovoTotal - precoAntigo);

    setCarrinho([{
      id: produtoSubstitutoTroca.id,
      nome: produtoSubstitutoTroca.nome,
      referencia: produtoSubstitutoTroca.referencia || null,
      codigoBarras: produtoSubstitutoTroca.codigoBarras || null,
      precoUnitario: precoNovoUnitario,
      quantidade: itemDevolvido.quantidade,
      tamanhoSelecionado: tamanhoSubstitutoTroca
    }]);

    setModalTrocaOutroProdutoAberto(false);
    setValorDiferencaInput(diferenca.toString());
    setIndiceFormaPagto(0);
    setModalFormaPagtoAberto(true);
    setEtapaTeclado("pagamento");
  }

  // 3️⃣ Lógica de Troca por Falha / Defeito
  async function concluirTrocaPorFalha() {
    if (!descricaoFalha.trim() || !tamanhoFalhaDevolvido) {
      alert("Preencha o tamanho da peça e a descrição da falha!");
      return;
    }

    const itemRef = carrinho[0];
    setProcessandoVenda(true);
    try {
      let vendaCriadaId = "";
      await runTransaction(db, async (transaction) => {
        const prodDocRef = doc(db, "produtos", itemRef.id);
        const snap = await transaction.get(prodDocRef);
        if (snap.exists()) {
          const estoqueAtual = snap.data().estoque || 0;
          transaction.update(prodDocRef, { estoque: Math.max(0, estoqueAtual - itemRef.quantidade) });
        }

        const falhaRef = doc(collection(db, "pecas_com_falha"));
        transaction.set(falhaRef, {
          lojaId: lojaIdAtual,
          produtoNome: itemRef.nome,
          tamanho: tamanhoFalhaDevolvido,
          falha: descricaoFalha.trim(),
          cliente: "Cliente / Balcão",
          status: "pendente",
          data: serverTimestamp(),
          dataString: new Date().toLocaleDateString("pt-BR")
        });

        const difNum = Number(valorDiferencaFalha) || 0;
        const vendaRef = doc(collection(db, "vendas"));
        vendaCriadaId = vendaRef.id;

        transaction.set(vendaRef, {
          data: serverTimestamp(),
          dataString: new Date().toLocaleDateString("pt-BR"),
          caixaId: caixaAberto.id,
          tipoVenda: "troca",
          operadorEmail: usuarioLogado?.email || "operador",
          lojaId: lojaIdAtual,
          itens: [{ ...itemRef, tamanhoSelecionado: tamanhoFalhaDevolvido }],
          subtotalBruto: difNum,
          desconto: 0,
          total: difNum,
          formaPagamento: "Troca por Falha",
          infoTroca: { itemTrocado: `Defeito: ${itemRef.nome} (${tamanhoFalhaDevolvido}) - ${descricaoFalha}`, valorDiferenca: difNum }
        });
      });

      const recibo = {
        id: vendaCriadaId.substring(0, 8).toUpperCase(),
        dataHora: new Date().toLocaleString("pt-BR"),
        itens: [{ ...itemRef, tamanhoSelecionado: tamanhoFalhaDevolvido }],
        subtotalBruto: Number(valorDiferencaFalha) || 0,
        desconto: 0,
        total: Number(valorDiferencaFalha) || 0,
        formaPagamento: "Troca por Falha",
        tipoVenda: "troca"
      };

      setDadosRecibo(recibo);
      setDadosReciboLocal(recibo);
      alert("Peça com falha registrada, enviada ao painel de falhas e estoque descontado!");
      setModalTipoTrocaAberto(false);
      setModalTrocaFalhaAberto(false);
      setDescricaoFalha("");
      setTamanhoFalhaDevolvido("");
      setValorDiferencaFalha("0.00");
      setCarrinho([]);
      setEtapaTeclado("busca");
      await recarregarDados();

      setTimeout(() => { window.print(); }, 300);
    } catch (err) {
      alert("Erro ao registrar falha: " + err.message);
    } finally {
      setProcessandoVenda(false);
    }
  }

  async function confirmarAVerEProsseguir(e) {
    e.preventDefault();
    if (!nomeResponsavelAVer.trim()) {
      alert("Informe o nome de quem pegou a mercadoria!");
      return;
    }
    setModalAVerInfoAberto(false);
    await executarMercadoriaAVerNoBanco();
  }

  function confirmarDescontoTeclado(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
    setEtapaTeclado("pagamento");
  }

  const valorEntregueNum = parseFloat(valorEntregueInput) || 0;
  const trocoCalculado = Math.max(0, valorEntregueNum - subtotalComDesconto);

  function confirmarDinheiroTeclado(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (valorEntregueNum < subtotalComDesconto) {
      alert(`Valor insuficiente! O total da venda é R$ ${subtotalComDesconto.toFixed(2)}.`);
      return;
    }

    const infoDinheiro = { valorEntregue: valorEntregueNum, troco: trocoCalculado };
    setModalDinheiroAberto(false);
    setEtapaTeclado("busca");
    executarVendaNoBanco(subtotalComDesconto, "Dinheiro", null, infoDinheiro);
  }

  async function executarMercadoriaAVerNoBanco() {
    setProcessandoVenda(true);
    try {
      const hoje = new Date();
      const dataString = hoje.toLocaleDateString("pt-BR");
      const nomeLimpo = nomeResponsavelAVer.trim().toLowerCase();
      const isJarbasOuLucas = nomeLimpo === "jarbas" || nomeLimpo === "lucas" || nomeLimpo.includes("jarbas") || nomeLimpo.includes("lucas");

      // Para Jarbas ou Lucas, o valor due/total é 0 (isento), para os demais clientes usa o subtotalBruto da tabela de atacado
      const valorFinalRegistro = isJarbasOuLucas ? 0 : subtotalBruto;
      const obsTexto = `Responsável: ${nomeResponsavelAVer.trim()} | Data: ${dataAVer} | Valor: R$ ${valorFinalRegistro.toFixed(2)} ${observacaoAVer ? `| Obs: ${observacaoAVer.trim()}` : ""}`;
      const itensDescricaoStr = carrinho.map(i => `${i.quantidade}x ${i.nome} ${i.tamanhoSelecionado ? `(${i.tamanhoSelecionado})` : ""}`).join("; ");

      const pedidoSalvo = {
        tipo: "mercadoria_a_ver",
        lojaId: lojaIdAtual,
        cliente: nomeResponsavelAVer.trim(),
        telefone: telefoneAVer.trim() || "",
        itens: carrinho.map(i => ({ ...i, precoUnitario: isJarbasOuLucas ? 0 : i.precoUnitario })),
        itensDescricao: itensDescricaoStr,
        valorTotalMercadoria: valorFinalRegistro,
        valorPago: 0,
        status: "pendente_prova",
        isJarbasOuLucas,
        observacao: observacaoAVer.trim(),
        dataRetirada: dataAVer,
        data: serverTimestamp()
      };

      console.log("Pedido salvo pelo PDV:", pedidoSalvo);
      console.log("lojaId usado:", lojaIdAtual);
      console.log("tipo usado:", "mercadoria_a_ver");

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

          let novoTamanhosStr = snap.data().tamanhos || "";
          if (item.tamanhoSelecionado) {
            const objT = parseTamanhos(novoTamanhosStr);
            const escolhidos = parseTamanhos(item.tamanhoSelecionado);
            Object.keys(escolhidos).forEach(tam => {
              if (objT[tam] >= escolhidos[tam]) {
                objT[tam] -= escolhidos[tam];
              }
            });
            novoTamanhosStr = serializeTamanhos(objT);
          }

          leituras.push({ ref, novoEstoque: estoqueAtual - item.quantidade, novoTamanhosStr });
        }

        for (const item of leituras) {
          transaction.update(item.ref, { estoque: item.novoEstoque, tamanhos: item.novoTamanhosStr });
        }

        const vendaRef = doc(collection(db, "vendas"));
        transaction.set(vendaRef, {
          data: serverTimestamp(),
          dataString: dataString,
          caixaId: caixaAberto ? caixaAberto.id : "sem_caixa",
          tipoVenda: "a_ver",
          operadorEmail: usuarioLogado?.email || "operador",
          lojaId: lojaIdAtual,
          naoComputarNoCaixa: true,
          itens: carrinho.map((item) => ({
            id: item.id,
            nome: item.nome,
            referencia: item.referencia,
            codigoBarras: item.codigoBarras,
            tamanhoSelecionado: item.tamanhoSelecionado || "",
            precoUnitario: isJarbasOuLucas ? 0 : item.precoUnitario,
            quantidade: item.quantidade,
          })),
          subtotalBruto: valorFinalRegistro,
          desconto: 0,
          total: valorFinalRegistro,
          formaPagamento: "A Ver",
          infoTroca: { itemTrocado: obsTexto, valorDiferenca: 0, levouAlgoMais: "" }
        });

        const pedidoRef = doc(collection(db, "pedidos"));
        transaction.set(pedidoRef, pedidoSalvo);
      });

      alert(isJarbasOuLucas ? "Retirada registrada para Jarbas/Lucas (Isento/Isolado)!" : "Mercadoria a ver registrada com sucesso (Valor devido computado)!");
      setCarrinho([]);
      setDescontoAplicado({ tipo: "reais", valor: 0, totalDescontado: 0 });
      setEtapaTeclado("busca");
      await recarregarDados();
    } catch (err) {
      alert("Erro ao registrar mercadoria a ver: " + err.message);
    } finally {
      setProcessandoVenda(false);
    }
  }

  async function executarVendaNoBanco(valorFinal, pagtoDescricao, infoParcelas, infoDinheiro) {
    setProcessandoVenda(true);
    try {
      let vendaCriadaId = "";
      const hoje = new Date();
      const dataString = hoje.toLocaleDateString("pt-BR");

      const diferencaTrocaNum = tipoTabela === "troca" ? (Number(valorDiferencaInput) || 0) : 0;
      const valorTotalFinalTroca = Math.max(0, subtotalComDesconto + diferencaTrocaNum);

      const infoTrocaObj = tipoTabela === "troca" ? {
        itemTrocado: itemTrocadoInput.trim(),
        valorDiferenca: diferencaNum,
        levouAlgoMais: levouAlgoMaisInput.trim()
      } : null;

      await runTransaction(db, async (transaction) => {
        const leituras = [];
        for (const item of carrinho) {
          const ref = doc(db, "produtos", item.id);
          const snap = await transaction.get(ref);
          if (!snap.exists()) throw new Error(`Produto ${item.nome} não encontrado!`);
          
          let estoqueAtual = snap.data().estoque;
          const aceitaNegativo = snap.data().permiteNegativo || false;
          let novoTamanhosStr = snap.data().tamanhos || "";

          if (!aceitaNegativo && estoqueAtual < item.quantidade) {
            throw new Error(`Estoque insuficiente para ${item.nome}!`);
          }
          estoqueAtual -= item.quantidade;

          if (item.tamanhoSelecionado) {
            const objT = parseTamanhos(novoTamanhosStr);
            const escolhidos = parseTamanhos(item.tamanhoSelecionado);
            Object.keys(escolhidos).forEach(tam => {
              if (objT[tam] >= escolhidos[tam]) {
                objT[tam] -= escolhidos[tam];
              }
            });
            novoTamanhosStr = serializeTamanhos(objT);
          }

          leituras.push({ ref, novoEstoque: estoqueAtual, novoTamanhosStr });
        }

        for (const item of leituras) {
          transaction.update(item.ref, { estoque: item.novoEstoque, tamanhos: item.novoTamanhosStr });
        }

        const vendaRef = doc(collection(db, "vendas"));
        vendaCriadaId = vendaRef.id;

        transaction.set(vendaRef, {
          data: serverTimestamp(),
          dataString: dataString,
          caixaId: caixaAberto ? caixaAberto.id : "sem_caixa",
          tipoVenda: tipoTabela,
          operadorEmail: usuarioLogado?.email || "operador",
          lojaId: lojaIdAtual,
          itens: carrinho.map((item) => ({
            id: item.id,
            nome: item.nome,
            referencia: item.referencia,
            codigoBarras: item.codigoBarras,
            tamanhoSelecionado: item.tamanhoSelecionado || "",
            precoUnitario: item.precoUnitario,
            quantidade: item.quantidade,
          })),
          subtotalBruto: subtotalBruto,
          desconto: valorDescontoCalculado,
          total: tipoTabela === "troca" ? valorTotalFinalTroca : valorFinal,
          formaPagamento: pagtoDescricao,
          parcelas: infoParcelas || null,
          dadosDinheiro: infoDinheiro || null,
          infoTroca: infoTrocaObj
        });
      });

      const recibo = {
        id: vendaCriadaId.substring(0, 8).toUpperCase(),
        dataHora: hoje.toLocaleString("pt-BR"),
        itens: [...carrinho],
        subtotalBruto: subtotalBruto,
        desconto: valorDescontoCalculado,
        total: tipoTabela === "troca" ? valorTotalFinalTroca : valorFinal,
        formaPagamento: pagtoDescricao,
        infoParcelas: infoParcelas,
        infoDinheiro: infoDinheiro,
        tipoVenda: tipoTabela,
        infoTroca: infoTrocaObj
      };

      setDadosRecibo(recibo);
      setDadosReciboLocal(recibo);
      setCarrinho([]);
      setDescontoAplicado({ tipo: "reais", valor: 0, totalDescontado: 0 });
      setEtapaTeclado("busca");
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
        const nomeP = p.nome?.toLowerCase() || "";
        const refP = p.referencia?.toLowerCase() || "";
        const codP = p.codigoBarras?.toLowerCase() || "";

        const termoSemEspacos = termo.replace(/\s+/g, "");
        const nomeSemEspacos = nomeP.replace(/\s+/g, "");

        const matchNomeExato = nomeP.includes(termo) || nomeSemEspacos.includes(termoSemEspacos);
        const matchRef = refP.includes(termo) || refP === termo;
        const matchCod = codP.includes(termo);

        return matchNomeExato || matchRef || matchCod;
      }).sort((a, b) => {
        const aRef = (a.referencia || "").toLowerCase();
        const bRef = (b.referencia || "").toLowerCase();
        if (aRef === termo && bRef !== termo) return -1;
        if (bRef === termo && aRef !== termo) return 1;
        return 0;
      })
    : [];

  const produtosTrocaFiltrados = buscaTrocaProduto.trim().length > 0
    ? produtos.filter(p => p.nome.toLowerCase().includes(buscaTrocaProduto.trim().toLowerCase()) || (p.referencia && p.referencia.toLowerCase().includes(buscaTrocaProduto.trim().toLowerCase())))
    : [];

  useEffect(() => {
    setIndiceFocoBusca(0);
  }, [buscaPdv]);

  useEffect(() => {
    if (listaBuscaRef.current && produtosFiltrados.length > 0) {
      const elementoAtivo = listaBuscaRef.current.children[indiceFocoBusca];
      if (elementoAtivo) {
        elementoAtivo.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [indiceFocoBusca, produtosFiltrados]);

  function handleKeyDownBusca(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (termo.length === 0) {
        iniciarFluxoFechamentoTeclado();
        return;
      }
      if (produtosFiltrados.length > 0) {
        const itemEscolhido = produtosFiltrados[indiceFocoBusca] || produtosFiltrados[0];
        if (itemEscolhido) {
          abrirModalQtd(itemEscolhido);
          setEtapaTeclado("adicionarItem");
        }
      }
    } else if (e.key === "ArrowDown" && produtosFiltrados.length > 0) {
      e.preventDefault();
      setIndiceFocoBusca((prev) => (prev < produtosFiltrados.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp" && produtosFiltrados.length > 0) {
      e.preventDefault();
      setIndiceFocoBusca((prev) => (prev > 0 ? prev - 1 : produtosFiltrados.length - 1));
    } else if (e.key === "ArrowRight" && termo.length === 0) {
      e.preventDefault();
      if (tipoTabela === "varejo") setTipoTabela("atacado");
      else if (tipoTabela === "atacado") setTipoTabela("troca");
      else if (tipoTabela === "troca") setTipoTabela("a_ver");
      else if (tipoTabela === "a_ver") setTipoTabela("varejo");
    } else if (e.key === "ArrowLeft" && termo.length === 0) {
      e.preventDefault();
      if (tipoTabela === "varejo") setTipoTabela("a_ver");
      else if (tipoTabela === "a_ver") setTipoTabela("troca");
      else if (tipoTabela === "troca") setTipoTabela("atacado");
      else if (tipoTabela === "atacado") setTipoTabela("varejo");
    }
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          body * { visibility: hidden !important; }
          .print-recibo, .print-recibo * { visibility: visible !important; }
          .print-recibo { 
            display: block !important; 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 72mm !important; 
            background: #fff !important; 
            color: #000 !important; 
            font-family: 'Courier New', Courier, monospace !important; 
            font-size: 12px !important;
            font-weight: bold !important;
            padding: 1mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
        }
        @media screen {
          .print-recibo { display: none; }
        }
        .input-animado:focus {
          border-color: #28a745 !important;
          box-shadow: 0 0 10px rgba(40, 167, 69, 0.25);
          background: rgba(40, 167, 69, 0.03);
        }
        .btn-hover-troca:hover {
          background: ${cores.bgCardSecundario || "#f0f0f0"} !important;
          border-color: ${corModo} !important;
        }
      `}</style>

      {/* RECIBO TÉRMICO 80mm SEM LOGO E COM LARGURA OTIMIZADA */}
      {dadosReciboLocal && (
        <div className="print-recibo">
          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>{configLoja.nomeLoja}</h2>
            {configLoja.endereco && <p style={{ margin: "2px 0", fontSize: "10px" }}>{configLoja.endereco}</p>}
            {configLoja.telefone && <p style={{ margin: "2px 0", fontSize: "10px" }}>Tel: {configLoja.telefone}</p>}
            <p style={{ margin: "4px 0 2px 0", fontSize: "11px" }}>COMPROVANTE DE VENDA</p>
            <p style={{ margin: "2px 0", fontSize: "10px" }}>Pedido: #{dadosReciboLocal.id}</p>
            <p style={{ margin: "2px 0", fontSize: "10px" }}>{dadosReciboLocal.dataHora}</p>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "5px 0" }}></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11px" }}>
            <span>ITEM / TAM / QTD x VL.UN</span>
            <span>TOTAL</span>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "3px 0 5px 0" }}></div>
          {dadosReciboLocal.itens.map((item, i) => (
            <div key={i} style={{ marginBottom: "5px", fontSize: "11px" }}>
              <div>{item.nome} {item.tamanhoSelecionado ? `[Tam: ${item.tamanhoSelecionado}]` : ""}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{item.quantidade}x R$ {Number(item.precoUnitario).toFixed(2)}</span>
                <span>R$ {(item.quantidade * item.precoUnitario).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {dadosReciboLocal.infoTroca && (
            <div style={{ fontSize: "10px", marginTop: "4px", borderTop: "1px solid #000", paddingTop: "4px" }}>
              <strong>Obs/Troca:</strong> {dadosReciboLocal.infoTroca.itemTrocado}
            </div>
          )}
          <div style={{ borderBottom: "1px solid #000", margin: "5px 0" }}></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Subtotal:</span>
            <span>R$ {dadosReciboLocal.subtotalBruto.toFixed(2)}</span>
          </div>
          {dadosReciboLocal.desconto > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Desconto:</span>
              <span>- R$ {dadosReciboLocal.desconto.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px", marginTop: "4px" }}>
            <span>TOTAL PAGO:</span>
            <span>R$ {dadosReciboLocal.total.toFixed(2)}</span>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "5px 0" }}></div>
          <div style={{ textAlign: "center", fontSize: "11px" }}>
            <p style={{ margin: "2px 0" }}>Forma: {dadosReciboLocal.formaPagamento}</p>
            <p style={{ margin: "2px 0" }}>Modo: {dadosReciboLocal.tipoVenda.toUpperCase()}</p>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "5px 0" }}></div>
          <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
            {configLoja.mensagemRodape}
          </div>
        </div>
      )}

      {modalAtalhosAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "420px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 15px 0", color: cores.texto }}>⌨️ Atalhos do Sistema PDV</h3>
            <ul style={{ paddingLeft: "20px", color: cores.textoSecundario, lineHeight: "1.8", margin: "0 0 20px 0", fontSize: "13px" }}>
              <li><strong>Teclas 1, 2, 3, 4 (com busca vazia):</strong> Alternam entre Varejo, Atacado, Troca e Mercadoria a Ver.</li>
              <li><strong>Setas ← / → (com busca vazia):</strong> Alternam os modos de venda.</li>
              <li><strong>Enter (com busca vazia):</strong> Inicia o fechamento da venda ou preenchimento especial.</li>
              <li><strong>Setas (↑ ↓):</strong> Navegam pelos produtos na busca com rolagem automática.</li>
              <li><strong>Tecla F2 (com busca vazia):</strong> Gerencia os tamanhos do último item do carrinho.</li>
              <li><strong>Tecla Q (com busca vazia):</strong> Altera o preço do último item do carrinho.</li>
              <li><strong>F1:</strong> Abre / fecha este painel de ajuda.</li>
            </ul>
            <button onClick={() => setModalAtalhosAberto(false)} style={{ width: "100%", padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
              Fechar (Esc / F1)
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE SELEÇÃO DE TAMANHO COM F2 */}
      {modalTamanhoCarrinhoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "20px", borderRadius: "10px", width: "100%", maxWidth: "420px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>👕 Gerenciar Tamanhos da Peça</h3>
            <p style={{ fontSize: "12px", color: cores.textoSecundario, marginBottom: "15px" }}>
              Item: <strong>{carrinho[itemSelecionadoCarrinhoIdx]?.nome}</strong>
            </p>

            {etapaTamanhoModal === "lista" ? (
              <div>
                <p style={{ fontSize: "11px", color: cores.textoSecundario, marginBottom: "10px" }}>Selecione um tamanho disponível:</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "15px", maxHeight: "200px", overflowY: "auto" }}>
                  {Object.keys(tamanhosDisponiveisTemp).length === 0 ? (
                    <p style={{ fontSize: "12px", color: cores.textoSuave, gridColumn: "1 / -1" }}>Nenhum tamanho cadastrado neste produto.</p>
                  ) : (
                    Object.keys(tamanhosDisponiveisTemp).map(tam => {
                      const disp = tamanhosDisponiveisTemp[tam];
                      return (
                        <button
                          key={tam}
                          type="button"
                          onClick={() => {
                            if (disp <= 0) {
                              alert("Este tamanho está esgotado!");
                              return;
                            }
                            setTamanhoSelecionadoTemp(tam);
                            setQtdTamanhoTemp("1");
                            setEtapaTamanhoModal("qtd");
                          }}
                          style={{
                            padding: "10px",
                            background: disp > 0 ? cores.bgCardSecundario : "#2a2a2a",
                            color: disp > 0 ? cores.texto : "#666",
                            border: `1px solid ${cores.borda}`,
                            borderRadius: "6px",
                            fontWeight: "bold",
                            cursor: disp > 0 ? "pointer" : "not-allowed",
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "13px"
                          }}
                        >
                          <span>{tam}</span>
                          <span style={{ color: "#28a745" }}>({disp} un)</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => setModalTamanhoCarrinhoAberto(false)} style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
                    Concluir e Voltar (Enter)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={confirmarQtdTamanhoModal}>
                <div style={{ background: cores.bgCardSecundario, padding: "10px", borderRadius: "6px", marginBottom: "12px", fontSize: "13px", color: cores.texto }}>
                  Tamanho selecionado: <strong style={{ color: corModo }}>{tamanhoSelecionadoTemp}</strong> (Disp: {tamanhosDisponiveisTemp[tamanhoSelecionadoTemp]} un)
                </div>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "6px" }}>Quantidade (Apenas números):</label>
                <input 
                  ref={inputQtdTamRef}
                  type="text" 
                  inputMode="numeric"
                  className="input-animado"
                  value={qtdTamanhoTemp}
                  onChange={(e) => setQtdTamanhoTemp(e.target.value.replace(/\D/g, ""))}
                  style={{ width: "100%", padding: "12px", background: cores.inputBg, border: `2px solid ${corModo}`, color: cores.texto, borderRadius: "6px", marginBottom: "15px", boxSizing: "border-box", outline: "none", fontSize: "18px", fontWeight: "bold", textAlign: "center" }}
                  required
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => setEtapaTamanhoModal("lista")} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Voltar</button>
                  <button type="submit" style={{ flex: 1, padding: "10px", background: corModo, color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>Adicionar (Enter)</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: SELEÇÃO DO TIPO DE TROCA */}
      {modalTipoTrocaAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "10px", width: "100%", maxWidth: "420px", border: `1px solid ${cores.borda}`, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: cores.texto }}>🔄 Selecione o Procedimento de Troca</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px", marginBottom: "15px" }}>Item no carrinho: <strong>{carrinho[0]?.nome}</strong></p>
            <p style={{ color: cores.textoSuave, fontSize: "11px", marginBottom: "15px" }}>Navegue com [↑ / ↓] e confirme com [Enter]</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Troca por Tamanho (Mesmo Produto)", acao: 0 },
                { label: "Troca por Outro Produto", acao: 1 },
                { label: "Troca por Falha / Defeito", acao: 2 }
              ].map((opt, idx) => {
                const focado = indiceTrocaTipo === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setIndiceTrocaTipo(idx);
                      if (idx === 0) {
                        setModalTipoTrocaAberto(false);
                        const item = carrinho[0];
                        const prodReal = produtos.find(p => p.id === item.id);
                        const prateleira = prodReal ? parseTamanhos(prodReal.tamanhos) : parseTamanhos(item.tamanhosDisponiveis);
                        setTamanhosDisponiveisDevolucao(prateleira);
                        setTamanhosDisponiveisNovo(prateleira);
                        setTamanhoDevolvidoTroca("");
                        setTamanhoNovoTroca("");
                        setTipoPrecoTrocaTamanho(tipoTabela);
                        setModalTrocaTamanhoAberto(true);
                      } else if (idx === 1) {
                        setModalTipoTrocaAberto(false);
                        setBuscaTrocaProduto("");
                        setProdutoSubstitutoTroca(null);
                        setTamanhoSubstitutoTroca("");
                        setTamanhosSubstitutosDisponiveis({});
                        setTipoPrecoOutroProd(tipoTabela);
                        setModalTrocaOutroProdutoAberto(true);
                      } else if (idx === 2) {
                        setModalTipoTrocaAberto(false);
                        setDescricaoFalha("");
                        setTamanhoFalhaDevolvido(carrinho[0]?.tamanhoSelecionado || "");
                        setValorDiferencaFalha("0.00");
                        setModalTrocaFalhaAberto(true);
                      }
                    }}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "8px",
                      border: focado ? `2px solid ${corModo}` : `1px solid ${cores.borda}`,
                      background: focado ? (cores.itemAtivoBg || "rgba(0,123,255,0.15)") : cores.bgCardSecundario,
                      color: cores.texto,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <span>{opt.label}</span>
                    {focado && <span style={{ fontSize: "11px", background: corModo, color: "#fff", padding: "2px 6px", borderRadius: "3px" }}>Enter ↵</span>}
                  </div>
                );
              })}
            </div>

            <button onClick={() => setModalTipoTrocaAberto(false)} style={{ width: "100%", padding: "11px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
              Cancelar (Esc)
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: TROCA POR TAMANHO */}
      {modalTrocaTamanhoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "10px", width: "100%", maxWidth: "420px", border: `1px solid ${cores.borda}`, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>👕 Troca por Tamanho</h3>
            <p style={{ fontSize: "12px", color: cores.textoSecundario, marginBottom: "15px" }}>Item: <strong>{carrinho[0]?.nome}</strong></p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Tamanho Devolvido pelo Cliente (Entra no estoque):</label>
              <select value={tamanhoDevolvidoTroca} onChange={e => setTamanhoDevolvidoTroca(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}>
                <option value="">Selecione...</option>
                {Object.keys(tamanhosDisponiveisDevolucao).map(t => (
                  <option key={t} value={t} style={{ background: cores.bgGeral, color: cores.texto }}>{t}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Novo Tamanho Retirado (Sai do estoque):</label>
              <select value={tamanhoNovoTroca} onChange={e => setTamanhoNovoTroca(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}>
                <option value="">Selecione...</option>
                {Object.keys(tamanhosDisponiveisNovo).map(t => {
                  const disp = tamanhosDisponiveisNovo[t];
                  return (
                    <option key={t} value={t} disabled={disp <= 0} style={{ background: cores.bgGeral, color: disp > 0 ? cores.texto : "#888" }}>
                      {t} (Disponível: {disp} un)
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Tabela de Preço:</label>
              <select value={tipoPrecoTrocaTamanho} onChange={e => setTipoPrecoTrocaTamanho(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}>
                <option value="varejo" style={{ background: cores.bgGeral, color: cores.texto }}>Varejo</option>
                <option value="atacado" style={{ background: cores.bgGeral, color: cores.texto }}>Atacado</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setModalTrocaTamanhoAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer" }}>Voltar</button>
              <button onClick={concluirTrocaPorTamanho} disabled={processandoVenda} style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{processandoVenda ? "Processando..." : "Confirmar Troca"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TROCA POR OUTRO PRODUTO */}
      {modalTrocaOutroProdutoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "10px", width: "100%", maxWidth: "450px", border: `1px solid ${cores.borda}`, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>🔄 Troca por Outro Produto</h3>
            <p style={{ fontSize: "12px", color: cores.textoSecundario, marginBottom: "15px" }}>Item devolvido: <strong>{carrinho[0]?.nome}</strong></p>

            <form onSubmit={confirmarTrocaOutroProduto}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Buscar Novo Produto no Estoque:</label>
                <input type="text" placeholder="Digite o nome ou referência..." value={buscaTrocaProduto} onChange={e => setBuscaTrocaProduto(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }} />
              </div>

              {buscaTrocaProduto.trim().length > 0 && (
                <div style={{ maxHeight: "140px", overflowY: "auto", border: `1px solid ${cores.borda}`, borderRadius: "6px", marginBottom: "12px" }}>
                  {produtosTrocaFiltrados.length === 0 ? (
                    <p style={{ padding: "8px", fontSize: "12px", color: cores.textoSecundario }}>Nenhum produto encontrado.</p>
                  ) : (
                    produtosTrocaFiltrados.map(p => (
                      <div key={p.id} onClick={() => { 
                        setProdutoSubstitutoTroca(p); 
                        setTamanhosSubstitutosDisponiveis(parseTamanhos(p.tamanhos));
                        setTamanhoSubstitutoTroca("");
                        setBuscaTrocaProduto(""); 
                      }} style={{ padding: "8px 12px", borderBottom: `1px solid ${cores.bordaClara}`, cursor: "pointer", background: produtoSubstitutoTroca?.id === p.id ? cores.itemAtivoBg : "transparent", color: cores.texto }}>
                        <strong>{p.nome}</strong> - R$ {Number(p.precoVarejo || p.preco || 0).toFixed(2)} (Estoque: {p.estoque} un)
                      </div>
                    ))
                  )}
                </div>
              )}

              {produtoSubstitutoTroca && (
                <div style={{ background: cores.bgCardSecundario, padding: "10px", borderRadius: "6px", marginBottom: "12px", fontSize: "13px", color: cores.texto }}>
                  Selecionado: <strong>{produtoSubstitutoTroca.nome}</strong> (Estoque Total: {produtoSubstitutoTroca.estoque} un)
                </div>
              )}

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Tamanho do Novo Produto:</label>
                <select value={tamanhoSubstitutoTroca} onChange={e => setTamanhoSubstitutoTroca(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }} required>
                  <option value="">Selecione o tamanho...</option>
                  {Object.keys(tamanhosSubstitutosDisponiveis).map(t => {
                    const disp = tamanhosSubstitutosDisponiveis[t];
                    return (
                      <option key={t} value={t} disabled={disp <= 0} style={{ background: cores.bgGeral, color: disp > 0 ? cores.texto : "#888" }}>
                        {t} (Disponível: {disp} un)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Tabela de Preço:</label>
                <select value={tipoPrecoOutroProd} onChange={e => setTipoPrecoOutroProd(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}>
                  <option value="varejo" style={{ background: cores.bgGeral, color: cores.texto }}>Varejo</option>
                  <option value="atacado" style={{ background: cores.bgGeral, color: cores.texto }}>Atacado</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => setModalTrocaOutroProdutoAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer" }}>Voltar</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#e67e22", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Avançar para Pagamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: TROCA POR FALHA / DEFEITO */}
      {modalTrocaFalhaAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "10px", width: "100%", maxWidth: "420px", border: `1px solid ${cores.borda}`, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>⚠️ Registrar Troca por Falha / Defeito</h3>
            <p style={{ fontSize: "12px", color: cores.textoSecundario, marginBottom: "15px" }}>A peça danificada será descontada do estoque e enviada ao painel de Peças com Falha.</p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Peça Trocada:</label>
              <input type="text" value={carrinho[0]?.nome || ""} readOnly style={{ width: "100%", padding: "10px", background: cores.bgCardSecundario, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", fontWeight: "bold" }} />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Tamanho da Peça:</label>
              <input type="text" placeholder="Ex: M ou 42" value={tamanhoFalhaDevolvido} onChange={e => setTamanhoFalhaDevolvido(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }} required />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Valor de Diferença (Se houver R$):</label>
              <input type="number" step="0.01" value={valorDiferencaFalha} onChange={e => setValorDiferencaFalha(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Descrição da Falha / Defeito:</label>
              <textarea placeholder="Ex: Tecido rasgado, zíper travado..." value={descricaoFalha} onChange={e => setDescricaoFalha(e.target.value)} style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", height: "80px", boxSizing: "border-box", resize: "vertical" }} required />
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setModalTrocaFalhaAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer" }}>Voltar</button>
              <button onClick={concluirTrocaPorFalha} disabled={processandoVenda} style={{ flex: 1, padding: "10px", background: "#e53e3e", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{processandoVenda ? "Processando..." : "Registrar Falha"}</button>
            </div>
          </div>
        </div>
      )}

      {modalAVerInfoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "400px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", color: cores.texto }}>🛍️ Mercadoria a Ver / Prova</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px", margin: "0 0 15px 0" }}>Atualiza o estoque, exibe o valor no relatório e registra o pedido.</p>

            <form onSubmit={confirmarAVerEProsseguir}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Nome de quem pegou (Carlos / Jarbas / Lucas...):</label>
                <input
                  ref={inputAVer1Ref}
                  type="text"
                  placeholder=""
                  value={nomeResponsavelAVer}
                  onChange={(e) => setNomeResponsavelAVer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); inputAVerTelRef.current?.focus(); } }}
                  style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Telefone de contato:</label>
                <input
                  ref={inputAVerTelRef}
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={telefoneAVer}
                  onChange={(e) => setTelefoneAVer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); inputAVer2Ref.current?.focus(); } }}
                  style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Observação:</label>
                <input
                  ref={inputAVer2Ref}
                  type="text"
                  placeholder=""
                  value={observacaoAVer}
                  onChange={(e) => setObservacaoAVer(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.borda}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setModalAVerInfoAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "#8e44ad", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {produtoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "340px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", color: cores.texto }}>Adicionar Item</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "14px", margin: "0 0 15px 0" }}>
              <strong style={{ color: cores.texto }}>{produtoModal.nome}</strong><br />
              <span style={{ color: corModo, fontWeight: "bold" }}>
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
                <button type="submit" style={{ flex: 1, padding: "10px", background: corModo, color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Confirmar (Enter)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemEditandoPreco && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "340px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", color: cores.texto }}>✏️ Alterar Preço Unitário</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "14px", margin: "0 0 15px 0" }}>
              Item: <strong style={{ color: cores.texto }}>{itemEditandoPreco.nome}</strong>
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

      {modalDescontoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "360px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 10px 0", color: cores.texto }}>🎟️ Desconto na Venda</h3>
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

      {modalFormaPagtoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "360px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 10px 0", color: cores.texto }}>💳 Escolha a Forma de Pagamento</h3>
            <p style={{ color: cores.textoSecundario, fontSize: "13px", margin: "0 0 15px 0" }}>
              Total a pagar: <strong style={{ color: corModo, fontSize: "16px" }}>R$ {(tipoTabela === "troca" ? Math.max(0, subtotalComDesconto + (Number(valorDiferencaInput) || 0)) : subtotalComDesconto).toFixed(2)}</strong> <br />
              <span style={{ color: cores.textoSuave }}>Navegue com [↑ / ↓] e confirme com [Enter]</span>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" }}>
              {formasPagamentoDisponiveis.map((fp, idx) => {
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
                    <strong style={{ fontSize: "16px", color: cores.texto }}>{fp}</strong>
                    {focado && <span style={{ fontSize: "11px", background: corModo, color: "#fff", padding: "2px 6px", borderRadius: "3px" }}>Enter ↵</span>}
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

      {modalCartaoAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "380px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: cores.texto }}>💳 Parcelamento Cartão de Crédito</h3>
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
                      <strong style={{ color: cores.texto }}>{conf.label}</strong>
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

      {modalDinheiroAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "8px", width: "360px", border: `1px solid ${cores.borda}`, boxShadow: "0 6px 25px rgba(0,0,0,0.7)" }}>
            <h3 style={{ margin: "0 0 10px 0", color: cores.texto }}>💵 Pagamento em Dinheiro</h3>
            
            <div style={{ background: cores.bgCardSecundario, padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: cores.texto }}>
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
                style={{ width: "100%", padding: "14px", fontSize: "22px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `2px solid ${corModo}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", marginBottom: "15px", outline: "none" }}
              />

              <div style={{ background: valorEntregueNum >= subtotalComDesconto ? "rgba(40, 167, 69, 0.15)" : "rgba(229, 62, 62, 0.15)", border: `1px solid ${valorEntregueNum >= subtotalComDesconto ? "#28a745" : "#e53e3e"}`, padding: "14px", borderRadius: "6px", textAlign: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "13px", display: "block", color: cores.textoSecundario }}>TROCO A DEVOLVER:</span>
                <strong style={{ fontSize: "24px", color: valorEntregueNum >= subtotalComDesconto ? "#28a745" : "#e53e3e" }}>
                  R$ {trocoCalculado.toFixed(2)}
                </strong>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => { setModalDinheiroAberto(false); setModalFormaPagtoAberto(true); }} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px", cursor: "pointer" }}>Voltar</button>
                <button type="submit" disabled={processandoVenda || valorEntregueNum < subtotalComDesconto} style={{ flex: 1, padding: "10px", background: valorEntregueNum >= subtotalComDesconto ? corModo : cores.bgCardSecundario, color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: valorEntregueNum >= subtotalComDesconto ? "pointer" : "not-allowed" }}>
                  Finalizar (Enter)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÁREA DA FRENTE DE CAIXA */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "25px", width: "100%" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", border: `1px solid ${cores.borda}`, flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", marginRight: "4px", color: cores.texto }}>Modo de Venda:</span>
              <button
                onClick={() => setTipoTabela("varejo")}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoTabela === "varejo" ? "#28a745" : cores.bgCardSecundario, color: tipoTabela === "varejo" ? "#fff" : cores.texto }}
              >
                [1] Varejo
              </button>
              <button
                onClick={() => setTipoTabela("atacado")}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoTabela === "atacado" ? "#007bff" : cores.bgCardSecundario, color: tipoTabela === "atacado" ? "#fff" : cores.texto }}
              >
                [2] Atacado
              </button>
              <button
                onClick={() => setTipoTabela("troca")}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoTabela === "troca" ? "#e67e22" : cores.bgCardSecundario, color: tipoTabela === "troca" ? "#fff" : cores.texto }}
              >
                [3] Troca
              </button>
              <button
                onClick={() => setTipoTabela("a_ver")}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", background: tipoTabela === "a_ver" ? "#8e44ad" : cores.bgCardSecundario, color: tipoTabela === "a_ver" ? "#fff" : cores.texto }}
              >
                [4] A Ver
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
                border: `2px solid ${corModo}`,
                borderRadius: "8px",
                color: cores.texto,
                boxSizing: "border-box",
                fontSize: "17px",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "12px", color: cores.textoSuave, padding: "0 4px" }}>
              <span>{termo.length === 0 ? "Com busca vazia: Use [1-4] ou [← / →] para modo, [Enter] para Finalizar, [Q] para preço, [F2] para tamanho" : "Navegue com setas ↑ ↓"}</span>
              <span>Pressione F1 para ver os atalhos</span>
            </div>
          </div>

          {termo.length > 0 && (
            <div ref={listaBuscaRef} style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "55vh", overflowY: "auto" }}>
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
                        border: focado ? `2px solid ${corModo}` : `1px solid ${cores.borda}`,
                        cursor: "pointer"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "16px", color: cores.texto }}>{p.nome}</strong>
                          {focado && <span style={{ fontSize: "11px", background: corModo, color: "#fff", padding: "2px 6px", borderRadius: "3px" }}>Enter ↵</span>}
                        </div>
                        <div style={{ color: cores.textoSecundario, fontSize: "13px", marginTop: "4px" }}>
                          <span style={{ color: corModo, fontWeight: "bold" }}>
                            R$ {precoCobrado.toFixed(2)}
                          </span>
                          {" | "}Estoque: {p.estoque} un {p.permiteNegativo ? "(Sem trava)" : ""}
                          {p.referencia ? ` | Ref: ${p.referencia}` : ""}
                          {p.codigoBarras ? ` | Cód: ${p.codigoBarras}` : ""}
                        </div>
                      </div>
                      <span style={{ background: focado ? corModo : cores.bgCardSecundario, color: focado ? "#fff" : cores.texto, padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
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
              <h2 style={{ margin: 0, fontSize: "20px", color: cores.texto }}>Itens da Venda</h2>
              <span style={{ fontSize: "12px", background: corModo, color: "#fff", padding: "3px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                {tipoTabela === "a_ver" ? "MERCADORIA A VER" : tipoTabela.toUpperCase()}
              </span>
            </div>

            {carrinho.length === 0 ? (
              <p style={{ color: cores.textoSuave, marginTop: "20px" }}>Nenhum item adicionado à venda. (Pressione F2 para definir tamanho)</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "35vh", overflowY: "auto", margin: "15px 0" }}>
                {carrinho.map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.bordaClara}`, paddingBottom: "8px" }}>
                    <div>
                      <div style={{ color: cores.texto }}><strong>{item.nome}</strong></div>
                      <div style={{ fontSize: "12px", color: "#28a745", fontWeight: "bold" }}>
                        Tamanho: {item.tamanhoSelecionado || "⚠️ Não definido (Pressione F2)"}
                      </div>
                      <div 
                        onClick={() => {
                          if (tipoTabela !== "a_ver") {
                            setItemEditandoPreco(item);
                            setNovoPrecoInput(item.precoUnitario.toString());
                          }
                        }}
                        title={tipoTabela !== "a_ver" ? "Clique para alterar o preço" : ""}
                        style={{ fontSize: "12px", color: cores.textoSecundario, cursor: tipoTabela !== "a_ver" ? "pointer" : "default" }}
                      >
                        {item.referencia ? `Ref: ${item.referencia} | ` : ""}
                        {item.quantidade}x <span style={{ color: corModo, textDecoration: tipoTabela !== "a_ver" ? "underline" : "none" }}>R$ {Number(item.precoUnitario).toFixed(2)}</span> = <strong style={{ color: cores.texto }}>R$ {(Number(item.precoUnitario) * item.quantidade).toFixed(2)}</strong> 
                        {tipoTabela !== "a_ver" && <span style={{ fontSize: "10px", marginLeft: "5px", color: cores.textoSuave }}>(✏️ editar)</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button onClick={() => abrirModalTamanhoCarrinho(idx)} title="Definir Tamanho (F2)" style={{ background: "#ffc107", color: "#000", border: "none", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>👕 Tam</button>
                      <button onClick={() => removerDoCarrinho(item.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: `2px solid ${cores.borda}`, paddingTop: "15px" }}>
            {descontoAplicado.valor > 0 && tipoTabela !== "a_ver" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ color: cores.textoSecundario, fontSize: "14px" }}>Desconto:</span>
                <span style={{ color: "#e53e3e", fontWeight: "bold", fontSize: "15px" }}>
                  - R$ {valorDescontoCalculado.toFixed(2)} ({descontoAplicado.tipo === "porcentagem" ? `${descontoAplicado.valor}%` : "R$"})
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", color: cores.texto }}>
              <span style={{ fontSize: "18px" }}>Total da Venda:</span>
              <span style={{ fontSize: "24px", fontWeight: "bold", color: corModo }}>
                R$ {subtotalComDesconto.toFixed(2)}
              </span>
            </div>

            <button
              onClick={iniciarFluxoFechamentoTeclado}
              disabled={processandoVenda || carrinho.length === 0}
              style={{ width: "100%", padding: "14px", background: carrinho.length > 0 ? corModo : cores.bgCardSecundario, color: "#fff", border: "none", borderRadius: "6px", fontSize: "16px", fontWeight: "bold", cursor: carrinho.length > 0 ? "pointer" : "not-allowed" }}
            >
              {processandoVenda ? "Processando..." : tipoTabela === "a_ver" ? "Registrar a Ver (Enter no campo vazio)" : tipoTabela === "troca" ? "Finalizar Troca (Enter no campo vazio)" : "Finalizar Venda (Enter no campo vazio)"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}