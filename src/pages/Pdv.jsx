import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { fetchStockProducts } from "../services/stockService";
import { executeSale } from "../services/saleService";
import { printThermalReceipt } from "../services/receiptService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import CloseCashierModal from "../components/cashier/CloseCashierModal";
import ModalFilaOffline from "../components/pdv/ModalFilaOffline";
import { formatCurrency } from "../utils/formatters";
import { cn } from "../utils/cn";
import {
  isPdvOnline,
  saveOfflineSale,
  getPendingSalesCount,
  syncOfflineSalesQueue,
  OFFLINE_EVENT_QUEUE_UPDATED,
  OFFLINE_EVENT_SYNC_FINISHED
} from "../services/pdvOfflineService";
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  DollarSign,
  CreditCard,
  QrCode,
  Tag,
  User,
  Layers,
  ArrowRight,
  Clock,
  RotateCcw,
  Sparkles,
  Calculator,
  CornerDownLeft,
  Hash,
  Save,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  Lock,
  Unlock
} from "lucide-react";

const TAXAS_CARTAO_CREDITO = {
  1: { taxa: 0.0, label: "1x à vista (sem juros)" },
  2: { taxa: 0.05, label: "2x (5% taxa)" },
  3: { taxa: 0.07, label: "3x (7% taxa)" },
  4: { taxa: 0.09, label: "4x (9% taxa)" }
};

const FORMAS_PAGTO_LISTA = ["dinheiro", "pix", "cartao_debito", "cartao_credito"];

export default function Pdv() {
  const { userProfile } = useAuth();
  const { activeTenantId, activeUnitId, companyDetails } = useTenant();

  // Dados da Loja para Impressão de Cupom 80mm
  const dadosLojaCupom = useMemo(() => ({
    nome: companyDetails?.nome || "LIFESURF CONFECÇÕES & SURFWEAR",
    cidade: companyDetails?.cidade ? `${companyDetails.cidade} - ${companyDetails.estado || "CE"}` : "Fortaleza - CE",
    cnpj: companyDetails?.cnpj || "12.345.678/0001-90",
    telefone: companyDetails?.telefone || "(85) 98888-7777",
    mensagemRodape: companyDetails?.mensagemRodape || "OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!"
  }), [companyDetails]);

  // Chave de persistência de venda em andamento
  const storageKey = `lifesurf_pdv_venda_${activeTenantId || "default"}`;

  // Produtos carregados da loja
function consolidarItensCarrinho(itens) {
  if (!Array.isArray(itens)) return [];
  const consolidados = [];
  itens.forEach((item) => {
    const idx = consolidados.findIndex((c) => {
      if (item.codigoBarras && c.codigoBarras && item.codigoBarras === c.codigoBarras) return true;
      if (item.referencia && c.referencia && item.referencia === c.referencia) return true;
      if (item.id && c.id && item.id === c.id) return true;
      return item.key && c.key && item.key === c.key;
    });
    if (idx >= 0) {
      consolidados[idx].quantidade += Number(item.quantidade) || 1;
    } else {
      consolidados.push({ ...item });
    }
  });
  return consolidados;
}

  const [produtosLoja, setProdutosLoja] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);

  // Status de Abertura / Fechamento de Caixa do PDV
  const [caixaAberto, setCaixaAberto] = useState(() => {
    try {
      const savedStatus = localStorage.getItem(`lifesurf_caixa_aberto_${activeTenantId || "default"}`);
      if (savedStatus === "fechado") return false;
    } catch {}
    return true;
  });
  const [modalAbrirCaixaAberto, setModalAbrirCaixaAberto] = useState(false);
  const [trocoAberturaInput, setTrocoAberturaInput] = useState("100.00");

  const handleAbrirCaixa = (e) => {
    if (e) e.preventDefault();
    try {
      localStorage.setItem(`lifesurf_caixa_aberto_${activeTenantId || "default"}`, "aberto");
      localStorage.setItem(`lifesurf_fundo_troco_${activeTenantId || "default"}`, String(trocoAberturaInput || "0"));
      setCaixaAberto(true);
      setModalAbrirCaixaAberto(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error(err);
      setCaixaAberto(true);
      setModalAbrirCaixaAberto(false);
    }
  };

  // 1. ESTADO DO CARRINHO COM PERSISTÊNCIA AUTOMÁTICA & CONSOLIDAÇÃO DE ITENS COM MESMO CÓDIGO
  const [carrinho, setCarrinho] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_pdv_venda_${activeTenantId || "default"}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed.carrinho) ? consolidarItensCarrinho(parsed.carrinho) : [];
      }
    } catch (e) {
      console.warn("Erro ao restaurar carrinho:", e);
    }
    return [];
  });

  const [tipoTabela, setTipoTabela] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_pdv_venda_${activeTenantId || "default"}`);
      if (saved) return JSON.parse(saved).tipoTabela || "varejo";
    } catch {}
    return "varejo";
  });

  const [clienteNome, setClienteNome] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_pdv_venda_${activeTenantId || "default"}`);
      if (saved) return JSON.parse(saved).clienteNome || "Consumidor Final";
    } catch {}
    return "Consumidor Final";
  });

  const [valorDesconto, setValorDesconto] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_pdv_venda_${activeTenantId || "default"}`);
      if (saved) return JSON.parse(saved).valorDesconto || "";
    } catch {}
    return "";
  });

  const [tipoDesconto, setTipoDesconto] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_pdv_venda_${activeTenantId || "default"}`);
      if (saved) return JSON.parse(saved).tipoDesconto || "reais";
    } catch {}
    return "reais";
  });

  // Salva automaticamente o rascunho da venda ao mudar de tela
  useEffect(() => {
    const key = `lifesurf_pdv_venda_${activeTenantId || "default"}`;
    if (carrinho.length > 0) {
      localStorage.setItem(
        key,
        JSON.stringify({
          carrinho,
          tipoTabela,
          clienteNome,
          valorDesconto,
          tipoDesconto
        })
      );
    } else {
      localStorage.removeItem(key);
    }
  }, [carrinho, tipoTabela, clienteNome, valorDesconto, tipoDesconto, activeTenantId]);

  // Busca e Scanner
  const [busca, setBusca] = useState("");
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);
  const searchInputRef = useRef(null);

  // FLUXO DO TECLADO (ENTER + ARROW KEYS)
  // 1. Modal de Tamanho
  const [modalTamanhoAberto, setModalTamanhoAberto] = useState(false);
  const [produtoEmProcesso, setProdutoEmProcesso] = useState(null);
  const [tamanhoEmProcesso, setTamanhoEmProcesso] = useState("U");
  const [indiceTamanhoFocado, setIndiceTamanhoFocado] = useState(0);

  // 2. Modal de Quantidade
  const [modalQuantidadeAberto, setModalQuantidadeAberto] = useState(false);
  const [quantidadeInput, setQuantidadeInput] = useState("1");
  const quantidadeInputRef = useRef(null);

  // 3. Modal de Desconto
  const [modalDescontoAberto, setModalDescontoAberto] = useState(false);
  const descontoInputRef = useRef(null);

  // 4. Modal de Pagamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [parcelasCartao, setParcelasCartao] = useState(1);
  const [processandoVenda, setProcessandoVenda] = useState(false);
  const dinheiroInputRef = useRef(null);

  // 5. Modal de Sucesso
  const [modalSucessoAberto, setModalSucessoAberto] = useState(false);
  const [ultimaVendaFinalizada, setUltimaVendaFinalizada] = useState(null);
  const [indiceSucessoFocado, setIndiceSucessoFocado] = useState(1); // 0 = Reimprimir, 1 = Nova Venda

  // 6. Fechamento de Caixa
  const [modalFecharCaixaAberto, setModalFecharCaixaAberto] = useState(false);

  // 7. Modo Contingência & Fila Offline
  const [isOnlineState, setIsOnlineState] = useState(isPdvOnline());
  const [offlineCount, setOfflineCount] = useState(() => getPendingSalesCount(activeTenantId));
  const [modalOfflineAberto, setModalOfflineAberto] = useState(false);
  const [sincronizandoFila, setSincronizandoFila] = useState(false);

  // Monitora alterações de rede e da fila offline
  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnlineState(isPdvOnline());
      setOfflineCount(getPendingSalesCount(activeTenantId));
    };

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    window.addEventListener("pdv:network_status_changed", updateNetworkStatus);
    window.addEventListener(OFFLINE_EVENT_QUEUE_UPDATED, updateNetworkStatus);
    window.addEventListener(OFFLINE_EVENT_SYNC_FINISHED, updateNetworkStatus);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
      window.removeEventListener("pdv:network_status_changed", updateNetworkStatus);
      window.removeEventListener(OFFLINE_EVENT_QUEUE_UPDATED, updateNetworkStatus);
      window.removeEventListener(OFFLINE_EVENT_SYNC_FINISHED, updateNetworkStatus);
    };
  }, [activeTenantId]);

  // Sincronização rápida das vendas offline pendentes
  const handleSincronizarFilaRapido = async () => {
    if (!isOnlineState || offlineCount === 0) return;
    setSincronizandoFila(true);
    try {
      const res = await syncOfflineSalesQueue(activeTenantId);
      if (res.synced > 0) {
        alert(`${res.synced} venda(s) offline sincronizada(s) com sucesso no Firestore!`);
        carregarProdutos();
      }
    } catch (err) {
      alert("Erro ao sincronizar vendas offline: " + (err.message || "Erro desconhecido"));
    } finally {
      setSincronizandoFila(false);
      setOfflineCount(getPendingSalesCount(activeTenantId));
    }
  };

  // Carrega produtos da loja
  const carregarProdutos = useCallback(async () => {
    if (!activeTenantId) return;
    setLoadingProdutos(true);
    try {
      const data = await fetchStockProducts(activeTenantId, "loja", 150);
      setProdutosLoja(data);
    } finally {
      setLoadingProdutos(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  // Filtro de Busca rápida
  useEffect(() => {
    if (!busca.trim()) {
      setProdutosFiltrados([]);
      return;
    }
    const termo = busca.toLowerCase();
    const resultados = produtosLoja.filter(
      (p) =>
        p.nome?.toLowerCase().includes(termo) ||
        p.referencia?.toLowerCase().includes(termo) ||
        p.codigoBarras?.includes(termo)
    );
    setProdutosFiltrados(resultados.slice(0, 8));
  }, [busca, produtosLoja]);

  // Opções para o Modal de Tamanhos (Array navegável com as setas)
  const opcoesTamanho = useMemo(() => {
    const list = [];

    // No ATACADO: permite a opção de "Não indicar tamanho" (opção 0)
    if (tipoTabela === "atacado") {
      list.push({
        id: "SEM_TAMANHO",
        label: "Não indicar tamanho (Atacado / Lote)",
        isQuick: true
      });
    }

    // Se o produto tiver grade cadastrada, utiliza os tamanhos cadastrados
    const gradeCadastrada = produtoEmProcesso?.gradeTamanhos;
    if (gradeCadastrada && Object.keys(gradeCadastrada).length > 0) {
      Object.entries(gradeCadastrada).forEach(([tam, saldo]) => {
        list.push({ id: tam, label: tam, saldo });
      });
    } else {
      // Grade padrão de moda/confecção se o produto não tiver grade específica cadastrada
      const tamanhosPadrao = ["P", "M", "G", "GG", "XG", "Único"];
      tamanhosPadrao.forEach((tam) => {
        list.push({
          id: tam,
          label: tam,
          saldo: produtoEmProcesso?.estoqueLoja ?? "-"
        });
      });
    }

    return list;
  }, [produtoEmProcesso, tipoTabela]);

  // Cálculos do Carrinho
  const subtotalBruto = carrinho.reduce((acc, item) => {
    const preco = tipoTabela === "atacado" ? (item.precoAtacado || item.precoVarejo) : item.precoVarejo;
    return acc + Number(preco) * item.quantidade;
  }, 0);

  const valorDescontoCalculado =
    tipoDesconto === "porcentagem"
      ? (subtotalBruto * (Number(valorDesconto) || 0)) / 100
      : Number(valorDesconto) || 0;

  const totalComDesconto = Math.max(0, subtotalBruto - valorDescontoCalculado);

  // Taxa de Cartão se houver
  const taxaConfig = formaPagamento === "cartao_credito" ? TAXAS_CARTAO_CREDITO[parcelasCartao] : null;
  const taxaPercentual = taxaConfig ? taxaConfig.taxa : 0;
  const valorTotalFinal = totalComDesconto * (1 + taxaPercentual);

  // Troco em dinheiro
  const valorEntregueNum = Number(valorRecebido) || 0;
  const trocoCalculado = Math.max(0, valorEntregueNum - valorTotalFinal);

  // ETAPA 1: SELECIONAR PRODUTO (SEMPRE ABRE O MODAL 1 DE TAMANHO)
  const iniciarInclusaoProduto = (produto) => {
    setProdutoEmProcesso(produto);
    setBusca("");
    setProdutosFiltrados([]);
    setIndiceTamanhoFocado(0);
    setModalTamanhoAberto(true);
  };

  // ETAPA 2: ESCOLHER TAMANHO -> FECHA MODAL 1 E ABRE O MODAL 2 DE QUANTIDADE
  const selecionarTamanhoEAvancar = (tamanhoEscolhido) => {
    setTamanhoEmProcesso(tamanhoEscolhido);
    setModalTamanhoAberto(false);
    setQuantidadeInput("1");
    setModalQuantidadeAberto(true);
  };

  // Foco automático e seleção no input de quantidade
  useEffect(() => {
    if (modalQuantidadeAberto && quantidadeInputRef.current) {
      setTimeout(() => {
        quantidadeInputRef.current?.focus();
        quantidadeInputRef.current?.select();
      }, 50);
    }
  }, [modalQuantidadeAberto]);

  // ETAPA 3: CONFIRMAR QUANTIDADE -> ADICIONA AO CARRINHO E VOLTA PARA A BUSCA
  const handleConfirmarQuantidade = (e) => {
    if (e) e.preventDefault();
    if (!produtoEmProcesso) return;

    const qtd = Math.max(1, parseInt(quantidadeInput, 10) || 1);
    const tamanhoFormatado = tamanhoEmProcesso === "SEM_TAMANHO" ? "Sem Tamanho" : tamanhoEmProcesso;
    const itemKey = `${produtoEmProcesso.id}-${tamanhoEmProcesso}`;
    
    // Procura item existente pelo mesmo código de barras, referência ou id do produto para somar
    const itemExistenteIndex = carrinho.findIndex((it) => {
      if (produtoEmProcesso.codigoBarras && it.codigoBarras && it.codigoBarras === produtoEmProcesso.codigoBarras) {
        return true;
      }
      if (produtoEmProcesso.referencia && it.referencia && it.referencia === produtoEmProcesso.referencia) {
        return true;
      }
      if (it.id === produtoEmProcesso.id) {
        return true;
      }
      return it.key === itemKey;
    });

    const precoVarejo = Number(produtoEmProcesso.precoVarejo) || 0;
    const precoAtacado = Number(produtoEmProcesso.precoAtacado) || precoVarejo;

    if (itemExistenteIndex >= 0) {
      const novoCarrinho = [...carrinho];
      novoCarrinho[itemExistenteIndex].quantidade += qtd;
      setCarrinho(novoCarrinho);
    } else {
      setCarrinho([
        ...carrinho,
        {
          key: itemKey,
          id: produtoEmProcesso.id,
          nome: produtoEmProcesso.nome,
          referencia: produtoEmProcesso.referencia,
          codigoBarras: produtoEmProcesso.codigoBarras,
          tamanho: tamanhoFormatado,
          cor: Array.isArray(produtoEmProcesso.cores) ? produtoEmProcesso.cores[0] : "Padrão",
          precoVarejo,
          precoAtacado,
          quantidade: qtd
        }
      ]);
    }

    setModalQuantidadeAberto(false);
    setProdutoEmProcesso(null);
    setBusca("");
    setProdutosFiltrados([]);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // ETAPA 4: ENTER NA BARRA DE BUSCA (DISPARADOR INTELIGENTE)
  const handleKeyDownBusca = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // Se digitou algo e há produtos correspondentes: escolhe o primeiro
      if (busca.trim() !== "") {
        if (produtosFiltrados.length > 0) {
          iniciarInclusaoProduto(produtosFiltrados[0]);
        }
        return;
      }

      // Se busca está vazia e há itens no carrinho: AVANÇA PARA FINALIZAR
      if (carrinho.length > 0) {
        setModalDescontoAberto(true);
      }
    }
  };

  // Foco no input de desconto ao abrir
  useEffect(() => {
    if (modalDescontoAberto && descontoInputRef.current) {
      setTimeout(() => {
        descontoInputRef.current?.focus();
        descontoInputRef.current?.select();
      }, 50);
    }
  }, [modalDescontoAberto]);

  // ETAPA 5: CONFIRMAR DESCONTO -> AVANÇA PARA PAGAMENTO
  const handleConfirmarDescontoEAvancar = (e) => {
    if (e) e.preventDefault();
    setModalDescontoAberto(false);
    setValorRecebido(totalComDesconto.toFixed(2));
    setModalPagamentoAberto(true);
  };

  // Foco no input de dinheiro ao abrir
  useEffect(() => {
    if (modalPagamentoAberto && formaPagamento === "dinheiro" && dinheiroInputRef.current) {
      setTimeout(() => {
        dinheiroInputRef.current?.focus();
        dinheiroInputRef.current?.select();
      }, 50);
    }
  }, [modalPagamentoAberto, formaPagamento]);

  // Manipulação de Itens no Carrinho
  const alterarQuantidade = (key, delta) => {
    setCarrinho((prev) =>
      prev
        .map((it) => {
          if (it.key === key) {
            const novaQtd = it.quantidade + delta;
            return novaQtd > 0 ? { ...it, quantidade: novaQtd } : null;
          }
          return it;
        })
        .filter(Boolean)
    );
  };

  const removerDoCarrinho = (key) => {
    setCarrinho((prev) => prev.filter((it) => it.key !== key));
  };

  const limparCarrinho = () => {
    if (carrinho.length === 0 || confirm("Deseja cancelar e esvaziar a venda atual?")) {
      setCarrinho([]);
      setValorDesconto("");
      setBusca("");
      const key = `lifesurf_pdv_venda_${activeTenantId || "default"}`;
      localStorage.removeItem(key);
      if (searchInputRef.current) searchInputRef.current.focus();
    }
  };

  // NAVEGAÇÃO COMPLETA POR SETAS EM TODOS OS MODAIS
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // 1. NAVEGAÇÃO NO MODAL DE TAMANHOS (Setas ← → ↑ ↓ + Enter)
      if (modalTamanhoAberto) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setIndiceTamanhoFocado((prev) => (prev + 1) % opcoesTamanho.length);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setIndiceTamanhoFocado((prev) => (prev - 1 + opcoesTamanho.length) % opcoesTamanho.length);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (tipoTabela === "atacado") {
            if (indiceTamanhoFocado === 0) {
              setIndiceTamanhoFocado(opcoesTamanho.length > 1 ? 1 : 0);
            } else {
              setIndiceTamanhoFocado((prev) => Math.min(opcoesTamanho.length - 1, prev + 3));
            }
          } else {
            setIndiceTamanhoFocado((prev) => Math.min(opcoesTamanho.length - 1, prev + 3));
          }
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (tipoTabela === "atacado") {
            if (indiceTamanhoFocado <= 3) {
              setIndiceTamanhoFocado(0);
            } else {
              setIndiceTamanhoFocado((prev) => Math.max(0, prev - 3));
            }
          } else {
            setIndiceTamanhoFocado((prev) => Math.max(0, prev - 3));
          }
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (opcoesTamanho[indiceTamanhoFocado]) {
            selecionarTamanhoEAvancar(opcoesTamanho[indiceTamanhoFocado].id);
          }
          return;
        }
      }

      // 2. NAVEGAÇÃO NO MODAL DE QUANTIDADE (Setas ↑ ↓)
      if (modalQuantidadeAberto) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setQuantidadeInput((prev) => (Math.max(1, parseInt(prev, 10) || 1) + 1).toString());
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setQuantidadeInput((prev) => Math.max(1, (parseInt(prev, 10) || 1) - 1).toString());
          return;
        }
      }

      // 3. NAVEGAÇÃO NO MODAL DE DESCONTO (Setas ← → alternam R$ / %)
      if (modalDescontoAberto) {
        if (e.key === "ArrowLeft") {
          setTipoDesconto("reais");
        }
        if (e.key === "ArrowRight") {
          setTipoDesconto("porcentagem");
        }
      }

      // 4. NAVEGAÇÃO NO MODAL DE PAGAMENTO (Setas ← → alternam formas de pagamento)
      if (modalPagamentoAberto) {
        const idxAtual = FORMAS_PAGTO_LISTA.indexOf(formaPagamento);
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const novoIdx = (idxAtual - 1 + FORMAS_PAGTO_LISTA.length) % FORMAS_PAGTO_LISTA.length;
          setFormaPagamento(FORMAS_PAGTO_LISTA[novoIdx]);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const novoIdx = (idxAtual + 1) % FORMAS_PAGTO_LISTA.length;
          setFormaPagamento(FORMAS_PAGTO_LISTA[novoIdx]);
          return;
        }
        if (formaPagamento === "cartao_credito") {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setParcelasCartao((prev) => Math.min(4, prev + 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setParcelasCartao((prev) => Math.max(1, prev - 1));
            return;
          }
        }
      }

      // 5. NAVEGAÇÃO NO MODAL DE SUCESSO (Setas ← → + Enter)
      if (modalSucessoAberto) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setIndiceSucessoFocado((prev) => (prev === 0 ? 1 : 0));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (indiceSucessoFocado === 0) {
            // Reimprimir
            if (ultimaVendaFinalizada) {
              printThermalReceipt(ultimaVendaFinalizada, dadosLojaCupom);
            }
          } else {
            // Nova Venda
            setModalSucessoAberto(false);
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
          return;
        }
      }

      // ATALHOS GERAIS
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === "F8") {
        e.preventDefault();
        setTipoTabela((prev) => (prev === "varejo" ? "atacado" : "varejo"));
      }
      if (e.key === "Escape") {
        if (modalTamanhoAberto) setModalTamanhoAberto(false);
        if (modalQuantidadeAberto) setModalQuantidadeAberto(false);
        if (modalDescontoAberto) setModalDescontoAberto(false);
        if (modalPagamentoAberto) setModalPagamentoAberto(false);
        if (modalSucessoAberto) setModalSucessoAberto(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    modalTamanhoAberto,
    modalQuantidadeAberto,
    modalDescontoAberto,
    modalPagamentoAberto,
    modalSucessoAberto,
    opcoesTamanho,
    indiceTamanhoFocado,
    formaPagamento,
    indiceSucessoFocado,
    ultimaVendaFinalizada
  ]);

  // ETAPA 6: CONFIRMAR VENDA -> FIRESTORE + IMPRESSÃO DO CUPOM TÉRMICO
  const handleConfirmarVenda = async (e) => {
    if (e) e.preventDefault();
    if (carrinho.length === 0) return;
    if (formaPagamento === "dinheiro" && valorEntregueNum < valorTotalFinal) {
      alert("O valor recebido em dinheiro é inferior ao total da venda.");
      return;
    }

    setProcessandoVenda(true);
    try {
      const payloadVenda = {
        itens: carrinho.map((it) => ({
          id: it.id,
          nome: it.nome,
          referencia: it.referencia,
          tamanho: it.tamanho,
          quantidade: it.quantidade,
          precoUnitario: tipoTabela === "atacado" ? it.precoAtacado : it.precoVarejo,
          subtotal: (tipoTabela === "atacado" ? it.precoAtacado : it.precoVarejo) * it.quantidade
        })),
        subtotal: subtotalBruto,
        desconto: valorDescontoCalculado,
        tipoDesconto,
        total: valorTotalFinal,
        tipoVenda: tipoTabela,
        formaPagamento,
        infoPagamento: {
          valorEntregue: formaPagamento === "dinheiro" ? valorEntregueNum : valorTotalFinal,
          troco: formaPagamento === "dinheiro" ? trocoCalculado : 0,
          parcelas: formaPagamento === "cartao_credito" ? parcelasCartao : 1,
          taxaPercentual: taxaPercentual * 100
        },
        cliente: { nome: clienteNome },
        operador: userProfile?.nome || "Operador LifeSurf",
        unidadeId: activeUnitId || "matriz"
      };

      // 1. Grava no Firestore ou em Fila Local de Contingência (Anti-queda de internet)
      let vendaGravada = null;
      let gravouOffline = false;

      if (!isPdvOnline()) {
        vendaGravada = saveOfflineSale(activeTenantId, payloadVenda);
        gravouOffline = true;
      } else {
        try {
          vendaGravada = await executeSale(activeTenantId, payloadVenda);
        } catch (nuvemErr) {
          console.warn(
            "[Pdv] Falha de conexão ao gravar no Firestore. Alternando automaticamente para contingência offline:",
            nuvemErr
          );
          vendaGravada = saveOfflineSale(activeTenantId, payloadVenda);
          gravouOffline = true;
        }
      }

      // 2. Disparo Automático do Cupom Térmico (80mm) com indicador de contingência se aplicável
      printThermalReceipt(
        {
          numeroVenda: vendaGravada.numeroVenda,
          operador: payloadVenda.operador,
          cliente: payloadVenda.cliente,
          itens: payloadVenda.itens,
          subtotal: payloadVenda.subtotal,
          desconto: payloadVenda.desconto,
          total: payloadVenda.total,
          formaPagamento,
          valorEntregue: payloadVenda.infoPagamento.valorEntregue,
          troco: payloadVenda.infoPagamento.troco,
          modoContingencia: gravouOffline
        },
        dadosLojaCupom
      );

      // 3. Efeito visual com confete
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Fallback
      }

      setUltimaVendaFinalizada({
        ...vendaGravada,
        modoContingencia: gravouOffline
      });
      setModalPagamentoAberto(false);
      setIndiceSucessoFocado(1);
      setModalSucessoAberto(true);

      // Limpa carrinho e remove do localStorage
      setCarrinho([]);
      setValorDesconto("");
      setValorRecebido("");
      localStorage.removeItem(storageKey);

      // Recarrega produtos da loja (se offline, já traz o saldo decrementado do cache local)
      carregarProdutos();
      setOfflineCount(getPendingSalesCount(activeTenantId));
    } catch (err) {
      console.error("[Pdv] Falha ao processar venda:", err);
      alert("Erro ao gravar venda: " + (err.message || "Erro desconhecido"));
    } finally {
      setProcessandoVenda(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-150">
      {/* Barra de Status e Atalhos Operacionais do PDV */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Frente de Caixa (PDV)
              </h1>

              {/* Indicador de Status de Rede / Contingência */}
              <button
                type="button"
                onClick={() => setModalOfflineAberto(true)}
                className="cursor-pointer transition-transform hover:scale-105 outline-none"
                title="Clique para gerenciar a Fila de Contingência e Modo Offline"
              >
                {isOnlineState ? (
                  <Badge variant="success" size="sm" withDot={true}>
                    Online (Nuvem)
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm" withDot={true} pulseDot={true}>
                    Modo Offline (Contingência)
                  </Badge>
                )}
              </button>

              {/* Contador de Vendas Offline Pendentes */}
              {offlineCount > 0 && (
                <button
                  type="button"
                  onClick={() => setModalOfflineAberto(true)}
                  className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 flex items-center gap-1.5 cursor-pointer transition-all animate-pulse"
                  title="Vendas salvas no caixa aguardando sincronização com a nuvem"
                >
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{offlineCount} venda(s) na fila local</span>
                </button>
              )}

              {/* Status do Caixa (Aberto / Fechado) */}
              {caixaAberto ? (
                <Badge variant="success" size="sm" withDot={true}>
                  Caixa Aberto
                </Badge>
              ) : (
                <Badge variant="danger" size="sm" withDot={true} pulseDot={true}>
                  Caixa Fechado
                </Badge>
              )}

              {carrinho.length > 0 && (
                <Badge variant="info" size="sm" withDot={true}>
                  Venda Salva (Anti-perda)
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              Operador: <strong className="text-slate-200">{userProfile?.nome || "Caixa Geral"}</strong>
            </span>
          </div>
        </div>

        {/* Alternador Varejo / Atacado, Botão Fila Offline e Fechar Caixa */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sincronização rápida em nuvem quando houver vendas na fila e internet disponível */}
          {offlineCount > 0 && isOnlineState && (
            <Button
              variant="success"
              size="sm"
              onClick={handleSincronizarFilaRapido}
              isLoading={sincronizandoFila}
              className="text-xs"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Sincronizar vendas offline imediatamente com o Firestore"
            >
              Sincronizar ({offlineCount})
            </Button>
          )}

          {/* Botão de Acesso à Fila Offline / Simulação */}
          <Button
            variant={!isOnlineState ? "warning" : "secondary"}
            size="sm"
            onClick={() => setModalOfflineAberto(true)}
            className="text-xs"
            leftIcon={
              !isOnlineState ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-sky-400" />
              )
            }
          >
            Fila Offline {offlineCount > 0 ? `(${offlineCount})` : ""}
          </Button>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTipoTabela("varejo")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                tipoTabela === "varejo"
                  ? "bg-sky-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Varejo
            </button>
            <button
              type="button"
              onClick={() => setTipoTabela("atacado")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                tipoTabela === "atacado"
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Atacado (F8)
            </button>
          </div>

          {caixaAberto ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalFecharCaixaAberto(true)}
              className="text-xs"
            >
              Fechar Caixa
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalAbrirCaixaAberto(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              leftIcon={<Unlock className="w-3.5 h-3.5" />}
            >
              Abrir Caixa
            </Button>
          )}
        </div>
      </div>

      {/* Visualização de Caixa Fechado ou Grid Principal do PDV */}
      {!caixaAberto ? (
        <Card className="p-12 text-center max-w-xl mx-auto my-8 space-y-6 border-slate-700/80 shadow-2xl bg-slate-900/90">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">O Caixa Está Fechado</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              O turno anterior foi finalizado e conferido com o dinheiro já contado pelo sistema. Para registrar novas vendas, escanear produtos e receber pagamentos, abra o caixa informando o troco inicial.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setModalAbrirCaixaAberto(true)}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40"
              leftIcon={<Unlock className="w-5 h-5" />}
            >
              Abrir Caixa Agora
            </Button>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-slate-800 flex items-center justify-center gap-4">
            <span>Operador: <strong className="text-slate-200">{userProfile?.nome || "Caixa Geral"}</strong></span>
            <span>•</span>
            <span>Status: <strong className="text-amber-400 font-semibold">Aguardando Abertura</strong></span>
          </div>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* COLUNA ESQUERDA: Busca, Scanner e Produtos Rápidos */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="relative">
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="Código de Barras ou Nome do Produto... [Enter = Adicionar / Avançar]"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={handleKeyDownBusca}
                leftIcon={<Barcode className="w-5 h-5 text-sky-400" />}
                className="h-12 text-base font-medium pl-10"
              />

              {/* Dica visual quando a busca está vazia e tem itens no carrinho */}
              {busca === "" && carrinho.length > 0 && (
                <div className="absolute right-3 top-3.5 flex items-center gap-1.5 text-xs text-sky-400 font-semibold pointer-events-none animate-pulse">
                  <span>Enter p/ Finalizar</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Resultados da busca rápida dropdown */}
              {produtosFiltrados.length > 0 && (
                <div className="absolute left-0 right-0 top-14 z-20 glass-dropdown rounded-xl border border-slate-700 p-2 shadow-2xl space-y-1">
                  {produtosFiltrados.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => iniciarInclusaoProduto(prod)}
                      className="p-2.5 rounded-lg hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm">{prod.nome}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>Ref: {prod.referencia || "S/Ref"}</span>
                          {prod.codigoBarras && <span className="font-mono text-sky-400">{prod.codigoBarras}</span>}
                          <span>Estoque: {prod.estoqueTotal || 0} un</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-emerald-400 text-sm">
                          {formatCurrency(tipoTabela === "atacado" ? (prod.precoAtacado || prod.precoVarejo) : prod.precoVarejo)}
                        </span>
                        <div className="text-[10px] text-sky-400 font-medium">Pressione Enter</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guia Rápido do Fluxo por Teclado */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
              <span className="flex items-center gap-1 text-sky-300">
                <kbd className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] border border-sky-500/30">Setas ← → ↑ ↓ + Enter</kbd>
                Navegação total por teclado nos modais
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">F8</kbd> Varejo/Atacado
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">ESC</kbd> Cancelar
              </span>
            </div>
          </Card>

          {/* Vitrine Rápida de Produtos */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Produtos Disponíveis no Balcão</span>
              <span>{produtosLoja.length} itens cadastrados</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {produtosLoja.slice(0, 12).map((prod) => (
                <Card
                  key={prod.id}
                  variant="interactive"
                  className="p-3 flex flex-col justify-between hover:border-sky-500/50 transition-all select-none"
                  onClick={() => iniciarInclusaoProduto(prod)}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white line-clamp-2">
                      {prod.nome}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Ref: {prod.referencia || "LS"}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">
                      {formatCurrency(tipoTabela === "atacado" ? (prod.precoAtacado || prod.precoVarejo) : prod.precoVarejo)}
                    </span>
                    <Badge variant={prod.estoqueTotal > 0 ? "neutral" : "danger"} size="sm">
                      {prod.estoqueTotal || 0} un
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Carrinho de Compras e Resumo Financeiro */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="flex flex-col h-full justify-between p-4 space-y-4">
            {/* Cabeçalho do Carrinho */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white">Carrinho da Venda</h2>
                <Badge variant="info" size="sm">
                  {carrinho.reduce((acc, it) => acc + it.quantidade, 0)} itens
                </Badge>
              </div>

              {carrinho.length > 0 && (
                <button
                  type="button"
                  onClick={limparCarrinho}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
            </div>

            {/* Lista Rolável de Itens no Carrinho */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {carrinho.map((item) => {
                const precoAtual = tipoTabela === "atacado" ? (item.precoAtacado || item.precoVarejo) : item.precoVarejo;
                const totalItem = precoAtual * item.quantidade;

                return (
                  <div
                    key={item.key}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {item.nome}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-bold text-sky-400">
                          {item.tamanho === "U" ? "Sem tamanho" : `Tam: ${item.tamanho}`}
                        </span>
                        <span>•</span>
                        <span>{formatCurrency(precoAtual)} cada</span>
                      </div>
                    </div>

                    {/* Controles de Quantidade */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.key, -1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-white">
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.key, 1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[70px]">
                      <div className="text-xs font-bold text-white">
                        {formatCurrency(totalItem)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removerDoCarrinho(item.key)}
                        className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}

              {carrinho.length === 0 && (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">O carrinho está vazio.</p>
                  <p className="text-[11px] text-slate-600">Digite ou escaneie o produto e aperte Enter.</p>
                </div>
              )}
            </div>

            {/* Resumo Financeiro da Venda */}
            <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(subtotalBruto)}</span>
              </div>

              {valorDescontoCalculado > 0 && (
                <div className="flex items-center justify-between text-rose-400">
                  <span>Desconto Aplicado:</span>
                  <span className="font-bold">- {formatCurrency(valorDescontoCalculado)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalDescontoAberto(true)}
                  className="text-xs text-sky-400 h-7 px-2"
                  leftIcon={<Tag className="w-3 h-3" />}
                >
                  {valorDesconto ? "Editar Desconto" : "+ Aplicar Desconto"}
                </Button>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono">
                    Total a Pagar
                  </span>
                  <span className="text-2xl font-black text-emerald-400 tracking-tight">
                    {formatCurrency(totalComDesconto)}
                  </span>
                </div>
              </div>

              {/* Botão de Finalização */}
              <Button
                variant="primary"
                className="w-full h-12 text-base font-bold shadow-lg shadow-sky-500/20 mt-2"
                disabled={carrinho.length === 0}
                onClick={() => setModalDescontoAberto(true)}
                rightIcon={<ArrowRight className="w-5 h-5" />}
              >
                FINALIZAR VENDA (Enter na busca vazia)
              </Button>
            </div>
          </Card>
        </div>
      </div>
      )}

      {/* MODAL 1: SELETOR DE TAMANHO NAVEGÁVEL COM SETAS DO TECLADO */}
      <Modal
        isOpen={modalTamanhoAberto}
        onClose={() => {
          setModalTamanhoAberto(false);
          searchInputRef.current?.focus();
        }}
        size="md"
      >
        <ModalHeader
          title={
            tipoTabela === "atacado"
              ? "Selecione o Tamanho [Modo Atacado]"
              : "Selecione o Tamanho Obrigatório [Modo Varejo]"
          }
          description={produtoEmProcesso?.nome}
          onClose={() => {
            setModalTamanhoAberto(false);
            searchInputRef.current?.focus();
          }}
        />
        <ModalBody className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">
              Navegue pelas setas <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">→</kbd> e pressione <kbd className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono text-[11px] border border-sky-500/30">Enter</kbd>
            </span>
            <Badge variant={tipoTabela === "atacado" ? "info" : "warning"} size="sm">
              {tipoTabela === "atacado" ? "Atacado: Tamanho Opcional" : "Varejo: Tamanho Obrigatório"}
            </Badge>
          </div>

          {/* Opção EXCLUSIVA DO ATACADO: Não indicar tamanho (destacável com as setas) */}
          {tipoTabela === "atacado" && opcoesTamanho[0]?.isQuick && (
            <div
              onClick={() => selecionarTamanhoEAvancar(opcoesTamanho[0].id)}
              className={cn(
                "p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer",
                indiceTamanhoFocado === 0
                  ? "bg-sky-500/25 border-sky-400 ring-2 ring-sky-400 text-white shadow-lg shadow-sky-500/20 scale-[1.01]"
                  : "bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-sky-300">Não indicar tamanho</span>
                  <Badge variant="info" size="sm">Atacado / Venda Geral</Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Pule a grade e informe apenas a quantidade de peças.</p>
              </div>
              <CornerDownLeft className={cn("w-4 h-4", indiceTamanhoFocado === 0 ? "text-sky-300" : "text-slate-500")} />
            </div>
          )}

          {/* Grade de tamanhos */}
          <div className="pt-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              {tipoTabela === "varejo"
                ? "Grade de Tamanhos (Escolha Obrigatória):"
                : "Ou selecione o tamanho na grade:"}
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {(tipoTabela === "atacado" ? opcoesTamanho.slice(1) : opcoesTamanho).map((opt, idx) => {
                const opcaoIndexReal = tipoTabela === "atacado" ? idx + 1 : idx;
                const focado = indiceTamanhoFocado === opcaoIndexReal;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selecionarTamanhoEAvancar(opt.id)}
                    className={cn(
                      "p-3.5 rounded-xl border text-center transition-all cursor-pointer group outline-none",
                      focado
                        ? "bg-sky-500/30 border-sky-400 ring-2 ring-sky-400 text-white shadow-lg shadow-sky-500/30 scale-[1.04]"
                        : "bg-slate-950 border-slate-800 hover:border-sky-500/50 text-slate-300"
                    )}
                  >
                    <span className="text-lg font-black text-white block font-mono">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {opt.saldo !== undefined && opt.saldo !== "-" ? `${opt.saldo} un` : "Disponível"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* MODAL 2: QUANTIDADE DO ITEM (SETAS ↑ / ↓ + ENTER) */}
      <Modal
        isOpen={modalQuantidadeAberto}
        onClose={() => {
          setModalQuantidadeAberto(false);
          searchInputRef.current?.focus();
        }}
        size="sm"
      >
        <form onSubmit={handleConfirmarQuantidade}>
          <ModalHeader
            title="Quantidade de Peças"
            description={`${produtoEmProcesso?.nome} • ${
              tamanhoEmProcesso === "SEM_TAMANHO"
                ? "Sem tamanho (Atacado)"
                : `Tamanho: ${tamanhoEmProcesso}`
            }`}
            onClose={() => {
              setModalQuantidadeAberto(false);
              searchInputRef.current?.focus();
            }}
          />
          <ModalBody className="space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs text-slate-400">Use as setas</span>
              <kbd className="inline-block mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">↑</kbd>
              <kbd className="inline-block mr-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">↓</kbd>
              <span className="text-xs text-slate-400">ou digite e aperte</span>
              <kbd className="inline-block ml-1.5 px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono text-xs border border-sky-500/30">
                Enter
              </kbd>
            </div>

            <div className="relative">
              <input
                ref={quantidadeInputRef}
                autoFocus
                type="number"
                min="1"
                step="1"
                required
                value={quantidadeInput}
                onChange={(e) => setQuantidadeInput(e.target.value)}
                className="w-full h-16 text-center text-3xl font-black bg-slate-950 text-white rounded-xl border-2 border-sky-500/80 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span>Valor Unitário:</span>
              <strong className="text-emerald-400">
                {formatCurrency(tipoTabela === "atacado" ? (produtoEmProcesso?.precoAtacado || produtoEmProcesso?.precoVarejo || 0) : (produtoEmProcesso?.precoVarejo || 0))}
              </strong>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setModalQuantidadeAberto(false);
                searchInputRef.current?.focus();
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Confirmar (Enter)
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 3: DESCONTO NA VENDA (SETAS ← → + ENTER) */}
      <Modal
        isOpen={modalDescontoAberto}
        onClose={() => {
          setModalDescontoAberto(false);
          searchInputRef.current?.focus();
        }}
        size="sm"
      >
        <form onSubmit={handleConfirmarDescontoEAvancar}>
          <ModalHeader
            title="Desconto na Venda"
            description={`Subtotal: ${formatCurrency(subtotalBruto)} • Aperte Enter para avançar`}
            onClose={() => {
              setModalDescontoAberto(false);
              searchInputRef.current?.focus();
            }}
          />
          <ModalBody className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={tipoDesconto === "reais" ? "primary" : "secondary"}
                className={cn("flex-1", tipoDesconto === "reais" && "ring-2 ring-sky-400")}
                size="sm"
                type="button"
                onClick={() => setTipoDesconto("reais")}
              >
                Em Reais (← R$)
              </Button>
              <Button
                variant={tipoDesconto === "porcentagem" ? "primary" : "secondary"}
                className={cn("flex-1", tipoDesconto === "porcentagem" && "ring-2 ring-sky-400")}
                size="sm"
                type="button"
                onClick={() => setTipoDesconto("porcentagem")}
              >
                Em Porcentagem (→ %)
              </Button>
            </div>

            <Input
              ref={descontoInputRef}
              autoFocus
              type="number"
              step="0.01"
              label={tipoDesconto === "reais" ? "Valor do Desconto (R$)" : "Percentual do Desconto (%)"}
              placeholder="0.00"
              value={valorDesconto}
              onChange={(e) => setValorDesconto(e.target.value)}
              helperText="Setas ← / → alternam tipo. Aperte Enter para avançar."
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setValorDesconto("");
                handleConfirmarDescontoEAvancar();
              }}
            >
              Sem Desconto
            </Button>
            <Button variant="primary" type="submit">
              Avançar para Pagamento (Enter)
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 4: FORMA DE PAGAMENTO (SETAS ← → + ENTER) */}
      <Modal
        isOpen={modalPagamentoAberto}
        onClose={() => {
          setModalPagamentoAberto(false);
          searchInputRef.current?.focus();
        }}
        size="md"
      >
        <form onSubmit={handleConfirmarVenda}>
          <ModalHeader
            title="Forma de Pagamento [Setas ← → + Enter]"
            description={`Total a Pagar: ${formatCurrency(valorTotalFinal)}`}
            onClose={() => {
              setModalPagamentoAberto(false);
              searchInputRef.current?.focus();
            }}
          />
          <ModalBody className="space-y-4">
            {/* Opções de Forma de Pagamento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "dinheiro", label: "Dinheiro", icon: DollarSign },
                { id: "pix", label: "Pix", icon: QrCode },
                { id: "cartao_debito", label: "Débito", icon: CreditCard },
                { id: "cartao_credito", label: "Crédito", icon: CreditCard }
              ].map((fp) => {
                const Icon = fp.icon;
                const ativo = formaPagamento === fp.id;
                return (
                  <button
                    key={fp.id}
                    type="button"
                    onClick={() => setFormaPagamento(fp.id)}
                    className={cn(
                      "p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer outline-none",
                      ativo
                        ? "bg-sky-500/25 border-sky-400 ring-2 ring-sky-400 text-white font-bold shadow-md shadow-sky-500/10 scale-[1.02]"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850"
                    )}
                  >
                    <Icon className="w-5 h-5 text-sky-400" />
                    <span className="text-xs">{fp.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dinheiro: Valor Entregue e Troco em Tempo Real */}
            {formaPagamento === "dinheiro" && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <Input
                  ref={dinheiroInputRef}
                  label="Valor Entregue pelo Cliente (R$)"
                  type="number"
                  step="0.01"
                  autoFocus
                  placeholder="Ex: 100.00"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                />

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-300 font-medium">Troco a Devolver:</span>
                  <span
                    className={`text-xl font-black ${
                      valorEntregueNum >= valorTotalFinal ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatCurrency(trocoCalculado)}
                  </span>
                </div>
              </div>
            )}

            {/* Cartão de Crédito com Parcelamento Navegável por Setas */}
            {formaPagamento === "cartao_credito" && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Opções de Parcelamento [Setas ↑ / ↓]:
                </label>
                <div className="space-y-1.5">
                  {[1, 2, 3, 4].map((num) => {
                    const conf = TAXAS_CARTAO_CREDITO[num];
                    const valorParc = (totalComDesconto * (1 + conf.taxa)) / num;
                    const focado = parcelasCartao === num;
                    return (
                      <div
                        key={num}
                        onClick={() => setParcelasCartao(num)}
                        className={cn(
                          "p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all",
                          focado
                            ? "bg-sky-500/20 border-sky-400 ring-2 ring-sky-400 text-white font-bold"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                        )}
                      >
                        <span>{num}x de {formatCurrency(valorParc)}</span>
                        <span className="text-slate-400 text-[11px]">{conf.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pix */}
            {formaPagamento === "pix" && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <QrCode className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-xs text-slate-200 font-medium">Chave Pix ou Maquininha Integrada</p>
                <p className="text-[11px] text-slate-400">
                  Confirme o recebimento e pressione Enter para finalizar.
                </p>
              </div>
            )}

            {/* Nome do Cliente (Opcional) */}
            <Input
              label="Identificação do Cliente (Opcional)"
              placeholder="Ex: Consumidor Final ou Nome do Cliente"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setModalPagamentoAberto(false);
                searchInputRef.current?.focus();
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              type="submit"
              isLoading={processandoVenda}
              disabled={formaPagamento === "dinheiro" && valorEntregueNum < valorTotalFinal}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Finalizar e Emitir Cupom (Enter)
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 5: SUCESSO E REIMPRESSÃO (SETAS ← → + ENTER) */}
      <Modal
        isOpen={modalSucessoAberto}
        onClose={() => {
          setModalSucessoAberto(false);
          searchInputRef.current?.focus();
        }}
        size="sm"
      >
        <ModalBody className="text-center py-6 space-y-4">
          <div
            className={`w-16 h-16 rounded-full border flex items-center justify-center mx-auto animate-bounce ${
              ultimaVendaFinalizada?.modoContingencia
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-xl font-black text-white tracking-tight">
              {ultimaVendaFinalizada?.modoContingencia
                ? "Venda Salva em Contingência!"
                : "Venda Concluída!"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {ultimaVendaFinalizada?.modoContingencia
                ? `Protocolo #${ultimaVendaFinalizada?.numeroVenda} emitido offline. O estoque local foi baixado e a venda será enviada à nuvem ao reconectar.`
                : `Cupom #${ultimaVendaFinalizada?.numeroVenda || "8472"} processado e estoque baixado no Firestore.`}
            </p>
          </div>

          {ultimaVendaFinalizada?.modoContingencia && (
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-300 text-xs flex items-center justify-center gap-1.5 font-semibold">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Modo Offline: Salvo com segurança no navegador</span>
            </div>
          )}

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
            Total Pago: <strong className="text-emerald-400 font-bold">{formatCurrency(ultimaVendaFinalizada?.total || 0)}</strong>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              className={cn(indiceSucessoFocado === 0 && "ring-2 ring-sky-400 border-sky-400")}
              onClick={() => {
                if (ultimaVendaFinalizada) {
                  printThermalReceipt(
                    {
                      ...ultimaVendaFinalizada,
                      modoContingencia: !!ultimaVendaFinalizada?.modoContingencia
                    },
                    dadosLojaCupom
                  );
                }
              }}
              leftIcon={<Printer className="w-4 h-4 text-sky-400" />}
            >
              Reimprimir Cupom Térmico (←)
            </Button>

            <Button
              variant="primary"
              autoFocus
              type="button"
              className={cn(indiceSucessoFocado === 1 && "ring-2 ring-sky-400 border-sky-400")}
              onClick={() => {
                setModalSucessoAberto(false);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
            >
              Iniciar Nova Venda (Enter ➔)
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* MODAL 6: FECHAMENTO DE CAIXA */}
      <CloseCashierModal
        isOpen={modalFecharCaixaAberto}
        onClose={() => {
          setModalFecharCaixaAberto(false);
          searchInputRef.current?.focus();
        }}
        onClosedSuccess={() => {
          try {
            localStorage.setItem(`lifesurf_caixa_aberto_${activeTenantId || "default"}`, "fechado");
            localStorage.removeItem(`lifesurf_pdv_venda_${activeTenantId || "default"}`);
          } catch {}
          setCaixaAberto(false);
          setCarrinho([]);
        }}
      />

      {/* MODAL 7: FILA DE CONTINGÊNCIA & MODO OFFLINE */}
      <ModalFilaOffline
        isOpen={modalOfflineAberto}
        onClose={() => {
          setModalOfflineAberto(false);
          searchInputRef.current?.focus();
        }}
        tenantId={activeTenantId}
        storeInfo={dadosLojaCupom}
        onSyncSuccess={() => {
          carregarProdutos();
          setOfflineCount(getPendingSalesCount(activeTenantId));
        }}
      />

      {/* MODAL 8: ABERTURA DE CAIXA */}
      <Modal
        isOpen={modalAbrirCaixaAberto}
        onClose={() => setModalAbrirCaixaAberto(false)}
        size="sm"
      >
        <form onSubmit={handleAbrirCaixa}>
          <ModalHeader
            title="Abertura de Caixa"
            description="Informe o fundo de troco inicial para liberar o PDV e iniciar as vendas."
            onClose={() => setModalAbrirCaixaAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Fundo de Troco Inicial (Gaveta R$)
              </label>
              <div className="relative">
                <Input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={trocoAberturaInput}
                  onChange={(e) => setTrocoAberturaInput(e.target.value)}
                  leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                  placeholder="0.00"
                  className="text-lg font-bold"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Este valor servirá como base para o cálculo de gaveta no encerramento do caixa.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setModalAbrirCaixaAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              leftIcon={<Unlock className="w-4 h-4" />}
            >
              Confirmar Abertura (Enter)
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
