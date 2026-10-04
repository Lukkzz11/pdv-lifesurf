import { useState, useEffect, useMemo, useRef } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  ORDER_STATUS,
  KANBAN_COLUMNS,
  createOrder,
  updateOrderStatus,
  subscribeToOrders,
  fetchRecentOrders
} from "../services/orderService";
import {
  generateOrderPickingListPDF,
  printThermalPickingList,
  uploadPickingListToGoogleDriveManual
} from "../services/pickingListService";
import {
  openWhatsAppChat,
  WHATSAPP_TEMPLATES,
  playOrderAlertSound,
  sendLocalPushNotification
} from "../services/notificationService";
import {
  isGoogleConnected,
  sendOrderCreatedEmail,
  sendOrderStatusUpdateEmail
} from "../services/googleApiService";
import { fetchStockProducts } from "../services/stockService";
import toast from "react-hot-toast";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from "../components/ui/Table";
import { formatCurrency, formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import {
  ClipboardList,
  Plus,
  Search,
  FileText,
  Printer,
  MessageCircle,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Layers,
  LayoutGrid,
  List,
  Sparkles,
  User,
  Phone,
  Tag,
  Package,
  Barcode,
  Check,
  AlertTriangle,
  RotateCcw,
  Mail,
  Cloud,
  ExternalLink
} from "lucide-react";

export default function Pedidos() {
  const { activeTenantId, companyDetails } = useTenant();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visualizacao, setVisualizacao] = useState("kanban"); // "kanban" | "tabela"

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");

  // Drag and Drop
  const [cardArrastadoId, setCardArrastadoId] = useState(null);
  const [colunaHover, setColunaHover] = useState(null);

  // Modal Novo Pedido
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [origem, setOrigem] = useState("whatsapp");
  const [observacoes, setObservacoes] = useState("");
  const [itensNovoPedido, setItensNovoPedido] = useState([]);
  const [salvandoNovoPedido, setSalvandoNovoPedido] = useState(false);

  // Catálogo de Produtos do Estoque da Loja para busca rápida
  const [produtosLoja, setProdutosLoja] = useState([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(false);
  const [termoBuscaProduto, setTermoBuscaProduto] = useState("");
  const [resultadoBuscaProdutos, setResultadoBuscaProdutos] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [itemSelecionadoIndex, setItemSelecionadoIndex] = useState(-1);
  const inputBuscaRef = useRef(null);

  // Modal Detalhes do Pedido
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  // Modal de Aviso de Separação Concluída (com download do PDF)
  const [modalSeparacaoAberto, setModalSeparacaoAberto] = useState(false);
  const [pedidoSeparadoRecente, setPedidoSeparadoRecente] = useState(null);
  const [salvandoDriveSeparacao, setSalvandoDriveSeparacao] = useState(false);
  const [driveLinkSeparacao, setDriveLinkSeparacao] = useState(null);
  const pedidosIniciaisCarregadosRef = useRef(false);
  const qtdPedidosAnteriorRef = useRef(0);

  // 1. INSCRIÇÃO EM TEMPO REAL NO FIRESTORE (Zero Polling / Atualização instantânea)
  useEffect(() => {
    if (!activeTenantId) return;
    setLoading(true);

    const unsubscribe = subscribeToOrders(
      activeTenantId,
      (data) => {
        // Alerta sonoro quando um novo pedido chega via Catálogo/Balcão
        if (pedidosIniciaisCarregadosRef.current && data.length > qtdPedidosAnteriorRef.current) {
          playOrderAlertSound();
          const novo = data[0];
          sendLocalPushNotification(
            "Novo Pedido LifeSurf! 🌊👕",
            `Pedido #${novo?.numeroPedido || "Novo"} recebido de ${novo?.cliente?.nome || "Cliente"}!`
          );
        }

        pedidosIniciaisCarregadosRef.current = true;
        qtdPedidosAnteriorRef.current = data.length;
        setPedidos(data);
        setLoading(false);
      },
      (err) => {
        console.warn("[Pedidos] Falha no listener em tempo real, usando fetch avulso:", err);
        fetchRecentOrders(activeTenantId, 50).then((data) => {
          setPedidos(data);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [activeTenantId]);

  // 1.1 CARREGAMENTO DO ESTOQUE DA LOJA PARA BUSCA RÁPIDA
  useEffect(() => {
    if (!activeTenantId) return;
    let isMounted = true;
    setCarregandoEstoque(true);
    fetchStockProducts(activeTenantId, "loja", 300)
      .then((prods) => {
        if (isMounted) {
          setProdutosLoja(prods || []);
          setCarregandoEstoque(false);
        }
      })
      .catch((err) => {
        console.warn("[Pedidos] Erro ao carregar estoque da loja:", err);
        if (isMounted) setCarregandoEstoque(false);
      });
    return () => {
      isMounted = false;
    };
  }, [activeTenantId]);

  // 1.2 FILTRO EM TEMPO REAL DE PRODUTOS DO ESTOQUE (CÓDIGO, NOME, CÓDIGO DE BARRAS)
  useEffect(() => {
    if (!termoBuscaProduto.trim()) {
      setResultadoBuscaProdutos([]);
      setItemSelecionadoIndex(-1);
      return;
    }
    const termoLimpo = termoBuscaProduto.trim().toLowerCase();
    const filtrados = produtosLoja.filter((p) => {
      const nome = (p.nome || "").toLowerCase();
      const ref = (p.referencia || "").toLowerCase();
      const barras = (p.codigoBarras || "").toLowerCase();
      const id = (p.id || "").toLowerCase();
      return (
        nome.includes(termoLimpo) ||
        ref.includes(termoLimpo) ||
        barras.includes(termoLimpo) ||
        id.includes(termoLimpo)
      );
    });
    setResultadoBuscaProdutos(filtrados.slice(0, 10));
    setItemSelecionadoIndex(filtrados.length > 0 ? 0 : -1);
  }, [termoBuscaProduto, produtosLoja]);

  // Função centralizada para abrir conversa no WhatsApp com templates
  const abrirWhatsAppCliente = (telefone, numeroPedido, template = WHATSAPP_TEMPLATES.PEDIDO_CONFIRMADO, dados = {}) => {
    if (!telefone) {
      alert("Este cliente não possui telefone de WhatsApp cadastrado.");
      return;
    }
    openWhatsAppChat({
      phone: telefone,
      numeroPedido: numeroPedido || "",
      clienteNome: dados.clienteNome || "Cliente",
      total: dados.total || "",
      template
    });
  };

  // 2. FILTRAGEM DE PEDIDOS
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((ped) => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !termo ||
        ped.numeroPedido?.toLowerCase().includes(termo) ||
        ped.cliente?.nome?.toLowerCase().includes(termo) ||
        ped.cliente?.telefone?.includes(termo);

      const matchOrigem = filtroOrigem === "todos" || ped.origem === filtroOrigem;

      return matchBusca && matchOrigem;
    });
  }, [pedidos, busca, filtroOrigem]);

  // Agrupamento por coluna Kanban
  const pedidosPorColuna = useMemo(() => {
    const mapa = {};
    KANBAN_COLUMNS.forEach((col) => {
      mapa[col.id] = [];
    });

    pedidosFiltrados.forEach((ped) => {
      const status = ped.status || ORDER_STATUS.NOVO;
      if (mapa[status]) {
        mapa[status].push(ped);
      } else {
        mapa[ORDER_STATUS.NOVO].push(ped);
      }
    });

    return mapa;
  }, [pedidosFiltrados]);

  // 3. AÇÃO DE MUDANÇA DE STATUS COM GATILHO DA LISTA DE SEPARAÇÃO EM PDF
  const moverStatusPedido = async (pedido, novoStatus) => {
    if (!pedido || pedido.status === novoStatus) return;

    // Atualização otimista na tela para resposta imediata
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedido.id ? { ...p, status: novoStatus } : p))
    );

    try {
      await updateOrderStatus(activeTenantId, pedido.id, novoStatus);

      // Disparo automático via Gmail API (Free Tier) caso o cliente tenha e-mail
      if (pedido.cliente?.email && isGoogleConnected()) {
        sendOrderStatusUpdateEmail(pedido, novoStatus, companyDetails)
          .then(() => {
            toast.success(`E-mail de atualização (${novoStatus}) enviado via Gmail API!`);
          })
          .catch((err) => {
            console.warn("[Pedidos] Falha ao enviar e-mail transacional:", err);
          });
      }

      // REGRA: Ao marcar o pedido como "SEPARADO", dispara a rotina do PDF de Separação
      if (novoStatus === ORDER_STATUS.SEPARADO) {
        setPedidoSeparadoRecente({ ...pedido, status: novoStatus });
        setDriveLinkSeparacao(null);
        setModalSeparacaoAberto(true);

        // Gera e faz download imediato do PDF oficial da Lista de Separação (e upload no Drive se conectado)
        generateOrderPickingListPDF(
          { ...pedido, status: novoStatus },
          companyDetails || {
            nome: "LIFESURF CONFECÇÕES & SURFWEAR",
            cidade: "Fortaleza - CE"
          }
        );
      }
    } catch (err) {
      console.error("[Pedidos] Falha ao atualizar status do pedido:", err);
      toast.error("Erro ao sincronizar status do pedido com o Firestore.");
    }
  };

  // Funções de avanço e recuo no Kanban
  const avancarStatus = (pedido) => {
    const statusOrdem = KANBAN_COLUMNS.map((c) => c.id);
    const idxAtual = statusOrdem.indexOf(pedido.status);
    if (idxAtual >= 0 && idxAtual < statusOrdem.length - 2) { // Não avança para cancelado por padrão
      moverStatusPedido(pedido, statusOrdem[idxAtual + 1]);
    }
  };

  const recuarStatus = (pedido) => {
    const statusOrdem = KANBAN_COLUMNS.map((c) => c.id);
    const idxAtual = statusOrdem.indexOf(pedido.status);
    if (idxAtual > 0) {
      moverStatusPedido(pedido, statusOrdem[idxAtual - 1]);
    }
  };

  // 4. DRAG AND DROP NATIVO (HTML5)
  const handleDragStart = (e, orderId) => {
    setCardArrastadoId(orderId);
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, colunaId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (colunaHover !== colunaId) {
      setColunaHover(colunaId);
    }
  };

  const handleDragLeave = (colunaId) => {
    if (colunaHover === colunaId) {
      setColunaHover(null);
    }
  };

  const handleDrop = (e, colunaId) => {
    e.preventDefault();
    setColunaHover(null);
    const orderId = e.dataTransfer.getData("text/plain") || cardArrastadoId;
    if (!orderId) return;

    const pedido = pedidos.find((p) => p.id === orderId);
    if (pedido && pedido.status !== colunaId) {
      moverStatusPedido(pedido, colunaId);
    }
    setCardArrastadoId(null);
  };

  // 5. MANIPULAÇÃO DE ITENS NO FORMULÁRIO DE NOVO PEDIDO (INTEGRADO AO ESTOQUE DA LOJA)
  const adicionarItemNovoPedido = () => {
    setItensNovoPedido((prev) => [
      ...prev,
      { nome: "", tamanho: "M", cor: "Preto", quantidade: 1, precoUnitario: "", produtoId: null }
    ]);
  };

  const removerItemNovoPedido = (index) => {
    setItensNovoPedido((prev) => prev.filter((_, i) => i !== index));
  };

  const atualizarItemNovoPedido = (index, campo, valor) => {
    setItensNovoPedido((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item))
    );
  };

  // Adiciona produto vindo da pesquisa direta do estoque da loja
  const handleAdicionarProdutoEstoque = (produto, tamanhoEscolhido = null) => {
    if (!produto) return;

    let tamanho = tamanhoEscolhido;
    if (!tamanho) {
      if (produto.gradeTamanhos && Object.keys(produto.gradeTamanhos).length > 0) {
        const comEstoque = Object.entries(produto.gradeTamanhos).find(([_, q]) => Number(q) > 0);
        tamanho = comEstoque ? comEstoque[0] : Object.keys(produto.gradeTamanhos)[0];
      } else {
        tamanho = "M";
      }
    }

    const cor = (produto.cores && produto.cores.length > 0)
      ? (Array.isArray(produto.cores) ? produto.cores[0] : produto.cores)
      : "Padrão";

    // Prioriza o valor de atacado conforme solicitado
    const preco = Number(produto.precoAtacado ?? produto.precoVarejo ?? produto.preco ?? produto.precoVenda ?? 0);

    setItensNovoPedido((prev) => {
      // Remove item vazio temporário inicial se houver
      const itensReais = prev.filter((it) => (it.nome && it.nome.trim() !== "") || it.produtoId);

      const indexExistente = itensReais.findIndex(
        (it) => it.produtoId === produto.id && it.tamanho === tamanho
      );

      if (indexExistente >= 0) {
        return itensReais.map((it, i) =>
          i === indexExistente ? { ...it, quantidade: Number(it.quantidade) + 1 } : it
        );
      }

      return [
        ...itensReais,
        {
          produtoId: produto.id,
          referencia: produto.referencia || "",
          codigoBarras: produto.codigoBarras || "",
          nome: produto.nome || "Produto da Loja",
          tamanho,
          cor,
          quantidade: 1,
          precoUnitario: preco,
          gradeTamanhos: produto.gradeTamanhos || null,
          coresDisponiveis: Array.isArray(produto.cores) ? produto.cores : []
        }
      ];
    });

    toast.success(`"${produto.nome}" (${tamanho}) adicionado com valor de atacado ${formatCurrency(preco)}!`, {
      icon: "🛍️",
      duration: 2500
    });
    setTermoBuscaProduto("");
    setMostrarSugestoes(false);
    if (inputBuscaRef.current) {
      inputBuscaRef.current.focus();
    }
  };

  const handleKeyDownBusca = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const termoLimpo = termoBuscaProduto.trim();
      if (!termoLimpo) return;

      // 1. Tenta correspondência exata por código de barras ou referência
      const matchExato = produtosLoja.find(
        (p) =>
          p.codigoBarras === termoLimpo ||
          (p.referencia && p.referencia.toLowerCase() === termoLimpo.toLowerCase())
      );

      if (matchExato) {
        handleAdicionarProdutoEstoque(matchExato);
        return;
      }

      // 2. Se houver resultados filtrados
      if (resultadoBuscaProdutos.length > 0) {
        const idx = itemSelecionadoIndex >= 0 ? itemSelecionadoIndex : 0;
        handleAdicionarProdutoEstoque(resultadoBuscaProdutos[idx]);
      } else {
        toast.error(`Nenhum produto em estoque para "${termoLimpo}"`);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setItemSelecionadoIndex((prev) =>
        prev < resultadoBuscaProdutos.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setItemSelecionadoIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Escape") {
      setMostrarSugestoes(false);
    }
  };

  const totalCalculadoNovoPedido = itensNovoPedido.reduce((acc, it) => {
    if (!it.nome.trim() && !it.produtoId) return acc;
    const qtd = Number(it.quantidade) || 1;
    const preco = Number(it.precoUnitario) || 0;
    return acc + qtd * preco;
  }, 0);

  const handleCriarPedidoCompleto = async (e) => {
    e.preventDefault();
    if (!clienteNome.trim()) {
      alert("Por favor, informe o nome do cliente.");
      return;
    }

    const itensValidos = itensNovoPedido.filter(
      (it) => (it.nome && it.nome.trim() !== "") || it.produtoId
    );

    if (itensValidos.length === 0) {
      toast.error("Adicione pelo menos um produto do estoque ou peça ao pedido.");
      return;
    }

    setSalvandoNovoPedido(true);
    try {
      const itensFormatados = itensValidos.map((it) => ({
        produtoId: it.produtoId || null,
        referencia: it.referencia || "",
        codigoBarras: it.codigoBarras || "",
        nome: it.nome.trim() || "Produto LifeSurf",
        tamanho: it.tamanho || "M",
        cor: it.cor || "Padrão",
        quantidade: Math.max(1, Number(it.quantidade) || 1),
        precoUnitario: Number(it.precoUnitario) || 0,
        subtotal: (Math.max(1, Number(it.quantidade) || 1)) * (Number(it.precoUnitario) || 0)
      }));

      const totalCalculado = itensFormatados.reduce((acc, it) => acc + it.subtotal, 0);

      const novoPedidoPayload = {
        cliente: {
          nome: clienteNome.trim(),
          telefone: clienteTelefone.trim(),
          email: clienteEmail.trim()
        },
        origem,
        observacoes,
        total: totalCalculado,
        subtotal: totalCalculado,
        itens: itensFormatados,
        status: ORDER_STATUS.NOVO
      };

      const pedidoCriado = await createOrder(activeTenantId, novoPedidoPayload);

      // Disparo automático via Gmail API (Free Tier) se o cliente possuir e-mail
      if (clienteEmail.trim() && isGoogleConnected()) {
        sendOrderCreatedEmail(
          { ...pedidoCriado, ...novoPedidoPayload },
          companyDetails
        )
          .then(() => {
            toast.success(`E-mail de confirmação enviado para ${clienteEmail.trim()} via Gmail API!`);
          })
          .catch((err) => {
            console.warn("[Pedidos] Falha ao disparar e-mail de novo pedido:", err);
          });
      }

      toast.success("Pedido cadastrado com sucesso!");
      setModalNovoAberto(false);
      setClienteNome("");
      setClienteTelefone("");
      setClienteEmail("");
      setObservacoes("");
      setItensNovoPedido([]);
      setTermoBuscaProduto("");
      setResultadoBuscaProdutos([]);
      setMostrarSugestoes(false);
    } catch (err) {
      console.error("[Pedidos] Falha ao cadastrar pedido:", err);
      toast.error("Erro ao salvar novo pedido no Firestore.");
    } finally {
      setSalvandoNovoPedido(false);
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho da Página com Contadores e Ações */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info" size="sm" withDot={true}>
              Pipeline em Tempo Real
            </Badge>
            <span className="text-xs text-slate-400">
              {pedidosFiltrados.length} pedidos no fluxo operacional
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gestão de Pedidos & Kanban
          </h1>
          <p className="text-xs text-slate-400">
            Arraste os cards para avançar no fluxo de separação, conferência em PDF e entrega.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador de Visão (Kanban vs Tabela) */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setVisualizacao("kanban")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                visualizacao === "kanban"
                  ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setVisualizacao("tabela")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                visualizacao === "tabela"
                  ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <List className="w-3.5 h-3.5" />
              Tabela
            </button>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setItensNovoPedido([]);
              setTermoBuscaProduto("");
              setMostrarSugestoes(false);
              setClienteNome("");
              setClienteTelefone("");
              setClienteEmail("");
              setObservacoes("");
              setModalNovoAberto(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone ou número do pedido (ex: PED-2610)..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-slate-950/80 text-white text-xs rounded-xl border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <Select
          value={filtroOrigem}
          onChange={(e) => setFiltroOrigem(e.target.value)}
          options={[
            { value: "todos", label: "Todas as Origens" },
            { value: "whatsapp", label: "WhatsApp & Redes" },
            { value: "balcao", label: "Balcão Loja" },
            { value: "catalogo", label: "Catálogo Online" },
            { value: "encomenda", label: "Encomenda Fábrica" }
          ]}
        />
      </div>

      {/* 6. CORPO PRINCIPAL: VISÃO PIPELINE KANBAN (DRAG AND DROP) */}
      {visualizacao === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 select-none min-h-[650px] scrollbar-thin scrollbar-thumb-slate-800">
          {KANBAN_COLUMNS.map((coluna) => {
            const pedidosColuna = pedidosPorColuna[coluna.id] || [];
            const isHover = colunaHover === coluna.id;

            return (
              <div
                key={coluna.id}
                onDragOver={(e) => handleDragOver(e, coluna.id)}
                onDragLeave={() => handleDragLeave(coluna.id)}
                onDrop={(e) => handleDrop(e, coluna.id)}
                className={cn(
                  "flex-shrink-0 w-80 rounded-2xl flex flex-col transition-all duration-200 border bg-slate-900/40 backdrop-blur-sm",
                  isHover
                    ? "border-sky-400/80 bg-sky-950/20 ring-2 ring-sky-500/30 scale-[1.01]"
                    : "border-slate-800/80 hover:border-slate-700/80"
                )}
              >
                {/* Cabeçalho da Coluna */}
                <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", coluna.dotColor)} />
                    <span className="text-xs font-bold text-white tracking-wide">
                      {coluna.label}
                    </span>
                  </div>

                  <Badge variant={coluna.badgeVariant} size="sm">
                    {pedidosColuna.length}
                  </Badge>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-[750px] scrollbar-thin">
                  {pedidosColuna.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800/80 rounded-xl text-slate-500 text-xs">
                      <span>Sem pedidos aqui</span>
                      <span className="text-[10px] text-slate-600 mt-0.5">
                        Arraste um card para cá
                      </span>
                    </div>
                  ) : (
                    pedidosColuna.map((pedido) => {
                      const isDragging = cardArrastadoId === pedido.id;
                      const qtdPecas = pedido.itens?.reduce(
                        (acc, it) => acc + (Number(it.quantidade) || 1),
                        0
                      ) || 1;

                      return (
                        <div
                          key={pedido.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, pedido.id)}
                          onDragEnd={() => setCardArrastadoId(null)}
                          className={cn(
                            "p-3.5 rounded-xl border bg-slate-950 text-slate-200 transition-all cursor-grab active:cursor-grabbing hover:border-slate-700 hover:shadow-lg group relative",
                            isDragging
                              ? "opacity-40 border-dashed border-sky-400 scale-95"
                              : "border-slate-800/90 shadow-sm"
                          )}
                        >
                          {/* Topo do Card: Número do pedido & Origem */}
                          <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-800/60">
                            <span className="text-[11px] font-black text-sky-400 font-mono tracking-wider">
                              {pedido.numeroPedido || pedido.id.slice(0, 8)}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {pedido.origem === "whatsapp" && (
                                <Badge variant="success" size="sm">
                                  WhatsApp
                                </Badge>
                              )}
                              {pedido.origem === "balcao" && (
                                <Badge variant="info" size="sm">
                                  Balcão
                                </Badge>
                              )}
                              {pedido.origem === "catalogo" && (
                                <Badge variant="neutral" size="sm">
                                  Catálogo
                                </Badge>
                              )}
                              {pedido.origem === "encomenda" && (
                                <Badge variant="warning" size="sm">
                                  Fábrica
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Dados do Cliente */}
                          <div className="pt-2.5 pb-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                                {pedido.cliente?.nome || "Consumidor Final"}
                              </h4>

                              {pedido.cliente?.telefone && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirWhatsAppCliente(
                                      pedido.cliente.telefone,
                                      pedido.numeroPedido
                                    );
                                  }}
                                  title="Conversar no WhatsApp"
                                  className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/10 rounded transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {pedido.cliente?.telefone && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {pedido.cliente.telefone}
                              </span>
                            )}
                          </div>

                          {/* Resumo de Peças e Grade */}
                          <div className="py-2 border-t border-slate-800/60 text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Volume de Peças:</span>
                              <strong className="text-white font-mono">{qtdPecas} un</strong>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {pedido.itens?.slice(0, 3).map((it, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate max-w-[190px]"
                                >
                                  {it.quantidade}x {it.nome} ({it.tamanho || "U"})
                                </span>
                              ))}
                              {pedido.itens?.length > 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                                  +{pedido.itens.length - 3} mais
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Valor Total e Botões Operacionais */}
                          <div className="pt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-1">
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase block font-mono">
                                Total
                              </span>
                              <strong className="text-sm font-extrabold text-emerald-400">
                                {formatCurrency(pedido.total || 0)}
                              </strong>
                            </div>

                            {/* Ações Rápidas no Card */}
                            <div className="flex items-center gap-1">
                              {/* Botão Lista de Separação em PDF */}
                              <button
                                type="button"
                                title="Gerar Lista de Separação (PDF)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateOrderPickingListPDF(pedido, {
                                    nome: "LIFESURF CONFECÇÕES",
                                    cidade: "Fortaleza - CE"
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 border border-slate-800 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Botão de Bobina Térmica 80mm */}
                              <button
                                type="button"
                                title="Imprimir Cupom Térmico (80mm)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  printThermalPickingList(pedido, {
                                    nome: "LIFESURF CONFECÇÕES"
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 border border-slate-800 transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Botão Avançar Status */}
                              {coluna.id !== ORDER_STATUS.ENTREGUE &&
                                coluna.id !== ORDER_STATUS.CANCELADO && (
                                  <button
                                    type="button"
                                    title="Avançar para a próxima etapa"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      avancarStatus(pedido);
                                    }}
                                    className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                            </div>
                          </div>

                          {/* Botão de Ver Detalhes (Clique do Card) */}
                          <div
                            onClick={() => setPedidoSelecionado(pedido)}
                            className="absolute inset-0 cursor-pointer -z-0"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 7. VISÃO TABELA CONVENCIONAL */
        <Card>
          <Table>
            <TableHeader>
              <TableRow isInteractive={false}>
                <TableHead>Nº Pedido</TableHead>
                <TableHead>Cliente & Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status Operacional</TableHead>
                <TableHead>Itens / Grade</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosFiltrados.length === 0 ? (
                <TableEmpty message="Nenhum pedido encontrado com os filtros aplicados." />
              ) : (
                pedidosFiltrados.map((pedido) => {
                  const config = KANBAN_COLUMNS.find((c) => c.id === pedido.status) || KANBAN_COLUMNS[0];
                  const qtdPecas = pedido.itens?.reduce(
                    (acc, it) => acc + (Number(it.quantidade) || 1),
                    0
                  ) || 1;

                  return (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-mono font-bold text-sky-400">
                        {pedido.numeroPedido || pedido.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-white">{pedido.cliente?.nome}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {pedido.cliente?.telefone || "Sem telefone"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm" className="capitalize">
                          {pedido.origem}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.badgeVariant} size="sm" withDot={true}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        {qtdPecas} peças ({pedido.itens?.length || 1} itens)
                      </TableCell>
                      <TableCell className="font-bold text-emerald-400 font-mono">
                        {formatCurrency(pedido.total || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Lista de Separação (PDF)"
                            onClick={() =>
                              generateOrderPickingListPDF(pedido, {
                                nome: "LIFESURF CONFECÇÕES",
                                cidade: "Fortaleza - CE"
                              })
                            }
                            leftIcon={<FileText className="w-3.5 h-3.5 text-sky-400" />}
                          >
                            PDF
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPedidoSelecionado(pedido)}
                          >
                            Detalhes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 8. MODAL DE SEPARAÇÃO CONCLUÍDA (FEEDBACK & IMPRESSÃO) */}
      <Modal
        isOpen={modalSeparacaoAberto}
        onClose={() => setModalSeparacaoAberto(false)}
        size="md"
      >
        <ModalHeader
          title="Pedido Separado na Expedição!"
          description="A Lista de Separação (Picking List) em PDF foi gerada para conferência física."
          onClose={() => setModalSeparacaoAberto(false)}
        />
        <ModalBody className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <strong className="text-white block text-sm">
                Pedido {pedidoSeparadoRecente?.numeroPedido} marcado como SEPARADO!
              </strong>
              <p>
                O arquivo PDF com a lista detalhada de peças, tamanhos e cores foi baixado
                automaticamente para a conferência no estoque.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Cliente:</span>
              <strong className="text-white">{pedidoSeparadoRecente?.cliente?.nome}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total de Peças:</span>
              <span className="font-mono text-white">
                {pedidoSeparadoRecente?.itens?.reduce(
                  (acc, it) => acc + (Number(it.quantidade) || 1),
                  0
                )}{" "}
                peças
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Valor do Pedido:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {formatCurrency(pedidoSeparadoRecente?.total || 0)}
              </span>
            </div>

            {driveLinkSeparacao && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300 mt-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  Salvo no Google Drive da Empresa
                </span>
                <a
                  href={driveLinkSeparacao}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-bold hover:text-emerald-200 flex items-center gap-1"
                >
                  Abrir no Drive <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={async () => {
              if (pedidoSeparadoRecente) {
                setSalvandoDriveSeparacao(true);
                try {
                  const res = await uploadPickingListToGoogleDriveManual(
                    pedidoSeparadoRecente,
                    companyDetails
                  );
                  setDriveLinkSeparacao(res.webViewLink);
                  toast.success("Lista salva na pasta segura do Google Drive!");
                } catch (err) {
                  toast.error("Erro ao salvar no Drive: " + err.message);
                } finally {
                  setSalvandoDriveSeparacao(false);
                }
              }
            }}
            isLoading={salvandoDriveSeparacao}
            leftIcon={<Cloud className="w-4 h-4 text-emerald-400" />}
            className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
          >
            {driveLinkSeparacao ? "Salvo no Drive ✓" : "Salvar no Google Drive"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (pedidoSeparadoRecente) {
                printThermalPickingList(pedidoSeparadoRecente, {
                  nome: "LIFESURF CONFECÇÕES"
                });
              }
            }}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Bobina (80mm)
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (pedidoSeparadoRecente) {
                generateOrderPickingListPDF(pedidoSeparadoRecente, companyDetails || {
                  nome: "LIFESURF CONFECÇÕES"
                });
              }
            }}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Baixar PDF Novamente
          </Button>
          <Button variant="ghost" onClick={() => setModalSeparacaoAberto(false)}>
            Concluir
          </Button>
        </ModalFooter>
      </Modal>

      {/* 9. MODAL DETALHES COMPLETOS DO PEDIDO */}
      {pedidoSelecionado && (
        <Modal
          isOpen={Boolean(pedidoSelecionado)}
          onClose={() => setPedidoSelecionado(null)}
          size="lg"
        >
          <ModalHeader
            title={`Pedido ${pedidoSelecionado.numeroPedido || pedidoSelecionado.id}`}
            description={`Origem: ${pedidoSelecionado.origem?.toUpperCase()} • Status: ${pedidoSelecionado.status?.toUpperCase()}`}
            onClose={() => setPedidoSelecionado(null)}
          />
          <ModalBody className="space-y-4">
            {/* Seletor de Mudança Rápida de Status */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                Mover Status no Pipeline:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {KANBAN_COLUMNS.map((col) => {
                  const isCurrent = pedidoSelecionado.status === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        moverStatusPedido(pedidoSelecionado, col.id);
                        setPedidoSelecionado({ ...pedidoSelecionado, status: col.id });
                      }}
                      className={cn(
                        "p-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer",
                        isCurrent
                          ? "bg-sky-500/20 border-sky-400 text-sky-300 ring-1 ring-sky-400"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                      )}
                    >
                      <span>{col.label}</span>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Informações do Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Cliente:</span>
                <strong className="text-white text-sm">
                  {pedidoSelecionado.cliente?.nome || "Consumidor Final"}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Contato / WhatsApp:</span>
                <span className="text-slate-200 font-mono">
                  {pedidoSelecionado.cliente?.telefone || "Não informado"}
                </span>
              </div>
              {pedidoSelecionado.observacoes && (
                <div className="sm:col-span-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block">Observações:</span>
                  <p className="text-slate-300 mt-0.5">{pedidoSelecionado.observacoes}</p>
                </div>
              )}
            </div>

            {/* Tabela de Itens */}
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
                Itens a Separar e Entregar:
              </span>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5 text-center">Tamanho</th>
                      <th className="p-2.5 text-center">Cor</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5 text-right">Preço Unit.</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {pedidoSelecionado.itens?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2.5 font-medium text-white">{it.nome}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-sky-400">
                          {it.tamanho || "U"}
                        </td>
                        <td className="p-2.5 text-center text-slate-400">{it.cor || "Padrão"}</td>
                        <td className="p-2.5 text-center font-mono font-bold">{it.quantidade}</td>
                        <td className="p-2.5 text-right font-mono">
                          {formatCurrency(it.precoUnitario || 0)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-white">
                          {formatCurrency((it.quantidade || 1) * (it.precoUnitario || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ações Rápidas de WhatsApp */}
            {pedidoSelecionado.cliente?.telefone && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <MessageCircle className="w-4 h-4" />
                  <span>Notificar Cliente no WhatsApp:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      abrirWhatsAppCliente(
                        pedidoSelecionado.cliente.telefone,
                        pedidoSelecionado.numeroPedido,
                        WHATSAPP_TEMPLATES.PEDIDO_CONFIRMADO,
                        {
                          clienteNome: pedidoSelecionado.cliente.nome,
                          total: formatCurrency(pedidoSelecionado.total || 0)
                        }
                      )
                    }
                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-[11px] font-semibold transition-colors flex items-center justify-center text-center cursor-pointer"
                  >
                    Confirmado
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      abrirWhatsAppCliente(
                        pedidoSelecionado.cliente.telefone,
                        pedidoSelecionado.numeroPedido,
                        WHATSAPP_TEMPLATES.PEDIDO_SEPARADO,
                        {
                          clienteNome: pedidoSelecionado.cliente.nome
                        }
                      )
                    }
                    className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 text-[11px] font-semibold transition-colors flex items-center justify-center text-center cursor-pointer"
                  >
                    Pronto / Retirada
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      abrirWhatsAppCliente(
                        pedidoSelecionado.cliente.telefone,
                        pedidoSelecionado.numeroPedido,
                        WHATSAPP_TEMPLATES.PEDIDO_EM_ROTA,
                        {
                          clienteNome: pedidoSelecionado.cliente.nome
                        }
                      )
                    }
                    className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-[11px] font-semibold transition-colors flex items-center justify-center text-center cursor-pointer"
                  >
                    Saiu p/ Entrega
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      abrirWhatsAppCliente(
                        pedidoSelecionado.cliente.telefone,
                        pedidoSelecionado.numeroPedido,
                        WHATSAPP_TEMPLATES.COBRANCA_PIX,
                        {
                          clienteNome: pedidoSelecionado.cliente.nome,
                          total: formatCurrency(pedidoSelecionado.total || 0),
                          chavePix: "pix@lifesurf.com.br"
                        }
                      )
                    }
                    className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-semibold transition-colors flex items-center justify-center text-center cursor-pointer"
                  >
                    Cobrança PIX
                  </button>
                </div>
              </div>
            )}

            {/* Ações de E-mail Transacional via Gmail API (Free Tier) */}
            {pedidoSelecionado.cliente?.email && (
              <div className="p-3 bg-sky-950/20 border border-sky-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    Notificar por E-mail (Gmail API):
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]">
                    {pedidoSelecionado.cliente.email}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await sendOrderCreatedEmail(pedidoSelecionado, companyDetails);
                        toast.success("E-mail de confirmação enviado via Gmail API!");
                      } catch (e) {
                        toast.error(e.message || "Erro ao enviar via Gmail API.");
                      }
                    }}
                    className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer text-center"
                  >
                    Reenviar Confirmação
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await sendOrderStatusUpdateEmail(pedidoSelecionado, pedidoSelecionado.status, companyDetails);
                        toast.success(`E-mail de status (${pedidoSelecionado.status}) enviado via Gmail API!`);
                      } catch (e) {
                        toast.error(e.message || "Erro ao enviar via Gmail API.");
                      }
                    }}
                    className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer text-center"
                  >
                    Enviar Status Atual ({pedidoSelecionado.status})
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Total Consolidado:</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {formatCurrency(pedidoSelecionado.total || 0)}
              </span>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                generateOrderPickingListPDF(pedidoSelecionado, {
                  nome: "LIFESURF CONFECÇÕES",
                  cidade: "Fortaleza - CE"
                })
              }
              leftIcon={<FileText className="w-4 h-4 text-sky-400" />}
            >
              Lista de Separação (PDF)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                printThermalPickingList(pedidoSelecionado, {
                  nome: "LIFESURF CONFECÇÕES"
                })
              }
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Bobina Térmica (80mm)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPedidoSelecionado(null)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* 10. MODAL NOVO PEDIDO (ENTRADA RÁPIDA DE ITENS E GRADE) */}
      <Modal isOpen={modalNovoAberto} onClose={() => setModalNovoAberto(false)} size="lg">
        <form onSubmit={handleCriarPedidoCompleto}>
          <ModalHeader
            title="Novo Pedido / Encomenda"
            description="Cadastre pedidos recebidos pelo WhatsApp, balcão ou catálogo para inclusão no Kanban."
            onClose={() => setModalNovoAberto(false)}
          />
          <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="Nome do Cliente *"
                  required
                  placeholder="Ex: Carlos Eduardo"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="WhatsApp / Telefone"
                  placeholder="(85) 99999-8888"
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                />
              </div>

              <div>
                <Input
                  type="email"
                  label="E-mail (Notificações Gmail)"
                  placeholder="cliente@email.com"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Canal de Origem"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                options={[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "balcao", label: "Balcão Loja" },
                  { value: "catalogo", label: "Catálogo Online" },
                  { value: "encomenda", label: "Fábrica / Encomenda" }
                ]}
              />

              <Input
                label="Observações / Entrega"
                placeholder="Ex: Entregar sexta às 16h embalado p/ presente"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            {/* Grade de Itens do Pedido */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-sky-500" />
                    Itens do Pedido & Estoque da Loja
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {produtosLoja.length > 0
                      ? `${produtosLoja.length} produtos carregados do estoque da loja`
                      : "Carregando catálogo de produtos..."}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={adicionarItemNovoPedido}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  className="text-xs h-7 px-2.5"
                >
                  + Peça Avulsa / Manual
                </Button>
              </div>

              {/* BARRA DE PESQUISA DIRETO DO ESTOQUE DA LOJA */}
              <div className="relative">
                <div className="relative flex items-center">
                  <div className="absolute left-3 pointer-events-none text-slate-400">
                    <Barcode className="w-4 h-4 text-sky-500" />
                  </div>
                  <input
                    ref={inputBuscaRef}
                    type="text"
                    value={termoBuscaProduto}
                    onChange={(e) => {
                      setTermoBuscaProduto(e.target.value);
                      setMostrarSugestoes(true);
                    }}
                    onFocus={() => {
                      if (termoBuscaProduto.trim()) setMostrarSugestoes(true);
                    }}
                    onKeyDown={handleKeyDownBusca}
                    placeholder="Pesquisar por Código, Nome ou Código de Barras (ex: CAM-01, 789... ou Silk Waves)..."
                    className="w-full h-10 pl-9 pr-24 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 text-xs focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-sm transition-all"
                  />
                  {termoBuscaProduto && (
                    <button
                      type="button"
                      onClick={() => {
                        setTermoBuscaProduto("");
                        setMostrarSugestoes(false);
                      }}
                      className="absolute right-12 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  <div className="absolute right-2.5 hidden sm:flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    <span>Enter</span>
                  </div>
                </div>

                {/* SUGESTÕES DE AUTOCOMPLETE DO ESTOQUE */}
                {mostrarSugestoes && termoBuscaProduto.trim() && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800 mb-1">
                      <span>Produtos Encontrados no Estoque ({resultadoBuscaProdutos.length})</span>
                      <span className="text-sky-500 dark:text-sky-400">Clique para adicionar</span>
                    </div>

                    {resultadoBuscaProdutos.length > 0 ? (
                      resultadoBuscaProdutos.map((prod, pIdx) => {
                        const isSelected = pIdx === itemSelecionadoIndex;
                        const precoAtacado = Number(prod.precoAtacado ?? prod.precoVarejo ?? prod.preco ?? 0);
                        const precoVarejo = Number(prod.precoVarejo ?? 0);
                        const estoqueTotal = prod.estoqueLoja ?? prod.estoqueTotal ?? 0;
                        const temGrade = prod.gradeTamanhos && Object.keys(prod.gradeTamanhos).length > 0;

                        return (
                          <div
                            key={prod.id || pIdx}
                            onClick={() => handleAdicionarProdutoEstoque(prod)}
                            onMouseEnter={() => setItemSelecionadoIndex(pIdx)}
                            className={cn(
                              "p-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs",
                              isSelected
                                ? "bg-sky-50 dark:bg-sky-500/15 border border-sky-300 dark:border-sky-500/30"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 dark:text-white truncate flex items-center gap-1.5">
                                  <span>{prod.nome}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {prod.referencia && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                      Ref: {prod.referencia}
                                    </span>
                                  )}
                                  {prod.codigoBarras && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                      {prod.codigoBarras}
                                    </span>
                                  )}
                                  {temGrade && (
                                    <span className="text-[10px] text-slate-400">
                                      Grade: {Object.keys(prod.gradeTamanhos).join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="font-extrabold text-amber-500 dark:text-amber-400 font-mono text-xs">
                                  {formatCurrency(precoAtacado)} <span className="text-[9px] font-semibold text-slate-400">Atacado</span>
                                </div>
                                {precoVarejo > 0 && precoVarejo !== precoAtacado && (
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    Varejo: {formatCurrency(precoVarejo)}
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[10px] font-mono block",
                                  estoqueTotal > 0 ? "text-slate-500 dark:text-slate-400" : "text-amber-500"
                                )}>
                                  {estoqueTotal} un estoque
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="primary"
                                className="h-7 px-2.5 text-xs pointer-events-none bg-emerald-600 text-white font-bold"
                              >
                                + Add
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Nenhum produto em estoque encontrado para <span className="font-semibold text-slate-800 dark:text-white">"{termoBuscaProduto}"</span>
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setItensNovoPedido((prev) => [
                              ...prev.filter((it) => it.nome.trim() !== "" || it.produtoId),
                              {
                                nome: termoBuscaProduto.trim(),
                                tamanho: "M",
                                cor: "Preto",
                                quantidade: 1,
                                precoUnitario: "",
                                produtoId: null
                              }
                            ]);
                            setTermoBuscaProduto("");
                            setMostrarSugestoes(false);
                          }}
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Adicionar como item avulso "{termoBuscaProduto.trim()}"
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* LISTA DE ITENS DO PEDIDO */}
              <div className="space-y-2.5">
                {itensNovoPedido.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-1.5 bg-slate-50/50 dark:bg-slate-900/20">
                    <Package className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nenhum produto adicionado ao pedido ainda
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Digite o código, nome ou código de barras no campo acima para puxar direto do estoque da loja.
                    </p>
                  </div>
                ) : (
                  itensNovoPedido.map((item, idx) => {
                    const gradeDisponivel = item.gradeTamanhos;
                    const tamanhosOpcoes = gradeDisponivel && Object.keys(gradeDisponivel).length > 0
                      ? Object.keys(gradeDisponivel)
                      : ["PP", "P", "M", "G", "GG", "XG", "38", "40", "42", "44", "U"];

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end shadow-sm"
                      >
                        <div className="sm:col-span-5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              Peça #{idx + 1}
                            </label>
                            {item.produtoId ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30">
                                Estoque Loja {item.referencia ? `(${item.referencia})` : ""}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                Avulso / Manual
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Camiseta Silk Surf Waves"
                            value={item.nome}
                            onChange={(e) => atualizarItemNovoPedido(idx, "nome", e.target.value)}
                            className="w-full h-8 px-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg border border-slate-300 dark:border-slate-800 text-xs focus:border-sky-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tam.</label>
                          <select
                            value={item.tamanho}
                            onChange={(e) => atualizarItemNovoPedido(idx, "tamanho", e.target.value)}
                            className="w-full h-8 px-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg border border-slate-300 dark:border-slate-800 text-xs focus:border-sky-500 focus:outline-none"
                          >
                            {tamanhosOpcoes.map((tam) => {
                              const saldoGrade = gradeDisponivel ? gradeDisponivel[tam] : null;
                              return (
                                <option key={tam} value={tam}>
                                  {tam} {saldoGrade !== null && saldoGrade !== undefined ? `(${saldoGrade} un)` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Qtd.</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantidade}
                            onChange={(e) =>
                              atualizarItemNovoPedido(idx, "quantidade", Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full h-8 px-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg border border-slate-300 dark:border-slate-800 text-xs text-center font-bold focus:border-sky-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Preço Unit. (R$) - Editável
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="89.90"
                            required
                            value={item.precoUnitario}
                            onChange={(e) =>
                              atualizarItemNovoPedido(idx, "precoUnitario", e.target.value)
                            }
                            className="w-full h-8 px-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg border border-slate-300 dark:border-slate-800 text-xs text-right font-mono focus:border-sky-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-center pb-0.5">
                          <button
                            type="button"
                            onClick={() => removerItemNovoPedido(idx)}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                            title="Remover produto"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Calculado:</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(totalCalculadoNovoPedido)}
              </span>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setModalNovoAberto(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvandoNovoPedido}>
              Criar Pedido no Pipeline
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
