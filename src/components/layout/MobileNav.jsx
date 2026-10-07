import { NavLink } from "react-router-dom";
import { ShoppingCart, DollarSign, Package, BarChart3, Menu, Trophy } from "lucide-react";
import { useTenant } from "../../contexts/TenantContext";
import { cn } from "../../utils/cn";

export function MobileNav({ onOpenMobileMenu }) {
  const { activeTenantId } = useTenant();

  const items = activeTenantId === "arena-sandplay"
    ? [
        { to: "/arena-sandplay", label: "Quadras", icon: Trophy },
        { to: "/pdv", label: "PDV", icon: ShoppingCart },
        { to: "/caixa-loja", label: "Caixa", icon: DollarSign },
        { to: "/relatorios", label: "DRE", icon: BarChart3 }
      ]
    : [
        { to: "/pdv", label: "PDV", icon: ShoppingCart },
        { to: "/caixa-loja", label: "Caixa", icon: DollarSign },
        { to: "/estoque", label: "Estoque", icon: Package },
        { to: "/relatorios", label: "DRE", icon: BarChart3 }
      ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 glass-dropdown border-t border-slate-800/80 px-2 flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center w-16 h-12 rounded-xl text-[10px] font-medium transition-all duration-150 select-none",
                isActive
                  ? "text-sky-400 bg-sky-500/10 border border-sky-500/20"
                  : "text-slate-400 hover:text-slate-200"
              )
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}

      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center w-16 h-12 rounded-xl text-[10px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

export default MobileNav;
