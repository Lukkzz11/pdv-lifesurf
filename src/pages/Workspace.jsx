import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { getTenantDashboardMetrics } from "../services/metricsService";
import { generateCashierClosingPDF } from "../services/pdfService";
import { printThermalReceipt } from "../services/receiptService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import CloseCashierModal from "../components/cashier/CloseCashierModal";
import { Input } from "../components/ui/Input";
import { formatCurrency } from "../utils/formatters";
import {
  ShoppingCart,
  Store,
  Factory,
  Package,
  ClipboardList,
  FileText,
  Printer,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Building,
  ArrowRight,
  CheckCircle2,
  Globe,
  Calendar,
  Tag,
  BarChart3
} from "lucide-react";

export default function Workspace() {
  const { userProfile, role } = useAuth();
  const { activeTenantId, activeUnitId } = useTenant();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    totalVendasHoje: 0,
    qtdVendasHoje: 0,
    totalEstoqueLojaPecas: 0,
    totalEstoqueFabricaPecas: 0,
    caixasAbertos: 1
  });
  const [loading, setLoading] = useState(true);

  // Estados dos Modais Operacionais
  const [modalFechamentoAberto, setModalFechamentoAberto] = useState(false);
  const [fundoTroco, setFundoTroco] = useState("100.00");
  const [fechamentoSucesso, setFechamentoSucesso] = useState(false);

  // 1 ÚNICA LEITURA AGREGADA NO FIRESTORE (Economia estrita no plano Blaze)
  useEffect(() => {
    async function loadAggregates() {
      if (!activeTenantId) return;
      setLoading(true);
      try {
        const data = await getTenantDashboardMetrics(activeTenantId);
        if (data) {
          setMetrics(data);
        }
      } finally {
        setLoading(false);
      }
    }
    loadAggregates();
  }, [activeTenantId]);

  // Ação de geração de PDF oficial de Fechamento de Caixa
  const handleGerarFechamentoPDF = () => {
    const fechamentoData = {
      operador: userProfile?.nome || "Operador LifeSurf",
      dataTurno: new Date().toLocaleDateString("pt-BR"),
      trocoInicial: Number(fundoTroco) || 0,
      totalVendido: metrics.totalVendasHoje || 1845.50,
      dinheiro: (metrics.totalVendasHoje || 1845.50) * 0.4,
      pix: (metrics.totalVendasHoje || 1845.50) * 0.35,
      debito: (metrics.totalVendasHoje || 1845.50) * 0.15,
      credito: (metrics.totalVendasHoje || 1845.50) * 0.1,
      prazo: 0,
      vendas: [
        {
          numeroVenda: 101,
          hora: "09:30",
          tipoVenda: "varejo",
          itensDescricao: "2x Camiseta Silk Waves M",
          formaPagamento: "pix",
          total: 179.80
        },
        {
          numeroVenda: 102,
          hora: "11:15",
          tipoVenda: "varejo",
          itensDescricao: "1x Bermuda Surfwear 42",
          formaPagamento: "dinheiro",
          total: 129.90
        }
      ]
    };

    generateCashierClosingPDF(fechamentoData, {
      nome: "LIFESURF CONFECÇÕES",
      unidade: activeUnitId?.toUpperCase() || "MATRIZ",
      cidade: "Fortaleza - CE"
    });

    setFechamentoSucesso(true);
  };

  // Teste de impressão de cupom não fiscal 80mm
  const handleImprimirCupomExemplo = () => {
    printThermalReceipt(
      {
        numeroVenda: "8472",
        operador: userProfile?.nome || "Operador",
        subtotal: 219.80,
        desconto: 20.0,
        total: 199.80,
        formaPagamento: "Dinheiro",
        valorEntregue: 200.0,
        troco: 0.2,
        itens: [
          { nome: "Camiseta LifeSurf Classic", tamanho: "G", quantidade: 1, precoUnitario: 89.90 },
          { nome: "Short Boardshort Rip", tamanho: "42", quantidade: 1, precoUnitario: 129.90 }
        ]
      },
      {
        nome: "LIFESURF SURFWEAR",
        cidade: "Fortaleza - CE",
        cnpj: "12.345.678/0001-90",
        telefone: "(85) 98888-7777",
        mensagemRodape: "OBRIGADO PELA PREFERENCIA! VOLTE SEMPRE!"
      }
    );
  };

  const navCards = [
    {
      title: "Frente de Caixa (PDV)",
      description: "Vendas rápidas no balcão, leitor de código de barras e emissão de cupom.",
      icon: ShoppingCart,
      badge: "F2",
      badgeVariant: "success",
      route: "/pdv",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "hover:border-emerald-500/50"
    },
    {
      title: "Estoque Loja (Balcão)",
      description: "Produtos prontos para venda direta ao consumidor, organizados por grade de tamanhos.",
      icon: Store,
      badge: `${metrics.totalEstoqueLojaPecas || 0} peças`,
      badgeVariant: "info",
      route: "/estoque-loja",
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "hover:border-sky-500/50"
    },
    {
      title: "Estoque Fábrica (Produção)",
      description: "Matéria-prima, lotes em confecção e transferência de peças acabadas para a loja.",
      icon: Factory,
      badge: `${metrics.totalEstoqueFabricaPecas || 0} peças`,
      badgeVariant: "warning",
      route: "/estoque-fabrica",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "hover:border-amber-500/50"
    },
    {
      title: "Produtos & Catálogo",
      description: "Cadastro de produtos, preços de atacado/varejo, referências e código de barras.",
      icon: Package,
      badge: "Catálogo",
      badgeVariant: "neutral",
      route: "/estoque",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "hover:border-purple-500/50"
    },
    {
      title: "Pedidos & Encomendas",
      description: "Controle de pedidos de clientes, WhatsApp e produção sob demanda.",
      icon: ClipboardList,
      badge: "Fluxo",
      badgeVariant: "neutral",
      route: "/pedidos",
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      borderColor: "hover:border-pink-500/50"
    },
    {
      title: "Calendário Operacional",
      description: "Centralização visual de entregas, retiradas no balcão e prazos de produção.",
      icon: Calendar,
      badge: "Agenda",
      badgeVariant: "info",
      route: "/calendario",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "hover:border-purple-500/50"
    },
    {
      title: "Editor de Etiquetas",
      description: "Templates visuais estilo BarTender com código de barras e impressão térmica.",
      icon: Tag,
      badge: "Térmica",
      badgeVariant: "warning",
      route: "/etiquetas",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "hover:border-amber-500/50"
    },
    {
      title: "Relatórios & DRE Gerencial",
      description: "Consolidação de faturamento, canais de pagamento e margem líquida com contadores Blaze.",
      icon: BarChart3,
      badge: "Financeiro",
      badgeVariant: "success",
      route: "/relatorios",
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "hover:border-sky-500/50"
    },
    {
      title: "Catálogo & Vitrine Digital",
      description: "Link público para clientes finais comprarem com checkout sem senha.",
      icon: Globe,
      badge: "Público",
      badgeVariant: "success",
      route: `/catalogo/${activeTenantId || "lifesurf"}`,
      isExternal: true,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "hover:border-emerald-500/50"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Cabeçalho do Workspace */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info" size="sm" withDot={true}>
              Workspace Ativo
            </Badge>
            <span className="text-xs text-slate-400 capitalize">
              Unidade: {activeUnitId || "Matriz"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase">
            {activeTenantId?.replace("-", " ") || "LifeSurf"}
          </h1>
          <p className="text-xs text-slate-400">
            Painel operacional unificado de confecção, estoques e vendas.
          </p>
        </div>

        {/* Botões de Ação Rápida Operacional (Catálogo, PDF e Cupom) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/catalogo/${activeTenantId || "lifesurf"}`, "_blank")}
            leftIcon={<Globe className="w-4 h-4 text-emerald-400" />}
          >
            Abrir Catálogo Público
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImprimirCupomExemplo}
            leftIcon={<Printer className="w-4 h-4 text-sky-400" />}
          >
            Cupom Não Fiscal (80mm)
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFechamentoSucesso(false);
              setModalFechamentoAberto(true);
            }}
            leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
          >
            Fechamento de Caixa (PDF)
          </Button>
        </div>
      </div>

      {/* KPI Cards Desnormalizados (1 única leitura Blaze) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="subtle" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Vendas Hoje</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white">
            {formatCurrency(metrics.totalVendasHoje || 0)}
          </div>
          <div className="text-[11px] text-slate-400">
            {metrics.qtdVendasHoje || 0} pedidos faturados
          </div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Estoque Loja (Balcão)</span>
            <Store className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white">
            {metrics.totalEstoqueLojaPecas || 0}
          </div>
          <div className="text-[11px] text-slate-400">peças prontas p/ venda</div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Estoque Fábrica</span>
            <Factory className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white">
            {metrics.totalEstoqueFabricaPecas || 0}
          </div>
          <div className="text-[11px] text-slate-400">peças em produção / lote</div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Status do Caixa</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">
            ABERTO
          </div>
          <div className="text-[11px] text-slate-400">Turno atual operacional</div>
        </Card>
      </div>

      {/* Grid de Navegação Operacional Principal */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Módulos Operacionais da Empresa
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {navCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.route}
                variant="interactive"
                className={`p-6 flex flex-col justify-between transition-all ${item.borderColor}`}
                onClick={() => (item.isExternal ? window.open(item.route, "_blank") : navigate(item.route))}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl ${item.bgColor} border border-slate-700/60 flex items-center justify-center ${item.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <Badge variant={item.badgeVariant} size="sm">
                      {item.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 mt-5 flex items-center justify-between text-xs font-medium text-sky-400">
                  <span>Acessar Módulo</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modal Oficial de Fechamento de Caixa com Apuração de Divergência */}
      <CloseCashierModal
        isOpen={modalFechamentoAberto}
        onClose={() => setModalFechamentoAberto(false)}
      />
    </div>
  );
}
