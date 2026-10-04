import { NavLink } from "react-router-dom";
import { useAuth } from "../../security/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { USER_ROLES } from "../../config/constants";
import { cn } from "../../utils/cn";
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  Factory,
  Package,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Building2,
  Clock,
  Waves,
  Globe,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Tag,
  ShoppingBag,
  Receipt
} from "lucide-react";

export function Sidebar({ collapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) {
  const { role } = useAuth();
  const { activeTenantId } = useTenant();

  const isManagerOrAdmin = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.GERENTE
  ].includes(role);

  const isSuperadminOrAdmin = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN
  ].includes(role);

  const navItems = [
    {
      to: "/workspace",
      label: "Painel Geral",
      shortLabel: "Painel",
      icon: LayoutDashboard
    },
    {
      to: `/catalogo/${activeTenantId || "lifesurf"}`,
      label: "Catálogo Online",
      shortLabel: "Catálogo",
      icon: Globe,
      badge: "Público",
      external: true
    },
    {
      to: "/gerenciar-catalogo",
      label: "Editar Catálogo",
      shortLabel: "Vitrine",
      icon: ShoppingBag,
      badge: "Gestão"
    },
    {
      to: "/pdv",
      label: "Frente de Caixa",
      shortLabel: "PDV",
      icon: ShoppingCart,
      badge: "F2"
    },
    {
      to: "/estoque-loja",
      label: "Estoque Loja",
      shortLabel: "Loja",
      icon: Store
    },
    {
      to: "/estoque-fabrica",
      label: "Estoque Fábrica",
      shortLabel: "Fábrica",
      icon: Factory
    },
    {
      to: "/pedidos",
      label: "Pedidos & Fluxo",
      shortLabel: "Pedidos",
      icon: ClipboardList
    },
    {
      to: "/calendario",
      label: "Calendário",
      shortLabel: "Agenda",
      icon: Calendar
    },
    {
      to: "/etiquetas",
      label: "Editor Etiquetas",
      shortLabel: "Etiquetas",
      icon: Tag
    },
    {
      to: "/relatorios",
      label: "Relatórios & DRE",
      shortLabel: "Relatórios",
      icon: BarChart3
    },
    {
      to: "/clientes",
      label: "Clientes & CRM",
      shortLabel: "Clientes",
      icon: Users
    },
    {
      to: "/a-ver",
      label: "Contas A Ver",
      shortLabel: "A Ver",
      icon: Clock
    },
    {
      to: "/financeiro",
      label: "Gastos & Entradas",
      shortLabel: "Gastos",
      icon: Receipt,
      badge: "Drive"
    },
    {
      to: "/configuracoes",
      label: "Configurações",
      shortLabel: "Config",
      icon: Settings
    },
    {
      to: "/selecionar-empresa",
      label: "Trocar de Empresa",
      shortLabel: "Empresas",
      icon: Building2
    }
  ];

  return (
    <>
      {/* Backdrop para telas mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Container da Sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 flex flex-col glass-panel border-r border-slate-800/80 transition-all duration-300 ease-in-out",
          // Largura em Desktop
          collapsed ? "lg:w-20" : "lg:w-64",
          // Responsividade Mobile
          isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header com Logo LifeSurf Oficial */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {(!collapsed || isMobileOpen) ? (
              <img
                src="/assets/logo-white.png"
                alt="LifeSurf Logo"
                className="h-9 w-auto max-w-[155px] object-contain select-none"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling.style.display = "flex";
                }}
              />
            ) : (
              <img
                src="/assets/logo-white.png"
                alt="LifeSurf"
                className="h-8 w-8 object-contain select-none"
              />
            )}

            {/* Fallback caso a imagem demore ou falhe */}
            <div className="hidden items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-sky-500/20 shrink-0">
                <Waves className="w-4 h-4 text-slate-950" />
              </div>
              {(!collapsed || isMobileOpen) && (
                <div className="flex flex-col truncate">
                  <span className="font-extrabold text-sm tracking-wider text-white">
                    LIFE<span className="text-sky-400">SURF</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Botão de colapsar em Desktop */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.external) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onCloseMobile}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group relative select-none text-slate-400 hover:text-white hover:bg-slate-800/50"
                  title={collapsed && !isMobileOpen ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0 text-sky-400 group-hover:scale-105 transition-transform" />
                  {(!collapsed || isMobileOpen) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {(!collapsed || isMobileOpen) && item.badge && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group relative select-none",
                    isActive
                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/10"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                  )
                }
                title={collapsed && !isMobileOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" />

                {(!collapsed || isMobileOpen) && (
                  <span className="truncate flex-1">{item.label}</span>
                )}

                {(!collapsed || isMobileOpen) && item.badge && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-slate-800/80 text-center">
          {(!collapsed || isMobileOpen) ? (
            <div className="text-[11px] text-slate-500 font-mono">
              LifeSurf • Multi-tenant v2
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 font-mono font-bold">v2</div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
