import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  fetchPublicCatalog,
  fetchCompanyPublicInfo,
  submitPublicOrder
} from "../services/catalogService";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import { formatCurrency } from "../utils/formatters";
import { cn } from "../utils/cn";
import {
  ShoppingCart,
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
  Sparkles,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Truck,
  CreditCard,
  QrCode,
  DollarSign,
  ChevronRight
} from "lucide-react";

export default function CatalogoPublico() {
  const { companyId } = useParams();
  const tenantId = companyId || "lifesurf";

  const [companyInfo, setCompanyInfo] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [enderecoCliente, setEnderecoCliente] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [observacoes, setObservacoes] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

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
      } finally {
        setLoading(false);
      }
    }
    carregarDados();
  }, [tenantId]);

  // Lista de Categorias Únicas
  const categorias = useMemo(() => {
    const setCats = new Set(["Todos"]);
    produtos.forEach((p) => {
      if (p.categoria) setCats.add(p.categoria);
    });
    return Array.from(setCats);
  }, [produtos]);

  // Produtos Filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchCat = categoriaAtiva === "Todos" || p.categoria === categoriaAtiva;
      const matchBusca =
        !busca.trim() ||
        p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.referencia?.toLowerCase().includes(busca.toLowerCase()) ||
        p.descricao?.toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [produtos, categoriaAtiva, busca]);

  // 2. ABRIR SELETOR DE TAMANHO
  const abrirSeletorVariacao = (produto) => {
    setProdutoModal(produto);
    setQuantidadeItem(1);

    // Seleciona o primeiro tamanho disponível
    const tamanhosDisponiveis = produto.gradeTamanhos
      ? Object.keys(produto.gradeTamanhos)
      : ["P", "M", "G", "GG"];
    setTamanhoSelecionado(tamanhosDisponiveis[0] || "M");

    // Seleciona a primeira cor disponível
    const cores = Array.isArray(produto.cores)
      ? produto.cores
      : typeof produto.cores === "string"
      ? produto.cores.split(",").map((c) => c.trim())
      : ["Padrão"];
    setCorSelecionada(cores[0] || "Padrão");
  };

  // 3. ADICIONAR AO CARRINHO
  const handleAdicionarAoCarrinho = () => {
    if (!produtoModal) return;

    const itemKey = `${produtoModal.id}-${tamanhoSelecionado}-${corSelecionada}`;
    const itemExistenteIndex = carrinho.findIndex((it) => it.key === itemKey);

    const precoUnitario = Number(produtoModal.precoVarejo) || 0;

    if (itemExistenteIndex >= 0) {
      const novoCarrinho = [...carrinho];
      novoCarrinho[itemExistenteIndex].quantidade += quantidadeItem;
      setCarrinho(novoCarrinho);
    } else {
      setCarrinho([
        ...carrinho,
        {
          key: itemKey,
          id: produtoModal.id,
          nome: produtoModal.nome,
          referencia: produtoModal.referencia,
          tamanho: tamanhoSelecionado,
          cor: corSelecionada,
          precoUnitario,
          quantidade: quantidadeItem,
          fotoUrl: produtoModal.fotoUrl
        }
      ]);
    }

    setProdutoModal(null);
    setCarrinhoAberto(true);
  };

  // Alterar quantidade no carrinho
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

  // Totais do Carrinho
  const totalItensSacola = carrinho.reduce((acc, it) => acc + it.quantidade, 0);
  const subtotalSacola = carrinho.reduce(
    (acc, it) => acc + it.precoUnitario * it.quantidade,
    0
  );

  // 4. CHECKOUT DE FRICÇÃO ZERO (SUBMISSÃO DO PEDIDO)
  const handleFinalizarPedido = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) return;

    if (!nomeCliente.trim()) {
      alert("Por favor, digite seu nome completo.");
      return;
    }
    if (!whatsappCliente.trim()) {
      alert("Por favor, digite seu WhatsApp para contato.");
      return;
    }
    if (!enderecoCliente.trim()) {
      alert("Por favor, digite seu endereço ou 'Retirar na loja'.");
      return;
    }

    setEnviandoPedido(true);
    try {
      const payload = {
        nome: nomeCliente.trim(),
        whatsapp: whatsappCliente.trim(),
        endereco: enderecoCliente.trim(),
        formaPagamento,
        observacoes: observacoes.trim(),
        subtotal: subtotalSacola,
        total: subtotalSacola,
        itens: carrinho.map((it) => ({
          id: it.id,
          nome: it.nome,
          referencia: it.referencia,
          tamanho: it.tamanho,
          cor: it.cor,
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

      // Efeito de confetes festivos
      confetti({
        particleCount: 80,
        spread: 70,
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
      ?.map((it) => `• ${it.quantidade}x ${it.nome} (${it.tamanho}/${it.cor}) - ${formatCurrency(it.subtotal)}`)
      .join("\n");

    const mensagem = `Olá, ${companyInfo?.nome || "LifeSurf"}! 🌊\n\nAcabei de fazer o pedido *${pedidoConcluido.numeroPedido}* pelo catálogo online:\n\n${itensTexto}\n\n*Total: ${formatCurrency(pedidoConcluido.total)}*\n*Pagamento:* ${pedidoConcluido.formaPagamento.toUpperCase()}\n*Cliente:* ${pedidoConcluido.cliente?.nome}\n*WhatsApp:* ${pedidoConcluido.cliente?.telefone}\n*Entrega:* ${pedidoConcluido.cliente?.endereco}\n\nPoderia confirmar a disponibilidade para entrega?`;

    const zap = companyInfo?.whatsapp || "85988887777";
    window.open(`https://wa.me/55${zap.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* 1. HEADER PÚBLICO DA VITRINE DIGITAL */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo-white.png"
              alt={companyInfo?.nome || "LifeSurf"}
              className="h-10 w-auto max-w-[140px] object-contain select-none"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling.style.display = "flex";
              }}
            />

            {/* Fallback */}
            <div className="hidden items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20 text-lg tracking-tight">
                LS
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold text-white tracking-tight uppercase">
                    {companyInfo?.nome || "LifeSurf Surfwear"}
                  </h1>
                  <Badge variant="success" size="sm">Oficial</Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  {companyInfo?.cidade || "Fortaleza - CE"} • Catálogo Digital de Fábrica
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Botão de Contato WhatsApp da Loja */}
            <a
              href={`https://wa.me/55${(companyInfo?.whatsapp || "85988887777").replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp da Loja
            </a>

            {/* Botão Flutuante / Header da Sacola */}
            <button
              type="button"
              onClick={() => setCarrinhoAberto(true)}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer group"
            >
              <ShoppingBag className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">Sacola</span>
              <span className="bg-slate-950 text-white font-mono text-[11px] px-1.5 py-0.5 rounded-full border border-sky-300">
                {totalItensSacola}
              </span>
              {subtotalSacola > 0 && (
                <span className="hidden md:inline pl-1 font-mono text-sky-100 border-l border-sky-400/40">
                  {formatCurrency(subtotalSacola)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER E BARRA DE BUSCA */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-950/40 via-slate-950 to-slate-950 py-10 px-4 sm:px-6 border-b border-slate-800/40">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Mostruário Digital & Encomendas Direto de Fábrica
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Coleção Surfwear & Moda Masculina
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            {companyInfo?.mensagemCatalogo ||
              "Peças exclusivas com tecidos nobres, alta durabilidade e pronta-entrega direto da confecção."}
          </p>

          {/* Campo de Busca Rápida */}
          <div className="max-w-md mx-auto relative pt-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por bermuda, camiseta, polo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 text-white text-xs border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 placeholder:text-slate-500"
            />
          </div>

          {/* Categorias em Pílulas */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaAtiva(cat)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
                  categoriaAtiva === cat
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. VITRINE DE PRODUTOS */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        {loading ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Carregando catálogo oficial...</p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-slate-900/30 rounded-2xl border border-slate-800 max-w-md mx-auto p-8">
            <Tag className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-400">
              Tente buscar por outro termo ou selecione a categoria "Todos".
            </p>
            <Button variant="outline" size="sm" onClick={() => { setBusca(""); setCategoriaAtiva("Todos"); }}>
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {produtosFiltrados.map((produto) => {
              const tamanhosDisponiveis = produto.gradeTamanhos
                ? Object.keys(produto.gradeTamanhos)
                : ["P", "M", "G", "GG"];

              return (
                <div
                  key={produto.id}
                  className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-xl group"
                >
                  {/* Foto do Produto */}
                  <div className="relative aspect-square w-full bg-slate-950 overflow-hidden">
                    {produto.fotoUrl ? (
                      <img
                        src={produto.fotoUrl}
                        alt={produto.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-950 text-slate-600 p-4 text-center">
                        <Tag className="w-12 h-12 mb-2 opacity-40 text-sky-400" />
                        <span className="text-[11px] font-bold text-slate-400">LIFESURF</span>
                      </div>
                    )}

                    {produto.destaque && (
                      <div className="absolute top-2.5 left-2.5">
                        <Badge variant="warning" size="sm">Destaque</Badge>
                      </div>
                    )}

                    <div className="absolute bottom-2.5 right-2.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-300 border border-slate-800 font-mono">
                        {produto.categoria || "Moda"}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes do Produto */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors line-clamp-2">
                        {produto.nome}
                      </h3>
                      {produto.descricao && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {produto.descricao}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                      {/* Grade de tamanhos disponíveis */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                        <span className="text-[10px] text-slate-500 mr-1">Tam:</span>
                        {tamanhosDisponiveis.slice(0, 5).map((tam) => (
                          <span
                            key={tam}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono font-bold"
                          >
                            {tam}
                          </span>
                        ))}
                      </div>

                      {/* Preço e Botão Adicionar */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                            Preço
                          </span>
                          <strong className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                            {formatCurrency(produto.precoVarejo || 0)}
                          </strong>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => abrirSeletorVariacao(produto)}
                          className="h-9 px-3 text-xs font-bold shadow-md shadow-sky-500/20"
                          rightIcon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Comprar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. MODAL DE ESCOLHA DE TAMANHO & QUANTIDADE */}
      {produtoModal && (
        <Modal isOpen={Boolean(produtoModal)} onClose={() => setProdutoModal(null)} size="md">
          <ModalHeader
            title={produtoModal.nome}
            description={`Selecione seu tamanho e cor para adicionar à sacola.`}
            onClose={() => setProdutoModal(null)}
          />
          <ModalBody className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              {produtoModal.fotoUrl && (
                <img
                  src={produtoModal.fotoUrl}
                  alt={produtoModal.nome}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-800"
                />
              )}
              <div>
                <span className="text-xs text-slate-400 block">{produtoModal.categoria}</span>
                <strong className="text-lg font-black text-emerald-400 font-mono">
                  {formatCurrency(produtoModal.precoVarejo || 0)}
                </strong>
              </div>
            </div>

            {/* Escolha de Tamanho */}
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                1. Selecione o Tamanho:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {(produtoModal.gradeTamanhos
                  ? Object.keys(produtoModal.gradeTamanhos)
                  : ["P", "M", "G", "GG"]
                ).map((tam) => (
                  <button
                    key={tam}
                    type="button"
                    onClick={() => setTamanhoSelecionado(tam)}
                    className={cn(
                      "py-2.5 rounded-xl border text-center font-mono font-bold text-xs transition-all cursor-pointer",
                      tamanhoSelecionado === tam
                        ? "bg-sky-500 text-white border-sky-400 ring-2 ring-sky-400 shadow-md shadow-sky-500/30 scale-105"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    )}
                  >
                    {tam}
                  </button>
                ))}
              </div>
            </div>

            {/* Escolha de Cor */}
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                2. Selecione a Cor:
              </span>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(produtoModal.cores)
                  ? produtoModal.cores
                  : typeof produtoModal.cores === "string"
                  ? produtoModal.cores.split(",").map((c) => c.trim())
                  : ["Padrão"]
                ).map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setCorSelecionada(cor)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                      corSelecionada === cor
                        ? "bg-sky-500/20 text-sky-300 border-sky-400 ring-1 ring-sky-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    )}
                  >
                    {cor}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantidade */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-300 font-semibold">Quantidade:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantidadeItem((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-white flex items-center justify-center hover:bg-slate-800"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center font-mono font-bold text-white text-sm">
                  {quantidadeItem}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidadeItem((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-white flex items-center justify-center hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setProdutoModal(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAdicionarAoCarrinho}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Adicionar à Sacola
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* 5. DRAWER / MODAL DA SACOLA E CHECKOUT DE FRICÇÃO ZERO */}
      {carrinhoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-950 h-full border-l border-slate-800 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header da Sacola */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Sua Sacola de Compras</h3>
              </div>
              <button
                type="button"
                onClick={() => setCarrinhoAberto(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo da Sacola (Itens + Formulário de Checkout) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {carrinho.length === 0 ? (
                <div className="text-center py-20 space-y-3 text-slate-500">
                  <ShoppingBag className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">Sua sacola está vazia.</p>
                  <p className="text-xs text-slate-500">Escolha peças no catálogo para finalizar.</p>
                  <Button variant="outline" size="sm" onClick={() => setCarrinhoAberto(false)}>
                    Explorar Produtos
                  </Button>
                </div>
              ) : (
                <>
                  {/* Lista dos Itens na Sacola */}
                  <div className="space-y-2.5">
                    {carrinho.map((item) => (
                      <div
                        key={item.key}
                        className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{item.nome}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            <span>Tam: <strong className="text-sky-400">{item.tamanho}</strong></span>
                            <span>•</span>
                            <span>{item.cor}</span>
                          </div>
                          <strong className="text-xs font-bold text-emerald-400 font-mono mt-1 block">
                            {formatCurrency(item.precoUnitario * item.quantidade)}
                          </strong>
                        </div>

                        {/* Botões de quantidade */}
                        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => alterarQtdCarrinho(item.key, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-xs text-white">
                            {item.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => alterarQtdCarrinho(item.key, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removerDoCarrinho(item.key)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* FORMULÁRIO DE CHECKOUT DE FRICÇÃO ZERO (SEM SENHA) */}
                  <form id="checkout-form" onSubmit={handleFinalizarPedido} className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Dados para Entrega (Sem Senha):
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Seu Nome Completo"
                          value={nomeCliente}
                          onChange={(e) => setNomeCliente(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none placeholder:text-slate-500"
                        />
                      </div>

                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Seu WhatsApp (com DDD)"
                          value={whatsappCliente}
                          onChange={(e) => setWhatsappCliente(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none placeholder:text-slate-500 font-mono"
                        />
                      </div>

                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Endereço de Entrega ou 'Retirar na Loja'"
                          value={enderecoCliente}
                          onChange={(e) => setEnderecoCliente(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none placeholder:text-slate-500"
                        />
                      </div>

                      {/* Escolha do Método de Pagamento */}
                      <div className="pt-1">
                        <label className="text-[11px] text-slate-400 block mb-1.5">
                          Forma de Pagamento Preferida:
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
                                  "py-2 px-1 rounded-lg border text-center text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-sky-500/20 border-sky-400 text-sky-300 ring-1 ring-sky-400"
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                )}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {pg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Observações (ex: deixar na portaria, troco para 100...)"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Rodapé com Totais e Botão de Envio */}
            {carrinho.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal ({totalItensSacola} peças):</span>
                    <span className="font-mono text-white">{formatCurrency(subtotalSacola)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      Entrega:
                    </span>
                    <span className="text-emerald-400 font-bold">A combinar / Balcão</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800 text-sm font-bold">
                    <span className="text-white">Total a Pagar:</span>
                    <span className="text-emerald-400 font-mono text-lg font-black">
                      {formatCurrency(subtotalSacola)}
                    </span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  form="checkout-form"
                  isLoading={enviandoPedido}
                  className="w-full h-12 text-sm font-extrabold shadow-lg shadow-sky-500/25"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  CONFIRMAR PEDIDO (SEM SENHA)
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL DE SUCESSO DO PEDIDO & COMPROVANTE */}
      {modalSucessoAberto && pedidoConcluido && (
        <Modal
          isOpen={modalSucessoAberto}
          onClose={() => setModalSucessoAberto(false)}
          size="md"
        >
          <ModalBody className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block font-mono">
                Sucesso! Pedido Registrado
              </span>
              <h3 className="text-2xl font-black text-white mt-1">
                {pedidoConcluido.numeroPedido}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Seu pedido foi enviado diretamente para a equipe de expedição da confecção!
              </p>
            </div>

            {/* Cartão de Resumo do Pedido */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente:</span>
                <strong className="text-white">{pedidoConcluido.cliente?.nome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">WhatsApp:</span>
                <span className="text-slate-200 font-mono">{pedidoConcluido.cliente?.telefone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entrega:</span>
                <span className="text-slate-200">{pedidoConcluido.cliente?.endereco}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Total a Pagar:</span>
                <strong className="text-emerald-400 text-sm font-mono font-black">
                  {formatCurrency(pedidoConcluido.total)}
                </strong>
              </div>
            </div>

            {/* Botão de Envio WhatsApp com Texto Pronto */}
            <div className="space-y-2 pt-2">
              <Button
                variant="success"
                className="w-full h-11 text-xs font-bold"
                onClick={abrirWhatsAppComPedido}
                leftIcon={<MessageCircle className="w-4 h-4" />}
              >
                Enviar Pedido no WhatsApp da Loja
              </Button>

              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setModalSucessoAberto(false)}
              >
                Continuar Navegando no Catálogo
              </Button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* 7. FOOTER PÚBLICO */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} {companyInfo?.nome || "LifeSurf Confecções"}. Todos os direitos reservados.</p>
        <p className="text-[11px] text-slate-600 mt-1">Plataforma PDV & Catálogo Digital LifeSurf.</p>
      </footer>
    </div>
  );
}
