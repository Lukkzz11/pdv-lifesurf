import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchReceivables,
  registerReceivablePayment,
  fetchPayables,
  createPayable,
  markPayableAsPaid,
  generatePaymentReceiptPDF,
  CATEGORIAS_DESPESA,
  zerarTodasContas,
  restaurarDemoContas,
  isContasAVerZerado
} from "../services/financialService";
import { openWhatsAppChat, WHATSAPP_TEMPLATES } from "../services/notificationService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import { formatCurrency, formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import toast from "react-hot-toast";
import {
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageCircle,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  Search,
  Receipt,
  Check,
  Sparkles,
  PieChart,
  RotateCcw
} from "lucide-react";

export default function ContasAVer() {
  const { activeTenantId, companyDetails } = useTenant();

  const [abaAtiva, setAbaAtiva] = useState("receber"); // "receber" | "pagar" | "fluxo"
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Zerar Tudo (Contas a Receber / Contas a Pagar)
  const [modalZerarAberto, setModalZerarAberto] = useState(false);
  const [salvandoZerar, setSalvandoZerar] = useState(false);
  const [opcoesZerar, setOpcoesZerar] = useState({
    receber: true,
    pagar: true
  });

  // Filtros
  const [buscaReceber, setBuscaReceber] = useState("");
  const [filtroStatusReceber, setFiltroStatusReceber] = useState("todos"); // "todos", "pendente", "liquidado"

  // Modal Baixa / Pagamento de Recebível
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [recebivelSelecionado, setRecebivelSelecionado] = useState(null);
  const [valorBaixa, setValorBaixa] = useState("");
  const [formaBaixa, setFormaBaixa] = useState("pix");
  const [observacaoBaixa, setObservacaoBaixa] = useState("");
  const [gerarReciboPdf, setGerarReciboPdf] = useState(true);
  const [salvandoBaixa, setSalvandoBaixa] = useState(false);

  // Modal Nova Conta a Pagar
  const [modalNovaDespesa, setModalNovaDespesa] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [formDespesa, setFormDespesa] = useState({
    fornecedor: "",
    categoria: "materia_prima",
    descricao: "",
    valor: "",
    dataVencimento: new Date().toISOString().split("T")[0]
  });

  const handleConfirmarZerarTudo = async () => {
    setSalvandoZerar(true);
    try {
      await zerarTodasContas(activeTenantId, opcoesZerar);
      if (opcoesZerar.receber) setReceivables([]);
      if (opcoesZerar.pagar) setPayables([]);
      setModalZerarAberto(false);
      toast.success("Contas a Ver e Financeiro zerados com sucesso! Todos os valores agora estão em R$ 0,00.");
    } catch (err) {
      toast.error("Erro ao zerar contas: " + (err.message || err));
    } finally {
      setSalvandoZerar(false);
    }
  };

  const handleRestaurarDemo = async () => {
    restaurarDemoContas(activeTenantId);
    toast.success("Demonstração financeira restaurada!");
    carregarDados();
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [recs, pays] = await Promise.all([
        fetchReceivables(activeTenantId),
        fetchPayables(activeTenantId)
      ]);
      setReceivables(recs);
      setPayables(pays);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [activeTenantId]);

  // Cálculos do Painel
  const stats = useMemo(() => {
    const totalAReceber = receivables
      .filter((r) => r.status !== "liquidado")
      .reduce((acc, r) => acc + (Number(r.saldoRestante) || 0), 0);

    const totalRecebido = receivables.reduce((acc, r) => acc + (Number(r.valorPago) || 0), 0);

    const totalAPagar = payables
      .filter((p) => p.status === "pendente")
      .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

    const totalPago = payables
      .filter((p) => p.status === "pago")
      .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

    const saldoProjetado = totalAReceber - totalAPagar;

    return { totalAReceber, totalRecebido, totalAPagar, totalPago, saldoProjetado };
  }, [receivables, payables]);

  // Filtro de Recebíveis
  const recebiveisFiltrados = useMemo(() => {
    return receivables.filter((r) => {
      const matchBusca =
        !buscaReceber.trim() ||
        r.cliente?.nome?.toLowerCase().includes(buscaReceber.toLowerCase()) ||
        r.numeroDocumento?.toLowerCase().includes(buscaReceber.toLowerCase()) ||
        r.descricao?.toLowerCase().includes(buscaReceber.toLowerCase());

      if (!matchBusca) return false;

      if (filtroStatusReceber === "pendente") return r.status !== "liquidado";
      if (filtroStatusReceber === "liquidado") return r.status === "liquidado";

      return true;
    });
  }, [receivables, buscaReceber, filtroStatusReceber]);

  // Abertura do Modal de Recebimento
  const abrirModalBaixa = (recebivel) => {
    setRecebivelSelecionado(recebivel);
    setValorBaixa(String(recebivel.saldoRestante || 0));
    setFormaBaixa("pix");
    setObservacaoBaixa("");
    setGerarReciboPdf(true);
    setModalBaixaAberto(true);
  };

  // Confirmação da Baixa de Recebível
  const handleConfirmarBaixa = async (e) => {
    e.preventDefault();
    if (!recebivelSelecionado) return;

    const valorNum = Number(valorBaixa) || 0;
    if (valorNum <= 0) {
      toast.error("Informe um valor de pagamento válido.");
      return;
    }
    if (valorNum > (Number(recebivelSelecionado.saldoRestante) || 0) + 0.05) {
      toast.error("O valor informado é superior ao saldo devedor do título.");
      return;
    }

    setSalvandoBaixa(true);
    try {
      const atualizado = await registerReceivablePayment(activeTenantId, recebivelSelecionado, {
        valor: valorNum,
        forma: formaBaixa,
        operador: "Caixa / Gerente",
        observacao: observacaoBaixa
      });

      setReceivables((prev) =>
        prev.map((r) => (r.id === recebivelSelecionado.id ? atualizado : r))
      );

      toast.success(
        atualizado.saldoRestante <= 0.01
          ? "Título liquidado com sucesso!"
          : `Amortização de ${formatCurrency(valorNum)} registrada com sucesso!`
      );

      // Emissão de Recibo em PDF
      if (gerarReciboPdf) {
        generatePaymentReceiptPDF(
          atualizado,
          { valor: valorNum, forma: formaBaixa },
          companyDetails || { nome: "LIFESURF CONFECÇÕES" }
        );
      }

      setModalBaixaAberto(false);
    } catch (err) {
      toast.error("Erro ao registrar pagamento: " + err.message);
    } finally {
      setSalvandoBaixa(false);
    }
  };

  // Disparo de Cobrança PIX via WhatsApp
  const handleCobrarWhatsApp = (recebivel) => {
    const tel = recebivel.cliente?.telefone;
    if (!tel) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }

    openWhatsAppChat(tel, recebivel.numeroDocumento, WHATSAPP_TEMPLATES.COBRANCA_PIX, {
      clienteNome: recebivel.cliente?.nome,
      total: formatCurrency(recebivel.saldoRestante || 0),
      chavePix: "pix@lifesurf.com.br"
    });
  };

  // Cadastro de Nova Despesa
  const handleSalvarDespesa = async (e) => {
    e.preventDefault();
    if (!formDespesa.fornecedor.trim()) {
      toast.error("Informe o fornecedor.");
      return;
    }
    if (Number(formDespesa.valor) <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setSalvandoDespesa(true);
    try {
      const criado = await createPayable(activeTenantId, formDespesa);
      setPayables((prev) => [criado, ...prev]);
      toast.success("Conta a pagar registrada com sucesso!");
      setModalNovaDespesa(false);
      setFormDespesa({
        fornecedor: "",
        categoria: "materia_prima",
        descricao: "",
        valor: "",
        dataVencimento: new Date().toISOString().split("T")[0]
      });
    } catch (err) {
      toast.error("Erro ao salvar despesa: " + err.message);
    } finally {
      setSalvandoDespesa(false);
    }
  };

  // Baixa de Conta a Pagar
  const handlePagarDespesa = async (payableId) => {
    try {
      await markPayableAsPaid(activeTenantId, payableId);
      setPayables((prev) =>
        prev.map((p) => (p.id === payableId ? { ...p, status: "pago", pagoEm: new Date().toISOString().split("T")[0] } : p))
      );
      toast.success("Conta marcada como PAGA com sucesso!");
    } catch (err) {
      toast.error("Erro ao dar baixa na conta: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </span>
            <Badge variant="info" size="sm" withDot={true}>
              Gestão Financeira & Crediário
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Contas A Ver & Financeiro
          </h1>
          <p className="text-xs text-slate-400">
            Controle de vendas a prazo (fiado), quitação de títulos de clientes, contas a pagar e fluxo de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isContasAVerZerado(activeTenantId) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestaurarDemo}
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-sky-400" />}
              className="text-xs text-sky-400 border-sky-500/30 hover:bg-sky-500/10 cursor-pointer"
            >
              Restaurar Demonstração
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalZerarAberto(true)}
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-rose-400" />}
              className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
            >
              Zerar Tudo
            </Button>
          )}

          {abaAtiva === "pagar" && (
            <Button
              variant="primary"
              onClick={() => setModalNovaDespesa(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
            >
              Nova Despesa
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Consolidadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                A Receber (Saldo "A Ver")
              </p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-0.5 font-mono">
                {formatCurrency(stats.totalAReceber)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-rose-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Contas a Pagar (Despesas)
              </p>
              <h3 className="text-2xl font-bold text-rose-400 mt-0.5 font-mono">
                {formatCurrency(stats.totalAPagar)}
              </h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-sky-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Já Amortizado
              </p>
              <h3 className="text-2xl font-bold text-sky-400 mt-0.5 font-mono">
                {formatCurrency(stats.totalRecebido)}
              </h3>
            </div>
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saldo Projetado Líquido
              </p>
              <h3 className={cn("text-2xl font-bold mt-0.5 font-mono", stats.saldoProjetado >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {formatCurrency(stats.saldoProjetado)}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Navegação entre Abas Financeiras */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "receber", label: 'Contas A Ver (Fiado / Recebíveis)', icon: Clock },
          { id: "pagar", label: "Contas a Pagar (Despesas & Fábrica)", icon: Building2 },
          { id: "fluxo", label: "Fluxo de Caixa & Projeção", icon: PieChart }
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
                  ? "border-emerald-400 bg-emerald-500 !text-white shadow-md font-extrabold"
                  : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isAtiva ? "!text-white" : "")} />
              <span className={cn(isAtiva ? "!text-white font-extrabold" : "")}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ABA 1: CONTAS A RECEBER ("A VER" / FIADO) */}
      {abaAtiva === "receber" && (
        <div className="space-y-4">
          <Card className="p-4 bg-slate-900/40 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, documento ou título..."
                value={buscaReceber}
                onChange={(e) => setBuscaReceber(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-950 text-white rounded-lg border border-slate-800 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {[
                { id: "todos", label: "Todos os Títulos" },
                { id: "pendente", label: "Em Aberto (Pendentes)" },
                { id: "liquidado", label: "Liquidados" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFiltroStatusReceber(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                    filtroStatusReceber === tab.id
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Título / Ref</th>
                    <th className="p-3.5">Cliente / Devedor</th>
                    <th className="p-3.5">Descrição</th>
                    <th className="p-3.5 text-right">Valor Original</th>
                    <th className="p-3.5 text-right">Amortizado</th>
                    <th className="p-3.5 text-right">Saldo Restante</th>
                    <th className="p-3.5 text-center">Vencimento</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {recebiveisFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <Clock className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                        <p className="font-semibold">Nenhum título a receber encontrado.</p>
                      </td>
                    </tr>
                  ) : (
                    recebiveisFiltrados.map((rec) => {
                      const isLiquidado = rec.status === "liquidado" || (Number(rec.saldoRestante) || 0) <= 0.01;
                      const saldo = Number(rec.saldoRestante) || 0;

                      return (
                        <tr key={rec.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3.5 font-mono text-sky-400 font-bold">
                            {rec.numeroDocumento || rec.id}
                          </td>

                          <td className="p-3.5">
                            <div>
                              <p className="font-bold text-white">{rec.cliente?.nome || "Consumidor"}</p>
                              {rec.cliente?.telefone && (
                                <p className="text-[11px] text-slate-400 font-mono">{rec.cliente.telefone}</p>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-300 max-w-xs truncate" title={rec.descricao}>
                            {rec.descricao || "Venda a Prazo"}
                          </td>

                          <td className="p-3.5 text-right font-mono text-slate-300">
                            {formatCurrency(rec.valorOriginal || 0)}
                          </td>

                          <td className="p-3.5 text-right font-mono text-emerald-400 font-semibold">
                            {formatCurrency(rec.valorPago || 0)}
                          </td>

                          <td className="p-3.5 text-right font-mono font-bold text-rose-400">
                            {formatCurrency(saldo)}
                          </td>

                          <td className="p-3.5 text-center text-slate-400 font-mono">
                            {rec.dataVencimento ? rec.dataVencimento.split("-").reverse().join("/") : "--/--/----"}
                          </td>

                          <td className="p-3.5 text-center">
                            <Badge variant={isLiquidado ? "success" : saldo > 0 ? "warning" : "info"} size="sm">
                              {isLiquidado ? "Liquidado" : rec.valorPago > 0 ? "Pago Parcial" : "Pendente"}
                            </Badge>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isLiquidado && (
                                <button
                                  type="button"
                                  onClick={() => abrirModalBaixa(rec)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                  title="Registrar recebimento de valor"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Receber</span>
                                </button>
                              )}

                              {!isLiquidado && rec.cliente?.telefone && (
                                <button
                                  type="button"
                                  onClick={() => handleCobrarWhatsApp(rec)}
                                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                                  title="Enviar cobrança PIX no WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              )}

                              {rec.valorPago > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    generatePaymentReceiptPDF(
                                      rec,
                                      rec.historicoPagamentos?.[rec.historicoPagamentos.length - 1] || { valor: rec.valorPago },
                                      companyDetails || { nome: "LIFESURF CONFECÇÕES" }
                                    )
                                  }
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                                  title="Emitir Recibo em PDF"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ABA 2: CONTAS A PAGAR (DESPESAS & FÁBRICA) */}
      {abaAtiva === "pagar" && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Fornecedor / Beneficiário</th>
                    <th className="p-3.5">Categoria</th>
                    <th className="p-3.5">Descrição</th>
                    <th className="p-3.5 text-right">Valor da Despesa</th>
                    <th className="p-3.5 text-center">Vencimento</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {payables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                        <p className="font-semibold">Nenhuma conta a pagar registrada.</p>
                      </td>
                    </tr>
                  ) : (
                    payables.map((pay) => {
                      const isPago = pay.status === "pago";

                      return (
                        <tr key={pay.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3.5 font-bold text-white">
                            {pay.fornecedor}
                          </td>

                          <td className="p-3.5">
                            <Badge variant="neutral" size="sm">
                              {CATEGORIAS_DESPESA.find((c) => c.id === pay.categoria)?.label || pay.categoria}
                            </Badge>
                          </td>

                          <td className="p-3.5 text-slate-300 max-w-sm truncate" title={pay.descricao}>
                            {pay.descricao}
                          </td>

                          <td className="p-3.5 text-right font-mono font-bold text-rose-400">
                            {formatCurrency(pay.valor || 0)}
                          </td>

                          <td className="p-3.5 text-center text-slate-400 font-mono">
                            {pay.dataVencimento ? pay.dataVencimento.split("-").reverse().join("/") : "--/--/----"}
                          </td>

                          <td className="p-3.5 text-center">
                            <Badge variant={isPago ? "success" : "warning"} size="sm">
                              {isPago ? "Pago" : "Pendente"}
                            </Badge>
                          </td>

                          <td className="p-3.5 text-center">
                            {!isPago ? (
                              <button
                                type="button"
                                onClick={() => handlePagarDespesa(pay.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer mx-auto shadow-sm"
                                title="Marcar despesa como paga"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Pagar</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-400 font-mono">Pago em {pay.pagoEm?.split("-").reverse().join("/") || "Hoje"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ABA 3: FLUXO DE CAIXA & PROJEÇÃO */}
      {abaAtiva === "fluxo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4 border-slate-800">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" />
              <span>Projeção de Entradas & Saídas</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Previsão de Recebimento de Clientes ("A Ver"):</p>
                  <p className="text-[11px] text-slate-400">Títulos a vencer e crediários ativos</p>
                </div>
                <span className="text-base font-bold font-mono text-emerald-400">
                  + {formatCurrency(stats.totalAReceber)}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">Despesas & Compromissos Agendados:</p>
                  <p className="text-[11px] text-slate-400">Boletos de fornecedores, facção e aluguel</p>
                </div>
                <span className="text-base font-bold font-mono text-rose-400">
                  - {formatCurrency(stats.totalAPagar)}
                </span>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-emerald-300 text-sm">Saldo Projetado em Caixa:</p>
                  <p className="text-[11px] text-emerald-400/80">Margem líquida financeira da operação</p>
                </div>
                <span className="text-xl font-black font-mono text-emerald-300">
                  {formatCurrency(stats.saldoProjetado)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4 border-slate-800">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Dicas de Saúde Financeira LifeSurf</span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Régua de Cobrança Automática
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Utilize o botão de cobrança via WhatsApp para clientes com parcelas vencendo nesta semana. Cobranças com chave PIX pronta aumentam a taxa de liquidação em mais de 70%.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Controle de Facções e Terceirizados
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Registre as ordens de facção e corte em "Contas a Pagar" antes do vencimento para provisionar o fluxo de caixa da fábrica.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Baixa de Pagamento do Recebível */}
      {modalBaixaAberto && recebivelSelecionado && (
        <Modal
          isOpen={modalBaixaAberto}
          onClose={() => setModalBaixaAberto(false)}
          size="md"
        >
          <form onSubmit={handleConfirmarBaixa}>
            <ModalHeader
              title={`Receber Pagamento • ${recebivelSelecionado.numeroDocumento}`}
              description={`Cliente: ${recebivelSelecionado.cliente?.nome}`}
              onClose={() => setModalBaixaAberto(false)}
            />
            <ModalBody className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Saldo Devedor Atual:</span>
                <span className="text-lg font-black text-rose-400 font-mono">
                  {formatCurrency(recebivelSelecionado.saldoRestante || 0)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">
                    Valor a Receber Agora (R$) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setValorBaixa(String(recebivelSelecionado.saldoRestante || 0))}
                    className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                  >
                    Quitar Valor Total
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={valorBaixa}
                  onChange={(e) => setValorBaixa(e.target.value)}
                  className="font-mono font-bold text-sm text-emerald-400"
                />
              </div>

              <Select
                label="Forma de Pagamento Recebida"
                value={formaBaixa}
                onChange={(e) => setFormaBaixa(e.target.value)}
                options={[
                  { value: "pix", label: "PIX (Instantâneo)" },
                  { value: "dinheiro", label: "Dinheiro Físico (Gaveta do Caixa)" },
                  { value: "debito", label: "Cartão de Débito" },
                  { value: "credito", label: "Cartão de Crédito" },
                  { value: "transferencia", label: "Transferência Bancária / TED" }
                ]}
              />

              <Input
                label="Observações / Anotações"
                placeholder="Ex: Pagamento da 1ª parcela em dinheiro"
                value={observacaoBaixa}
                onChange={(e) => setObservacaoBaixa(e.target.value)}
              />

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gerarReciboPdf}
                    onChange={(e) => setGerarReciboPdf(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Gerar e baixar Recibo Oficial de Quitação em PDF
                  </span>
                </label>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" type="button" onClick={() => setModalBaixaAberto(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" isLoading={salvandoBaixa} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                Confirmar Recebimento
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Modal Nova Despesa / Conta a Pagar */}
      <Modal
        isOpen={modalNovaDespesa}
        onClose={() => setModalNovaDespesa(false)}
        size="md"
      >
        <form onSubmit={handleSalvarDespesa}>
          <ModalHeader
            title="Nova Despesa / Conta a Pagar"
            description="Cadastre despesas operacionais da loja, oficina de costura ou fornecedores."
            onClose={() => setModalNovaDespesa(false)}
          />
          <ModalBody className="space-y-4">
            <Input
              label="Fornecedor / Favorecido *"
              placeholder="Ex: Têxtil Ceará, Oficina Dona Rita..."
              value={formDespesa.fornecedor}
              onChange={(e) => setFormDespesa({ ...formDespesa, fornecedor: e.target.value })}
              required
            />

            <Select
              label="Centro de Custo / Categoria *"
              value={formDespesa.categoria}
              onChange={(e) => setFormDespesa({ ...formDespesa, categoria: e.target.value })}
              options={CATEGORIAS_DESPESA.map((c) => ({ value: c.id, label: c.label }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="number"
                step="0.01"
                label="Valor da Conta (R$) *"
                placeholder="0.00"
                value={formDespesa.valor}
                onChange={(e) => setFormDespesa({ ...formDespesa, valor: e.target.value })}
                required
                className="font-mono text-rose-400 font-bold"
              />

              <Input
                type="date"
                label="Data de Vencimento *"
                value={formDespesa.dataVencimento}
                onChange={(e) => setFormDespesa({ ...formDespesa, dataVencimento: e.target.value })}
                required
              />
            </div>

            <Input
              label="Descrição / Detalhes"
              placeholder="Ex: Compra de 100 metros de malha 30.1..."
              value={formDespesa.descricao}
              onChange={(e) => setFormDespesa({ ...formDespesa, descricao: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalNovaDespesa(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvandoDespesa} className="bg-rose-600 hover:bg-rose-500 text-white">
              Salvar Conta a Pagar
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal Zerar Tudo (Contas a Ver / Contas a Pagar) */}
      <Modal
        isOpen={modalZerarAberto}
        onClose={() => setModalZerarAberto(false)}
        size="md"
      >
        <ModalHeader
          title="Zerar Contas a Ver & Financeiro"
          description="Limpe todos os saldos e transações para iniciar com dados totalmente zerados (R$ 0,00)."
          onClose={() => setModalZerarAberto(false)}
        />
        <ModalBody className="space-y-4">
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Atenção: Ação de Redefinição Financeira</p>
              <p className="text-slate-300 leading-relaxed">
                Esta ação definirá o total a receber, contas a pagar, total amortizado e saldo projetado para <strong>R$ 0,00</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Selecione o que deseja zerar:
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={opcoesZerar.receber}
                onChange={(e) => setOpcoesZerar((prev) => ({ ...prev, receber: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <div className="flex-1">
                <span className="font-bold text-white block">Contas a Receber (Fiado / Títulos de Clientes)</span>
                <span className="text-[11px] text-slate-400">Zera o saldo devedor e todos os títulos a receber</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={opcoesZerar.pagar}
                onChange={(e) => setOpcoesZerar((prev) => ({ ...prev, pagar: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <div className="flex-1">
                <span className="font-bold text-white block">Contas a Pagar (Despesas & Fornecedores)</span>
                <span className="text-[11px] text-slate-400">Zera todas as contas a pagar e compromissos operacionais</span>
              </div>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" type="button" onClick={() => setModalZerarAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            isLoading={salvandoZerar}
            onClick={handleConfirmarZerarTudo}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
          >
            Confirmar e Zerar Tudo (R$ 0,00)
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
