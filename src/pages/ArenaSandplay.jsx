import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import {
  ARENA_COURTS,
  ARENA_HORARIOS,
  MODALIDADES_ARENA,
  fetchArenaBookings,
  createArenaBooking,
  updateArenaBooking,
  deleteArenaBooking
} from "../services/arenaService";
import {
  getArenaFirebaseConfig,
  isDedicatedArenaFirebaseConfigured,
  saveArenaCustomFirebaseConfig,
  clearArenaCustomFirebaseConfig
} from "../config/arenaFirebase";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import { formatCurrency, formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import toast from "react-hot-toast";
import {
  Trophy,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Database,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Phone,
  Building2,
  Sun,
  Flame,
  Globe,
  MapPin,
  Check,
  Send,
  Zap,
  Sparkles,
  ArrowLeft
} from "lucide-react";

export default function ArenaSandplay() {
  const { userProfile } = useAuth();
  const { switchTenant, activeTenantId } = useTenant();
  const navigate = useNavigate();

  // Data Selecionada (padrão hoje YYYY-MM-DD)
  const [dataSelecionada, setDataSelecionada] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [quadraFiltro, setQuadraFiltro] = useState("todas");
  const [modalidadeFiltro, setModalidadeFiltro] = useState("todas");

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Alugar Horário
  const [modalAlugarAberto, setModalAlugarAberto] = useState(false);
  const [salvandoBooking, setSalvandoBooking] = useState(false);
  const [formReserva, setFormReserva] = useState({
    quadraId: "quadra-1",
    horario: "18:00",
    clienteNome: "",
    clienteTelefone: "",
    modalidade: "Beach Tennis",
    valor: "100",
    formaPagamento: "pix",
    statusPagamento: "pago",
    observacoes: ""
  });

  // Modal Detalhes do Horário Agendado
  const [bookingSelecionado, setBookingSelecionado] = useState(null);

  // Modal de Conexão com Firebase Dedicado da Arena
  const [modalFirebaseAberto, setModalFirebaseAberto] = useState(false);
  const [firebaseConfigState, setFirebaseConfigState] = useState(getArenaFirebaseConfig());
  const [formFirebase, setFormFirebase] = useState({
    apiKey: firebaseConfigState.apiKey || "",
    projectId: firebaseConfigState.projectId || "",
    authDomain: firebaseConfigState.authDomain || "",
    storageBucket: firebaseConfigState.storageBucket || ""
  });

  // Carrega agendamentos da data
  const carregarAgendamentos = async (dataStr = dataSelecionada) => {
    setLoading(true);
    try {
      const lista = await fetchArenaBookings(dataStr);
      setBookings(lista);
    } catch (err) {
      console.error("[ArenaSandplay] Erro ao carregar agendamentos:", err);
      toast.error("Erro ao carregar agenda de horários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAgendamentos(dataSelecionada);
  }, [dataSelecionada]);

  // Muda a data atual
  const mudarData = (dias) => {
    const d = new Date(dataSelecionada + "T00:00:00");
    d.setDate(d.getDate() + dias);
    setDataSelecionada(d.toISOString().split("T")[0]);
  };

  // Abre modal de locação para slot específico
  const handleSlotClick = (quadra, horario) => {
    setFormReserva({
      quadraId: quadra.id,
      horario,
      clienteNome: "",
      clienteTelefone: "",
      modalidade: modalidadeFiltro !== "todas" ? modalidadeFiltro : "Beach Tennis",
      valor: String(quadra.valorHora || 90),
      formaPagamento: "pix",
      statusPagamento: "pago",
      observacoes: ""
    });
    setModalAlugarAberto(true);
  };

  // Salvar locação de horário
  const handleSalvarLocacao = async (e) => {
    e.preventDefault();
    if (!formReserva.clienteNome.trim()) {
      toast.error("Informe o nome do responsável pelo horário.");
      return;
    }

    const quadraInfo = ARENA_COURTS.find((q) => q.id === formReserva.quadraId);

    setSalvandoBooking(true);
    try {
      await createArenaBooking({
        ...formReserva,
        quadraNome: quadraInfo?.nome || "Quadra",
        data: dataSelecionada
      });

      toast.success("Horário alugado com sucesso!");
      setModalAlugarAberto(false);
      await carregarAgendamentos(dataSelecionada);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao confirmar locação de horário.");
    } finally {
      setSalvandoBooking(false);
    }
  };

  // Excluir agendamento
  const handleExcluirAgendamento = async (id) => {
    if (!window.confirm("Deseja realmente liberar este horário?")) return;
    try {
      await deleteArenaBooking(id);
      toast.success("Horário desocupado com sucesso!");
      setBookingSelecionado(null);
      await carregarAgendamentos(dataSelecionada);
    } catch (err) {
      toast.error("Erro ao excluir agendamento.");
    }
  };

  // Enviar confirmação no WhatsApp
  const handleWhatsAppBooking = (booking) => {
    const tel = (booking.clienteTelefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${booking.clienteNome}! Seu horário na Arena Sandplay está confirmado:\n\n` +
      `📅 Data: ${formatDate(booking.data || dataSelecionada)}\n` +
      `⏰ Horário: ${booking.horario}\n` +
      `📍 Quadra: ${booking.quadraNome}\n` +
      `🎾 Tipo / Modalidade: ${booking.modalidade}\n` +
      `💰 Valor: ${formatCurrency(booking.valor)}\n\n` +
      `Te esperamos na quadra!`
    );
    window.open(`https://wa.me/${tel ? `55${tel}` : ""}?text=${msg}`, "_blank");
  };

  // Configuração do Firebase da Arena
  const handleSalvarFirebaseConfig = (e) => {
    e.preventDefault();
    try {
      saveArenaCustomFirebaseConfig(formFirebase);
      toast.success("Credenciais do Firebase Arena atualizadas! Recarregando...");
      setModalFirebaseAberto(false);
    } catch (err) {
      toast.error(err.message || "Erro ao salvar credenciais.");
    }
  };

  const handleRestaurarFirebasePadrao = () => {
    if (window.confirm("Deseja restaurar as configurações padrão?")) {
      clearArenaCustomFirebaseConfig();
    }
  };

  // Filtra as quadras exibidas
  const quadrasExibidas = useMemo(() => {
    if (quadraFiltro === "todas") return ARENA_COURTS;
    return ARENA_COURTS.filter((q) => q.id === quadraFiltro);
  }, [quadraFiltro]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* 1. CABEÇALHO DA ARENA SANDPLAY (FOCADO NO AMBIENTE DE LOCAÇÃO E FIREBASE DEDICADO) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-950/20 border border-amber-500/30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30">
            <Trophy className="w-7 h-7 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-wide flex flex-wrap items-center gap-2">
                ARENA SANDPLAY
                <Badge variant="warning" size="sm" className="font-mono text-[10px]">
                  ESPORTES DE AREIA
                </Badge>
                <Badge variant="success" size="sm" className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Firebase Dedicado: arenasandplay-fc30f
                </Badge>
              </h1>
            </div>
            <p className="text-xs text-amber-200/80 mt-1">
              Aluguel de Horários de Quadras • Beach Tennis, Futevôlei e Vôlei de Areia
            </p>
          </div>
        </div>

        {/* Ações Diretas: Alugar Horário & Conexão Firebase Dedicado */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFormReserva({
                quadraId: "quadra-1",
                horario: "18:00",
                clienteNome: "",
                clienteTelefone: "",
                modalidade: "Beach Tennis",
                valor: "100",
                formaPagamento: "pix",
                statusPagamento: "pago",
                observacoes: ""
              });
              setModalAlugarAberto(true);
            }}
            leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-lg shadow-amber-400/20"
          >
            Alugar Horário
          </Button>

          {/* Botão de Conexão com Firebase Dedicado da Arena */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalFirebaseAberto(true)}
            leftIcon={<Database className="w-4 h-4 text-sky-400" />}
            className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10 font-medium"
            title="A Arena utiliza um Firebase independente do restante do sistema"
          >
            {isDedicatedArenaFirebaseConfigured() ? "Firebase Arena (Dedicado)" : "Configurar Firebase"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            leftIcon={<ArrowLeft className="w-4 h-4 text-slate-400" />}
            className="text-slate-400 hover:text-white"
          >
            Voltar ao Painel
          </Button>
        </div>
      </div>

      {/* 2. SELETOR DE TIPO (TIPOS DE QUADRA & MODALIDADES) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              1. Selecione o Tipo de Quadra & Modalidade
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {ARENA_COURTS.length} quadras ativas para locação
          </span>
        </div>

        {/* Cards dos Tipos de Quadra */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ARENA_COURTS.map((court) => {
            const isSelected = quadraFiltro === court.id;
            return (
              <Card
                key={court.id}
                variant="interactive"
                onClick={() => setQuadraFiltro(isSelected ? "todas" : court.id)}
                className={`p-5 transition-all cursor-pointer border-2 ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                    : "border-slate-800 hover:border-slate-700 bg-slate-900/60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">
                        {court.nome}
                      </h3>
                      <p className="text-xs text-amber-300/80 mt-0.5">
                        {court.tipo}
                      </p>
                    </div>
                  </div>

                  <Badge variant={isSelected ? "warning" : "neutral"} size="sm">
                    {isSelected ? "Selecionada" : "Filtrar"}
                  </Badge>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Valor da hora:</span>
                  <span className="text-base font-black text-amber-400 font-mono">
                    {formatCurrency(court.valorHora)}/h
                  </span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Chips de Tipos de Modalidade */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 shrink-0">
            Tipo de Esporte:
          </span>
          {["todas", ...MODALIDADES_ARENA].map((mod) => (
            <button
              key={mod}
              type="button"
              onClick={() => setModalidadeFiltro(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                modalidadeFiltro === mod
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-sm font-bold"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              {mod === "todas" ? "Todas as Modalidades" : mod}
            </button>
          ))}
        </div>
      </div>

      {/* 3. SEÇÃO PRINCIPAL: ALUGAR HORÁRIO (GRADE DE HORÁRIOS DISPONÍVEIS) */}
      <Card className="p-6 space-y-6 border-slate-800 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Alugar Horário • Grade de Disponibilidade
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha a data desejada e clique em qualquer horário vago para alugar de imediato.
            </p>
          </div>

          {/* Navegação entre Dias */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mudarData(-1)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Calendar className="w-4 h-4 text-amber-400" />
              <Input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="bg-transparent border-0 p-0 text-xs font-bold text-white focus:ring-0 w-32"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => mudarData(1)}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Próximo
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDataSelecionada(new Date().toISOString().split("T")[0])}
              className="text-xs text-amber-300"
            >
              Hoje
            </Button>
          </div>
        </div>

        {/* Tabela de Locação de Horários por Quadra */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-3 px-3 text-xs font-bold text-slate-400 uppercase w-24">
                  Horário
                </th>
                {quadrasExibidas.map((quadra) => (
                  <th key={quadra.id} className="py-3 px-3 text-xs font-bold text-white uppercase">
                    <div className="flex items-center justify-between">
                      <span>{quadra.nome}</span>
                      <Badge variant="warning" size="sm" className="font-mono">
                        {formatCurrency(quadra.valorHora)}/h
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ARENA_HORARIOS.map((horario) => (
                <tr key={horario} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-xs text-amber-300 bg-slate-950/60 rounded-l-lg">
                    {horario}
                  </td>
                  {quadrasExibidas.map((quadra) => {
                    const booking = bookings.find(
                      (b) => b.quadraId === quadra.id && b.horario === horario
                    );

                    // Slot Ocupado
                    if (booking) {
                      return (
                        <td key={quadra.id} className="py-2.5 px-2">
                          <div
                            onClick={() => setBookingSelecionado(booking)}
                            className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer transition-all shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-white truncate max-w-[130px]">
                                {booking.clienteNome}
                              </span>
                              <Badge variant="warning" size="sm" className="text-[10px]">
                                Reservado
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                              <span>{booking.modalidade || "Beach Tennis"}</span>
                              <span className="font-mono font-bold text-amber-400">
                                {formatCurrency(booking.valor)}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // Slot Livre / Disponível para Alugar Horário
                    return (
                      <td key={quadra.id} className="py-2.5 px-2">
                        <button
                          type="button"
                          onClick={() => handleSlotClick(quadra, horario)}
                          className="w-full py-3 px-3 rounded-xl border border-dashed border-emerald-500/30 hover:border-emerald-400 bg-emerald-950/10 hover:bg-emerald-500/15 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer group"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-125 transition-transform" />
                          <span>Alugar Horário</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. MODAL ALUGAR HORÁRIO (FORMULÁRIO DIRETO E SIMPLES) */}
      <Modal isOpen={modalAlugarAberto} onClose={() => setModalAlugarAberto(false)} size="md">
        <ModalHeader onClose={() => setModalAlugarAberto(false)}>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Alugar Horário • Arena Sandplay</span>
          </div>
        </ModalHeader>
        <form onSubmit={handleSalvarLocacao}>
          <ModalBody className="space-y-4">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-center justify-between">
              <div>
                Data: <strong className="text-white">{formatDate(dataSelecionada)}</strong> às{" "}
                <strong className="text-amber-300">{formReserva.horario}</strong>
              </div>
              <Badge variant="warning" size="sm">
                Aluguel de Quadra
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Tipo de Quadra *
                </label>
                <Select
                  value={formReserva.quadraId}
                  onChange={(e) => {
                    const qId = e.target.value;
                    const court = ARENA_COURTS.find((c) => c.id === qId);
                    setFormReserva({
                      ...formReserva,
                      quadraId: qId,
                      valor: court ? String(court.valorHora) : formReserva.valor
                    });
                  }}
                >
                  {ARENA_COURTS.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nome} ({formatCurrency(q.valorHora)}/h)
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Horário
                </label>
                <Select
                  value={formReserva.horario}
                  onChange={(e) => setFormReserva({ ...formReserva, horario: e.target.value })}
                >
                  {ARENA_HORARIOS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome do Responsável / Atleta *
              </label>
              <Input
                placeholder="Ex: Lucas Emanuel ou Grupo Sexta"
                value={formReserva.clienteNome}
                onChange={(e) => setFormReserva({ ...formReserva, clienteNome: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  WhatsApp / Telefone
                </label>
                <Input
                  placeholder="(85) 99999-9999"
                  value={formReserva.clienteTelefone}
                  onChange={(e) => setFormReserva({ ...formReserva, clienteTelefone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Tipo de Modalidade
                </label>
                <Select
                  value={formReserva.modalidade}
                  onChange={(e) => setFormReserva({ ...formReserva, modalidade: e.target.value })}
                >
                  {MODALIDADES_ARENA.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Valor da Locação (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formReserva.valor}
                  onChange={(e) => setFormReserva({ ...formReserva, valor: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Forma de Pagamento
                </label>
                <Select
                  value={formReserva.formaPagamento}
                  onChange={(e) => setFormReserva({ ...formReserva, formaPagamento: e.target.value })}
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Observações
              </label>
              <Input
                placeholder="Ex: Aluguel de raquetes / bolinhas inclusas"
                value={formReserva.observacoes}
                onChange={(e) => setFormReserva({ ...formReserva, observacoes: e.target.value })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setModalAlugarAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={salvandoBooking}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-lg shadow-amber-400/20"
            >
              {salvandoBooking ? "Salvando..." : "Confirmar e Alugar Horário"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* 5. MODAL DETALHES DE HORÁRIO ALUGADO */}
      {bookingSelecionado && (
        <Modal isOpen={true} onClose={() => setBookingSelecionado(null)} size="md">
          <ModalHeader onClose={() => setBookingSelecionado(null)}>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Horário Alugado: {bookingSelecionado.clienteNome}</span>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Quadra:</span>
                <span className="font-bold text-white text-sm">{bookingSelecionado.quadraNome}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Data & Horário:</span>
                <span className="font-bold text-amber-400 text-sm">
                  {formatDate(bookingSelecionado.data || dataSelecionada)} às {bookingSelecionado.horario}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tipo de Modalidade:</span>
                <span className="font-medium text-slate-200">
                  {bookingSelecionado.modalidade || "Beach Tennis"}
                </span>
              </div>
              {bookingSelecionado.clienteTelefone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Telefone / WhatsApp:</span>
                  <span className="font-mono text-slate-300">
                    {bookingSelecionado.clienteTelefone}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400">Valor da Locação:</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {formatCurrency(bookingSelecionado.valor)}
                </span>
              </div>
              {bookingSelecionado.observacoes && (
                <div className="pt-2 border-t border-slate-800 text-slate-400">
                  Obs: {bookingSelecionado.observacoes}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExcluirAgendamento(bookingSelecionado.id)}
              leftIcon={<Trash2 className="w-4 h-4 text-rose-400" />}
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            >
              Liberar Horário
            </Button>

            <div className="flex items-center gap-2">
              {bookingSelecionado.clienteTelefone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleWhatsAppBooking(bookingSelecionado)}
                  leftIcon={<Send className="w-3.5 h-3.5 text-emerald-400" />}
                  className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                >
                  WhatsApp
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setBookingSelecionado(null)}>
                Fechar
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* 6. MODAL DE CONFIGURAÇÃO DO FIREBASE DEDICADO DA ARENA */}
      <Modal isOpen={modalFirebaseAberto} onClose={() => setModalFirebaseAberto(false)} size="md">
        <ModalHeader onClose={() => setModalFirebaseAberto(false)}>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            <span>Firebase Dedicado • Arena Sandplay</span>
          </div>
        </ModalHeader>
        <form onSubmit={handleSalvarFirebaseConfig}>
          <ModalBody className="space-y-4">
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-200">
              <p className="font-semibold mb-1">Ambiente de Banco Dedicado</p>
              <p className="text-sky-300/80">
                A Arena Sandplay opera no mesmo sistema, mas pode ter um projeto Firebase totalmente próprio e isolado (banco, auth e storage separados da Life Surf).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Firebase Project ID *
              </label>
              <Input
                placeholder="ex: arena-sandplay-db"
                value={formFirebase.projectId}
                onChange={(e) => setFormFirebase({ ...formFirebase, projectId: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                API Key (Firebase Web) *
              </label>
              <Input
                placeholder="AIzaSy..."
                value={formFirebase.apiKey}
                onChange={(e) => setFormFirebase({ ...formFirebase, apiKey: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Auth Domain
              </label>
              <Input
                placeholder="arena-sandplay-db.firebaseapp.com"
                value={formFirebase.authDomain}
                onChange={(e) => setFormFirebase({ ...formFirebase, authDomain: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Storage Bucket
              </label>
              <Input
                placeholder="arena-sandplay-db.firebasestorage.app"
                value={formFirebase.storageBucket}
                onChange={(e) => setFormFirebase({ ...formFirebase, storageBucket: e.target.value })}
              />
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
              Status atual:{" "}
              <strong className="text-emerald-400">
                Conectado ao Firebase Dedicado: arenasandplay-fc30f (100% Isolado da Life Surf)
              </strong>
            </div>
          </ModalBody>
          <ModalFooter className="flex items-center justify-between">
            {isDedicatedArenaFirebaseConfigured() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestaurarFirebasePadrao}
                className="text-rose-400 border-rose-500/30"
              >
                Voltar ao Padrão
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={() => setModalFirebaseAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" className="bg-sky-600 hover:bg-sky-500">
                Salvar Credenciais
              </Button>
            </div>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
