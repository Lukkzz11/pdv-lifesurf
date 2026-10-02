import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { fetchUserTenants } from "../services/tenantService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import {
  Building2,
  Waves,
  Search,
  ArrowRight,
  ShieldCheck,
  Store,
  Factory,
  LogOut,
  Sparkles
} from "lucide-react";

export default function SelectCompany() {
  const { user, userProfile, role, logout } = useAuth();
  const { switchTenant } = useTenant();
  const navigate = useNavigate();

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true);
      try {
        const lista = await fetchUserTenants(userProfile);
        setEmpresas(lista);
      } finally {
        setLoading(false);
      }
    }
    loadCompanies();
  }, [userProfile]);

  const handleSelectCompany = (empresaId) => {
    switchTenant(empresaId);
    navigate("/workspace");
  };

  const filteredEmpresas = empresas.filter((emp) =>
    emp.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Topo com Usuário e Logout */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20">
            <Waves className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white">
              LIFE<span className="text-sky-400">SURF</span>
            </h1>
            <p className="text-xs text-slate-400">Multiempresa & Gestão Unificada</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-medium text-slate-200">{user?.email}</span>
            <span className="text-[10px] text-sky-400 uppercase tracking-widest font-mono">
              Perfil: {role}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-slate-400 hover:text-rose-400"
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
            Ambiente Multiempresa
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Selecione uma Empresa
          </h2>
          <p className="text-sm text-slate-400">
            Escolha o ambiente de trabalho que deseja gerenciar. As opções abaixo são filtradas de acordo com as permissões da sua conta.
          </p>
        </div>

        {/* Barra de Busca de Empresa */}
        {empresas.length > 2 && (
          <div className="max-w-md mx-auto">
            <Input
              placeholder="Buscar por nome da empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        )}

        {/* Grid de Empresas Disponíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-4">
          {filteredEmpresas.map((emp) => (
            <Card
              key={emp.id}
              variant="interactive"
              className="flex flex-col justify-between group hover:border-sky-500/50 transition-all p-6 space-y-5"
              onClick={() => handleSelectCompany(emp.id)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <Badge variant="success" size="sm" withDot={true}>
                    Ativa
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                    {emp.nome || "LifeSurf Confecções"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {emp.cidade || "Fortaleza - CE"} • {emp.segmento || "Moda & Surfwear"}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-emerald-400" /> Loja Balcão
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Factory className="w-3.5 h-3.5 text-sky-400" /> Estoque Fábrica
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full mt-4 justify-between"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectCompany(emp.id);
                }}
                rightIcon={<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
              >
                Acessar Workspace
              </Button>
            </Card>
          ))}
        </div>

        {filteredEmpresas.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">
            Nenhuma empresa encontrada com os termos informados.
          </div>
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="text-center text-xs text-slate-500 pt-6 border-t border-slate-800/80">
        LifeSurf PDV v2 • Arquitetura Multiempresa com Isolamento Seguro
      </footer>
    </div>
  );
}
