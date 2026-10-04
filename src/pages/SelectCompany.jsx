import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { fetchUserTenants, createCompany, deleteCompany } from "../services/tenantService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import toast from "react-hot-toast";
import {
  Building2,
  Waves,
  Search,
  ArrowRight,
  ShieldCheck,
  Store,
  Factory,
  LogOut,
  Sparkles,
  Plus,
  Trash2,
  Trophy,
  Home,
  Wallet,
  Receipt,
  Phone,
  MapPin,
  Briefcase,
  CheckCircle2
} from "lucide-react";

export default function SelectCompany() {
  const { user, userProfile, role, logout } = useAuth();
  const { switchTenant } = useTenant();
  const navigate = useNavigate();

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal de Adicionar Nova Empresa
  const [modalNovaEmpresa, setModalNovaEmpresa] = useState(false);
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [formNova, setFormNova] = useState({
    nome: "",
    segmento: "Comércio Geral & Varejo",
    razaoSocial: "",
    cnpj: "",
    cidade: "Fortaleza - CE",
    telefone: "",
    corDestaque: "#0284c7"
  });

  const carregarEmpresas = async () => {
    setLoading(true);
    try {
      const lista = await fetchUserTenants(userProfile);
      setEmpresas(lista);
    } catch (err) {
      console.error("Erro ao carregar empresas:", err);
      toast.error("Erro ao carregar lista de empresas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEmpresas();
  }, [userProfile]);

  const handleSelectCompany = (empresaId, rotaDestino = "/workspace") => {
    switchTenant(empresaId);
    toast.success("Empresa ativada com sucesso!");
    navigate(rotaDestino);
  };

  const handleSalvarNovaEmpresa = async (e) => {
    e.preventDefault();
    if (!formNova.nome.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }

    setSalvandoNova(true);
    try {
      const nova = await createCompany({
        nome: formNova.nome.trim(),
        segmento: formNova.segmento,
        razaoSocial: formNova.razaoSocial || formNova.nome.trim(),
        cnpj: formNova.cnpj || "00.000.000/0001-00",
        cidade: formNova.cidade || "Fortaleza - CE",
        telefone: formNova.telefone || "(85) 99999-9999",
        temaConfig: {
          id: `theme-${Date.now()}`,
          primaryColor: formNova.corDestaque,
          accentColor: formNova.corDestaque,
          mode: "dark"
        }
      }, userProfile);

      toast.success(`Empresa "${nova.nome}" cadastrada com sucesso!`);
      setModalNovaEmpresa(false);
      setFormNova({
        nome: "",
        segmento: "Comércio Geral & Varejo",
        razaoSocial: "",
        cnpj: "",
        cidade: "Fortaleza - CE",
        telefone: "",
        corDestaque: "#0284c7"
      });
      await carregarEmpresas();
      // Opcional: já seleciona e entra
      handleSelectCompany(nova.id);
    } catch (err) {
      console.error("Erro ao cadastrar empresa:", err);
      toast.error("Falha ao salvar a nova empresa.");
    } finally {
      setSalvandoNova(false);
    }
  };

  const handleExcluirEmpresa = async (e, emp) => {
    e.stopPropagation();
    if (!window.confirm(`Deseja realmente remover a empresa "${emp.nome}" do painel?`)) {
      return;
    }

    try {
      await deleteCompany(emp.id);
      toast.success("Empresa removida com sucesso!");
      await carregarEmpresas();
    } catch (err) {
      toast.error(err.message || "Não foi possível remover esta empresa.");
    }
  };

  const getCompanyVisuals = (emp) => {
    const id = emp.id?.toLowerCase() || "";
    if (id.includes("lifesurf")) {
      return {
        icon: Waves,
        iconBg: "bg-sky-500/10 border-sky-500/30 text-sky-400",
        badgeVariant: "info",
        badgeText: "Moda & Surfwear",
        defaultRoute: "/workspace"
      };
    }
    if (id.includes("arena") || id.includes("sandplay")) {
      return {
        icon: Trophy,
        iconBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        badgeVariant: "warning",
        badgeText: "Beach Tennis & Lazer",
        defaultRoute: "/workspace"
      };
    }
    if (id.includes("jarbas") || id.includes("aluguel") || id.includes("alugueis")) {
      return {
        icon: Home,
        iconBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        badgeVariant: "success",
        badgeText: "Locação & Imóveis",
        defaultRoute: "/workspace"
      };
    }
    if (id.includes("pessoal") || id.includes("financa") || id.includes("gasto")) {
      return {
        icon: Wallet,
        iconBg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
        badgeVariant: "purple",
        badgeText: "Finanças Pessoais",
        defaultRoute: "/financeiro"
      };
    }
    return {
      icon: Building2,
      iconBg: "bg-slate-500/10 border-slate-500/30 text-slate-400",
      badgeVariant: "neutral",
      badgeText: emp.segmento || "Empresa Cadastrada",
      defaultRoute: "/workspace"
    };
  };

  const isProtectedCompany = (id) => {
    return ["lifesurf-principal", "lifesurf", "arena-sandplay", "jarbas-alugueis", "financas-pessoal"].includes(id);
  };

  const filteredEmpresas = empresas.filter((emp) =>
    emp.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.segmento?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8 transition-colors">
      {/* Topo com Usuário e Logout */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20">
            <Waves className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-slate-900 dark:text-white">
              LIFE<span className="text-sky-500 dark:text-sky-400">SURF</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Multiempresa & Gestão Unificada</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{user?.email || "Administrador"}</span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 uppercase tracking-widest font-mono font-semibold">
              Perfil: {role || "Superadmin"}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-500 dark:text-slate-400 hover:text-rose-500"
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sair
          </Button>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8 space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <Badge variant="info" withDot={true} className="mb-2">
            Ambiente Multiempresa LifeSurf
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Selecione uma Empresa
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Alterne instantaneamente entre suas empresas, negócios ou controle financeiro pessoal físico.
          </p>
        </div>

        {/* Barra de Ações: Busca + Botão Nova Empresa */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-4xl mx-auto">
          <div className="w-full sm:flex-1">
            <Input
              placeholder="Buscar por nome, segmento ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <Button
            variant="primary"
            onClick={() => setModalNovaEmpresa(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto shrink-0 shadow-lg shadow-sky-500/20"
          >
            Cadastrar Nova Empresa
          </Button>
        </div>

        {/* Grid de Empresas Disponíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5 pt-2 max-w-4xl mx-auto">
          {filteredEmpresas.map((emp) => {
            const visual = getCompanyVisuals(emp);
            const IconComponent = visual.icon;
            const isPersonal = emp.id?.includes("pessoal") || emp.id?.includes("financa");

            return (
              <Card
                key={emp.id}
                variant="interactive"
                className="flex flex-col justify-between group hover:border-sky-500/50 transition-all p-6 space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md relative overflow-hidden"
                onClick={() => handleSelectCompany(emp.id, visual.defaultRoute)}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${visual.iconBg}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={visual.badgeVariant} size="sm" withDot={true}>
                        {visual.badgeText}
                      </Badge>

                      {!isProtectedCompany(emp.id) && (
                        <button
                          type="button"
                          onClick={(e) => handleExcluirEmpresa(e, emp)}
                          title="Remover empresa"
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors">
                      {emp.nome}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {emp.cidade || "Fortaleza - CE"} • {emp.segmento || "Comércio & Serviços"}
                    </p>
                    {emp.telefone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {emp.telefone}
                      </p>
                    )}
                  </div>

                  {/* Informação Operacional */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    {isPersonal ? (
                      <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400 font-medium">
                        <Receipt className="w-3.5 h-3.5" /> Controle Físico & Colaborativo
                      </span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-emerald-500" /> Loja / PDV
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-sky-500" /> Fábrica / Estoque
                        </span>
                      </div>
                    )}
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                      ID: {emp.id}
                    </span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    variant="primary"
                    className="w-full justify-between shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCompany(emp.id, visual.defaultRoute);
                    }}
                    rightIcon={<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                  >
                    {isPersonal ? "Acessar Gastos & Entradas" : "Acessar Workspace"}
                  </Button>

                  {isPersonal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCompany(emp.id, "/workspace");
                      }}
                    >
                      Ou abrir Painel Geral Completo
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredEmpresas.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 max-w-lg mx-auto">
            <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhuma empresa encontrada</p>
            <p className="text-xs text-slate-400 mt-1">Nenhum registro corresponde aos filtros pesquisados.</p>
          </div>
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 pt-6 border-t border-slate-200 dark:border-slate-800">
        LifeSurf PDV v2 • Arquitetura Multiempresa com Isolamento Seguro & Troca Dinâmica
      </footer>

      {/* Modal de Cadastrar Nova Empresa */}
      <Modal isOpen={modalNovaEmpresa} onClose={() => setModalNovaEmpresa(false)} size="md">
        <ModalHeader title="Cadastrar Nova Empresa / Negócio" onClose={() => setModalNovaEmpresa(false)} />
        <form onSubmit={handleSalvarNovaEmpresa}>
          <ModalBody className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cadastre um novo ambiente isolado para administrar vendas, estoque, pedidos e financeiro separadamente.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                Nome da Empresa / Negócio *
              </label>
              <Input
                placeholder="Ex: Arena Sandplay, Jarbas Aluguéis, etc."
                value={formNova.nome}
                onChange={(e) => setFormNova({ ...formNova, nome: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  Segmento / Atividade
                </label>
                <select
                  value={formNova.segmento}
                  onChange={(e) => setFormNova({ ...formNova, segmento: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium outline-none focus:border-sky-500"
                >
                  <option value="Confecção & Moda Surfwear">Confecção & Moda Surfwear</option>
                  <option value="Complexo Esportivo, Beach Tennis & Lazer">Complexo Esportivo, Beach Tennis & Lazer</option>
                  <option value="Locação de Imóveis, Equipamentos & Bens">Locação de Imóveis, Equipamentos & Bens</option>
                  <option value="Controle Financeiro & Gastos Pessoais">Controle Financeiro & Gastos Pessoais</option>
                  <option value="Alimentação, Bar & Restaurante">Alimentação, Bar & Restaurante</option>
                  <option value="Comércio Geral & Varejo">Comércio Geral & Varejo</option>
                  <option value="Prestação de Serviços">Prestação de Serviços</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  CNPJ ou CPF (Opcional)
                </label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={formNova.cnpj}
                  onChange={(e) => setFormNova({ ...formNova, cnpj: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  Cidade / UF
                </label>
                <Input
                  placeholder="Fortaleza - CE"
                  value={formNova.cidade}
                  onChange={(e) => setFormNova({ ...formNova, cidade: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  Telefone / WhatsApp
                </label>
                <Input
                  placeholder="(85) 99999-9999"
                  value={formNova.telefone}
                  onChange={(e) => setFormNova({ ...formNova, telefone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                Cor Temática da Marca
              </label>
              <div className="flex items-center gap-3 pt-1">
                {[
                  { color: "#0284c7", label: "Azul" },
                  { color: "#f59e0b", label: "Âmbar" },
                  { color: "#059669", label: "Esmeralda" },
                  { color: "#6366f1", label: "Índigo" },
                  { color: "#e11d48", label: "Rosa" }
                ].map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => setFormNova({ ...formNova, corDestaque: item.color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${
                      formNova.corDestaque === item.color ? "scale-110 border-white ring-2 ring-sky-500" : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: item.color }}
                    title={item.label}
                  />
                ))}
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setModalNovaEmpresa(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={salvandoNova} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
              Cadastrar & Entrar
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
