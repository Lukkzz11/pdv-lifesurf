import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchFinancialReports,
  generateDrePDF
} from "../services/reportsService";
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
import toast from "react-hot-toast";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
  CreditCard,
  QrCode,
  Clock,
  Sparkles,
  Trash2,
  Edit2,
  Plus,
  Sliders,
  AlertTriangle,
  Receipt,
  Minus
} from "lucide-react";

export default function Relatorios() {
  const { activeTenantId } = useTenant();

  const [abaAtiva, setAbaAtiva] = useState("dre"); // "dre" | "cheques" | "ajustes"
  const [periodo, setPeriodo] = useState("mes"); // "hoje" | "semana" | "mes"
  const [dadosBase, setDadosBase] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. CONFIGURAÇÃO DE MARGEM & CMV EDITÁVEIS
  const [cmvPercentual, setCmvPercentual] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_dre_cmv_${activeTenantId || "default"}`);
      if (saved) return Number(saved) || 40;
    } catch {}
    return 40;
  });

  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [novoCmvInput, setNovoCmvInput] = useState(String(cmvPercentual));

  // 2. GESTÃO DE CHEQUES (Adicionar, Editar e Excluir)
  const [cheques, setCheques] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_cheques_${activeTenantId || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "chk-1",
        numero: "000421",
        banco: "Bradesco (237)",
        emitente: "Confecções Silva & Pontes ME",
        bomPara: "20/10/2026",
        valor: 2450.00,
        status: "a_compensar",
        observacao: "Pedido atacado #1042"
      },
      {
        id: "chk-2",
        numero: "001892",
        banco: "Itaú (341)",
        emitente: "Marcos Vinicius Santos",
        bomPara: "15/10/2026",
        valor: 1200.00,
        status: "a_compensar",
        observacao: "Parcela 2/3 surfwear"
      },
      {
        id: "chk-3",
        numero: "009104",
        banco: "Banco do Brasil (001)",
        emitente: "Surf & Beach Club Fortaleza",
        bomPara: "01/10/2026",
        valor: 3800.00,
        status: "compensado",
        observacao: "Lote bermudas tactel"
      }
    ];
  });

  const [modalChequeAberto, setModalChequeAberto] = useState(false);
  const [chequeEditando, setChequeEditando] = useState(null);
  const [formCheque, setFormCheque] = useState({
    numero: "",
    banco: "Banco do Brasil",
    emitente: "",
    bomPara: "",
    valor: "",
    status: "a_compensar",
    observacao: ""
  });

  // 3. LANÇAMENTOS AVULSOS / AJUSTES MANUAIS (Para aumentar ou deduzir valores no DRE)
  const [ajustes, setAjustes] = useState(() => {
    try {
      const saved = localStorage.getItem(`lifesurf_ajustes_dre_${activeTenantId || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "aju-1",
        tipo: "acrescimo",
        descricao: "Receita de Frete / Entrega Fortaleza",
        valor: 350.00,
        data: "03/10/2026"
      },
      {
        id: "aju-2",
        tipo: "deducao",
        descricao: "Despesa com Embalagens e Sacolas Personalizadas",
        valor: 280.00,
        data: "02/10/2026"
      }
    ];
  });

  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [ajusteEditando, setAjusteEditando] = useState(null);
  const [formAjuste, setFormAjuste] = useState({
    tipo: "acrescimo",
    descricao: "",
    valor: "",
    data: new Date().toLocaleDateString("pt-BR")
  });

  // Salva cheques no localStorage sempre que alterados
  useEffect(() => {
    try {
      localStorage.setItem(`lifesurf_cheques_${activeTenantId || "default"}`, JSON.stringify(cheques));
    } catch {}
  }, [cheques, activeTenantId]);

  // Salva ajustes no localStorage sempre que alterados
  useEffect(() => {
    try {
      localStorage.setItem(`lifesurf_ajustes_dre_${activeTenantId || "default"}`, JSON.stringify(ajustes));
    } catch {}
  }, [ajustes, activeTenantId]);

  // Carrega relatórios do backend
  useEffect(() => {
    async function carregarRelatorios() {
      setLoading(true);
      try {
        const res = await fetchFinancialReports(activeTenantId, periodo);
        setDadosBase(res);
      } finally {
        setLoading(false);
      }
    }
    carregarRelatorios();
  }, [activeTenantId, periodo]);

  // Cálculos consolidados em tempo real com Margem editável e Ajustes
  const dados = useMemo(() => {
    if (!dadosBase) return null;

    const totalAcrescimos = ajustes
      .filter((a) => a.tipo === "acrescimo")
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    const totalDeducoesExtras = ajustes
      .filter((a) => a.tipo === "deducao")
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    const faturamentoBrutoAjustado = Number(dadosBase.faturamentoBruto || 0) + totalAcrescimos;
    const descontosTotal = Number(dadosBase.descontos || 0) + totalDeducoesExtras;
    const faturamentoLiquido = Math.max(0, faturamentoBrutoAjustado - descontosTotal);

    // CMV customizável
    const taxaCmv = (Number(cmvPercentual) || 40) / 100;
    const custoMercadorias = faturamentoLiquido * taxaCmv;
    const lucroBruto = Math.max(0, faturamentoLiquido - custoMercadorias);
    const margemLucroPercentual = faturamentoLiquido > 0 ? (lucroBruto / faturamentoLiquido) * 100 : 0;

    return {
      ...dadosBase,
      faturamentoBruto: faturamentoBrutoAjustado,
      descontos: descontosTotal,
      faturamentoLiquido,
      custoMercadorias,
      lucroBruto,
      margemLucroPercentual,
      totalAcrescimos,
      totalDeducoesExtras
    };
  }, [dadosBase, cmvPercentual, ajustes]);

  // Totalizadores de Cheques
  const totalChequesACompensar = useMemo(() => {
    return cheques
      .filter((c) => c.status === "a_compensar")
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }, [cheques]);

  const totalChequesCompensados = useMemo(() => {
    return cheques
      .filter((c) => c.status === "compensado")
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  }, [cheques]);

  // Funções de Gestão de Margem e Parâmetros
  const handleSalvarConfigMargem = (e) => {
    e.preventDefault();
    const novoCmv = Math.min(99, Math.max(1, Number(novoCmvInput) || 40));
    setCmvPercentual(novoCmv);
    try {
      localStorage.setItem(`lifesurf_dre_cmv_${activeTenantId || "default"}`, String(novoCmv));
    } catch {}
    setModalConfigAberto(false);
    toast.success(`Margem e CMV atualizados para ${novoCmv}%!`);
  };

  // Funções de Gestão de Cheques
  const abrirModalNovoCheque = () => {
    setChequeEditando(null);
    setFormCheque({
      numero: "",
      banco: "Banco do Brasil",
      emitente: "",
      bomPara: new Date(Date.now() + 15 * 86400000).toLocaleDateString("pt-BR"),
      valor: "",
      status: "a_compensar",
      observacao: ""
    });
    setModalChequeAberto(true);
  };

  const abrirModalEditarCheque = (chq) => {
    setChequeEditando(chq);
    setFormCheque({
      numero: chq.numero || "",
      banco: chq.banco || "",
      emitente: chq.emitente || "",
      bomPara: chq.bomPara || "",
      valor: String(chq.valor || ""),
      status: chq.status || "a_compensar",
      observacao: chq.observacao || ""
    });
    setModalChequeAberto(true);
  };

  const handleSalvarCheque = (e) => {
    e.preventDefault();
    const valNum = Number(formCheque.valor) || 0;
    if (valNum <= 0) {
      toast.error("Informe um valor válido para o cheque.");
      return;
    }

    if (chequeEditando) {
      setCheques((prev) =>
        prev.map((c) =>
          c.id === chequeEditando.id
            ? { ...c, ...formCheque, valor: valNum }
            : c
        )
      );
      toast.success("Cheque atualizado com sucesso!");
    } else {
      const novo = {
        id: `chk-${Date.now()}`,
        ...formCheque,
        valor: valNum
      };
      setCheques((prev) => [novo, ...prev]);
      toast.success("Cheque adicionado com sucesso!");
    }

    setModalChequeAberto(false);
  };

  const handleExcluirCheque = (id) => {
    if (confirm("Deseja realmente excluir este cheque do relatório financeiro?")) {
      setCheques((prev) => prev.filter((c) => c.id !== id));
      toast.success("Cheque excluído com sucesso.");
    }
  };

  // Funções de Gestão de Ajustes / Lançamentos Avulsos
  const abrirModalNovoAjuste = (tipo = "acrescimo") => {
    setAjusteEditando(null);
    setFormAjuste({
      tipo,
      descricao: "",
      valor: "",
      data: new Date().toLocaleDateString("pt-BR")
    });
    setModalAjusteAberto(true);
  };

  const abrirModalEditarAjuste = (ajuste) => {
    setAjusteEditando(ajuste);
    setFormAjuste({
      tipo: ajuste.tipo,
      descricao: ajuste.descricao,
      valor: String(ajuste.valor || ""),
      data: ajuste.data || new Date().toLocaleDateString("pt-BR")
    });
    setModalAjusteAberto(true);
  };

  const handleSalvarAjuste = (e) => {
    e.preventDefault();
    const valNum = Number(formAjuste.valor) || 0;
    if (valNum <= 0) {
      toast.error("Informe um valor válido para o ajuste.");
      return;
    }

    if (ajusteEditando) {
      setAjustes((prev) =>
        prev.map((a) =>
          a.id === ajusteEditando.id
            ? { ...a, ...formAjuste, valor: valNum }
            : a
        )
      );
      toast.success("Lançamento ajustado com sucesso!");
    } else {
      const novo = {
        id: `aju-${Date.now()}`,
        ...formAjuste,
        valor: valNum
      };
      setAjustes((prev) => [novo, ...prev]);
      toast.success(
        formAjuste.tipo === "acrescimo"
          ? "Acréscimo somado ao DRE com sucesso!"
          : "Dedução aplicada ao DRE com sucesso!"
      );
    }

    setModalAjusteAberto(false);
  };

  const handleExcluirAjuste = (id) => {
    if (confirm("Deseja realmente remover este lançamento avulso do relatório?")) {
      setAjustes((prev) => prev.filter((a) => a.id !== id));
      toast.success("Lançamento avulso removido.");
    }
  };

  const handleExportarPDF = () => {
    if (!dados) return;
    generateDrePDF(
      dados,
      {
        nome: "LIFESURF CONFECÇÕES & SURFWEAR",
        cidade: "Fortaleza - CE"
      },
      periodo === "hoje" ? "Diário" : periodo === "semana" ? "Semanal" : "Mensal"
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success" size="sm" withDot={true}>
              DRE Gerencial & Controladoria
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Personalizável: edite margens, cheques, acréscimos e deduções
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Relatórios Financeiros & DRE
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Faturamento líquido, controle de margens ({cmvPercentual}% CMV), cheques a compensar e lançamentos manuais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Período */}
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl flex items-center gap-1">
            {[
              { id: "hoje", label: "Hoje" },
              { id: "semana", label: "7 Dias" },
              { id: "mes", label: "Este Mês" }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  periodo === p.id
                    ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalConfigAberto(true)}
            leftIcon={<Sliders className="w-4 h-4 text-sky-400" />}
          >
            Editar Margem / CMV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportarPDF}
            leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
          >
            Exportar DRE em PDF
          </Button>
        </div>
      </div>

      {/* Navegação por Abas: DRE, Cheques, Lançamentos Avulsos */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "dre", label: "Demonstração DRE & Faturamento", icon: BarChart3 },
          { id: "cheques", label: `Cheques & Recebíveis (${cheques.length})`, icon: Receipt },
          { id: "ajustes", label: `Ajustes & Lançamentos Avulsos (${ajustes.length})`, icon: DollarSign }
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
            </button>
          );
        })}
      </div>

      {loading || !dados ? (
        <div className="text-center py-20 space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Consolidando DRE operacional...</p>
        </div>
      ) : (
        <>
          {/* 4 Cards de KPI Superior */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Faturamento Líquido</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatCurrency(dados.faturamentoLiquido)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Bruto:</span>
                <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(dados.faturamentoBruto)}</strong>
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Lucro Bruto (Margem)</span>
                <Percent className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-sky-500 dark:text-sky-400 font-mono">
                {formatCurrency(dados.lucroBruto)}
              </div>
              <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{dados.margemLucroPercentual.toFixed(1)}% de margem (CMV {cmvPercentual}%)</span>
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Cheques a Compensar</span>
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-500 dark:text-amber-400 font-mono">
                {formatCurrency(totalChequesACompensar)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Compensados: {formatCurrency(totalChequesCompensados)}
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Ajustes / Avulsos</span>
                <Sliders className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-500 dark:text-purple-400 font-mono">
                +{formatCurrency(dados.totalAcrescimos)}
              </div>
              <div className="text-[11px] text-rose-500 font-mono">
                Deduções extras: -{formatCurrency(dados.totalDeducoesExtras)}
              </div>
            </Card>
          </div>

          {/* ABA 1: DRE & FATURAMENTO */}
          {abaAtiva === "dre" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Estrutura do DRE Gerencial */}
              <div className="lg:col-span-7">
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Demonstração do Resultado do Exercício (DRE)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Cálculo integrado com margem configurável ({cmvPercentual}% CMV) e acréscimos.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModalConfigAberto(true)}
                      className="text-xs"
                      leftIcon={<Sliders className="w-3.5 h-3.5" />}
                    >
                      Alterar CMV ({cmvPercentual}%)
                    </Button>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Receita Bruta */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-slate-900 dark:text-white">1. Receita Operacional Bruta</span>
                      <strong className="text-slate-900 dark:text-white font-mono text-sm">
                        {formatCurrency(dados.faturamentoBruto)}
                      </strong>
                    </div>

                    {/* Deduções */}
                    <div className="flex items-center justify-between px-3 text-rose-500">
                      <span>(-) Deduções / Descontos / Ajustes Avulsos</span>
                      <span className="font-mono font-bold">- {formatCurrency(dados.descontos)}</span>
                    </div>

                    {/* Receita Líquida */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">
                      <span>(=) 2. Receita Operacional Líquida</span>
                      <span className="font-mono text-sm">{formatCurrency(dados.faturamentoLiquido)}</span>
                    </div>

                    {/* CMV */}
                    <div className="flex items-center justify-between px-3 text-amber-500">
                      <div>
                        <span>(-) Custo das Mercadorias Vendidas (CMV)</span>
                        <span className="text-[10px] text-slate-400 block">
                          Base de cálculo: {cmvPercentual}% configurado
                        </span>
                      </div>
                      <span className="font-mono font-bold">- {formatCurrency(dados.custoMercadorias)}</span>
                    </div>

                    {/* Lucro Bruto */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                      <span>(=) 3. Lucro Bruto / Margem de Contribuição</span>
                      <span className="font-mono text-base">{formatCurrency(dados.lucroBruto)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Divisão por Formas de Pagamento */}
              <div className="lg:col-span-5">
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Formas de Pagamento</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Distribuição financeira das entradas.</p>
                    </div>
                    <PieChart className="w-5 h-5 text-sky-500" />
                  </div>

                  <div className="space-y-4">
                    {Object.entries(dados.formasPagamento || {}).map(([key, item]) => {
                      const labels = {
                        pix: { nome: "PIX", color: "bg-sky-500" },
                        cartao_credito: { nome: "Cartão de Crédito", color: "bg-purple-500" },
                        dinheiro: { nome: "Dinheiro em Espécie", color: "bg-emerald-500" },
                        cartao_debito: { nome: "Cartão de Débito", color: "bg-indigo-500" },
                        a_ver: { nome: "A Ver / Fiado", color: "bg-amber-500" }
                      };
                      const config = labels[key] || { nome: key, color: "bg-slate-500" };

                      return (
                        <div key={key} className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{config.nome}</span>
                            <div className="flex items-center gap-2">
                              <strong className="text-slate-900 dark:text-white font-mono">{formatCurrency(item.total)}</strong>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                ({item.percentual.toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-300", config.color)}
                              style={{ width: `${Math.min(100, Math.max(0, item.percentual))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ABA 2: GESTÃO DE CHEQUES & TÍTULOS */}
          {abaAtiva === "cheques" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cheques & Recebíveis Futuros
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cadastre, edite valores e gerencie compensações de cheques recebidos no atacado e varejo.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={abrirModalNovoCheque}
                  leftIcon={<Plus className="w-4 h-4" />}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Adicionar Cheque
                </Button>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow isInteractive={false}>
                      <TableHead>Nº Cheque</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Emitente / Cliente</TableHead>
                      <TableHead>Bom Para (Venc.)</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cheques.length === 0 ? (
                      <TableEmpty message="Nenhum cheque cadastrado no momento." />
                    ) : (
                      cheques.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono font-bold text-sky-500 dark:text-sky-400">
                            #{c.numero}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                            {c.banco}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-slate-900 dark:text-white text-xs">
                              {c.emitente}
                            </div>
                            {c.observacao && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                "{c.observacao}"
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                            {c.bomPara}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(c.valor)}
                          </TableCell>
                          <TableCell>
                            {c.status === "compensado" ? (
                              <Badge variant="success" size="sm" withDot={true}>
                                Compensado
                              </Badge>
                            ) : c.status === "devolvido" ? (
                              <Badge variant="danger" size="sm" withDot={true}>
                                Devolvido
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm" withDot={true}>
                                A Compensar
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => abrirModalEditarCheque(c)}
                                title="Editar Cheque"
                                className="cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4 text-sky-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => handleExcluirCheque(c.id)}
                                title="Excluir Cheque"
                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ABA 3: LANÇAMENTOS AVULSOS / AJUSTES MANUAIS */}
          {abaAtiva === "ajustes" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ajustes & Lançamentos Avulsos no DRE
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adicione receitas avulsas para aumentar o faturamento ou deduções para ajustar o balanço comercial.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirModalNovoAjuste("deducao")}
                    leftIcon={<Minus className="w-3.5 h-3.5 text-rose-500" />}
                    className="text-rose-500 border-rose-300 dark:border-rose-500/30"
                  >
                    Nova Dedução (-)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => abrirModalNovoAjuste("acrescimo")}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Novo Acréscimo (+)
                  </Button>
                </div>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow isInteractive={false}>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo de Lançamento</TableHead>
                      <TableHead>Descrição / Motivo</TableHead>
                      <TableHead>Impacto no DRE</TableHead>
                      <TableHead>Valor (R$)</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ajustes.length === 0 ? (
                      <TableEmpty message="Nenhum ajuste ou lançamento avulso registrado." />
                    ) : (
                      ajustes.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {a.data}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={a.tipo === "acrescimo" ? "success" : "danger"}
                              size="sm"
                            >
                              {a.tipo === "acrescimo" ? "+ Acréscimo" : "- Dedução"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-800 dark:text-white text-xs">
                            {a.descricao}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                            {a.tipo === "acrescimo"
                              ? "Aumenta faturamento bruto e lucro"
                              : "Reduz receita operacional líquida"}
                          </TableCell>
                          <TableCell className={cn(
                            "font-mono font-bold text-sm",
                            a.tipo === "acrescimo" ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {a.tipo === "acrescimo" ? "+" : "-"} {formatCurrency(a.valor)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => abrirModalEditarAjuste(a)}
                                title="Editar Lançamento"
                                className="cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4 text-sky-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => handleExcluirAjuste(a.id)}
                                title="Excluir Lançamento"
                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: EDITAR MARGEM & CMV */}
      <Modal isOpen={modalConfigAberto} onClose={() => setModalConfigAberto(false)} size="sm">
        <form onSubmit={handleSalvarConfigMargem}>
          <ModalHeader
            title="Parâmetros de Margem & CMV"
            description="Ajuste o Custo das Mercadorias Vendidas (CMV) para recalcular os lucros do DRE."
            onClose={() => setModalConfigAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alíquota de CMV / Custo de Fabricação (%)
              </label>
              <Input
                type="number"
                min="1"
                max="99"
                step="1"
                required
                value={novoCmvInput}
                onChange={(e) => setNovoCmvInput(e.target.value)}
                placeholder="40"
                className="text-lg font-bold"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Exemplo: 40% significa que a cada R$ 100 vendidos, R$ 40 cobrem tecidos e costura, deixando 60% de Margem Bruta.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalConfigAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" className="bg-sky-600 text-white font-bold">
              Salvar Parâmetros
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 2: ADICIONAR / EDITAR CHEQUE */}
      <Modal isOpen={modalChequeAberto} onClose={() => setModalChequeAberto(false)} size="md">
        <form onSubmit={handleSalvarCheque}>
          <ModalHeader
            title={chequeEditando ? "Editar Cheque" : "Cadastrar Novo Cheque"}
            description="Informe os dados bancários e a data de vencimento (bom para) do cheque."
            onClose={() => setModalChequeAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Número do Cheque *"
                required
                placeholder="Ex: 000452"
                value={formCheque.numero}
                onChange={(e) => setFormCheque({ ...formCheque, numero: e.target.value })}
              />
              <Input
                label="Banco"
                required
                placeholder="Ex: Bradesco, Itaú, Banco do Brasil"
                value={formCheque.banco}
                onChange={(e) => setFormCheque({ ...formCheque, banco: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Emitente / Cliente *"
                required
                placeholder="Nome ou Razão Social do Emitente"
                value={formCheque.emitente}
                onChange={(e) => setFormCheque({ ...formCheque, emitente: e.target.value })}
              />
              <Input
                label="Bom Para (Data Vencimento) *"
                required
                placeholder="DD/MM/AAAA"
                value={formCheque.bomPara}
                onChange={(e) => setFormCheque({ ...formCheque, bomPara: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Valor do Cheque (R$) *"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={formCheque.valor}
                onChange={(e) => setFormCheque({ ...formCheque, valor: e.target.value })}
              />
              <Select
                label="Status de Compensação"
                value={formCheque.status}
                onChange={(e) => setFormCheque({ ...formCheque, status: e.target.value })}
              >
                <option value="a_compensar">A Compensar (Pendente)</option>
                <option value="compensado">Compensado na Conta</option>
                <option value="devolvido">Devolvido / Sustado</option>
              </Select>
            </div>

            <Input
              label="Observações / Pedido Vinculado"
              placeholder="Ex: Ref. Pedido Atacado #204, pago em 2 parcelas"
              value={formCheque.observacao}
              onChange={(e) => setFormCheque({ ...formCheque, observacao: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalChequeAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" className="bg-emerald-600 text-white font-bold">
              {chequeEditando ? "Salvar Alterações" : "Cadastrar Cheque"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 3: ADICIONAR / EDITAR LANÇAMENTO AVULSO */}
      <Modal isOpen={modalAjusteAberto} onClose={() => setModalAjusteAberto(false)} size="md">
        <form onSubmit={handleSalvarAjuste}>
          <ModalHeader
            title={ajusteEditando ? "Editar Lançamento Avulso" : "Novo Lançamento Avulso no DRE"}
            description="Adicione acréscimos para aumentar valores ou deduções para abater do faturamento."
            onClose={() => setModalAjusteAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Tipo de Lançamento"
                value={formAjuste.tipo}
                onChange={(e) => setFormAjuste({ ...formAjuste, tipo: e.target.value })}
              >
                <option value="acrescimo">+ Acréscimo (Aumentar Receita / Lucro)</option>
                <option value="deducao">- Dedução (Desconto / Despesa Extra)</option>
              </Select>
              <Input
                label="Data do Lançamento"
                value={formAjuste.data}
                onChange={(e) => setFormAjuste({ ...formAjuste, data: e.target.value })}
              />
            </div>

            <Input
              label="Descrição do Lançamento *"
              required
              placeholder="Ex: Receita extra de entrega, frete, bônus comercial, estorno..."
              value={formAjuste.descricao}
              onChange={(e) => setFormAjuste({ ...formAjuste, descricao: e.target.value })}
            />

            <Input
              label="Valor (R$) *"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={formAjuste.valor}
              onChange={(e) => setFormAjuste({ ...formAjuste, valor: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalAjusteAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              className={cn(
                formAjuste.tipo === "acrescimo"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  : "bg-rose-600 hover:bg-rose-500 text-white font-bold"
              )}
            >
              {ajusteEditando ? "Salvar Lançamento" : "Confirmar Lançamento"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
