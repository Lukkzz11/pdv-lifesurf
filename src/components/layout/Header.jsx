import { useState, useEffect } from "react";
import { useAuth } from "../../security/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  setupPushNotifications,
  playOrderAlertSound,
  sendLocalPushNotification
} from "../../services/notificationService";
import {
  Menu,
  Building,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  CircleDollarSign,
  Bell,
  Volume2,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from "lucide-react";

export function Header({ onToggleMobileMenu, sidebarCollapsed }) {
  const { user, userProfile, role, logout } = useAuth();
  const { activeTenantId, activeUnitId } = useTenant();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      titulo: "Novo Pedido no Catálogo!",
      mensagem: "Pedido #PED-2610-8492 recebido via WhatsApp (R$ 297,00).",
      hora: "Há 5 min",
      lida: false,
      tipo: "pedido"
    },
    {
      id: "notif-2",
      titulo: "Lote de Produção Concluído",
      mensagem: "OP-2026-084 de Camisetas Silk Waves foi finalizada na fábrica.",
      hora: "Há 40 min",
      lida: false,
      tipo: "producao"
    }
  ]);
  const [pushStatus, setPushStatus] = useState("default");

  // Iniciar checagem de permissão
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  const handleTestAlert = () => {
    playOrderAlertSound();
    sendLocalPushNotification(
      "Alerta LifeSurf Teste",
      "O som de alerta e as notificações push do seu PDV estão 100% operacionais!"
    );
  };

  const handleEnablePush = async () => {
    const token = await setupPushNotifications(activeTenantId);
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission);
    }
    if (token) {
      playOrderAlertSound();
      alert("Notificações Push ativadas com sucesso neste dispositivo!");
    }
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  // Exemplo de status operacional (será integrado dinamicamente na fase de caixa)
  const isCashierOpen = true;

  return (
    <header className="sticky top-0 z-30 h-16 w-full glass-panel border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Context Info */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Informações da Empresa e Loja Ativa */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850/80 border border-slate-800 text-xs text-slate-300">
            <Building className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold text-white uppercase tracking-wider">
              {activeTenantId || "LifeSurf"}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 capitalize">{activeUnitId || "Matriz"}</span>
          </div>

          {/* Badge de Status do Caixa */}
          <Badge
            variant={isCashierOpen ? "success" : "danger"}
            withDot={true}
            pulseDot={isCashierOpen}
            size="sm"
            className="hidden xs:inline-flex"
          >
            {isCashierOpen ? "Caixa Aberto" : "Caixa Fechado"}
          </Badge>
        </div>
      </div>

      {/* Right: Atalhos Rápidos e Menu de Usuário */}
      <div className="flex items-center gap-3">
        {/* Indicador de Atalho Rápido para PDV */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-800">
          <CircleDollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>F2: Nova Venda</span>
        </div>

        {/* Central de Notificações Push & Alertas */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifMenuOpen((prev) => !prev)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-700/60 cursor-pointer"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse ring-2 ring-slate-900" />
            )}
          </button>

          {/* Dropdown de Notificações */}
          {notifMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-dropdown rounded-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 shadow-2xl border border-slate-700/70">
                <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Notificações & Alertas
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                        {unreadCount} novas
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[11px] text-slate-400 hover:text-sky-400 transition-colors"
                    >
                      Marcar lidas
                    </button>
                  )}
                </div>

                {/* Lista de Alertas */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "p-3 text-xs transition-colors hover:bg-slate-800/40",
                        !n.lida && "bg-sky-950/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-white leading-tight">
                          {n.titulo}
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {n.hora}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
                        {n.mensagem}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Ações Rápidas de Push e Som */}
                <div className="p-3 bg-slate-900/80 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleTestAlert}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                      Testar Som
                    </button>

                    <button
                      type="button"
                      onClick={handleEnablePush}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors",
                        pushStatus === "granted"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-sky-600 hover:bg-sky-500 text-white"
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {pushStatus === "granted" ? "Push Ativado" : "Ativar no Celular"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Menu do Usuário */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-700/60 cursor-pointer"
            aria-expanded={userMenuOpen}
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-semibold text-xs">
              {user?.email ? user.email.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-medium text-slate-200 truncate max-w-[130px]">
                {userProfile?.nome || user?.email?.split("@")[0] || "Usuário"}
              </span>
              <span className="text-[10px] text-sky-400 font-mono uppercase tracking-wider">
                {role || "Operador"}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Dropdown do Usuário */}
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 glass-dropdown rounded-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-xs font-medium text-white truncate">
                    {userProfile?.nome || "Usuário Conectado"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-sky-400">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Perfil: {role}</span>
                  </div>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair do Sistema</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
