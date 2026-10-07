import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { DEFAULT_PAINEL_CONFIG, getCompanyPainelConfig } from "../services/tenantService";
import { getTenantDashboardMetrics } from "../services/metricsService";
import { fetchRecentOrders, ORDER_STATUS } from "../services/orderService";
import { fetchStockProducts, calculateGradeTotal } from "../services/stockService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { formatCurrency } from "../utils/formatters";
import {
  ShoppingCart,
  Store,
  Factory,
  Package,
  ClipboardList,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Calendar,
  Tag,
  BarChart3,
  Settings,
  ShoppingBag,
  Clock,
  Layers,
  Sparkles,
  ArrowUpRight,
  Users
} from "lucide-react";
import { USER_ROLES } from "../config/constants";

export default function Workspace() {
  const { userProfile, role } = useAuth();
  const { activeTenantId, activeUnitId, companyDetails } = useTenant();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    totalVendasHoje: 0,
    qtdVendasHoje: 0,
    totalMes: 0,
    totalEstoqueLojaPecas: 0,
    totalEstoqueFabricaPecas: 0,
    caixasAbertos: 1
  });
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [produtosEstoqueBaixo, setProdutosEstoqueBaixo] = useState([]);
  const [loading, setLoading] = useState(true);

  const limiteEstoqueMinimo = companyDetails?.alertaEstoqueMinimoPadrao || 5;

  // Carregamento Gerencial Unificado (Blaze-friendly com queries otimizadas)
  useEffect(() => {
    async function carregarDadosGerenciais() {
      if (!activeTenantId) return;
      setLoading(true);
      try {
        const [metricasData, pedidosData, produtosData] = await Promise.all([
          getTenantDashboardMetrics(activeTenantId),
          fetchRecentOrders(activeTenantId, 25),
          fetchStockProducts(activeTenantId, "loja", 40)
        ]);

        if (metricasData) {
          setMetrics(metricasData);
        }

        // Filtra pedidos novos aguardando início de separação
        if (Array.isArray(pedidosData)) {
          const pendentes = pedidosData.filter(
            (p) => p.status === ORDER_STATUS.NOVO || p.status === "novo" || p.status === "pendente"
          );
          setPedidosPendentes(pendentes);
        }

        // Filtra produtos com estoque igual ou abaixo do limite de alerta
        if (Array.isArray(produtosData)) {
          const baixos = produtosData.filter((prod) => {
            const saldoTotal =
              prod.estoqueTotal !== undefined
                ? Number(prod.estoqueTotal)
                : calculateGradeTotal(prod.gradeTamanhos);
            return saldoTotal <= limiteEstoqueMinimo;
          });
          setProdutosEstoqueBaixo(baixos);
        }
      } catch (err) {
        console.error("[Workspace] Erro ao carregar indicadores executivos:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarDadosGerenciais();
  }, [activeTenantId, limiteEstoqueMinimo]);

  const [painelConfig, setPainelConfig] = useState(() => {
    return companyDetails?.painelConfig || getCompanyPainelConfig(activeTenantId);
  });

  // Sincronização em tempo real das preferências de layout e atalhos da empresa
  useEffect(() => {
    const conf = companyDetails?.painelConfig || getCompanyPainelConfig(activeTenantId);
    if (conf) {
      setPainelConfig(conf);
    }

    const handleConfigChange = (e) => {
      if (e.detail) {
        setPainelConfig(e.detail);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith("lifesurf_painel_config")) {
        const updated = getCompanyPainelConfig(activeTenantId);
        setPainelConfig(updated);
      }
    };

    window.addEventListener("lifesurf:painel_config_changed", handleConfigChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("lifesurf:painel_config_changed", handleConfigChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [activeTenantId, companyDetails?.painelConfig]);

  const navCards = [
    {
      id: "pdv",
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
      id: "caixa-loja",
      title: "Caixa Loja",
      description: "Centralização de vendas PDV, operador, cancelamentos, edições e fechamento.",
      icon: DollarSign,
      badge: "Caixa",
      badgeVariant: "success",
      route: "/caixa-loja",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "hover:border-emerald-500/50"
    },
    {
      id: "estoque-loja",
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
      id: "estoque-fabrica",
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
      id: "estoque",
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
      id: "pedidos",
      title: "Pedidos & Encomendas",
      description: "Controle de pedidos de clientes, WhatsApp e produção sob demanda.",
      icon: ClipboardList,
      badge: pedidosPendentes.length > 0 ? `${pedidosPendentes.length} novos` : "Fluxo",
      badgeVariant: pedidosPendentes.length > 0 ? "warning" : "neutral",
      route: "/pedidos",
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      borderColor: "hover:border-pink-500/50"
    },
    {
      id: "calendario",
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
      id: "etiquetas",
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
      id: "relatorios",
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
      id: "catalogo",
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
    },
    {
      id: "clientes",
      title: "Clientes & Atacado (CRM)",
      description: "Carteira de lojistas e revendedores, limites de crediário e preços de atacado.",
      icon: Users,
      badge: "CRM",
      badgeVariant: "info",
      route: "/clientes",
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "hover:border-sky-500/50"
    },
    {
      id: "a-ver",
      title: "Contas A Ver & Financeiro",
      description: "Controle de vendas a prazo (fiado), contas a pagar e emissão de recibos de quitação.",
      icon: Clock,
      badge: "Financeiro",
      badgeVariant: "warning",
      route: "/a-ver",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "hover:border-emerald-500/50"
    },
    {
      id: "financeiro",
      title: "Gastos, Entradas & Comprovantes",
      description: "Controle financeiro diário com foto de comprovantes enviada direto para o Google Drive em pastas mensais.",
      icon: DollarSign,
      badge: "Google Drive",
      badgeVariant: "success",
      route: "/financeiro",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "hover:border-emerald-500/50"
    },
    {
      id: "configuracoes",
      title: "Configurações da Empresa",
      description: "Dados fiscais, personalização de cores/tema global, rodapé do cupom e regras do ERP.",
      icon: Settings,
      badge: "Ajustes",
      badgeVariant: "info",
      route: "/configuracoes",
      color: "text-brand-primary",
      bgColor: "bg-brand-primary/10",
      borderColor: "hover:border-brand-primary/50"
    }
  ];

  // Filtra e reordena os atalhos de acordo com a customização configurada
  const visibleNavCards = useMemo(() => {
    const desativados = painelConfig?.modulosDesativados || [];
    const ordem = painelConfig?.ordemModulos || [];

    const filtrados = navCards.filter((card) => !desativados.includes(card.id));

    return [...filtrados].sort((a, b) => {
      const idxA = ordem.indexOf(a.id);
      const idxB = ordem.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [navCards, painelConfig]);

  // Formação de colunas do grid
  const gridColsClass = useMemo(() => {
    switch (String(painelConfig?.colunasGrid)) {
      case "2":
        return "grid grid-cols-1 md:grid-cols-2 gap-5";
      case "4":
        return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";
      case "3":
      default:
        return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5";
    }
  }, [painelConfig?.colunasGrid]);

  // Densidade dos cards
  const densityPaddingClass = useMemo(() => {
    switch (painelConfig?.densidadeCards) {
      case "compacto":
        return "p-4 space-y-3";
      case "detalhado":
        return "p-7 space-y-5";
      case "padrao":
      default:
        return "p-6 space-y-4";
    }
  }, [painelConfig?.densidadeCards]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Cabeçalho Executivo do Workspace (Livre de Atalhos de Caixa) */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b"
        style={{ borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))" }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info" size="sm" withDot={true}>
              Painel Executivo
            </Badge>
            <span className="text-xs text-slate-400 capitalize">
              Unidade: {activeUnitId || "Matriz"}
            </span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase"
            style={{ color: "var(--text-heading, #ffffff)" }}
          >
            {companyDetails?.nome || activeTenantId?.replace("-", " ") || "LifeSurf"}
          </h1>
          <p className="text-xs text-slate-400">
            Torre de controle gerencial e visão executiva unificada da empresa.
          </p>
        </div>

        {/* Ações Gerenciais Limpas (Sem poluição de atalhos operacionais de caixa) */}
        {painelConfig.exibirAcoesCabecalho !== false && (
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
              variant="secondary"
              size="sm"
              onClick={() => navigate("/configuracoes")}
              leftIcon={<Settings className="w-4 h-4 text-sky-400" />}
            >
              Ajustes & Tema
            </Button>
          </div>
        )}
      </div>

      {/* 2. Torre de Controle de Alertas & Indicadores Críticos (Executivo) */}
      {painelConfig.exibirAlertasCriticos !== false && (
        <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h2
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-heading, #ffffff)" }}
            >
              Torre de Controle • Alertas Críticos
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Monitoramento em tempo real do negócio
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Alerta 1: Pedidos Pendentes do Catálogo / WhatsApp */}
          <Card
            variant="interactive"
            onClick={() => navigate("/pedidos")}
            className={`p-4 border transition-all ${
              pedidosPendentes.length > 0
                ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                : "hover:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    pedidosPendentes.length > 0
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-heading, #ffffff)" }}
                  >
                    Pedidos do Catálogo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {pedidosPendentes.length > 0
                      ? `${pedidosPendentes.length} aguardando separação`
                      : "Nenhum pedido pendente"}
                  </p>
                </div>
              </div>

              <Badge
                variant={pedidosPendentes.length > 0 ? "warning" : "success"}
                size="sm"
                withDot={pedidosPendentes.length > 0}
                pulseDot={pedidosPendentes.length > 0}
              >
                {pedidosPendentes.length > 0 ? "Requer Ação" : "Em Dia"}
              </Badge>
            </div>

            <div
              className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] text-amber-400 font-medium"
              style={{ borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))" }}
            >
              <span>{pedidosPendentes.length > 0 ? "Abrir Kanban de Separação" : "Ver todos os pedidos"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>

          {/* Alerta 2: Estoque Baixo / Ruptura de Balcão */}
          <Card
            variant="interactive"
            onClick={() => navigate("/estoque-loja")}
            className={`p-4 border transition-all ${
              produtosEstoqueBaixo.length > 0
                ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60"
                : "hover:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    produtosEstoqueBaixo.length > 0
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-heading, #ffffff)" }}
                  >
                    Alerta de Estoque Baixo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {produtosEstoqueBaixo.length > 0
                      ? `${produtosEstoqueBaixo.length} itens abaixo do mínimo (${limiteEstoqueMinimo} un)`
                      : "Estoque balanceado sem rupturas"}
                  </p>
                </div>
              </div>

              <Badge
                variant={produtosEstoqueBaixo.length > 0 ? "danger" : "success"}
                size="sm"
                withDot={produtosEstoqueBaixo.length > 0}
              >
                {produtosEstoqueBaixo.length > 0 ? "Reposição" : "Regular"}
              </Badge>
            </div>

            <div
              className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] text-rose-400 font-medium"
              style={{ borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))" }}
            >
              <span>{produtosEstoqueBaixo.length > 0 ? "Emitir reposição / NF-e" : "Auditar estoque no balcão"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Card>

          {/* Alerta 3: Visão de Saúde Financeira do Mês */}
          <Card
            variant="interactive"
            onClick={() => navigate("/relatorios")}
            className="p-4 border hover:border-emerald-500/40 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-heading, #ffffff)" }}
                  >
                    Faturamento Mensal
                  </h3>
                  <p className="text-base font-extrabold text-emerald-400">
                    {formatCurrency(metrics.totalMes || metrics.totalVendasHoje || 0)}
                  </p>
                </div>
              </div>

              <Badge variant="success" size="sm">
                DRE Ativo
              </Badge>
            </div>

            <div
              className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] text-emerald-400 font-medium"
              style={{ borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))" }}
            >
              <span>Ver DRE Gerencial Completo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </Card>
        </div>
      </div>
      )}

      {/* 4. Grid de Módulos Operacionais da Empresa (Cards Limpos) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-heading, #ffffff)" }}
          >
            Módulos Operacionais da Empresa
          </h2>
          <span className="text-xs text-slate-400">
            {visibleNavCards.length} atalhos ativos
          </span>
        </div>

        <div className={gridColsClass}>
          {visibleNavCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id || item.route}
                variant="interactive"
                className={`${densityPaddingClass} flex flex-col justify-between transition-all ${item.borderColor}`}
                onClick={() =>
                  item.isExternal ? window.open(item.route, "_blank") : navigate(item.route)
                }
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl ${item.bgColor} border flex items-center justify-center ${item.color}`}
                      style={{ borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))" }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <Badge variant={item.badgeVariant} size="sm">
                      {item.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3
                      className="text-lg font-bold group-hover:text-sky-400 transition-colors"
                      style={{ color: "var(--text-heading, #ffffff)" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div
                  className="pt-4 border-t mt-5 flex items-center justify-between text-xs font-medium text-sky-400"
                  style={{ borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))" }}
                >
                  <span>Acessar Módulo</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
