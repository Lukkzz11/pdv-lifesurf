import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchStockProducts,
  saveProduct,
  deleteProduct,
  fetchStockMovements,
  deleteStockMovement,
  fetchPurchaseInvoices,
  deletePurchaseInvoice,
  CATEGORIAS_MODA,
  TAMANHOS_LETRAS,
  formatGradeString,
  calculateGradeTotal
} from "../services/stockService";
import { toggleProductCatalogVisibility } from "../services/catalogService";
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
import EntradaNfeModal from "../components/stock/EntradaNfeModal";
import AjusteEstoqueModal from "../components/stock/AjusteEstoqueModal";
import KardexMovimentacoes from "../components/stock/KardexMovimentacoes";
import NotasCompraLista from "../components/stock/NotasCompraLista";
import { formatCurrency } from "../utils/formatters";
import toast from "react-hot-toast";
import {
  Store,
  Plus,
  Search,
  Barcode,
  Edit2,
  Trash2,
  Layers,
  ArrowUpDown,
  Filter,
  FileText,
  AlertTriangle,
  History,
  Boxes,
  Globe,
  Eye,
  EyeOff,
  Star
} from "lucide-react";

export default function EstoqueLoja() {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const { activeTenantId } = useTenant();

  const [abaAtiva, setAbaAtiva] = useState("produtos"); // "produtos" | "kardex" | "notas"
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [notasCompra, setNotasCompra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");

  // Estados dos Modais ERP
  const [modalNfeAberto, setModalNfeAberto] = useState(false);
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);

  // Estados do Modal de Cadastro/Edição de Produto Avulso
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Formulário do Produto
  const [formData, setFormData] = useState({
    nome: "",
    categoria: "Camiseta",
    referencia: "",
    codigoBarras: "",
    precoVarejo: "",
    precoAtacado: "",
    cores: "Preto, Branco",
    ativoNoCatalogo: true,
    destaque: false,
    fotoUrl: "",
    descricao: "",
    gradeTamanhos: { P: 5, M: 10, G: 8, GG: 4 }
  });

  const carregarDadosEstoque = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const [prods, movs, nfs] = await Promise.all([
        fetchStockProducts(activeTenantId, "loja", 60),
        fetchStockMovements(activeTenantId, {}, 60),
        fetchPurchaseInvoices(activeTenantId, 25)
      ]);
      setProdutos(prods);
      setMovimentacoes(movs);
      setNotasCompra(nfs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosEstoque();
  }, [activeTenantId]);

  const abrirModalNovo = () => {
    setProdutoEditando(null);
    setFormData({
      nome: "",
      categoria: "Camiseta",
      referencia: "",
      codigoBarras: "",
      precoVarejo: "",
      precoAtacado: "",
      cores: "Preto, Branco",
      ativoNoCatalogo: true,
      destaque: false,
      fotoUrl: "",
      descricao: "",
      gradeTamanhos: { P: 5, M: 10, G: 8, GG: 4 }
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (prod) => {
    setProdutoEditando(prod);
    setFormData({
      nome: prod.nome || "",
      categoria: prod.categoria || "Camiseta",
      referencia: prod.referencia || "",
      codigoBarras: prod.codigoBarras || "",
      precoVarejo: prod.precoVarejo || "",
      precoAtacado: prod.precoAtacado || "",
      cores: Array.isArray(prod.cores) ? prod.cores.join(", ") : prod.cores || "",
      ativoNoCatalogo: prod.ativoNoCatalogo !== false,
      destaque: Boolean(prod.destaque),
      fotoUrl: prod.fotoUrl || "",
      descricao: prod.descricao || "",
      gradeTamanhos: prod.gradeTamanhos || {}
    });
    setModalAberto(true);
  };

  const handleToggleCatalogoEstoque = async (prod) => {
    const novoStatus = !(prod.ativoNoCatalogo !== false);
    try {
      await toggleProductCatalogVisibility(activeTenantId, prod.id, novoStatus);
      setProdutos((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, ativoNoCatalogo: novoStatus } : p))
      );
      if (novoStatus) {
        toast.success(`"${prod.nome}" visível na vitrine online!`);
      } else {
        toast(`"${prod.nome}" retirado da vitrine online.`, { icon: "👁️‍🗨️" });
      }
    } catch (err) {
      toast.error("Erro ao alterar visibilidade no catálogo");
    }
  };

  const handleSalvarProduto = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;

    setSalvando(true);
    try {
      const payload = {
        ...formData,
        precoVarejo: Number(formData.precoVarejo) || 0,
        precoAtacado: Number(formData.precoAtacado) || 0,
        cores:
          typeof formData.cores === "string"
            ? formData.cores.split(",").map((c) => c.trim()).filter(Boolean)
            : formData.cores,
        ativoNoCatalogo: formData.ativoNoCatalogo !== false,
        destaque: Boolean(formData.destaque),
        fotoUrl: formData.fotoUrl?.trim() || "",
        descricao: formData.descricao?.trim() || "",
        estoqueTotal: calculateGradeTotal(formData.gradeTamanhos)
      };

      await saveProduct(activeTenantId, "loja", payload, produtoEditando?.id);
      setModalAberto(false);
      await carregarDadosEstoque();
      toast.success("Produto salvo com sucesso!");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (confirm("Deseja realmente remover este produto do estoque da loja?")) {
      await deleteProduct(activeTenantId, "loja", id);
      await carregarDadosEstoque();
    }
  };

  const handleExcluirMovimento = async (movimentoId) => {
    if (confirm("Deseja realmente excluir este registro do Kardex de movimentação?")) {
      await deleteStockMovement(activeTenantId, movimentoId);
      setMovimentacoes((prev) => prev.filter((m) => m.id !== movimentoId));
      toast.success("Registro de movimentação removido com sucesso.");
    }
  };

  const handleExcluirNotaCompra = async (notaId) => {
    if (confirm("Deseja realmente excluir esta Nota Fiscal de Compra?")) {
      await deletePurchaseInvoice(activeTenantId, notaId);
      setNotasCompra((prev) => prev.filter((n) => n.id !== notaId));
      toast.success("Nota de compra removida com sucesso.");
    }
  };

  const alterarGradeItem = (tam, valor) => {
    const qtd = Math.max(0, parseInt(valor, 10) || 0);
    setFormData((prev) => ({
      ...prev,
      gradeTamanhos: {
        ...prev.gradeTamanhos,
        [tam]: qtd
      }
    }));
  };

  const produtosFiltrados = produtos.filter((p) => {
    const matchBusca =
      p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.referencia?.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigoBarras?.includes(busca);

    const matchCat = categoriaFiltro === "TODAS" || p.categoria === categoriaFiltro;
    return matchBusca && matchCat;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo da Tela com Ações de ERP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success" size="sm" withDot={true}>
              Pronto para Venda
            </Badge>
            <span className="text-xs text-slate-400">Balcão & Frente de Caixa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Estoque de Loja</h1>
          <p className="text-xs text-slate-400">
            Controle integrado estilo ERP com entradas por NF-e, baixas por avaria e rastreabilidade total no Kardex.
          </p>
        </div>

        {/* Botões de Ação Rápida ERP */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/gerenciar-catalogo")}
            leftIcon={<Globe className="w-4 h-4 text-sky-400" />}
          >
            Editar Catálogo
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalAjusteAberto(true)}
            leftIcon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          >
            Baixa por Avaria
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalNfeAberto(true)}
            leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
          >
            Entrada por NF-e
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={abrirModalNovo}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Navegação entre Abas ERP */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "produtos", label: "Produtos & Balcão", icon: Boxes, count: produtos.length },
          { id: "kardex", label: "Kardex de Movimentações", icon: History, count: movimentacoes.length },
          { id: "notas", label: "Notas Fiscais de Compra (NF-e)", icon: FileText, count: notasCompra.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isAtiva = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer border-b-2 ${
                isAtiva
                  ? "border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                isAtiva
                  ? "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ABA 1: PRODUTOS & BALCÃO */}
      {abaAtiva === "produtos" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <Card variant="subtle" className="p-4 flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome, referência ou código de barras..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            <div className="w-full md:w-56">
              <Select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                placeholder="Filtrar Categoria"
              >
                <option value="TODAS">Todas as Categorias</option>
                {CATEGORIAS_MODA.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </Card>


      {/* Tabela de Produtos da Loja */}
      <Table>
        <TableHeader>
          <TableRow isInteractive={false}>
            <TableHead>Produto & Referência</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Grade de Tamanhos</TableHead>
            <TableHead>Preço Varejo</TableHead>
            <TableHead>Preço Atacado</TableHead>
            <TableHead>Total Peças</TableHead>
            <TableHead className="text-center">Catálogo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {produtosFiltrados.map((prod) => (
            <TableRow key={prod.id}>
              <TableCell>
                <div className="font-semibold text-white">{prod.nome}</div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Ref: {prod.referencia || "S/Ref"}</span>
                  {prod.codigoBarras && (
                    <span className="flex items-center gap-1 font-mono text-[11px] text-sky-400">
                      <Barcode className="w-3 h-3" /> {prod.codigoBarras}
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <Badge variant="neutral" size="sm">{prod.categoria || "Geral"}</Badge>
              </TableCell>

              <TableCell>
                <span className="text-xs font-mono text-slate-300">
                  {formatGradeString(prod.gradeTamanhos)}
                </span>
              </TableCell>

              <TableCell>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(prod.precoVarejo)}
                </span>
              </TableCell>

              <TableCell>
                <span className="text-slate-300">
                  {formatCurrency(prod.precoAtacado)}
                </span>
              </TableCell>

              <TableCell>
                <Badge
                  variant={prod.estoqueTotal > 5 ? "success" : prod.estoqueTotal > 0 ? "warning" : "danger"}
                  size="sm"
                >
                  {prod.estoqueTotal || 0} un
                </Badge>
              </TableCell>

              <TableCell className="text-center">
                <button
                  type="button"
                  onClick={() => handleToggleCatalogoEstoque(prod)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                    prod.ativoNoCatalogo !== false
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30 group"
                      : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-500/15 hover:text-emerald-400"
                  }`}
                  title={
                    prod.ativoNoCatalogo !== false
                      ? "Na vitrine - Clique para retirar"
                      : "Retirado - Clique para exibir na vitrine"
                  }
                >
                  {prod.ativoNoCatalogo !== false ? (
                    <>
                      <Eye className="w-3.5 h-3.5 group-hover:hidden" />
                      <EyeOff className="w-3.5 h-3.5 hidden group-hover:inline text-rose-400" />
                      <span className="group-hover:hidden">Na Vitrine</span>
                      <span className="hidden group-hover:inline text-rose-400">Retirar</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      <span>Retirado</span>
                    </>
                  )}
                </button>
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => abrirModalEditar(prod)}
                    title="Editar Produto"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => handleExcluir(prod.id)}
                    className="hover:text-rose-400"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {produtosFiltrados.length === 0 && !loading && (
            <TableEmpty
              title="Nenhum produto em estoque"
              description="Cadastre novos produtos ou receba lotes transferidos da Fábrica."
              colSpan={7}
            />
          )}
        </TableBody>
      </Table>
        </div>
      )}

      {/* ABA 2: KARDEX DE MOVIMENTAÇÕES (RASTREAMENTO ERP) */}
      {abaAtiva === "kardex" && (
        <KardexMovimentacoes
          movimentacoes={movimentacoes}
          loading={loading}
          onDeleteMovimento={handleExcluirMovimento}
        />
      )}

      {/* ABA 3: NOTAS FISCAIS DE COMPRA (NF-E) */}
      {abaAtiva === "notas" && (
        <NotasCompraLista
          notas={notasCompra}
          onNovaNota={() => setModalNfeAberto(true)}
          onDeleteNota={handleExcluirNotaCompra}
        />
      )}

      {/* MODAL ERP: ENTRADA POR NF-E */}
      <EntradaNfeModal
        isOpen={modalNfeAberto}
        onClose={() => setModalNfeAberto(false)}
        tenantId={activeTenantId}
        produtosExistentes={produtos}
        userAuth={userProfile || user}
        onSuccess={carregarDadosEstoque}
      />

      {/* MODAL ERP: BAIXA POR AVARIA / AJUSTE */}
      <AjusteEstoqueModal
        isOpen={modalAjusteAberto}
        onClose={() => setModalAjusteAberto(false)}
        tenantId={activeTenantId}
        produtos={produtos}
        tipoEstoque="loja"
        userAuth={userProfile || user}
        onSuccess={carregarDadosEstoque}
      />

      {/* Modal de Cadastro / Edição com Grade de Variações de Moda */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} size="lg">
        <form onSubmit={handleSalvarProduto}>
          <ModalHeader
            title={produtoEditando ? "Editar Produto da Loja" : "Novo Produto para Balcão"}
            description="Cadastre informações de catálogo e distribua as quantidades na grade de tamanhos."
            onClose={() => setModalAberto(false)}
          />

          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nome do Produto"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Camiseta LifeSurf Classic Waves"
              />

              <Select
                label="Categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              >
                {CATEGORIAS_MODA.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input
                label="Referência"
                value={formData.referencia}
                onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                placeholder="Ex: LS-201"
              />

              <Input
                label="Código de Barras"
                value={formData.codigoBarras}
                onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                placeholder="789..."
              />

              <Input
                label="Preço Varejo (R$)"
                type="number"
                step="0.01"
                required
                value={formData.precoVarejo}
                onChange={(e) => setFormData({ ...formData, precoVarejo: e.target.value })}
                placeholder="89.90"
              />

              <Input
                label="Preço Atacado (R$)"
                type="number"
                step="0.01"
                value={formData.precoAtacado}
                onChange={(e) => setFormData({ ...formData, precoAtacado: e.target.value })}
                placeholder="59.90"
              />
            </div>

            <Input
              label="Cores Disponíveis (separadas por vírgula)"
              value={formData.cores}
              onChange={(e) => setFormData({ ...formData, cores: e.target.value })}
              placeholder="Preto, Branco, Azul Royal"
            />

            {/* Seletor Visual de Grade de Tamanhos de Confecção */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Grade de Tamanhos (Estoque Unitário)
                </span>
                <span className="text-xs text-sky-400 font-bold">
                  Total: {calculateGradeTotal(formData.gradeTamanhos)} peças
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {TAMANHOS_LETRAS.map((tam) => (
                  <div key={tam} className="flex flex-col items-center">
                    <label className="text-[11px] font-mono text-slate-400 mb-1">{tam}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.gradeTamanhos[tam] || ""}
                      onChange={(e) => alterarGradeItem(tam, e.target.value)}
                      placeholder="0"
                      className="w-full text-center h-8 bg-slate-900 border border-slate-700 rounded-md text-xs font-bold text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Opções de Publicação no Catálogo Online */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-400" />
                Configurações da Vitrine / Catálogo Online
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.ativoNoCatalogo !== false}
                    onChange={(e) => setFormData({ ...formData, ativoNoCatalogo: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-700 bg-slate-800"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">Exibir no Catálogo</div>
                    <div className="text-[10px] text-slate-400">Visível aos clientes na vitrine</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.destaque)}
                    onChange={(e) => setFormData({ ...formData, destaque: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-700 bg-slate-800"
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span>Destaque na Vitrine</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    </div>
                    <div className="text-[10px] text-slate-400">Selo dourado no topo</div>
                  </div>
                </label>
              </div>

              <Input
                label="URL da Foto do Produto (para a vitrine)"
                value={formData.fotoUrl || ""}
                onChange={(e) => setFormData({ ...formData, fotoUrl: e.target.value })}
                placeholder="https://exemplo.com/foto-do-produto.jpg"
              />
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvando}>
              Salvar no Estoque
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
