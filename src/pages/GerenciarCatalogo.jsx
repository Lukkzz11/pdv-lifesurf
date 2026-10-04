import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import { useAuth } from "../security/AuthContext";
import {
  fetchCompanyPublicInfo,
  saveCompanyCatalogSettings,
  fetchAdminCatalogProducts,
  saveCatalogProduct,
  toggleProductCatalogVisibility,
  toggleProductCatalogDestaque,
  removeProductFromCatalog,
  resetCatalogToDefault
} from "../services/catalogService";
import { CATEGORIAS_MODA } from "../services/stockService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
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
import { formatCurrency } from "../utils/formatters";
import { cn } from "../utils/cn";
import toast from "react-hot-toast";
import {
  Globe,
  Store,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Star,
  ExternalLink,
  Copy,
  Check,
  Save,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  Layers,
  MessageCircle,
  QrCode,
  Image as ImageIcon,
  Tag,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function GerenciarCatalogo() {
  const { activeTenantId } = useTenant();
  const { userProfile } = useAuth();
  const tenantId = activeTenantId || "lifesurf";

  const [loading, setLoading] = useState(true);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Informações da Vitrine / Loja
  const [companyInfo, setCompanyInfo] = useState({
    nome: "",
    whatsapp: "",
    telefone: "",
    chavePix: "",
    mensagemCatalogo: "",
    cidade: "Fortaleza - CE",
    endereco: "Av. Beira Mar, 2100",
    bairro: "Meireles"
  });

  // Lista de Mercadorias do Catálogo
  const [produtos, setProdutos] = useState([]);

  // Filtros de Busca
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS"); // "TODOS" | "ATIVOS" | "OCULTOS" | "DESTAQUES"

  // Modal de Adicionar / Editar Mercadoria
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState(null);
  const [salvandoProduto, setSalvandoProduto] = useState(false);

  const [formProduto, setFormProduto] = useState({
    nome: "",
    categoria: "Camiseta",
    referencia: "",
    precoVarejo: "",
    precoAtacado: "",
    descricao: "",
    fotoUrl: "",
    cores: "Preto, Branco",
    ativoNoCatalogo: true,
    destaque: false,
    gradeTamanhos: { P: 10, M: 20, G: 15, GG: 8 }
  });

  // 1. CARREGAMENTO DOS DADOS DO CATÁLOGO
  const carregarDados = async () => {
    setLoading(true);
    try {
      const [info, prods] = await Promise.all([
        fetchCompanyPublicInfo(tenantId),
        fetchAdminCatalogProducts(tenantId)
      ]);

      setCompanyInfo({
        nome: info.nome || "LifeSurf Surfwear & Confecções",
        whatsapp: info.whatsapp || "(85) 98888-7777",
        telefone: info.telefone || "(85) 98888-7777",
        chavePix: info.chavePix || "12.345.678/0001-90",
        mensagemCatalogo:
          info.mensagemCatalogo ||
          "Produtos de alta qualidade com fabricação própria, pronta-entrega e envio para todo o Brasil!",
        cidade: info.cidade || "Fortaleza - CE",
        endereco: info.endereco || "Av. Beira Mar, 2100",
        bairro: info.bairro || "Meireles"
      });

      setProdutos(prods);
    } catch (err) {
      console.error("[GerenciarCatalogo] Erro ao carregar dados:", err);
      toast.error("Erro ao carregar dados do catálogo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [tenantId]);

  // 2. SALVAR DADOS DA VITRINE (NOME, WHATSAPP, PIX, BANNER)
  const handleSalvarConfigLoja = async (e) => {
    if (e) e.preventDefault();
    if (!companyInfo.nome.trim()) {
      toast.error("O nome da loja na vitrine é obrigatório");
      return;
    }

    setSalvandoConfig(true);
    try {
      await saveCompanyCatalogSettings(tenantId, companyInfo);
      toast.success("Informações da vitrine salvas com sucesso!");
    } catch (err) {
      console.error("[GerenciarCatalogo] Erro ao salvar configurações:", err);
      toast.error("Erro ao salvar informações da vitrine");
    } finally {
      setSalvandoConfig(false);
    }
  };

  // 3. COPIAR E ABRIR LINK PÚBLICO
  const urlPublica = `${window.location.origin}/catalogo/${tenantId}`;

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(urlPublica);
    setLinkCopiado(true);
    toast.success("Link do catálogo copiado para a área de transferência!");
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  const handleAbrirVitrine = () => {
    window.open(urlPublica, "_blank");
  };

  // 4. RETIRAR OU RECOLOCAR MERCADORIA DO CATÁLOGO (1 CLIQUE)
  const handleToggleVisibilidade = async (prod) => {
    const novoStatus = !(prod.ativoNoCatalogo !== false);
    try {
      const listaAtualizada = await toggleProductCatalogVisibility(tenantId, prod.id, novoStatus);
      setProdutos(listaAtualizada);
      if (novoStatus) {
        toast.success(`"${prod.nome}" agora está visível no catálogo online!`);
      } else {
        toast(`"${prod.nome}" foi retirado da vitrine pública.`, {
          icon: "👁️‍🗨️",
          style: { background: "#1e293b", color: "#f87171" }
        });
      }
    } catch (err) {
      toast.error("Erro ao alterar visibilidade da mercadoria");
    }
  };

  // 5. ALTERNAR DESTAQUE DA MERCADORIA (1 CLIQUE)
  const handleToggleDestaque = async (prod) => {
    const novoDestaque = !prod.destaque;
    try {
      const listaAtualizada = await toggleProductCatalogDestaque(tenantId, prod.id, novoDestaque);
      setProdutos(listaAtualizada);
      if (novoDestaque) {
        toast.success(`"${prod.nome}" marcado como DESTAQUE na vitrine!`, { icon: "⭐" });
      } else {
        toast(`Destaque removido de "${prod.nome}".`);
      }
    } catch (err) {
      toast.error("Erro ao alterar destaque da mercadoria");
    }
  };

  // 6. ABRIR MODAL PARA EDITAR OU CRIAR MERCADORIA
  const handleAbrirModalNovo = () => {
    setProdutoEditando(null);
    setFormProduto({
      nome: "",
      categoria: "Camiseta",
      referencia: `REF-${Math.floor(100 + Math.random() * 900)}`,
      precoVarejo: "",
      precoAtacado: "",
      descricao: "",
      fotoUrl: "",
      cores: "Preto, Branco",
      ativoNoCatalogo: true,
      destaque: false,
      gradeTamanhos: { P: 10, M: 20, G: 15, GG: 8 }
    });
    setModalProdutoAberto(true);
  };

  const handleAbrirModalEditar = (prod) => {
    setProdutoEditando(prod);
    setFormProduto({
      nome: prod.nome || "",
      categoria: prod.categoria || "Camiseta",
      referencia: prod.referencia || "",
      precoVarejo: prod.precoVarejo || "",
      precoAtacado: prod.precoAtacado || "",
      descricao: prod.descricao || "",
      fotoUrl: prod.fotoUrl || "",
      cores: Array.isArray(prod.cores) ? prod.cores.join(", ") : prod.cores || "Preto, Branco",
      ativoNoCatalogo: prod.ativoNoCatalogo !== false,
      destaque: Boolean(prod.destaque),
      gradeTamanhos: prod.gradeTamanhos || { P: 10, M: 20, G: 15, GG: 8 }
    });
    setModalProdutoAberto(true);
  };

  // 7. SALVAR MERCADORIA (CRIAÇÃO OU ATUALIZAÇÃO)
  const handleSalvarProduto = async (e) => {
    if (e) e.preventDefault();
    if (!formProduto.nome.trim()) {
      toast.error("Digite o nome da mercadoria");
      return;
    }
    if (!formProduto.precoVarejo || Number(formProduto.precoVarejo) <= 0) {
      toast.error("Informe um preço de varejo válido");
      return;
    }

    setSalvandoProduto(true);
    try {
      const coresArray = typeof formProduto.cores === "string"
        ? formProduto.cores.split(",").map((c) => c.trim()).filter(Boolean)
        : formProduto.cores;

      const payload = {
        ...formProduto,
        nome: formProduto.nome.trim(),
        referencia: formProduto.referencia.trim(),
        precoVarejo: Number(formProduto.precoVarejo) || 0,
        precoAtacado: Number(formProduto.precoAtacado) || Number(formProduto.precoVarejo) * 0.6,
        cores: coresArray.length > 0 ? coresArray : ["Padrão"],
        ativo: true,
        ativoNoCatalogo: formProduto.ativoNoCatalogo !== false,
        destaque: Boolean(formProduto.destaque),
        descricao: formProduto.descricao.trim(),
        fotoUrl:
          formProduto.fotoUrl.trim() ||
          "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=80"
      };

      const salvo = await saveCatalogProduct(tenantId, payload, produtoEditando?.id || null);

      // Atualiza lista em tela
      if (produtoEditando) {
        setProdutos((prev) => prev.map((p) => (p.id === produtoEditando.id ? { ...p, ...salvo } : p)));
        toast.success(`Mercadoria "${salvo.nome}" atualizada com sucesso!`);
      } else {
        setProdutos((prev) => [salvo, ...prev]);
        toast.success(`Nova mercadoria "${salvo.nome}" adicionada à vitrine!`);
      }

      setModalProdutoAberto(false);
    } catch (err) {
      console.error("[GerenciarCatalogo] Erro ao salvar produto:", err);
      toast.error("Erro ao salvar produto");
    } finally {
      setSalvandoProduto(false);
    }
  };

  // 8. EXCLUIR DEFINITIVAMENTE MERCADORIA
  const handleExcluirProduto = async (prod) => {
    const confirmar = window.confirm(
      `Deseja realmente excluir a mercadoria "${prod.nome}"? Se quiser apenas tirá-la da vitrine temporariamente, basta desmarcar o botão "Na Vitrine".`
    );
    if (!confirmar) return;

    try {
      const listaAtualizada = await removeProductFromCatalog(tenantId, prod.id, true);
      setProdutos(listaAtualizada);
      toast.success(`Mercadoria "${prod.nome}" excluída com sucesso.`);
    } catch (err) {
      toast.error("Erro ao excluir mercadoria");
    }
  };

  // 9. RESTAURAR CATÁLOGO DEMO DA LIFESURF
  const handleRestaurarPadrao = () => {
    const confirmar = window.confirm(
      "Deseja restaurar as 8 mercadorias padrão da coleção LifeSurf (com fotos e grades completas)? Suas edições atuais serão redefinidas para o modelo oficial."
    );
    if (!confirmar) return;

    const padrao = resetCatalogToDefault(tenantId);
    setProdutos(padrao);
    toast.success("Catálogo padrão LifeSurf restaurado com sucesso!");
  };

  // 10. FILTRAGEM DE MERCADORIAS
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((prod) => {
      // Filtro Categoria
      const matchCat = filtroCategoria === "TODAS" || prod.categoria === filtroCategoria;

      // Filtro Status
      let matchStatus = true;
      if (filtroStatus === "ATIVOS") matchStatus = prod.ativoNoCatalogo !== false;
      if (filtroStatus === "OCULTOS") matchStatus = prod.ativoNoCatalogo === false;
      if (filtroStatus === "DESTAQUES") matchStatus = Boolean(prod.destaque);

      // Filtro Texto
      const matchBusca =
        !busca.trim() ||
        prod.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        prod.referencia?.toLowerCase().includes(busca.toLowerCase()) ||
        prod.categoria?.toLowerCase().includes(busca.toLowerCase());

      return matchCat && matchStatus && matchBusca;
    });
  }, [produtos, filtroCategoria, filtroStatus, busca]);

  // Contadores
  const contadores = useMemo(() => {
    const total = produtos.length;
    const ativos = produtos.filter((p) => p.ativoNoCatalogo !== false).length;
    const ocultos = total - ativos;
    const destaques = produtos.filter((p) => Boolean(p.destaque)).length;
    return { total, ativos, ocultos, destaques };
  }, [produtos]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. TOPO DA TELA & LINK PÚBLICO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info" size="sm" withDot={true}>
              Vitrine & Catálogo Digital
            </Badge>
            <span className="text-xs text-slate-400">
              Loja: <strong className="text-white uppercase">{tenantId}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Globe className="w-7 h-7 text-sky-400" />
            Editar Catálogo & Vitrine Online
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Personalize o nome da sua loja, WhatsApp de pedidos, chave PIX e edite ou retire
            mercadorias para manter sua vitrine pública sempre sincronizada com o estoque.
          </p>
        </div>

        {/* Botões de Ação do Catálogo */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestaurarPadrao}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
            title="Restaura os produtos padrão de demonstração"
          >
            Restaurar Padrão
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopiarLink}
            leftIcon={linkCopiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
          >
            {linkCopiado ? "Link Copiado!" : "Copiar Link"}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleAbrirVitrine}
            leftIcon={<ExternalLink className="w-4 h-4" />}
          >
            Ver Vitrine Online
          </Button>
        </div>
      </div>

      {/* 2. CARD DE CONFIGURAÇÕES GERAIS DA VITRINE */}
      <Card variant="subtle" className="p-5 border-sky-500/20 shadow-lg">
        <form onSubmit={handleSalvarConfigLoja} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Identificação da Loja no Catálogo
                </h2>
                <p className="text-xs text-slate-400">
                  Estes dados aparecem no cabeçalho e rodapé do catálogo público visto pelo cliente.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={salvandoConfig}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Salvar Dados da Loja
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome da Loja na Vitrine *
              </label>
              <Input
                placeholder="Ex: LifeSurf Surfwear & Confecções"
                value={companyInfo.nome}
                onChange={(e) => setCompanyInfo({ ...companyInfo, nome: e.target.value })}
                leftIcon={<Store className="w-4 h-4" />}
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Nome de destaque exibido no topo do catálogo.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                WhatsApp para Receber Pedidos *
              </label>
              <Input
                placeholder="Ex: (85) 98888-7777 ou 85988887777"
                value={companyInfo.whatsapp}
                onChange={(e) => setCompanyInfo({ ...companyInfo, whatsapp: e.target.value })}
                leftIcon={<MessageCircle className="w-4 h-4 text-emerald-400" />}
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Os pedidos do carrinho abrem direto no WhatsApp deste número.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Chave PIX da Empresa (Cópia Fácil)
              </label>
              <Input
                placeholder="Ex: CNPJ, Telefone ou Chave Aleatória"
                value={companyInfo.chavePix}
                onChange={(e) => setCompanyInfo({ ...companyInfo, chavePix: e.target.value })}
                leftIcon={<QrCode className="w-4 h-4 text-teal-400" />}
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Cliente pode copiar a chave com 1 clique no fechamento.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Mensagem do Banner de Boas-Vindas
              </label>
              <textarea
                rows={2}
                placeholder="Mensagem destacada no banner inicial do catálogo..."
                value={companyInfo.mensagemCatalogo}
                onChange={(e) => setCompanyInfo({ ...companyInfo, mensagemCatalogo: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 text-xs text-white p-2.5 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Endereço de Retirada / Cidade
              </label>
              <Input
                placeholder="Ex: Av. Beira Mar, 2100 - Meireles, Fortaleza - CE"
                value={companyInfo.endereco}
                onChange={(e) => setCompanyInfo({ ...companyInfo, endereco: e.target.value })}
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Exibido na opção de "Retirar no Balcão" no checkout.
              </span>
            </div>
          </div>
        </form>
      </Card>

      {/* 3. CARDS DE MÉTRICAS DAS MERCADORIAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="subtle" className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-white">{contadores.total}</div>
            <div className="text-[11px] text-slate-400">Total de Mercadorias</div>
          </div>
        </Card>

        <Card variant="subtle" className="p-4 flex items-center gap-3 border-emerald-500/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-400">{contadores.ativos}</div>
            <div className="text-[11px] text-slate-400">Visíveis na Vitrine</div>
          </div>
        </Card>

        <Card variant="subtle" className="p-4 flex items-center gap-3 border-amber-500/20">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-amber-400">{contadores.ocultos}</div>
            <div className="text-[11px] text-slate-400">Retirados / Ocultos</div>
          </div>
        </Card>

        <Card variant="subtle" className="p-4 flex items-center gap-3 border-yellow-500/20">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-yellow-400">{contadores.destaques}</div>
            <div className="text-[11px] text-slate-400">Itens em Destaque</div>
          </div>
        </Card>
      </div>

      {/* 4. BARRA DE FILTROS & BOTÃO NOVA MERCADORIA */}
      <Card variant="subtle" className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar mercadoria por nome, referência..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="TODAS">Todas as Categorias</option>
              {CATEGORIAS_MODA.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVOS">Apenas Visíveis</option>
              <option value="OCULTOS">Apenas Retirados / Ocultos</option>
              <option value="DESTAQUES">Apenas Destaques ⭐</option>
            </Select>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleAbrirModalNovo}
          leftIcon={<Plus className="w-4 h-4" />}
          className="whitespace-nowrap"
        >
          Nova Mercadoria
        </Button>
      </Card>

      {/* 5. TABELA DE GESTÃO DAS MERCADORIAS */}
      <Card variant="subtle" className="overflow-hidden border-slate-800">
        <Table>
          <TableHeader>
            <TableRow isInteractive={false}>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>Mercadoria / Nome</TableHead>
              <TableHead>Categoria & Ref</TableHead>
              <TableHead>Preço Varejo</TableHead>
              <TableHead>Preço Atacado</TableHead>
              <TableHead className="text-center">Destaque</TableHead>
              <TableHead className="text-center">Visibilidade (Catálogo)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {produtosFiltrados.length === 0 ? (
              <TableEmpty
                colSpan={8}
                message={loading ? "Carregando catálogo..." : "Nenhuma mercadoria encontrada com os filtros selecionados."}
              />
            ) : (
              produtosFiltrados.map((prod) => {
                const isVisivel = prod.ativoNoCatalogo !== false;
                const isDestaque = Boolean(prod.destaque);

                return (
                  <TableRow key={prod.id} className={!isVisivel ? "opacity-60 bg-slate-950/40" : ""}>
                    {/* Foto */}
                    <TableCell>
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {prod.fotoUrl ? (
                          <img
                            src={prod.fotoUrl}
                            alt={prod.nome}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-600" />
                        )}
                      </div>
                    </TableCell>

                    {/* Nome & Cores */}
                    <TableCell>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{prod.nome}</span>
                        {isDestaque && (
                          <span title="Item em Destaque na Vitrine">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 inline" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-1">
                        {prod.descricao || "Sem descrição cadastrada"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Cores: {Array.isArray(prod.cores) ? prod.cores.join(", ") : prod.cores || "Padrão"}
                      </div>
                    </TableCell>

                    {/* Categoria & Ref */}
                    <TableCell>
                      <Badge variant="subtle" size="sm">
                        {prod.categoria || "Geral"}
                      </Badge>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        Ref: {prod.referencia || "S/Ref"}
                      </div>
                    </TableCell>

                    {/* Preço Varejo */}
                    <TableCell>
                      <div className="font-bold text-emerald-400 font-mono text-sm">
                        {formatCurrency(prod.precoVarejo)}
                      </div>
                      <div className="text-[10px] text-slate-500">Consumidor</div>
                    </TableCell>

                    {/* Preço Atacado */}
                    <TableCell>
                      <div className="font-bold text-amber-400 font-mono text-sm">
                        {formatCurrency(prod.precoAtacado)}
                      </div>
                      <div className="text-[10px] text-slate-500">Revendedor</div>
                    </TableCell>

                    {/* Toggle Destaque ⭐ */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleDestaque(prod)}
                        className={cn(
                          "p-1.5 rounded-lg border transition-all cursor-pointer inline-flex items-center justify-center",
                          isDestaque
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                            : "bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-700"
                        )}
                        title={isDestaque ? "Remover dos destaques" : "Marcar como destaque na vitrine"}
                      >
                        <Star className={cn("w-4 h-4", isDestaque && "fill-amber-400")} />
                      </button>
                    </TableCell>

                    {/* Visibilidade no Catálogo (RETIRAR / EXIBIR COM 1 CLIQUE) */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleVisibilidade(prod)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer mx-auto",
                          isVisivel
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-400 group"
                            : "bg-slate-800/80 border border-slate-700 text-slate-400 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-400"
                        )}
                        title={isVisivel ? "Clique para retirar esta mercadoria do catálogo" : "Clique para exibir na vitrine"}
                      >
                        {isVisivel ? (
                          <>
                            <Eye className="w-3.5 h-3.5 group-hover:hidden" />
                            <EyeOff className="w-3.5 h-3.5 hidden group-hover:inline text-rose-400" />
                            <span className="group-hover:hidden">Na Vitrine</span>
                            <span className="hidden group-hover:inline text-rose-400">Retirar</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                            <span>Retirado (Oculto)</span>
                          </>
                        )}
                      </button>
                    </TableCell>

                    {/* Ações (Editar / Excluir) */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAbrirModalEditar(prod)}
                          title="Editar nome, foto, preços e descrição"
                          className="h-8 px-2 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluirProduto(prod)}
                          title="Excluir mercadoria definitivamente"
                          className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* 6. MODAL DE CADASTRO / EDIÇÃO DE MERCADORIA */}
      <Modal isOpen={modalProdutoAberto} onClose={() => setModalProdutoAberto(false)} size="lg">
        <ModalHeader onClose={() => setModalProdutoAberto(false)}>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-sky-400" />
            <span>{produtoEditando ? "Editar Mercadoria do Catálogo" : "Nova Mercadoria na Vitrine"}</span>
          </div>
        </ModalHeader>

        <form onSubmit={handleSalvarProduto}>
          <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Nome da Mercadoria */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome da Mercadoria *
              </label>
              <Input
                placeholder="Ex: Camiseta Silk Waves Classic Algodão 30.1"
                value={formProduto.nome}
                onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })}
                required
              />
            </div>

            {/* Categoria & Referência */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Categoria *
                </label>
                <Select
                  value={formProduto.categoria}
                  onChange={(e) => setFormProduto({ ...formProduto, categoria: e.target.value })}
                >
                  {CATEGORIAS_MODA.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Código / Referência
                </label>
                <Input
                  placeholder="Ex: CAM-001"
                  value={formProduto.referencia}
                  onChange={(e) => setFormProduto({ ...formProduto, referencia: e.target.value })}
                />
              </div>
            </div>

            {/* Preço Varejo & Preço Atacado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Preço Varejo (Consumidor) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 89.90"
                  value={formProduto.precoVarejo}
                  onChange={(e) => setFormProduto({ ...formProduto, precoVarejo: e.target.value })}
                  leftIcon={<span className="text-xs font-mono font-bold text-slate-400">R$</span>}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Preço Atacado (Lojistas / Revendedores)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 48.00"
                  value={formProduto.precoAtacado}
                  onChange={(e) => setFormProduto({ ...formProduto, precoAtacado: e.target.value })}
                  leftIcon={<span className="text-xs font-mono font-bold text-slate-400">R$</span>}
                />
              </div>
            </div>

            {/* URL da Foto e Preview */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                URL da Foto do Produto
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="https://exemplo.com/foto-do-produto.jpg"
                    value={formProduto.fotoUrl}
                    onChange={(e) => setFormProduto({ ...formProduto, fotoUrl: e.target.value })}
                    leftIcon={<ImageIcon className="w-4 h-4 text-slate-500" />}
                  />
                </div>
                {formProduto.fotoUrl && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                    <img
                      src={formProduto.fotoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Insira o link direto de uma foto hospedada (Unsplash, Imgur ou Cloud Storage).
              </span>
            </div>

            {/* Cores Disponíveis */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Cores Disponíveis (separadas por vírgula)
              </label>
              <Input
                placeholder="Ex: Preto, Branco, Azul Marinho, Bordô"
                value={formProduto.cores}
                onChange={(e) => setFormProduto({ ...formProduto, cores: e.target.value })}
              />
            </div>

            {/* Descrição Detalhada da Peça */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Descrição & Detalhes da Peça
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Camiseta 100% algodão penteado fio 30.1 com estampa toque zero e caimento regular..."
                value={formProduto.descricao}
                onChange={(e) => setFormProduto({ ...formProduto, descricao: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 text-xs text-white p-2.5 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30 resize-none"
              />
            </div>

            {/* Switches de Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={formProduto.ativoNoCatalogo}
                  onChange={(e) => setFormProduto({ ...formProduto, ativoNoCatalogo: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-700 bg-slate-800"
                />
                <div>
                  <div className="text-xs font-bold text-white">Visível no Catálogo</div>
                  <div className="text-[11px] text-slate-400">Exibir esta peça para clientes na vitrine</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={formProduto.destaque}
                  onChange={(e) => setFormProduto({ ...formProduto, destaque: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-700 bg-slate-800"
                />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>Produto em Destaque</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="text-[11px] text-slate-400">Aparece com selo e destaque na vitrine</div>
                </div>
              </label>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setModalProdutoAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={salvandoProduto}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {produtoEditando ? "Salvar Alterações" : "Cadastrar Mercadoria"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
