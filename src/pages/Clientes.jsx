import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  CUSTOMER_TYPES
} from "../services/customerService";
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
  Users,
  UserPlus,
  Search,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  AlertCircle,
  MessageCircle,
  Edit2,
  DollarSign,
  ShoppingBag,
  Clock,
  Sparkles,
  Percent,
  CheckCircle2,
  Filter,
  Trash2
} from "lucide-react";

export default function Clientes() {
  const { activeTenantId } = useTenant();

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos"); // "todos", "varejo", "atacado", "devedores"

  // Modal Novo / Editar Cliente
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    razaoSocial: "",
    tipo: CUSTOMER_TYPES.VAREJO,
    documento: "",
    inscricaoEstadual: "",
    telefone: "",
    email: "",
    cidade: "Fortaleza",
    estado: "CE",
    endereco: "",
    limiteCredito: 1000,
    saldoDevedor: 0,
    descontoAtacadoPadrao: 15,
    observacoes: ""
  });

  // Modal Detalhes & Histórico
  const [clienteDetalhes, setClienteDetalhes] = useState(null);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers(activeTenantId);
      setClientes(data);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
      toast.error("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, [activeTenantId]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const total = clientes.length;
    const atacado = clientes.filter((c) => c.tipo === "atacado").length;
    const varejo = clientes.filter((c) => c.tipo === "varejo").length;
    const totalDevedor = clientes.reduce((acc, c) => acc + (Number(c.saldoDevedor) || 0), 0);
    const clientesComDebito = clientes.filter((c) => (Number(c.saldoDevedor) || 0) > 0).length;

    return { total, atacado, varejo, totalDevedor, clientesComDebito };
  }, [clientes]);

  // Filtro de Busca
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const matchBusca =
        !busca.trim() ||
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.razaoSocial?.toLowerCase().includes(busca.toLowerCase()) ||
        c.documento?.includes(busca) ||
        c.telefone?.includes(busca) ||
        c.cidade?.toLowerCase().includes(busca.toLowerCase());

      if (!matchBusca) return false;

      if (filtroTipo === "varejo") return c.tipo === "varejo";
      if (filtroTipo === "atacado") return c.tipo === "atacado";
      if (filtroTipo === "devedores") return (Number(c.saldoDevedor) || 0) > 0;

      return true;
    });
  }, [clientes, busca, filtroTipo]);

  const abrirModalNovo = () => {
    setClienteEditando(null);
    setFormData({
      nome: "",
      razaoSocial: "",
      tipo: CUSTOMER_TYPES.VAREJO,
      documento: "",
      inscricaoEstadual: "",
      telefone: "",
      email: "",
      cidade: "Fortaleza",
      estado: "CE",
      endereco: "",
      limiteCredito: 1000,
      saldoDevedor: 0,
      descontoAtacadoPadrao: 15,
      observacoes: ""
    });
    setModalClienteAberto(true);
  };

  const abrirModalEditar = (cliente) => {
    setClienteEditando(cliente);
    setFormData({
      nome: cliente.nome || "",
      razaoSocial: cliente.razaoSocial || "",
      tipo: cliente.tipo || CUSTOMER_TYPES.VAREJO,
      documento: cliente.documento || "",
      inscricaoEstadual: cliente.inscricaoEstadual || "",
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      cidade: cliente.cidade || "Fortaleza",
      estado: cliente.estado || "CE",
      endereco: cliente.endereco || "",
      limiteCredito: cliente.limiteCredito || 1000,
      saldoDevedor: cliente.saldoDevedor || 0,
      descontoAtacadoPadrao: cliente.descontoAtacadoPadrao || 0,
      observacoes: cliente.observacoes || ""
    });
    setModalClienteAberto(true);
  };

  const handleSalvarCliente = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    setSalvando(true);
    try {
      if (clienteEditando) {
        await updateCustomer(activeTenantId, clienteEditando.id, formData);
        setClientes((prev) =>
          prev.map((c) => (c.id === clienteEditando.id ? { ...c, ...formData } : c))
        );
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const criado = await createCustomer(activeTenantId, formData);
        setClientes((prev) => [criado, ...prev]);
        toast.success("Cliente cadastrado com sucesso!");
      }
      setModalClienteAberto(false);
    } catch (err) {
      toast.error("Erro ao salvar cliente: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirCliente = async (clienteId) => {
    if (confirm("Deseja realmente excluir este cliente? Esta ação não pode ser desfeita.")) {
      try {
        await deleteCustomer(activeTenantId, clienteId);
        setClientes((prev) => prev.filter((c) => c.id !== clienteId));
        if (clienteDetalhes?.id === clienteId) setClienteDetalhes(null);
        toast.success("Cliente excluído com sucesso.");
      } catch (err) {
        console.error(err);
        toast.error("Erro ao excluir cliente.");
      }
    }
  };

  const handleCobrarWhatsApp = (cliente) => {
    if (!cliente.telefone) {
      toast.error("Cliente não possui telefone cadastrado.");
      return;
    }
    const saldo = Number(cliente.saldoDevedor) || 0;
    if (saldo <= 0) {
      toast.success("Cliente não possui débitos em aberto!");
      return;
    }

    openWhatsAppChat(
      cliente.telefone,
      "SALDO-DEVEDOR",
      WHATSAPP_TEMPLATES.COBRANCA_PIX,
      {
        clienteNome: cliente.nome,
        total: formatCurrency(saldo),
        chavePix: "pix@lifesurf.com.br"
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Users className="w-5 h-5" />
            </span>
            <Badge variant="info" size="sm" withDot={true}>
              CRM & Gestão de Carteira
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Clientes & Atacado
          </h1>
          <p className="text-xs text-slate-400">
            Diferenciação de Varejo (CPF) vs Atacado (CNPJ), controle de crediário e histórico de compras.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={abrirModalNovo}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="text-xs bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
          >
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-sky-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total de Clientes
              </p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{stats.total}</h3>
            </div>
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Lojistas / Atacado
              </p>
              <h3 className="text-2xl font-bold text-purple-400 mt-0.5">{stats.atacado}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Varejo / Consumidor
              </p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.varejo}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <User className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-l-rose-500 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Fiado / "A Ver"
              </p>
              <h3 className="text-2xl font-bold text-rose-400 mt-0.5 font-mono">
                {formatCurrency(stats.totalDevedor)}
              </h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Filtro e Busca */}
      <Card className="p-4 bg-slate-900/40 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ/CPF, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-slate-950 text-white rounded-lg border border-slate-800 text-xs focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: "todos", label: "Todos" },
            { id: "atacado", label: "Lojistas (Atacado)" },
            { id: "varejo", label: "Varejo" },
            { id: "devedores", label: "Com Saldo Devedor" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroTipo(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                filtroTipo === tab.id
                  ? "bg-sky-500 text-white shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Lista / Tabela de Clientes */}
      <Card className="p-0 overflow-hidden border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Cliente / Razão Social</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Documento</th>
                <th className="p-3.5">Contato</th>
                <th className="p-3.5">Cidade</th>
                <th className="p-3.5 text-right">Limite de Crédito</th>
                <th className="p-3.5 text-right">Saldo Devedor ("A Ver")</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                    <p className="font-semibold">Nenhum cliente encontrado.</p>
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((cliente) => {
                  const saldo = Number(cliente.saldoDevedor) || 0;
                  const isAtacado = cliente.tipo === "atacado";

                  return (
                    <tr key={cliente.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                              isAtacado
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                            )}
                          >
                            {isAtacado ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-white hover:text-sky-400 cursor-pointer" onClick={() => setClienteDetalhes(cliente)}>
                              {cliente.nome}
                            </p>
                            {cliente.razaoSocial && (
                              <p className="text-[11px] text-slate-400">{cliente.razaoSocial}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <Badge variant={isAtacado ? "info" : "neutral"} size="sm">
                          {isAtacado ? "Atacado" : "Varejo"}
                        </Badge>
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        {cliente.documento || "Não informado"}
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          {cliente.telefone && (
                            <span className="font-mono text-slate-300 block">{cliente.telefone}</span>
                          )}
                          {cliente.email && (
                            <span className="text-[11px] text-slate-400 block truncate max-w-[160px]">
                              {cliente.email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-400">
                        {cliente.cidade || "Fortaleza"} - {cliente.estado || "CE"}
                      </td>

                      <td className="p-3.5 text-right font-mono text-slate-300">
                        {formatCurrency(cliente.limiteCredito || 0)}
                      </td>

                      <td className="p-3.5 text-right">
                        {saldo > 0 ? (
                          <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            {formatCurrency(saldo)}
                          </span>
                        ) : (
                          <span className="font-mono text-emerald-400 text-xs">Em dia ✓</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {cliente.telefone && (
                            <button
                              type="button"
                              onClick={() => handleCobrarWhatsApp(cliente)}
                              className={cn(
                                "p-1.5 rounded-lg border transition-colors cursor-pointer",
                                saldo > 0
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                              )}
                              title={saldo > 0 ? "Enviar cobrança PIX no WhatsApp" : "Iniciar conversa no WhatsApp"}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => abrirModalEditar(cliente)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Editar cadastro"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExcluirCliente(cliente.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Excluir cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal Cadastro / Edição de Cliente */}
      <Modal
        isOpen={modalClienteAberto}
        onClose={() => setModalClienteAberto(false)}
        size="lg"
      >
        <form onSubmit={handleSalvarCliente}>
          <ModalHeader
            title={clienteEditando ? "Editar Cliente" : "Novo Cliente"}
            description="Cadastre clientes de varejo ou lojistas parceiros de atacado."
            onClose={() => setModalClienteAberto(false)}
          />
          <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Tipo de Cliente *"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                options={[
                  { value: CUSTOMER_TYPES.VAREJO, label: "Consumidor Final (Varejo)" },
                  { value: CUSTOMER_TYPES.ATACADO, label: "Lojista / Revenda (Atacado)" }
                ]}
              />

              <div className="sm:col-span-2">
                <Input
                  label={formData.tipo === "atacado" ? "Nome Fantasia da Loja *" : "Nome Completo *"}
                  placeholder={formData.tipo === "atacado" ? "Ex: Maresia Surf Shop" : "Ex: Carlos Silva"}
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
            </div>

            {formData.tipo === "atacado" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Razão Social"
                  placeholder="Ex: Maresia Comércio de Roupas Ltda"
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                />
                <Input
                  label="Inscrição Estadual (IE)"
                  placeholder="06.123.456-7"
                  value={formData.inscricaoEstadual}
                  onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={formData.tipo === "atacado" ? "CNPJ *" : "CPF"}
                placeholder={formData.tipo === "atacado" ? "00.000.000/0001-00" : "000.000.000-00"}
                value={formData.documento}
                onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
              />

              <Input
                label="WhatsApp / Telefone *"
                placeholder="(85) 99999-8888"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                required
              />

              <Input
                type="email"
                label="E-mail"
                placeholder="cliente@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Endereço Completo"
                  placeholder="Rua, número, bairro..."
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>
              <Input
                label="Cidade / UF"
                placeholder="Fortaleza - CE"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>

            {/* Parâmetros Comerciais / Atacado e Crediário */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                Condições Comerciais & Limite de Crediário
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="number"
                  step="50"
                  label="Limite de Crédito para Vendas a Prazo / Fiado (R$)"
                  value={formData.limiteCredito}
                  onChange={(e) => setFormData({ ...formData, limiteCredito: e.target.value })}
                />

                <Input
                  type="number"
                  step="0.01"
                  label="Saldo Devedor Atual / Débito em Aberto (R$)"
                  value={formData.saldoDevedor}
                  onChange={(e) => setFormData({ ...formData, saldoDevedor: e.target.value })}
                />

                {formData.tipo === "atacado" && (
                  <Input
                    type="number"
                    min="0"
                    max="60"
                    label="Desconto de Atacado Padrão (%)"
                    value={formData.descontoAtacadoPadrao}
                    onChange={(e) => setFormData({ ...formData, descontoAtacadoPadrao: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Observações / Preferências</label>
              <textarea
                className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                rows={2}
                placeholder="Preferência de cores, modelos, transportadora parceira..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalClienteAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvando}>
              {clienteEditando ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal Detalhes do Cliente */}
      {clienteDetalhes && (
        <Modal
          isOpen={Boolean(clienteDetalhes)}
          onClose={() => setClienteDetalhes(null)}
          size="md"
        >
          <ModalHeader
            title={clienteDetalhes.nome}
            description={`Tipo: ${clienteDetalhes.tipo?.toUpperCase()} • Cidade: ${clienteDetalhes.cidade || "Fortaleza"}`}
            onClose={() => setClienteDetalhes(null)}
          />
          <ModalBody className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Documento:</span>
                <span className="text-white font-mono">{clienteDetalhes.documento || "Não informado"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Telefone / WhatsApp:</span>
                <span className="text-white font-mono">{clienteDetalhes.telefone || "Não informado"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Limite de Crediário:</span>
                <span className="text-white font-mono">{formatCurrency(clienteDetalhes.limiteCredito || 0)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Saldo Devedor Atual:</span>
                <span className="text-rose-400 font-bold font-mono">
                  {formatCurrency(clienteDetalhes.saldoDevedor || 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Total Já Comprado (LTV):</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {formatCurrency(clienteDetalhes.totalGasto || 0)} ({clienteDetalhes.qtdCompras || 0} compras)
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Última Compra:</span>
                <span className="text-slate-300">
                  {clienteDetalhes.ultimaCompra ? formatDate(new Date(clienteDetalhes.ultimaCompra)) : "Sem registro"}
                </span>
              </div>
            </div>

            {clienteDetalhes.observacoes && (
              <p className="text-xs text-slate-400 p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                <strong>Obs:</strong> {clienteDetalhes.observacoes}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            {clienteDetalhes.telefone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCobrarWhatsApp(clienteDetalhes)}
                leftIcon={<MessageCircle className="w-4 h-4 text-emerald-400" />}
                className="border-emerald-500/30 text-emerald-300"
              >
                Cobrança WhatsApp
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 mr-auto"
              onClick={() => handleExcluirCliente(clienteDetalhes.id)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Excluir Cliente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const c = clienteDetalhes;
                setClienteDetalhes(null);
                abrirModalEditar(c);
              }}
              leftIcon={<Edit2 className="w-4 h-4" />}
            >
              Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setClienteDetalhes(null)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
