import { useState, useEffect } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchFinancialReports,
  generateDrePDF
} from "../services/reportsService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { formatCurrency } from "../utils/formatters";
import { cn } from "../utils/cn";
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
  Sparkles
} from "lucide-react";

export default function Relatorios() {
  const { activeTenantId } = useTenant();

  const [periodo, setPeriodo] = useState("mes"); // "hoje" | "semana" | "mes"
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarRelatorios() {
      setLoading(true);
      try {
        const res = await fetchFinancialReports(activeTenantId, periodo);
        setDados(res);
      } finally {
        setLoading(false);
      }
    }
    carregarRelatorios();
  }, [activeTenantId, periodo]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success" size="sm" withDot={true}>
              DRE Gerencial Consolidado
            </Badge>
            <span className="text-xs text-slate-400">
              Economia estrita de leituras (Contadores Agregados Blaze)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Relatórios Financeiros & DRE
          </h1>
          <p className="text-xs text-slate-400">
            Faturamento, margens de lucro líquido, custo de mercadorias (CMV) e divisão de pagamentos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Seletor de Período */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
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
                    : "text-slate-400 hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={handleExportarPDF}
            leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
          >
            Exportar DRE em PDF
          </Button>
        </div>
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
              <div className="text-2xl font-black text-white font-mono">
                {formatCurrency(dados.faturamentoLiquido)}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>Bruto:</span>
                <strong className="text-slate-200">{formatCurrency(dados.faturamentoBruto)}</strong>
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Lucro Bruto (Margem)</span>
                <Percent className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-sky-400 font-mono">
                {formatCurrency(dados.lucroBruto)}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{dados.margemLucroPercentual.toFixed(1)}% de margem</span>
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Ticket Médio / Venda</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {formatCurrency(dados.ticketMedio)}
              </div>
              <div className="text-[11px] text-slate-400">
                {dados.totalVendas} vendas faturadas
              </div>
            </Card>

            <Card variant="subtle" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Volume de Peças</span>
                <Layers className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {dados.totalPecasVendidas} peças
              </div>
              <div className="text-[11px] text-slate-400">
                Média de {(dados.totalPecasVendidas / (dados.totalVendas || 1)).toFixed(1)} peças/venda
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Estrutura do DRE Gerencial */}
            <div className="lg:col-span-7">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Demonstração do Resultado (DRE)</h3>
                    <p className="text-xs text-slate-400">
                      Cálculo de margem de contribuição e custos de confecção.
                    </p>
                  </div>
                  <Badge variant="info" size="sm">
                    {periodo === "hoje" ? "Diário" : periodo === "semana" ? "Semanal" : "Mensal"}
                  </Badge>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Receita Bruta */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="font-bold text-white">1. Receita Operacional Bruta</span>
                    <strong className="text-white font-mono text-sm">
                      {formatCurrency(dados.faturamentoBruto)}
                    </strong>
                  </div>

                  {/* Deduções */}
                  <div className="flex items-center justify-between px-3 text-rose-400">
                    <span>(-) Deduções / Descontos Concedidos</span>
                    <span className="font-mono font-bold">- {formatCurrency(dados.descontos)}</span>
                  </div>

                  {/* Receita Líquida */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold">
                    <span>(=) 2. Receita Operacional Líquida</span>
                    <span className="font-mono text-sm">{formatCurrency(dados.faturamentoLiquido)}</span>
                  </div>

                  {/* CMV */}
                  <div className="flex items-center justify-between px-3 text-amber-400">
                    <div>
                      <span>(-) Custo das Mercadorias Vendidas (CMV)</span>
                      <span className="text-[10px] text-slate-500 block">Tecidos, costura e aviamentos (~40%)</span>
                    </div>
                    <span className="font-mono font-bold">- {formatCurrency(dados.custoMercadorias)}</span>
                  </div>

                  {/* Lucro Bruto */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-sm">
                    <span>(=) 3. Lucro Bruto / Margem de Contribuição</span>
                    <span className="font-mono text-base">{formatCurrency(dados.lucroBruto)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Divisão por Formas de Pagamento */}
            <div className="lg:col-span-5">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Formas de Pagamento</h3>
                    <p className="text-xs text-slate-400">Distribuição financeira das entradas.</p>
                  </div>
                  <PieChart className="w-5 h-5 text-sky-400" />
                </div>

                <div className="space-y-4">
                  {Object.entries(dados.formasPagamento || {}).map(([key, item]) => {
                    const labels = {
                      pix: { nome: "PIX", color: "bg-sky-500", text: "text-sky-400" },
                      cartao_credito: { nome: "Cartão de Crédito", color: "bg-purple-500", text: "text-purple-400" },
                      dinheiro: { nome: "Dinheiro em Espécie", color: "bg-emerald-500", text: "text-emerald-400" },
                      cartao_debito: { nome: "Cartão de Débito", color: "bg-indigo-500", text: "text-indigo-400" },
                      a_ver: { nome: "A Ver / Fiado", color: "bg-amber-500", text: "text-amber-400" }
                    };
                    const config = labels[key] || { nome: key, color: "bg-slate-500", text: "text-slate-400" };

                    return (
                      <div key={key} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-300">{config.nome}</span>
                          <div className="flex items-center gap-2">
                            <strong className="text-white font-mono">{formatCurrency(item.total)}</strong>
                            <span className="text-[11px] text-slate-400 font-mono">({item.percentual.toFixed(1)}%)</span>
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
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
        </>
      )}
    </div>
  );
}
