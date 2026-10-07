import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNav from "./MobileNav";
import { cn } from "../../utils/cn";

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col antialiased transition-colors duration-200"
      style={{
        backgroundColor: "var(--bg-main, #090d16)",
        color: "var(--text-body, #f8fafc)"
      }}
    >
      {/* Sidebar para Desktop e Drawer para Mobile */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Área Principal de Conteúdo */}
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        {/* Header Superior */}
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />

        {/* Viewport da Página com padding seguro para navegação mobile */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Barra de Navegação Inferior para Mobile e Dispositivos Touch */}
      <MobileNav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
}

export default MainLayout;
