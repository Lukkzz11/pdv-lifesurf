import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  TIPOS_EVENTO
} from "../services/calendarService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { cn } from "../utils/cn";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Truck,
  Package,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Send
} from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function Calendario() {
  const { currentCompany } = useTenant();
  const tenantId = currentCompany?.id || "demo-lifesurf";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState("todos");

  // Controle de navegação de mês/ano
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Modal de novo agendamento
  const [modalOpen, setModalOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    tipo: "entrega_pedido",
    data: new Date().toISOString().split("T")[0],
    horario: "14:00",
    responsavel: "",
    cliente: "",
    descricao: ""
  });

  // Carregar eventos
  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarEvents(tenantId);
      setEvents(data);
    } catch (err) {
      console.error("Erro ao carregar calendário:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [tenantId]);

  // Navegação de mês
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split("T")[0]);
  };

  // Cálculo da grade do mês
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Dias do mês anterior para preencher a primeira semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: false
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: true
      });
    }

    // Dias do próximo mês para completar 35 ou 42 células
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: false
      });
    }

    return days;
  }, [year, month]);

  // Indexação de eventos por data
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((evt) => {
      if (tipoFiltro !== "todos" && evt.tipo !== tipoFiltro) return;
      if (!map[evt.data]) map[evt.data] = [];
      map[evt.data].push(evt);
    });
    return map;
  }, [events, tipoFiltro]);

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    return (eventsByDate[selectedDateStr] || []).sort((a, b) =>
      (a.horario || "").localeCompare(b.horario || "")
    );
  }, [eventsByDate, selectedDateStr]);

  // Estatísticas rápidas
  const todayStr = new Date().toISOString().split("T")[0];
  const stats = useMemo(() => {
    const todayCount = (eventsByDate[todayStr] || []).length;
    const deliveriesCount = events.filter((e) => e.tipo === "entrega_pedido").length;
    const opsCount = events.filter((e) => e.tipo === "producao_op").length;
    return { todayCount, deliveriesCount, opsCount };
  }, [events, eventsByDate, todayStr]);

  // Submeter novo evento
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;

    setFormSaving(true);
    try {
      const created = await createCalendarEvent(tenantId, formData);
      setEvents((prev) => [created, ...prev]);
      setModalOpen(false);
      setSelectedDateStr(formData.data);
      setFormData({
        titulo: "",
        tipo: "entrega_pedido",
        data: new Date().toISOString().split("T")[0],
        horario: "14:00",
        responsavel: "",
        cliente: "",
        descricao: ""
      });
    } catch (err) {
      alert("Erro ao salvar agendamento: " + err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const getTipoBadge = (tipo) => {
    const config = TIPOS_EVENTO[tipo?.toUpperCase()] || TIPOS_EVENTO.LEMBRETE;
    return <Badge variant={config.badge}>{config.label}</Badge>;
  };

  const getTipoDotColor = (tipo) => {
    switch (tipo) {
      case "entrega_pedido":
        return "bg-emerald-500";
      case "retirada_balcao":
        return "bg-sky-500";
      case "producao_op":
        return "bg-purple-500";
      case "chegada_tecido":
        return "bg-amber-500";
      default:
        return "bg-slate-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Calendário Operacional Integrado
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão visual de entregas, retiradas no balcão e prazos de produção de lotes (OP).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToday}
            className="text-xs"
          >
            Ir para Hoje
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormData((prev) => ({ ...prev, data: selectedDateStr }));
              setModalOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-white to-purple-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Compromissos Hoje
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                {stats.todayCount}
              </h3>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Entregas Agendadas
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                {stats.deliveriesCount}
              </h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500 bg-gradient-to-br from-white to-sky-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Lotes em Produção (OP)
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                {stats.opsCount}
              </h3>
            </div>
            <div className="p-3 bg-sky-100 rounded-xl text-sky-600">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Calendário à esquerda + Painel do Dia à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Lado Esquerdo: Calendário Mensal */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm border-slate-200">
            {/* Header de Navegação do Calendário */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-bold text-slate-800 min-w-44 text-center">
                  {MESES[month]} de {year}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Filtro por tipo */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTipoFiltro("todos")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
                    tipoFiltro === "todos"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltro("entrega_pedido")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1",
                    tipoFiltro === "entrega_pedido"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Entregas
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltro("retirada_balcao")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1",
                    tipoFiltro === "retirada_balcao"
                      ? "bg-sky-600 text-white"
                      : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Retiradas
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltro("producao_op")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1",
                    tipoFiltro === "producao_op"
                      ? "bg-purple-600 text-white"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Fábrica (OP)
                </button>
              </div>
            </div>

            {/* Grid dos Dias da Semana */}
            <div className="grid grid-cols-7 border-b border-slate-200 text-center bg-slate-100/60 font-semibold text-xs text-slate-600 py-2">
              {DIAS_SEMANA.map((d, idx) => (
                <div key={idx} className={idx === 0 || idx === 6 ? "text-slate-400" : ""}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid dos Dias do Mês */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50">
              {calendarDays.map((cell, idx) => {
                const dayEvts = eventsByDate[cell.dateStr] || [];
                const isSelected = cell.dateStr === selectedDateStr;
                const isToday = cell.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateStr(cell.dateStr)}
                    className={cn(
                      "min-h-24 p-1.5 transition-all cursor-pointer flex flex-col justify-between relative group",
                      cell.isCurrentMonth ? "bg-white" : "bg-slate-50/60 text-slate-400",
                      isSelected && "ring-2 ring-purple-600 ring-inset bg-purple-50/20 z-10",
                      isToday && !isSelected && "bg-amber-50/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                          isToday
                            ? "bg-purple-600 text-white font-bold"
                            : isSelected
                            ? "text-purple-700 font-bold"
                            : cell.isCurrentMonth
                            ? "text-slate-700"
                            : "text-slate-400"
                        )}
                      >
                        {cell.dayNum}
                      </span>

                      {dayEvts.length > 0 && (
                        <span className="text-[10px] font-medium text-slate-400 group-hover:text-purple-600">
                          {dayEvts.length}
                        </span>
                      )}
                    </div>

                    {/* Chips dos eventos do dia */}
                    <div className="space-y-1 my-1 overflow-hidden">
                      {dayEvts.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded truncate flex items-center gap-1 leading-tight",
                            ev.tipo === "entrega_pedido" && "bg-emerald-100 text-emerald-800",
                            ev.tipo === "retirada_balcao" && "bg-sky-100 text-sky-800",
                            ev.tipo === "producao_op" && "bg-purple-100 text-purple-800",
                            ev.tipo === "chegada_tecido" && "bg-amber-100 text-amber-800",
                            ev.tipo === "lembrete" && "bg-slate-100 text-slate-800"
                          )}
                          title={`${ev.horario ? ev.horario + " - " : ""}${ev.titulo}`}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              getTipoDotColor(ev.tipo)
                            )}
                          />
                          <span className="truncate">{ev.titulo}</span>
                        </div>
                      ))}

                      {dayEvts.length > 2 && (
                        <div className="text-[9px] font-semibold text-slate-500 pl-1">
                          +{dayEvts.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Lado Direito: Detalhes do Dia Selecionado */}
        <div className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-purple-600" />
                    {selectedDateStr.split("-").reverse().join("/")}
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedDayEvents.length === 0
                      ? "Nenhum compromisso agendado"
                      : `${selectedDayEvents.length} compromisso(s) encontrado(s)`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, data: selectedDateStr }));
                    setModalOpen(true);
                  }}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agendar
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CalendarDays className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-sm font-medium">Dia livre sem pendências</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Use o botão "+ Agendar" para registrar entregas, chegadas de tecido ou prazos de corte.
                  </p>
                </div>
              ) : (
                selectedDayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-all shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-800 leading-snug">
                        {evt.titulo}
                      </h4>
                      {getTipoBadge(evt.tipo)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {evt.horario && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-purple-600" />
                          {evt.horario}
                        </span>
                      )}
                      {evt.responsavel && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {evt.responsavel}
                        </span>
                      )}
                    </div>

                    {evt.cliente && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <strong className="text-slate-700">Cliente/Contato:</strong> {evt.cliente}
                      </p>
                    )}

                    {evt.descricao && (
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {evt.descricao}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal: Novo Agendamento */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo Agendamento Operacional"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Título do Compromisso / Meta *"
            placeholder="Ex: Entrega Encomenda Atacado #PED-8492"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tipo de Evento"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              options={[
                { value: "entrega_pedido", label: "Entrega de Pedido" },
                { value: "retirada_balcao", label: "Retirada no Balcão" },
                { value: "producao_op", label: "Término de Lote (OP)" },
                { value: "chegada_tecido", label: "Chegada de Matéria-Prima" },
                { value: "lembrete", label: "Lembrete Geral" }
              ]}
            />

            <Input
              type="time"
              label="Horário Previsto"
              value={formData.horario}
              onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="date"
              label="Data do Agendamento"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              required
            />

            <Input
              label="Responsável / Operador"
              placeholder="Ex: Motoboy Carlos, Mestre Fábrica"
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
            />
          </div>

          <Input
            label="Cliente / Contato (Opcional)"
            placeholder="Ex: Rodrigo Silva (85) 99888-7766"
            value={formData.cliente}
            onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Observações / Instruções
            </label>
            <textarea
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              rows={3}
              placeholder="Detalhes adicionais, itens a separar ou cobrança..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={formSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {formSaving ? "Salvando..." : "Salvar no Calendário"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Calendario;
