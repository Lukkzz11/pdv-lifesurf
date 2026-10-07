import { useState, useEffect } from "react";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import {
  STATUS_OP,
  STATUS_OP_CONFIG,
  TIPOS_MATERIA_PRIMA,
  fetchProductionOrders,
  createProductionOrder,
  updateProductionOrderStatus,
  deleteProductionOrder,
  fetchRawMaterials,
  saveRawMaterial,
  deleteRawMaterial,
  fetchProductionWaste,
  recordProductionWaste,
  deleteProductionWaste,
  transferFinishedGoodsToStore
} from "../services/productionService";
import {
  fetchStockMovements,
  deleteStockMovement,
  saveProduct,
  CATEGORIAS_MODA,
  TAMANHOS_LETRAS
} from "../services/stockService";
import toast from "react-hot-toast";
import KardexMovimentacoes from "../components/stock/KardexMovimentacoes";
import EntradaNfeModal from "../components/stock/EntradaNfeModal";
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
import { cn } from "../utils/cn";
import {
  Factory,
  Plus,
  Search,
  Scissors,
  Layers,
  Send,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Package,
  CheckCircle2,
  Trash2,
  Clock,
  Shirt,
  Percent,
  Check,
  RotateCcw,
  History,
  FileText
} from "lucide-react";

export default function EstoqueFabrica() {
  const { userProfile, user } = useAuth();
  const { activeTenantId } = useTenant();

  const [abaAtiva, setAbaAtiva] = useState("ops"); // "ops" | "materia_prima" | "perdas" | "kardex"
  const [loading, setLoading] = useState(true);

  // Estados dos Dados
  const [ordensProducao, setOrdensProducao] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [perdas, setPerdas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);

  // Modais
  const [modalNovaOpAberto, setModalNovaOpAberto] = useState(false);
  const [modalNovoMaterialAberto, setModalNovoMaterialAberto] = useState(false);
  const [modalNovaPerdaAberto, setModalNovaPerdaAberto] = useState(false);
  const [modalTransferirAberto, setModalTransferirAberto] = useState(false);
  const [modalNfeAberto, setModalNfeAberto] = useState(false);

  // Formulário Nova OP
  const [modeloOp, setModeloOp] = useState("");
  const [referenciaOp, setReferenciaOp] = useState("");
  const [categoriaOp, setCategoriaOp] = useState("Camiseta");
  const [previsaoOp, setPrevisaoOp] = useState("");
  const [tecidoOp, setTecidoOp] = useState("");
  const [responsavelOp, setResponsavelOp] = useState("");
  const [gradeOp, setGradeOp] = useState({ P: 20, M: 40, G: 40, GG: 20 });
  const [salvandoOp, setSalvandoOp] = useState(false);

  // Formulário Matéria-Prima
  const [nomeMaterial, setNomeMaterial] = useState("");
  const [tipoMaterial, setTipoMaterial] = useState("Tecido / Malha (Metros)");
  const [unidadeMaterial, setUnidadeMaterial] = useState("metros");
  const [estoqueAtualMaterial, setEstoqueAtualMaterial] = useState("");
  const [estoqueMinMaterial, setEstoqueMinMaterial] = useState("15");
  const [custoMaterial, setCustoMaterial] = useState("");
  const [fornecedorMaterial, setFornecedorMaterial] = useState("");
  const [salvandoMaterial, setSalvandoMaterial] = useState(false);

  // Formulário Perda
  const [opPerda, setOpPerda] = useState("Geral");
  const [motivoPerda, setMotivoPerda] = useState("falha_corte");
  const [materialPerda, setMaterialPerda] = useState("");
  const [qtdPerda, setQtdPerda] = useState("");
  const [custoPerda, setCustoPerda] = useState("");
  const [obsPerda, setObsPerda] = useState("");
  const [salvandoPerda, setSalvandoPerda] = useState(false);

  // Formulário Transferência para Loja
  const [opParaTransferir, setOpParaTransferir] = useState(null);
  const [gradeTransferir, setGradeTransferir] = useState({});
  const [transferindo, setTransferindo] = useState(false);

  // Formulário Novo Produto / Peça de Fábrica
  const [modalNovoProdutoFabricaAberto, setModalNovoProdutoFabricaAberto] = useState(false);
  const [novoProdNome, setNovoProdNome] = useState("");
  const [novoProdRef, setNovoProdRef] = useState("");
  const [novoProdCategoria, setNovoProdCategoria] = useState("Camiseta");
  const [novoProdTecido, setNovoProdTecido] = useState("");
  const [novoProdCusto, setNovoProdCusto] = useState("25.00");
  const [novoProdVarejo, setNovoProdVarejo] = useState("79.90");
  const [novoProdAtacado, setNovoProdAtacado] = useState("49.90");
  const [novoProdGrade, setNovoProdGrade] = useState({ PP: 0, P: 10, M: 20, G: 20, GG: 10, EXG: 0 });
  const [novoProdCriarOp, setNovoProdCriarOp] = useState(true);
  const [salvandoNovoProd, setSalvandoNovoProd] = useState(false);

  // Carregar dados
  const carregarDadosFabrica = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const [ops, mats, pds, movs] = await Promise.all([
        fetchProductionOrders(activeTenantId),
        fetchRawMaterials(activeTenantId),
        fetchProductionWaste(activeTenantId),
        fetchStockMovements(activeTenantId, {}, 50)
      ]);
      setOrdensProducao(ops);
      setMateriasPrimas(mats);
      setPerdas(pds);
      setMovimentacoes(movs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosFabrica();
  }, [activeTenantId]);

  // Ações de OP
  const handleAvancarEstagioOp = async (op) => {
    const estagios = [
      STATUS_OP.PLANEJAMENTO,
      STATUS_OP.CORTE,
      STATUS_OP.COSTURA,
      STATUS_OP.ESTAMPA,
      STATUS_OP.ACABAMENTO,
      STATUS_OP.CONCLUIDO
    ];
    const idx = estagios.indexOf(op.status);
    if (idx >= 0 && idx < estagios.length - 1) {
      const proximo = estagios[idx + 1];
      setOrdensProducao((prev) =>
        prev.map((o) => (o.id === op.id ? { ...o, status: proximo } : o))
      );
      await updateProductionOrderStatus(activeTenantId, op.id, proximo);
    }
  };

  const handleCriarOp = async (e) => {
    e.preventDefault();
    if (!modeloOp.trim()) return;

    setSalvandoOp(true);
    try {
      const nova = await createProductionOrder(activeTenantId, {
        modelo: modeloOp.trim(),
        referencia: referenciaOp.trim(),
        categoria: categoriaOp,
        previsaoTermino: previsaoOp,
        tecidoUtilizado: tecidoOp,
        responsavel: responsavelOp,
        gradePlanejada: gradeOp,
        custoEstimadoPeca: 24.50
      });

      setOrdensProducao((prev) => [nova, ...prev]);
      setModalNovaOpAberto(false);
      setModeloOp("");
      setReferenciaOp("");
      setPrevisaoOp("");
    } finally {
      setSalvandoOp(false);
    }
  };

  const handleSalvarMaterial = async (e) => {
    e.preventDefault();
    if (!nomeMaterial.trim()) return;

    setSalvandoMaterial(true);
    try {
      const novo = await saveRawMaterial(activeTenantId, {
        nome: nomeMaterial.trim(),
        tipo: tipoMaterial,
        unidade: unidadeMaterial,
        estoqueAtual: Number(estoqueAtualMaterial) || 0,
        estoqueMinimo: Number(estoqueMinMaterial) || 10,
        custoUnitario: Number(custoMaterial) || 0,
        fornecedor: fornecedorMaterial.trim()
      });

      setMateriasPrimas((prev) => [novo, ...prev]);
      setModalNovoMaterialAberto(false);
      setNomeMaterial("");
      setEstoqueAtualMaterial("");
      setCustoMaterial("");
    } finally {
      setSalvandoMaterial(false);
    }
  };

  const handleSalvarPerda = async (e) => {
    e.preventDefault();
    if (!qtdPerda) return;

    setSalvandoPerda(true);
    try {
      const nova = await recordProductionWaste(activeTenantId, {
        opCodigo: opPerda,
        motivo: motivoPerda,
        materialNome: materialPerda || "Tecido em Corte",
        quantidade: Number(qtdPerda),
        custoEstimadoPerda: Number(custoPerda) || 0,
        observacao: obsPerda
      });

      setPerdas((prev) => [nova, ...prev]);
      setModalNovaPerdaAberto(false);
      setQtdPerda("");
      setCustoPerda("");
      setObsPerda("");
    } finally {
      setSalvandoPerda(false);
    }
  };

  const abrirModalTransferencia = (op) => {
    setOpParaTransferir(op);
    setGradeTransferir(op.gradePlanejada || { P: 10, M: 20, G: 20, GG: 10 });
    setModalTransferirAberto(true);
  };

  const handleConfirmarTransferencia = async () => {
    if (!opParaTransferir) return;

    setTransferindo(true);
    try {
      await transferFinishedGoodsToStore(activeTenantId, {
        nome: opParaTransferir.modelo,
        referencia: opParaTransferir.referencia,
        categoria: opParaTransferir.categoria,
        gradeTransferir,
        precoVarejo: 89.90,
        precoAtacado: 59.90
      });

      // Atualiza OP para concluído
      await updateProductionOrderStatus(activeTenantId, opParaTransferir.id, STATUS_OP.CONCLUIDO);
      setOrdensProducao((prev) =>
        prev.map((o) => (o.id === opParaTransferir.id ? { ...o, status: STATUS_OP.CONCLUIDO } : o))
      );

      setModalTransferirAberto(false);
      alert("Lote transferido com sucesso para a loja! As peças já estão no balcão de vendas.");
    } finally {
      setTransferindo(false);
    }
  };

  // Exclusões com confirmação e feedback
  const handleExcluirOp = async (opId) => {
    if (confirm("Deseja realmente excluir esta Ordem de Produção?")) {
      await deleteProductionOrder(activeTenantId, opId);
      setOrdensProducao((prev) => prev.filter((o) => o.id !== opId));
      toast.success("Ordem de Produção excluída com sucesso.");
    }
  };

  const handleExcluirMaterial = async (materialId) => {
    if (confirm("Deseja realmente excluir esta matéria-prima?")) {
      await deleteRawMaterial(activeTenantId, materialId);
      setMateriasPrimas((prev) => prev.filter((m) => m.id !== materialId));
      toast.success("Matéria-prima excluída com sucesso.");
    }
  };

  const handleExcluirPerda = async (perdaId) => {
    if (confirm("Deseja realmente excluir este registro de perda?")) {
      await deleteProductionWaste(activeTenantId, perdaId);
      setPerdas((prev) => prev.filter((p) => p.id !== perdaId));
      toast.success("Registro de perda excluído com sucesso.");
    }
  };

  const handleExcluirMovimento = async (movimentoId) => {
    if (confirm("Deseja realmente excluir este registro do Kardex de produção?")) {
      await deleteStockMovement(activeTenantId, movimentoId);
      setMovimentacoes((prev) => prev.filter((m) => m.id !== movimentoId));
      toast.success("Movimentação de produção excluída com sucesso.");
    }
  };

  const handleSalvarNovoProdutoFabrica = async (e) => {
    e.preventDefault();
    if (!novoProdNome.trim()) {
      toast.error("Informe o nome do produto / modelo.");
      return;
    }
    setSalvandoNovoProd(true);
    try {
      const refFinal = novoProdRef.trim() || `REF-${Math.floor(100 + Math.random() * 900)}`;
      const custoNum = Number(novoProdCusto) || 0;
      const varejoNum = Number(novoProdVarejo) || custoNum * 2.5;
      const atacadoNum = Number(novoProdAtacado) || custoNum * 1.8;
      const totalPecas = Object.values(novoProdGrade).reduce((a, b) => a + (Number(b) || 0), 0);

      // 1. Salva no estoque da Fábrica
      await saveProduct(activeTenantId, "fabrica", {
        nome: novoProdNome.trim(),
        referencia: refFinal,
        categoria: novoProdCategoria,
        tecido: novoProdTecido.trim() || "Malha 100% Algodão",
        custoUnitario: custoNum,
        precoVarejo: varejoNum,
        precoAtacado: atacadoNum,
        gradeTamanhos: novoProdGrade,
        estoqueTotal: totalPecas,
        ativo: true
      });

      // 2. Se a opção criar OP estiver marcada, cria também uma Ordem de Produção pronta para o fluxo têxtil
      if (novoProdCriarOp) {
        const novaOp = await createProductionOrder(
          activeTenantId,
          {
            modelo: novoProdNome.trim(),
            referencia: refFinal,
            categoria: novoProdCategoria,
            dataPrevisao: new Date(Date.now() + 7 * 86400000).toLocaleDateString("pt-BR"),
            tecidoUtilizado: novoProdTecido.trim() || "Malha Algodão Penteado",
            responsavel: userProfile?.nome || "Chefe de Corte",
            gradePlanejada: novoProdGrade
          },
          userProfile || user
        );
        setOrdensProducao((prev) => [novaOp, ...prev]);
      }

      toast.success("Produto de fábrica cadastrado com sucesso!");
      setModalNovoProdutoFabricaAberto(false);
      setNovoProdNome("");
      setNovoProdRef("");
      setNovoProdTecido("");
      setNovoProdGrade({ PP: 0, P: 10, M: 20, G: 20, GG: 10, EXG: 0 });
      await carregarDadosFabrica();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar produto na fábrica.");
    } finally {
      setSalvandoNovoProd(false);
    }
  };

  // Métricas Gerenciais da Fábrica
  const opsEmAndamento = ordensProducao.filter((op) => op.status !== STATUS_OP.CONCLUIDO);
  const pecasEmConfeccao = opsEmAndamento.reduce(
    (acc, op) => acc + (op.grade ? Object.values(op.grade).reduce((s, v) => s + (Number(v) || 0), 0) : 0),
    0
  );
  const opsProntasTransferir = ordensProducao.filter(
    (op) => op.status === STATUS_OP.ACABAMENTO || op.status === STATUS_OP.CONCLUIDO
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho de Fábrica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning" size="sm" withDot={true}>
              Fábrica & Produção Ativa
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Confecção, matérias-primas e Ordens de Produção
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Gestão de Produção & Fábrica
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Acompanhe o corte, costura, estampas e envie lotes prontos direto para o estoque da loja.
          </p>
        </div>

        {/* Botão de Ação Primária dependendo da aba */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalNovoProdutoFabricaAberto(true)}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            Novo Produto / Peça de Fábrica
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalNfeAberto(true)}
            leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
          >
            Entrada por NF-e
          </Button>

          {abaAtiva === "ops" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalNovaOpAberto(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Nova OP
            </Button>
          )}
          {abaAtiva === "materia_prima" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalNovoMaterialAberto(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Cadastrar Matéria-Prima
            </Button>
          )}
          {abaAtiva === "perdas" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalNovaPerdaAberto(true)}
              leftIcon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            >
              Registrar Perda / Refugo
            </Button>
          )}
        </div>
      </div>

      {/* Navegação entre Abas da Fábrica */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "ops", label: "Ordens de Produção (OP)", icon: Layers, count: ordensProducao.length },
          { id: "materia_prima", label: "Estoque de Matéria-Prima", icon: Scissors, count: materiasPrimas.length },
          { id: "perdas", label: "Gestão de Perdas & Refugo", icon: Percent, count: perdas.length },
          { id: "kardex", label: "Kardex de Produção", icon: History, count: movimentacoes.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isAtiva = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer border-b-2",
                isAtiva
                  ? "border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/40"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                isAtiva
                  ? "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ABA 1: ORDENS DE PRODUÇÃO */}
      {abaAtiva === "ops" && (
        <div className="space-y-4">
          {/* Cards de Métricas e KPIs da Confecção */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="subtle" className="p-4 space-y-1.5 border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">OPs Ativas</span>
                <Layers className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                {opsEmAndamento.length}
              </div>
              <div className="text-[11px] text-slate-400">
                em corte, costura ou estampa
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-1.5 border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Peças em Produção</span>
                <Shirt className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-amber-400">
                {pecasEmConfeccao}
              </div>
              <div className="text-[11px] text-slate-400">
                peças sendo confeccionadas
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-1.5 border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Prontos p/ Loja</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400">
                {opsProntasTransferir}
              </div>
              <div className="text-[11px] text-slate-400">
                lotes em acabamento / concluídos
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-1.5 border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Matérias-Primas</span>
                <Scissors className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                {materiasPrimas.length}
              </div>
              <div className="text-[11px] text-slate-400">
                tecidos, aviamentos e linhas
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ordensProducao.map((op) => {
              const config = STATUS_OP_CONFIG[op.status] || STATUS_OP_CONFIG[STATUS_OP.PLANEJAMENTO];
              const estagios = [
                STATUS_OP.PLANEJAMENTO,
                STATUS_OP.CORTE,
                STATUS_OP.COSTURA,
                STATUS_OP.ESTAMPA,
                STATUS_OP.ACABAMENTO,
                STATUS_OP.CONCLUIDO
              ];
              const stepIndex = estagios.indexOf(op.status);
              const percentual = Math.round(((stepIndex + 1) / estagios.length) * 100);

              return (
                <Card
                  key={op.id}
                  className="p-4 flex flex-col justify-between space-y-4 border-slate-800 hover:border-slate-700 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-sky-400">
                        {op.codigoOP}
                      </span>
                      <Badge variant={config.badge} size="sm">
                        {config.label}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white">{op.modelo}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>Ref: {op.referencia || "CAM-001"}</span>
                        <span>•</span>
                        <span>{op.categoria}</span>
                      </div>
                    </div>

                    {/* Barra de Progresso do Lote */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Progresso da Produção:</span>
                        <span className="font-bold text-sky-400">{percentual}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: `${percentual}%` }}
                        />
                      </div>
                    </div>

                    {/* Grade Planejada de Peças */}
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Grade Planejada:</span>
                        <strong className="text-white">{op.totalPecasPlanejadas} peças</strong>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(op.gradePlanejada || {}).map(([tam, qtd]) => (
                          <span
                            key={tam}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300"
                          >
                            {tam}: <strong className="text-white">{qtd}</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    {op.tecidoUtilizado && (
                      <div className="text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Insumos: </span>
                        {op.tecidoUtilizado}
                      </div>
                    )}
                  </div>

                  {/* Ações da OP */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {op.status !== STATUS_OP.CONCLUIDO ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAvancarEstagioOp(op)}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Avançar Etapa
                        </Button>

                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => abrirModalTransferencia(op)}
                          leftIcon={<Send className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Transferir Loja
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Lote Transferido para Loja
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => handleExcluirOp(op.id)}
                      title="Excluir Ordem de Produção"
                      className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 2: ESTOQUE DE MATÉRIA-PRIMA */}
      {abaAtiva === "materia_prima" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow isInteractive={false}>
                <TableHead>Insumo / Matéria-Prima</TableHead>
                <TableHead>Categoria / Tipo</TableHead>
                <TableHead>Estoque Atual</TableHead>
                <TableHead>Estoque Mínimo</TableHead>
                <TableHead>Custo Unitário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasPrimas.map((mat) => {
                const emAlerta = mat.estoqueAtual <= mat.estoqueMinimo;
                return (
                  <TableRow key={mat.id}>
                    <TableCell>
                      <strong className="text-white block">{mat.nome}</strong>
                      <span className="text-[11px] text-slate-400">{mat.localizacao || "Galpão"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" size="sm">
                        {mat.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-white text-sm">
                      {mat.estoqueAtual} {mat.unidade}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">
                      {mat.estoqueMinimo} {mat.unidade}
                    </TableCell>
                    <TableCell className="font-mono text-emerald-400 font-semibold">
                      {formatCurrency(mat.custoUnitario || 0)}
                    </TableCell>
                    <TableCell>
                      {emAlerta ? (
                        <Badge variant="danger" size="sm" withDot={true}>
                          Repor Urgente
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm" withDot={true}>
                          Estoque Normal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {mat.fornecedor || "Não informado"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => handleExcluirMaterial(mat.id)}
                        title="Excluir Matéria-Prima"
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ABA 3: GESTÃO DE PERDAS & REFUGO */}
      {abaAtiva === "perdas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card variant="subtle" className="p-4 space-y-1">
              <span className="text-xs text-slate-400">Total de Perdas Registradas</span>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {perdas.length} ocorrências
              </div>
            </Card>
            <Card variant="subtle" className="p-4 space-y-1">
              <span className="text-xs text-slate-400">Custo Total de Refugo</span>
              <div className="text-2xl font-black text-white font-mono">
                {formatCurrency(
                  perdas.reduce((acc, p) => acc + (Number(p.custoEstimadoPerda) || 0), 0)
                )}
              </div>
            </Card>
            <Card variant="subtle" className="p-4 space-y-1">
              <span className="text-xs text-slate-400">Aproveitamento Médio de Tecido</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">94.8%</div>
            </Card>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow isInteractive={false}>
                  <TableHead>Data</TableHead>
                  <TableHead>Lote / OP</TableHead>
                  <TableHead>Motivo da Perda</TableHead>
                  <TableHead>Material Afetado</TableHead>
                  <TableHead>Qtd. Desperdiçada</TableHead>
                  <TableHead>Custo Estimado</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perdas.length === 0 ? (
                  <TableEmpty message="Nenhuma perda registrada. Ótimo aproveitamento!" />
                ) : (
                  perdas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-slate-400">{p.data}</TableCell>
                      <TableCell className="font-mono font-bold text-sky-400">
                        {p.opCodigo}
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning" size="sm" className="capitalize">
                          {p.motivo.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-200">{p.materialNome}</TableCell>
                      <TableCell className="font-mono font-bold text-rose-400">
                        {p.quantidade} {p.unidade || "kg/m"}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-white">
                        {formatCurrency(p.custoEstimadoPerda || 0)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {p.observacao || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleExcluirPerda(p.id)}
                          title="Excluir Registro de Perda"
                          className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ABA 4: KARDEX DE MOVIMENTAÇÕES DE FÁBRICA */}
      {abaAtiva === "kardex" && (
        <KardexMovimentacoes
          movimentacoes={movimentacoes}
          loading={loading}
          onDeleteMovimento={handleExcluirMovimento}
        />
      )}

      {/* MODAL: NOVA ORDEM DE PRODUÇÃO (OP) */}
      <Modal isOpen={modalNovaOpAberto} onClose={() => setModalNovaOpAberto(false)} size="lg">
        <form onSubmit={handleCriarOp}>
          <ModalHeader
            title="Abrir Nova Ordem de Produção (OP)"
            description="Defina o modelo, grade planejada de tamanhos e insumos para a confecção."
            onClose={() => setModalNovaOpAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Modelo da Peça"
                required
                placeholder="Ex: Camiseta Silk Waves Classic"
                value={modeloOp}
                onChange={(e) => setModeloOp(e.target.value)}
              />
              <Input
                label="Referência / Código"
                placeholder="CAM-001"
                value={referenciaOp}
                onChange={(e) => setReferenciaOp(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Categoria"
                value={categoriaOp}
                onChange={(e) => setCategoriaOp(e.target.value)}
                options={[
                  { value: "Camiseta", label: "Camiseta" },
                  { value: "Bermuda", label: "Bermuda" },
                  { value: "Short", label: "Short" },
                  { value: "Camisa Gola Polo", label: "Gola Polo" },
                  { value: "Acessórios", label: "Acessórios" }
                ]}
              />

              <Input
                label="Previsão de Término"
                type="date"
                value={previsaoOp}
                onChange={(e) => setPrevisaoOp(e.target.value)}
              />

              <Input
                label="Responsável pelo Lote"
                placeholder="Ex: Mestre Raimundo"
                value={responsavelOp}
                onChange={(e) => setResponsavelOp(e.target.value)}
              />
            </div>

            <Input
              label="Tecido / Matéria-Prima Utilizada"
              placeholder="Ex: Malha Algodão 30.1 Preto (40kg) + Linha Poliéster"
              value={tecidoOp}
              onChange={(e) => setTecidoOp(e.target.value)}
            />

            {/* Grade de Tamanhos Planejada */}
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
                Grade de Peças Planejadas:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {["PP", "P", "M", "G", "GG", "XG"].map((tam) => (
                  <div key={tam} className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-xs font-mono font-bold text-slate-400 block">{tam}</span>
                    <input
                      type="number"
                      min="0"
                      value={gradeOp[tam] || 0}
                      onChange={(e) =>
                        setGradeOp((prev) => ({ ...prev, [tam]: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="w-full bg-slate-900 text-white rounded mt-1 text-center font-bold text-sm h-8 border border-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalNovaOpAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvandoOp}>
              Gerar Ordem de Produção
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL: CADASTRAR MATÉRIA-PRIMA */}
      <Modal isOpen={modalNovoMaterialAberto} onClose={() => setModalNovoMaterialAberto(false)} size="md">
        <form onSubmit={handleSalvarMaterial}>
          <ModalHeader
            title="Cadastrar Matéria-Prima"
            description="Entrada de tecido, aviamento ou insumo de costura no estoque da fábrica."
            onClose={() => setModalNovoMaterialAberto(false)}
          />
          <ModalBody className="space-y-3">
            <Input
              label="Descrição do Insumo"
              required
              placeholder="Ex: Malha Algodão 30.1 Penteado Branco"
              value={nomeMaterial}
              onChange={(e) => setNomeMaterial(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo de Material"
                value={tipoMaterial}
                onChange={(e) => setTipoMaterial(e.target.value)}
                options={TIPOS_MATERIA_PRIMA.map((t) => ({ value: t, label: t }))}
              />
              <Input
                label="Unidade de Medida"
                placeholder="kg, metros, rolos..."
                value={unidadeMaterial}
                onChange={(e) => setUnidadeMaterial(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Estoque Atual"
                type="number"
                step="0.1"
                required
                value={estoqueAtualMaterial}
                onChange={(e) => setEstoqueAtualMaterial(e.target.value)}
              />
              <Input
                label="Estoque Mínimo (Alerta)"
                type="number"
                step="0.1"
                value={estoqueMinMaterial}
                onChange={(e) => setEstoqueMinMaterial(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Custo Unitário (R$)"
                type="number"
                step="0.01"
                placeholder="45.00"
                value={custoMaterial}
                onChange={(e) => setCustoMaterial(e.target.value)}
              />
              <Input
                label="Fornecedor"
                placeholder="Ex: Têxtil Brasil"
                value={fornecedorMaterial}
                onChange={(e) => setFornecedorMaterial(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalNovoMaterialAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvandoMaterial}>
              Salvar Matéria-Prima
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL: REGISTRAR PERDA / REFUGO */}
      <Modal isOpen={modalNovaPerdaAberto} onClose={() => setModalNovaPerdaAberto(false)} size="md">
        <form onSubmit={handleSalvarPerda}>
          <ModalHeader
            title="Registrar Perda / Refugo de Produção"
            description="Controle de sobras, defeitos de corte, estamparia ou tecido avariado."
            onClose={() => setModalNovaPerdaAberto(false)}
          />
          <ModalBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="OP de Origem"
                placeholder="Ex: OP-2026-084"
                value={opPerda}
                onChange={(e) => setOpPerda(e.target.value)}
              />
              <Select
                label="Motivo da Perda"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                options={[
                  { value: "falha_corte", label: "Falha de Corte" },
                  { value: "defeito_tecido", label: "Defeito de Fabricação no Tecido" },
                  { value: "erro_costura", label: "Erro Irrecuperável de Costura" },
                  { value: "falha_estampa", label: "Falha na Estamparia / Silk" },
                  { value: "sobra_rolo", label: "Sobra / Ponta de Rolo" }
                ]}
              />
            </div>

            <Input
              label="Material Perdido"
              placeholder="Ex: Malha Algodão Preto"
              value={materialPerda}
              onChange={(e) => setMaterialPerda(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantidade Desperdiçada"
                type="number"
                step="0.1"
                required
                placeholder="Ex: 3.5"
                value={qtdPerda}
                onChange={(e) => setQtdPerda(e.target.value)}
              />
              <Input
                label="Custo Estimado da Perda (R$)"
                type="number"
                step="0.01"
                placeholder="140.00"
                value={custoPerda}
                onChange={(e) => setCustoPerda(e.target.value)}
              />
            </div>

            <Input
              label="Observações da Ocorrência"
              placeholder="Ex: Lâmina da máquina travou no enfesto"
              value={obsPerda}
              onChange={(e) => setObsPerda(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalNovaPerdaAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvandoPerda}>
              Registrar Ocorrência
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL: TRANSFERÊNCIA ATÔMICA PARA A LOJA */}
      {opParaTransferir && (
        <Modal isOpen={modalTransferirAberto} onClose={() => setModalTransferirAberto(false)} size="md">
          <ModalHeader
            title="Transferir Peças Prontas para a Loja"
            description={`Lote ${opParaTransferir.codigoOP} • ${opParaTransferir.modelo}`}
            onClose={() => setModalTransferirAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-start gap-2.5">
              <Send className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-bold">Transferência Atômica</strong>
                As peças abaixo serão debitadas da produção e ficarão imediatamente disponíveis no
                PDV e Estoque da Loja.
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
                Conferência da Grade para Envio ao Balcão:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(gradeTransferir).map(([tam, qtd]) => (
                  <div key={tam} className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-xs font-mono font-bold text-slate-400 block">{tam}</span>
                    <input
                      type="number"
                      min="0"
                      value={qtd}
                      onChange={(e) =>
                        setGradeTransferir((prev) => ({
                          ...prev,
                          [tam]: parseInt(e.target.value, 10) || 0
                        }))
                      }
                      className="w-full bg-slate-900 text-white rounded mt-1 text-center font-bold text-sm h-8 border border-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModalTransferirAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="success"
              onClick={handleConfirmarTransferencia}
              isLoading={transferindo}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Confirmar Envio para a Loja
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* MODAL ERP: ENTRADA POR NF-E PARA A FÁBRICA */}
      <EntradaNfeModal
        isOpen={modalNfeAberto}
        onClose={() => setModalNfeAberto(false)}
        tenantId={activeTenantId}
        produtosExistentes={materiasPrimas}
        userAuth={userProfile || user}
        onSuccess={carregarDadosFabrica}
      />

      {/* MODAL NOVO PRODUTO / PEÇA DE FÁBRICA */}
      <Modal
        isOpen={modalNovoProdutoFabricaAberto}
        onClose={() => setModalNovoProdutoFabricaAberto(false)}
        size="lg"
      >
        <form onSubmit={handleSalvarNovoProdutoFabrica}>
          <ModalHeader
            title="Novo Produto / Peça de Fábrica"
            description="Cadastre um novo modelo têxtil para confecção e controle de grade de tamanhos."
            onClose={() => setModalNovoProdutoFabricaAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome do Produto / Modelo"
                required
                autoFocus
                placeholder="Ex: Camiseta Oversized Streetwear LifeSurf"
                value={novoProdNome}
                onChange={(e) => setNovoProdNome(e.target.value)}
              />
              <Input
                label="Referência / Código"
                placeholder="Ex: LF-805 (deixe vazio p/ auto)"
                value={novoProdRef}
                onChange={(e) => setNovoProdRef(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Categoria do Vestuário"
                value={novoProdCategoria}
                onChange={(e) => setNovoProdCategoria(e.target.value)}
              >
                {CATEGORIAS_MODA.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input
                label="Tecido / Composição Principal"
                placeholder="Ex: Algodão 30.1 Penteado, Tactel, Piquet"
                value={novoProdTecido}
                onChange={(e) => setNovoProdTecido(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Custo Fabril (R$)"
                type="number"
                step="0.01"
                min="0"
                placeholder="25.00"
                value={novoProdCusto}
                onChange={(e) => setNovoProdCusto(e.target.value)}
              />
              <Input
                label="Preço Atacado (R$)"
                type="number"
                step="0.01"
                min="0"
                placeholder="49.90"
                value={novoProdAtacado}
                onChange={(e) => setNovoProdAtacado(e.target.value)}
              />
              <Input
                label="Preço Varejo (R$)"
                type="number"
                step="0.01"
                min="0"
                placeholder="79.90"
                value={novoProdVarejo}
                onChange={(e) => setNovoProdVarejo(e.target.value)}
              />
            </div>

            {/* Grade de Tamanhos */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Grade Inicial de Confecção (Peças)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  Total: {Object.values(novoProdGrade).reduce((a, b) => a + (Number(b) || 0), 0)} peças
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(novoProdGrade).map(([tam, qtd]) => (
                  <div key={tam} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <span className="text-xs font-mono font-bold text-slate-400 block">{tam}</span>
                    <input
                      type="number"
                      min="0"
                      value={qtd}
                      onChange={(e) =>
                        setNovoProdGrade((prev) => ({
                          ...prev,
                          [tam]: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="w-full bg-slate-950 text-white rounded mt-1 text-center font-bold text-sm h-8 border border-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={novoProdCriarOp}
                onChange={(e) => setNovoProdCriarOp(e.target.checked)}
                className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500"
              />
              <span className="text-xs text-slate-300">
                Criar automaticamente uma Ordem de Produção (OP) em <strong>Planejamento</strong> para esta nova peça
              </span>
            </label>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setModalNovoProdutoFabricaAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={salvandoNovoProd}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Cadastrar Peça de Fábrica
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
