import { useState, useEffect } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchStockProducts,
  saveProduct,
  deleteProduct,
  CATEGORIAS_MODA,
  TAMANHOS_LETRAS,
  formatGradeString,
  calculateGradeTotal
} from "../services/stockService";
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
import { formatCurrency } from "../utils/formatters";
import {
  Store,
  Plus,
  Search,
  Barcode,
  Edit2,
  Trash2,
  Layers,
  ArrowUpDown,
  Filter
} from "lucide-react";

export default function EstoqueLoja() {
  const { activeTenantId } = useTenant();

  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");

  // Estados do Modal de Cadastro/Edição
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
    gradeTamanhos: { P: 5, M: 10, G: 8, GG: 4 }
  });

  const carregarProdutos = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const data = await fetchStockProducts(activeTenantId, "loja", 50);
      setProdutos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
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
      gradeTamanhos: prod.gradeTamanhos || {}
    });
    setModalAberto(true);
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
        cores: formData.cores.split(",").map((c) => c.trim()).filter(Boolean),
        estoqueTotal: calculateGradeTotal(formData.gradeTamanhos)
      };

      await saveProduct(activeTenantId, "loja", payload, produtoEditando?.id);
      setModalAberto(false);
      await carregarProdutos();
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (confirm("Deseja realmente remover este produto do estoque da loja?")) {
      await deleteProduct(activeTenantId, "loja", id);
      await carregarProdutos();
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
    <div className="space-y-6">
      {/* Topo da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success" size="sm" withDot={true}>
              Pronto para Venda
            </Badge>
            <span className="text-xs text-slate-400">Balcão & Frente de Caixa</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Estoque de Loja</h1>
          <p className="text-xs text-slate-400">
            Controle de produtos e grades de tamanhos disponíveis para faturamento imediato.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={abrirModalNovo}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Novo Produto de Loja
        </Button>
      </div>

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
