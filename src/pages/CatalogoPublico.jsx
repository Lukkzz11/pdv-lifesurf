import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { useAuth } from "../security/AuthContext";
import {
  fetchPublicCatalog,
  fetchCompanyPublicInfo,
  submitPublicOrder
} from "../services/catalogService";
import { getProductImageUrl, DEFAULT_PRODUCT_FALLBACK } from "../services/imageUploadService";
import { Button } from "../components/ui/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import { formatCurrency } from "../utils/formatters";
import { cn } from "../utils/cn";
import {
  Search,
  CheckCircle2,
  Tag,
  Phone,
  MapPin,
  User,
  MessageCircle,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Truck,
  CreditCard,
  QrCode,
  DollarSign,
  Share2,
  Copy,
  Check,
  Building,
  Store,
  Edit2,
  Sparkles,
  ChevronRight
} from "lucide-react";

/**
 * Mapeia nomes de cores para classes visuais sutis e elegantes
 */
function getColorSwatchClass(corNome = "") {
  const norm = corNome.toLowerCase();
  if (norm.includes("preto")) return "bg-neutral-900 border-neutral-700";
  if (norm.includes("branco") || norm.includes("off-white")) return "bg-white border-neutral-300";
  if (norm.includes("marinho")) return "bg-blue-950 border-blue-900";
  if (norm.includes("royal") || norm.includes("azul")) return "bg-sky-600 border-sky-500";
  if (norm.includes("verde") || norm.includes("militar")) return "bg-emerald-800 border-emerald-700";
  if (norm.includes("areia") || norm.includes("bege")) return "bg-amber-100 border-amber-300";
  if (norm.includes("cinza") || norm.includes("chumbo")) return "bg-neutral-500 border-neutral-400";
  if (norm.includes("bordô") || norm.includes("vermelho")) return "bg-rose-900 border-rose-800";
  if (norm.includes("amarelo")) return "bg-amber-300 border-amber-400";
  if (norm.includes("turquesa")) return "bg-teal-500 border-teal-400";
  return "bg-neutral-300 border-neutral-400";
}

export default function CatalogoPublico() {
  const { isAuthenticated } = useAuth();
  const { companyId } = useParams();
  const tenantId = companyId || "lifesurf";

  const [companyInfo, setCompanyInfo] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modo de Compra: Varejo vs Atacado (Lojista)
  const [tipoTabela, setTipoTabela] = useState("varejo"); // "varejo" | "atacado"

  // Filtros de Vitrine
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");

  // Modal de Seleção de Variação (Tamanho & Cor)
  const [produtoModal, setProdutoModal] = useState(null);
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");
  const [corSelecionada, setCorSelecionada] = useState("");
  const [quantidadeItem, setQuantidadeItem] = useState(1);

  // Carrinho de Compras
  const [carrinho, setCarrinho] = useState([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  // Checkout de Fricção Zero
  const [nomeCliente, setNomeCliente] = useState("");
  const [whatsappCliente, setWhatsappCliente] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState("entrega"); // "entrega" | "retirada"
  const [enderecoCliente, setEnderecoCliente] = useState("");
  const [cidadeCliente, setCidadeCliente] = useState("");
  const [bairroCliente, setBairroCliente] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [observacoes, setObservacoes] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  // Feedback de Cópia
  const [pixCopiado, setPixCopiado] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Comprovante de Sucesso
  const [pedidoConcluido, setPedidoConcluido] = useState(null);
  const [modalSucessoAberto, setModalSucessoAberto] = useState(false);

  // 1. CARREGAMENTO DOS DADOS PÚBLICOS
  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      try {
        const [info, prods] = await Promise.all([
          fetchCompanyPublicInfo(tenantId),
          fetchPublicCatalog(tenantId)
        ]);
        setCompanyInfo(info);
        setProdutos(prods);
      } catch (err) {
        console.error("[CatalogoPublico] Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    carregarDados();

    // Sincronização em tempo real quando o catálogo for editado no painel administrativo
    const handleCatalogUpdate = () => {
      fetchPublicCatalog(tenantId).then((prods) => {
        if (Array.isArray(prods) && prods.length > 0) {
          setProdutos(prods);
        }
      });
    };

    window.addEventListener("lifesurf:catalog_updated", handleCatalogUpdate);
    window.addEventListener("storage", handleCatalogUpdate);

    return () => {
      window.removeEventListener("lifesurf:catalog_updated", handleCatalogUpdate);
      window.removeEventListener("storage", handleCatalogUpdate);
    };
  }, [tenantId]);


  // 2. EXTRAÇÃO E FILTRO DE CATEGORIAS
  const categorias = useMemo(() => {
    const cats = new Set(["Todos"]);
    produtos.forEach((p) => {
      if (p.categoria && p.categoria.trim()) {
        cats.add(p.categoria.trim());
      }
    });
    return Array.from(cats);
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchCat = categoriaAtiva === "Todos" || p.categoria === categoriaAtiva;
      const matchBusca =
        !busca.trim() ||
        p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.referencia?.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [produtos, categoriaAtiva, busca]);

  // 3. ABERTURA DO MODAL DE VARIAÇÃO
  const abrirSeletorVariacao = (produto) => {
    setProdutoModal(produto);

    // Pré-seleciona primeiro tamanho disponível
    const tamanhos = produto.gradeTamanhos ? Object.keys(produto.gradeTamanhos) : ["P", "M", "G", "GG"];
    setTamanhoSelecionado(tamanhos[0] || "M");

    // Pré-seleciona primeira cor disponível
    let cores = ["Padrão"];
    if (Array.isArray(produto.cores) && produto.cores.length > 0) {
      cores = produto.cores;
    } else if (typeof produto.cores === "string" && produto.cores.trim()) {
      cores = produto.cores.split(",").map((c) => c.trim());
    }
    setCorSelecionada(cores[0] || "Padrão");
    setQuantidadeItem(1);
  };

  // 4. ADICIONAR ITEM À SACOLA
  const handleAdicionarAoCarrinho = () => {
    if (!produtoModal) return;

    const precoVarejo = Number(produtoModal.precoVarejo) || 0;
    const precoAtacado = Number(produtoModal.precoAtacado) || precoVarejo;
    const precoUnitario = tipoTabela === "atacado" ? precoAtacado : precoVarejo;

    const itemKey = `${produtoModal.id}-${tamanhoSelecionado}-${corSelecionada}-${tipoTabela}`;

    setCarrinho((prev) => {
      const index = prev.findIndex((it) => it.key === itemKey);
      if (index >= 0) {
        const novo = [...prev];
        novo[index].quantidade += quantidadeItem;
        return novo;
      }
      return [
        ...prev,
        {
          key: itemKey,
          id: produtoModal.id,
          nome: produtoModal.nome,
          referencia: produtoModal.referencia || "",
          fotoUrl: getProductImageUrl(produtoModal) || null,
          tamanho: tamanhoSelecionado,
          cor: corSelecionada,
          tipoVenda: tipoTabela,
          precoUnitario,
          precoVarejoReferencia: precoVarejo,
          quantidade: quantidadeItem
        }
      ];
    });

    setProdutoModal(null);
    setCarrinhoAberto(true);
  };

  // 5. MANIPULAÇÃO DO CARRINHO
  const alterarQtdCarrinho = (key, delta) => {
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

  const subtotalSacola = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + it.precoUnitario * it.quantidade, 0);
  }, [carrinho]);

  const totalItensSacola = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + it.quantidade, 0);
  }, [carrinho]);

  const economiaTotal = useMemo(() => {
    return carrinho.reduce((acc, it) => {
      if (it.tipoVenda === "atacado" && it.precoVarejoReferencia > it.precoUnitario) {
        return acc + (it.precoVarejoReferencia - it.precoUnitario) * it.quantidade;
      }
      return acc;
    }, 0);
  }, [carrinho]);

  // 6. FINALIZAR PEDIDO (CHECKOUT SEM SENHA)
  const handleFinalizarPedido = async (e) => {
    if (e) e.preventDefault();

    if (carrinho.length === 0) {
      alert("Sua sacola está vazia!");
      return;
    }
    if (!nomeCliente.trim()) {
      alert("Por favor, digite seu nome completo.");
      return;
    }
    if (!whatsappCliente.trim()) {
      alert("Por favor, digite seu WhatsApp com DDD para contato.");
      return;
    }
    if (tipoEntrega === "entrega" && !enderecoCliente.trim()) {
      alert("Por favor, digite seu endereço de entrega (Rua, Número, Bairro).");
      return;
    }

    setEnviandoPedido(true);
    try {
      const enderecoFormatado =
        tipoEntrega === "retirada"
          ? "Retirar no Balcão da Fábrica / Loja"
          : `${enderecoCliente.trim()}${bairroCliente ? `, Bairro: ${bairroCliente.trim()}` : ""}${cidadeCliente ? ` - ${cidadeCliente.trim()}` : ""}`;

      const payload = {
        nome: nomeCliente.trim(),
        whatsapp: whatsappCliente.trim(),
        endereco: enderecoFormatado,
        tipoEntrega,
        formaPagamento,
        tipoVenda: tipoTabela,
        observacoes: observacoes.trim(),
        subtotal: subtotalSacola,
        total: subtotalSacola,
        economia: economiaTotal,
        itens: carrinho.map((it) => ({
          id: it.id,
          nome: it.nome,
          referencia: it.referencia,
          tamanho: it.tamanho,
          cor: it.cor,
          tipoVenda: it.tipoVenda || tipoTabela,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitario,
          subtotal: it.quantidade * it.precoUnitario
        }))
      };

      const pedidoGravado = await submitPublicOrder(tenantId, payload);

      setPedidoConcluido(pedidoGravado);
      setCarrinho([]);
      setCarrinhoAberto(false);
      setModalSucessoAberto(true);

      confetti({
        particleCount: 100,
        spread: 75,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error("[CatalogoPublico] Falha ao enviar pedido:", err);
      alert("Ocorreu um erro ao registrar seu pedido. Tente novamente.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  // Link para enviar mensagem pronta no WhatsApp da loja
  const abrirWhatsAppComPedido = () => {
    if (!pedidoConcluido) return;

    const itensTexto = pedidoConcluido.itens
      ?.map(
        (it) =>
          `• ${it.quantidade}x ${it.nome} (${it.tamanho}/${it.cor}) - ${formatCurrency(it.subtotal)}`
      )
      .join("\n");

    const zapLoja = companyInfo?.whatsapp || "85988887777";
    const mensagem = `Olá, equipe *${companyInfo?.nome || "LifeSurf"}*! 👋\n\nAcabei de fazer o pedido *#${pedidoConcluido.numeroPedido}* pelo Catálogo Online:\n\n${itensTexto}\n\n*Total:* ${formatCurrency(pedidoConcluido.total)}\n*Modo:* ${pedidoConcluido.tipoVenda === "atacado" ? "Atacado / Lojista" : "Varejo"}\n*Pagamento:* ${pedidoConcluido.formaPagamento.toUpperCase()}\n*Cliente:* ${pedidoConcluido.cliente?.nome}\n*WhatsApp:* ${pedidoConcluido.cliente?.telefone}\n*Entrega:* ${pedidoConcluido.cliente?.endereco}\n\nPoderia confirmar a disponibilidade das peças e chave para pagamento?`;

    window.open(
      `https://wa.me/55${zapLoja.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
  };

  // Copia a Chave PIX da empresa
  const copiarChavePix = () => {
    const chave = companyInfo?.chavePix || companyInfo?.cnpj || "12.345.678/0001-90";
    navigator.clipboard.writeText(chave);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2500);
  };

  // Compartilha o Catálogo Online
  const compartilharCatalogo = () => {
    if (navigator.share) {
      navigator
        .share({
          title: companyInfo?.nome || "LifeSurf Catálogo Digital",
          text: "Confira as novidades e coleção surfwear direto da confecção!",
          url: window.location.href
        })
        .catch(() => { });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/60 text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white pb-20 md:pb-0">
      {/* 0. BARRA DE ADMINISTRAÇÃO (QUANDO LOGADO NO ERP) */}
      {isAuthenticated && (
        <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-neutral-300 gap-2 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-white">Visualização de Cliente</span>
            <span className="text-neutral-400 hidden sm:inline">• Modo Administrador Ativo</span>
          </div>
          <Link
            to="/gerenciar-catalogo"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-xs transition-colors shadow-sm cursor-pointer ml-auto"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Editar Catálogo & Mercadorias</span>
          </Link>
        </div>
      )}

      {/* 1. TOP ANNOUNCEMENT BAR (ESTÉTICA MINIMALISTA & MODERNA) */}
      <div className="bg-neutral-900 text-neutral-100 py-2 px-4 text-center text-xs font-medium tracking-tight flex items-center justify-center gap-2 border-b border-neutral-800">
        <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
        <span>
          {tipoTabela === "atacado"
            ? "TABELA DE ATACADO ATIVA: Preços especiais de confecção para revendedores e lojistas."
            : "FRETE GRÁTIS para retirada no balcão da confecção • Peças com pronta-entrega."}
        </span>
      </div>

      {/* 2. HEADER PÚBLICO DA VITRINE (ESTILO C&A / ALTA MODA CLEAN) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo e Nome da Loja */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo-white.png"
              alt={companyInfo?.nome || "LifeSurf"}
              className="h-8 w-auto max-w-[120px] object-contain select-none filter invert"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling.style.display = "flex";
              }}
            />

            {/* Fallback Monograma Clean */}
            <div className="hidden items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-extrabold text-sm tracking-tighter">
                LS
              </div>
              <div>
                <h1 className="text-sm font-bold text-neutral-900 tracking-tight uppercase leading-tight">
                  {companyInfo?.nome || "LifeSurf"}
                </h1>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  {companyInfo?.cidade || "Fortaleza - CE"}
                </p>
              </div>
            </div>
          </div>

          {/* Alternador Varejo vs Atacado (Pílula Segmentada Clean) */}
          <div className="hidden md:flex items-center bg-neutral-100 p-1 rounded-full border border-neutral-200/70 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTipoTabela("varejo")}
              className={cn(
                "px-3.5 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5",
                tipoTabela === "varejo"
                  ? "bg-white text-neutral-900 font-semibold shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Varejo</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoTabela("atacado")}
              className={cn(
                "px-3.5 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5",
                tipoTabela === "atacado"
                  ? "bg-neutral-900 text-white font-semibold shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Atacado (Lojista)</span>
            </button>
          </div>

          {/* Ações do Header */}
          <div className="flex items-center gap-2">
            {/* Compartilhar */}
            <button
              type="button"
              onClick={compartilharCatalogo}
              className="p-2 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 transition-colors cursor-pointer hidden sm:flex"
              title="Compartilhar catálogo"
            >
              {linkCopiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Falar no WhatsApp */}
            <a
              href={`https://wa.me/55${(companyInfo?.whatsapp || "85988887777").replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-300 text-neutral-700 hover:text-neutral-900 text-xs font-medium transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>

            {/* Sacola de Compras */}
            <button
              type="button"
              onClick={() => setCarrinhoAberto(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs shadow-xs transition-all cursor-pointer group"
            >
              <ShoppingBag className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">Sacola</span>
              <span className="bg-white text-neutral-900 font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                {totalItensSacola}
              </span>
              {subtotalSacola > 0 && (
                <span className="hidden md:inline pl-1 font-mono text-neutral-200 border-l border-neutral-700">
                  {formatCurrency(subtotalSacola)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO / CABEÇALHO DA COLEÇÃO (ESTILO EDITORIAL CLEAN) */}
      <section className="bg-white border-b border-neutral-200/70 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          {/* Seletor Varejo/Atacado Mobile */}
          <div className="flex md:hidden items-center justify-center">
            <div className="flex items-center bg-neutral-100 p-1 rounded-full border border-neutral-200/80 text-xs font-medium w-full max-w-xs justify-between">
              <button
                type="button"
                onClick={() => setTipoTabela("varejo")}
                className={cn(
                  "flex-1 py-1 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  tipoTabela === "varejo"
                    ? "bg-white text-neutral-900 font-semibold shadow-xs"
                    : "text-neutral-500"
                )}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Varejo</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoTabela("atacado")}
                className={cn(
                  "flex-1 py-1 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  tipoTabela === "atacado"
                    ? "bg-neutral-900 text-white font-semibold shadow-xs"
                    : "text-neutral-500"
                )}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Atacado</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Coleção 2026 • Fabricação Própria
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              Moda & Coleção Surfwear
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-lg mx-auto">
              {tipoTabela === "atacado"
                ? "Tabela de atacado para lojistas e revendedores. Monte sua grade com descontos de fábrica!"
                : companyInfo?.mensagemCatalogo ||
                "Peças exclusivas com tecidos nobres, alta durabilidade e caimento impecável."}
            </p>
          </div>

          {/* Barra de Pesquisa Rápida */}
          <div className="max-w-xl mx-auto relative pt-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por nome da peça, categoria ou referência..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-full bg-neutral-100/80 text-neutral-900 text-xs border border-neutral-200/90 focus:bg-white focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 transition-all shadow-xs"
            />
          </div>

          {/* Pílulas de Categorias Minimalistas */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {categorias.map((cat) => {
              const isAtiva = categoriaAtiva === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaAtiva(cat)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs transition-all cursor-pointer",
                    isAtiva
                      ? "bg-neutral-900 text-white font-semibold shadow-xs"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 font-medium"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. VITRINE DE PRODUTOS (GRADE LIMPA E ESPAÇOSA ESTILO C&A) */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        {loading ? (
          <div className="text-center py-24 space-y-3">
            <div className="w-8 h-8 border-3 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-neutral-500 font-medium">Carregando catálogo...</p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="text-center py-20 space-y-3 bg-white rounded-2xl border border-neutral-200 max-w-md mx-auto p-8 shadow-xs">
            <Tag className="w-10 h-10 text-neutral-400 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">Nenhuma peça encontrada</h3>
            <p className="text-xs text-neutral-500">
              Tente buscar por outro termo ou escolha a categoria "Todos".
            </p>
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setCategoriaAtiva("Todos");
              }}
              className="mt-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              Ver Todas as Peças
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {produtosFiltrados.map((produto) => {
              const tamanhosDisponiveis = produto.gradeTamanhos
                ? Object.keys(produto.gradeTamanhos)
                : ["P", "M", "G", "GG"];

              const precoVarejo = Number(produto.precoVarejo) || 0;
              const precoAtacado = Number(produto.precoAtacado) || precoVarejo;
              const precoExibido = tipoTabela === "atacado" ? precoAtacado : precoVarejo;
              const economia = precoVarejo > precoAtacado ? precoVarejo - precoAtacado : 0;
              const economiaPercent = precoVarejo > 0 ? Math.round((economia / precoVarejo) * 100) : 0;

              const coresLista = Array.isArray(produto.cores)
                ? produto.cores
                : typeof produto.cores === "string"
                  ? produto.cores.split(",").map((c) => c.trim())
                  : ["Padrão"];

              return (
                <div
                  key={produto.id}
                  className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden flex flex-col justify-between hover:border-neutral-300 hover:shadow-md transition-all duration-300 group"
                >
                  {/* Foto do Produto (Proporção Editorial 3:4 com Zoom Suave) */}
                  <div className="relative aspect-[3/4] w-full bg-neutral-100 overflow-hidden cursor-pointer" onClick={() => abrirSeletorVariacao(produto)}>
                    {(() => {
                      const fotoUrl = getProductImageUrl(produto);
                      return (
                        <img
                          src={fotoUrl || DEFAULT_PRODUCT_FALLBACK}
                          alt={produto.nome}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK;
                          }}
                        />
                      );
                    })()}


                    {/* Badges Minimalistas */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                      {produto.destaque && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-neutral-900 border border-neutral-200 shadow-xs uppercase tracking-tight">
                          Novo
                        </span>
                      )}
                      {tipoTabela === "atacado" && economiaPercent > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-900 text-white shadow-xs">
                          -{economiaPercent}% OFF
                        </span>
                      )}
                    </div>

                    {/* Categoria discreta */}
                    <div className="absolute bottom-2.5 right-2.5 z-10">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-neutral-600 border border-neutral-200 font-medium">
                        {produto.categoria || "Surfwear"}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes do Produto */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3 bg-white">
                    <div>
                      {/* Referência e Categoria */}
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                        <span>{produto.categoria || "Moda"}</span>
                        {produto.referencia && <span className="font-mono">Ref: {produto.referencia}</span>}
                      </div>

                      {/* Nome do Produto */}
                      <h3
                        onClick={() => abrirSeletorVariacao(produto)}
                        className="text-xs sm:text-sm font-semibold text-neutral-900 group-hover:text-neutral-600 transition-colors line-clamp-2 cursor-pointer leading-snug"
                      >
                        {produto.nome}
                      </h3>

                      {/* Amostras Visuais de Cores */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex items-center gap-1">
                          {coresLista.slice(0, 4).map((c, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                "w-2.5 h-2.5 rounded-full border shadow-2xs",
                                getColorSwatchClass(c)
                              )}
                              title={c}
                            />
                          ))}
                          {coresLista.length > 4 && (
                            <span className="text-[9px] text-neutral-400 font-mono">
                              +{coresLista.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-neutral-100">
                      {/* Tamanhos Disponíveis */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                        <span className="text-[10px] text-neutral-400 mr-1">Tam:</span>
                        {tamanhosDisponiveis.slice(0, 5).map((tam) => (
                          <span
                            key={tam}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono font-medium"
                          >
                            {tam}
                          </span>
                        ))}
                      </div>

                      {/* Preço em Evidência */}
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <strong className="text-base sm:text-lg font-bold text-neutral-900 font-sans tracking-tight">
                            {formatCurrency(precoExibido)}
                          </strong>
                          {tipoTabela === "atacado" && precoVarejo > precoAtacado && (
                            <span className="text-xs text-neutral-400 line-through font-normal">
                              {formatCurrency(precoVarejo)}
                            </span>
                          )}
                        </div>
                        {tipoTabela === "varejo" && precoAtacado < precoVarejo && (
                          <span className="text-[10px] text-neutral-500 block font-normal mt-0.5">
                            Atacado: <strong className="text-neutral-800">{formatCurrency(precoAtacado)}</strong>
                          </span>
                        )}
                      </div>

                      {/* Botão de Ação Minimalista e Alto Contraste (Estilo C&A) */}
                      <button
                        type="button"
                        onClick={() => abrirSeletorVariacao(produto)}
                        className="w-full h-9 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Comprar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. MODAL DE ESCOLHA DE TAMANHO & VARIAÇÃO (CLEAN & MODERNO) */}
      {produtoModal && (
        <Modal isOpen={Boolean(produtoModal)} onClose={() => setProdutoModal(null)} size="md">
          <ModalHeader
            title={produtoModal.nome}
            description={`Selecione tamanho e cor • ${tipoTabela === "atacado" ? "Tabela Atacado" : "Varejo"}`}
            onClose={() => setProdutoModal(null)}
          />
          <ModalBody className="space-y-4 text-neutral-900 bg-white">
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              {(() => {
                const modalFoto = getProductImageUrl(produtoModal);
                return modalFoto ? (
                  <img
                    src={modalFoto}
                    alt={produtoModal.nome}
                    className="w-16 h-20 rounded-lg object-cover border border-neutral-200 shrink-0"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK;
                    }}
                  />
                ) : null;
              })()}
              <div className="flex-1 min-w-0">

                <span className="text-xs text-neutral-500 block uppercase tracking-wider">{produtoModal.categoria}</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <strong className="text-xl font-bold text-neutral-900 font-sans">
                    {formatCurrency(
                      tipoTabela === "atacado"
                        ? produtoModal.precoAtacado || produtoModal.precoVarejo
                        : produtoModal.precoVarejo
                    )}
                  </strong>
                  {tipoTabela === "atacado" && produtoModal.precoVarejo > produtoModal.precoAtacado && (
                    <span className="text-xs text-neutral-400 line-through">
                      {formatCurrency(produtoModal.precoVarejo)}
                    </span>
                  )}
                </div>
                <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800">
                  {tipoTabela === "atacado" ? "Preço de Atacado" : "Preço de Varejo"}
                </span>
              </div>
            </div>

            {/* Escolha de Tamanho */}
            <div>
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider block mb-2">
                1. Escolha o Tamanho:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {(produtoModal.gradeTamanhos
                  ? Object.keys(produtoModal.gradeTamanhos)
                  : ["P", "M", "G", "GG"]
                ).map((tam) => {
                  const isSelected = tamanhoSelecionado === tam;
                  return (
                    <button
                      key={tam}
                      type="button"
                      onClick={() => setTamanhoSelecionado(tam)}
                      className={cn(
                        "py-2.5 rounded-lg border text-center font-mono font-semibold text-xs transition-all cursor-pointer",
                        isSelected
                          ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                          : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400"
                      )}
                    >
                      {tam}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escolha de Cor */}
            <div>
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider block mb-2">
                2. Escolha a Cor:
              </span>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(produtoModal.cores)
                  ? produtoModal.cores
                  : typeof produtoModal.cores === "string"
                    ? produtoModal.cores.split(",").map((c) => c.trim())
                    : ["Padrão"]
                ).map((cor) => {
                  const isSelected = corSelecionada === cor;
                  return (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setCorSelecionada(cor)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer flex items-center gap-2",
                        isSelected
                          ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                          : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400"
                      )}
                    >
                      <span
                        className={cn(
                          "w-3 h-3 rounded-full border shrink-0",
                          getColorSwatchClass(cor)
                        )}
                      />
                      <span>{cor}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantidade */}
            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <div>
                <span className="text-xs text-neutral-700 font-semibold block">Quantidade:</span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  Subtotal:{" "}
                  {formatCurrency(
                    (tipoTabela === "atacado"
                      ? produtoModal.precoAtacado || produtoModal.precoVarejo
                      : produtoModal.precoVarejo) * quantidadeItem
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantidadeItem((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-800 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-mono font-bold text-neutral-900 text-sm">
                  {quantidadeItem}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidadeItem((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-800 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setProdutoModal(null)} className="text-neutral-600">
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAdicionarAoCarrinho}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs"
            >
              Adicionar à Sacola
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* 6. DRAWER DA SACOLA E CHECKOUT DE FRICÇÃO ZERO (DESIGN CLEAN) */}
      {carrinhoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full border-l border-neutral-200 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header da Sacola */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-neutral-900" />
                <h3 className="text-base font-bold text-neutral-900">Sua Sacola de Compras</h3>
              </div>
              <button
                type="button"
                onClick={() => setCarrinhoAberto(false)}
                className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo da Sacola */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {carrinho.length === 0 ? (
                <div className="text-center py-20 space-y-3 text-neutral-400">
                  <ShoppingBag className="w-12 h-12 mx-auto text-neutral-300" />
                  <p className="text-sm font-semibold text-neutral-700">Sua sacola está vazia.</p>
                  <p className="text-xs text-neutral-500">Escolha peças no catálogo para finalizar.</p>
                  <button
                    type="button"
                    onClick={() => setCarrinhoAberto(false)}
                    className="mt-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
                  >
                    Explorar Peças
                  </button>
                </div>
              ) : (
                <>
                  {/* Lista de Itens */}
                  <div className="space-y-2.5">
                    {carrinho.map((item) => (
                      <div
                        key={item.key}
                        className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between gap-3"
                      >
                        {item.fotoUrl && (
                          <div className="w-12 h-14 rounded-lg bg-neutral-200 border border-neutral-300 overflow-hidden shrink-0">
                            <img
                              src={item.fotoUrl}
                              alt={item.nome}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-neutral-900 truncate">{item.nome}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5 font-mono">
                            <span>Tam: <strong>{item.tamanho}</strong></span>
                            <span>•</span>
                            <span>{item.cor}</span>
                            {item.tipoVenda === "atacado" && (
                              <>
                                <span>•</span>
                                <span className="text-neutral-900 font-bold">Atacado</span>
                              </>
                            )}
                          </div>
                          <strong className="text-xs font-bold text-neutral-900 font-mono mt-1 block">
                            {formatCurrency(item.precoUnitario * item.quantidade)}
                          </strong>
                        </div>


                        {/* Botões de Quantidade */}
                        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-neutral-200">
                          <button
                            type="button"
                            onClick={() => alterarQtdCarrinho(item.key, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-xs text-neutral-900">
                            {item.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => alterarQtdCarrinho(item.key, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removerDoCarrinho(item.key)}
                          className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* FORMULÁRIO DE CHECKOUT RÁPIDO */}
                  <form
                    id="checkout-form"
                    onSubmit={handleFinalizarPedido}
                    className="pt-3 border-t border-neutral-200 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Dados de Envio & Contato
                      </span>
                      <span className="text-[11px] text-neutral-500 font-normal">Sem senha necessária</span>
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          required
                          placeholder="Seu Nome Completo"
                          value={nomeCliente}
                          onChange={(e) => setNomeCliente(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none placeholder:text-neutral-400"
                        />
                      </div>

                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          required
                          placeholder="WhatsApp com DDD (Ex: 85988887777)"
                          value={whatsappCliente}
                          onChange={(e) => setWhatsappCliente(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none placeholder:text-neutral-400 font-mono"
                        />
                      </div>

                      {/* Modalidade de Entrega */}
                      <div className="pt-1">
                        <label className="text-[11px] text-neutral-500 block mb-1">
                          Como deseja receber seu pedido?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTipoEntrega("entrega")}
                            className={cn(
                              "p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                              tipoEntrega === "entrega"
                                ? "bg-neutral-900 border-neutral-900 text-white shadow-xs"
                                : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                            )}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Entrega / Motoboy</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTipoEntrega("retirada")}
                            className={cn(
                              "p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                              tipoEntrega === "retirada"
                                ? "bg-neutral-900 border-neutral-900 text-white shadow-xs"
                                : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                            )}
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>Retirar no Balcão</span>
                          </button>
                        </div>
                      </div>

                      {tipoEntrega === "entrega" ? (
                        <div className="space-y-2 pt-1">
                          <div className="relative">
                            <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                              type="text"
                              required
                              placeholder="Endereço (Rua, Número, Complemento)"
                              value={enderecoCliente}
                              onChange={(e) => setEnderecoCliente(e.target.value)}
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none placeholder:text-neutral-400"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Bairro"
                              value={bairroCliente}
                              onChange={(e) => setBairroCliente(e.target.value)}
                              className="w-full h-9 px-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none placeholder:text-neutral-400"
                            />
                            <input
                              type="text"
                              placeholder="Cidade / UF"
                              value={cidadeCliente}
                              onChange={(e) => setCidadeCliente(e.target.value)}
                              className="w-full h-9 px-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none placeholder:text-neutral-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-700 space-y-1">
                          <strong className="text-neutral-900 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-neutral-700" />
                            {companyInfo?.nome || "LifeSurf Confecções"}
                          </strong>
                          <p className="text-[11px] text-neutral-500">
                            {companyInfo?.endereco || "Av. Beira Mar, 2100 - Meireles"} - {companyInfo?.cidade || "Fortaleza - CE"}
                          </p>
                          <span className="text-[10px] text-emerald-700 font-semibold block">
                            ✓ Sem taxa de frete • Retirada direta na fábrica
                          </span>
                        </div>
                      )}

                      {/* Método de Pagamento */}
                      <div className="pt-1">
                        <label className="text-[11px] text-neutral-500 block mb-1.5">
                          Forma de Pagamento:
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "pix", label: "PIX", icon: QrCode },
                            { id: "cartao", label: "Cartão", icon: CreditCard },
                            { id: "dinheiro", label: "Dinheiro", icon: DollarSign }
                          ].map((pg) => {
                            const Icon = pg.icon;
                            const isSelected = formaPagamento === pg.id;
                            return (
                              <button
                                key={pg.id}
                                type="button"
                                onClick={() => setFormaPagamento(pg.id)}
                                className={cn(
                                  "py-2 px-1 rounded-lg border text-center text-[11px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-neutral-900 border-neutral-900 text-white shadow-xs"
                                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                )}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {pg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Chave PIX se selecionado */}
                      {formaPagamento === "pix" && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-emerald-800 uppercase tracking-wider block font-bold">
                              Chave PIX da Loja
                            </span>
                            <span className="text-emerald-950 font-mono font-bold text-[11px]">
                              {companyInfo?.chavePix || companyInfo?.cnpj || "12.345.678/0001-90"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={copiarChavePix}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold text-[10px] hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            {pixCopiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {pixCopiado ? "Copiada!" : "Copiar"}
                          </button>
                        </div>
                      )}

                      <textarea
                        rows={2}
                        placeholder="Observações adicionais (ex: deixar na portaria, troco para 100...)"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-none placeholder:text-neutral-400"
                      />
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Rodapé da Sacola com Totais e Botão */}
            {carrinho.length > 0 && (
              <div className="p-4 border-t border-neutral-200 bg-white space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>Subtotal ({totalItensSacola} peças):</span>
                    <span className="font-mono text-neutral-900 font-semibold">{formatCurrency(subtotalSacola)}</span>
                  </div>

                  {economiaTotal > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Economia no Atacado:</span>
                      <span className="font-mono">-{formatCurrency(economiaTotal)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-neutral-700" />
                      Entrega:
                    </span>
                    <span className="text-neutral-800 font-medium">
                      {tipoEntrega === "retirada" ? "Grátis (Balcão)" : "A combinar com motoboy"}
                    </span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-bold">
                    <span className="text-neutral-900">Total a Pagar:</span>
                    <span className="text-neutral-900 font-mono text-lg font-extrabold">
                      {formatCurrency(subtotalSacola)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={enviandoPedido}
                  className="w-full h-12 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer disabled:opacity-50"
                >
                  {enviandoPedido ? (
                    <span>Registrando Pedido...</span>
                  ) : (
                    <>
                      <span>CONFIRMAR PEDIDO</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL DE SUCESSO DO PEDIDO */}
      {modalSucessoAberto && pedidoConcluido && (
        <Modal
          isOpen={modalSucessoAberto}
          onClose={() => setModalSucessoAberto(false)}
          size="md"
        >
          <ModalBody className="p-6 text-center space-y-4 bg-white text-neutral-900">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest block font-mono">
                Pedido Registrado com Sucesso
              </span>
              <h3 className="text-2xl font-extrabold text-neutral-900 mt-1">
                {pedidoConcluido.numeroPedido}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Seu pedido foi recebido pela confecção e já está na fila de separação da expedição!
              </p>
            </div>

            {/* Resumo do Pedido */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Cliente:</span>
                <strong className="text-neutral-900">{pedidoConcluido.cliente?.nome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">WhatsApp:</span>
                <span className="text-neutral-800 font-mono">{pedidoConcluido.cliente?.telefone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Recebimento:</span>
                <span className="text-neutral-800">{pedidoConcluido.cliente?.endereco}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Forma de Pagto:</span>
                <strong className="text-neutral-900 uppercase">{pedidoConcluido.formaPagamento}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-neutral-200">
                <span className="text-neutral-500">Total a Pagar:</span>
                <strong className="text-neutral-900 text-sm font-mono font-bold">
                  {formatCurrency(pedidoConcluido.total)}
                </strong>
              </div>
            </div>

            {/* Botão Enviar WhatsApp */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                onClick={abrirWhatsAppComPedido}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar Pedido no WhatsApp da Loja</span>
              </button>

              <button
                type="button"
                className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-900 font-medium cursor-pointer"
                onClick={() => setModalSucessoAberto(false)}
              >
                Continuar Navegando
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* 8. BARRA FLUTUANTE INFERIOR MOBILE */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Total:</span>
          <strong className="text-base font-bold text-neutral-900 font-mono">
            {formatCurrency(subtotalSacola)}
          </strong>
        </div>

        <button
          type="button"
          onClick={() => setCarrinhoAberto(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold shadow-xs cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Ver Sacola ({totalItensSacola})</span>
        </button>
      </div>

      {/* 9. FOOTER MINIMALISTA */}
      <footer className="mt-auto border-t border-neutral-200 bg-white py-8 px-4 text-center text-xs text-neutral-500 space-y-1.5">
        <p className="font-semibold text-neutral-700">
          © {new Date().getFullYear()} {companyInfo?.nome || "LifeSurf Confecções"}. Todos os direitos reservados.
        </p>
        <p className="text-[11px] text-neutral-400">
          {companyInfo?.cidade || "Fortaleza - CE"} • CNPJ: {companyInfo?.cnpj || "12.345.678/0001-90"} • WhatsApp: {companyInfo?.telefone || "(85) 98888-7777"}
        </p>
        <p className="text-[10px] text-neutral-400">
          Plataforma PDV & Catálogo Digital Integrado LifeSurf.
        </p>
      </footer>
    </div>
  );
}
