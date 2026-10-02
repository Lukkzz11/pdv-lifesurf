import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../security/ProtectedRoute";
import { USER_ROLES } from "../config/constants";
import MainLayout from "../components/layout/MainLayout";
import Login from "../pages/Login";
import SelectCompany from "../pages/SelectCompany";
import Workspace from "../pages/Workspace";
import EstoqueLoja from "../pages/EstoqueLoja";
import EstoqueFabrica from "../pages/EstoqueFabrica";
import Pedidos from "../pages/Pedidos";
import Pdv from "../pages/Pdv";
import CatalogoPublico from "../pages/CatalogoPublico";
import Relatorios from "../pages/Relatorios";
import Etiquetas from "../pages/Etiquetas";
import Calendario from "../pages/Calendario";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ShieldAlert, ArrowLeft, Construction } from "lucide-react";

// Placeholder visual padronizado para as rotas em transição
function OperationalPlaceholder({ title, description = "Módulo operacional LifeSurf." }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" withDot={true}>Módulo Ativo</Badge>
        </div>
      </div>

      <Card variant="subtle" className="p-8 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <Construction className="w-7 h-7" />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="text-base font-semibold text-white">Fase de Conexão Operacional</h3>
          <p className="text-xs text-slate-400">
            A estrutura de dados, agregações e segurança estão prontas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.history.back()} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Voltar
        </Button>
      </Card>
    </div>
  );
}

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center p-8 space-y-4 border-rose-500/30">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Acesso Negado (403)</h2>
          <p className="text-xs text-slate-400">
            Seu perfil atual não possui autorização para visualizar este módulo.
          </p>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => (window.location.href = "/")}>
          Retornar ao Início
        </Button>
      </Card>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* 0. Rota Pública Isolada do Catálogo / Vitrine Digital (Sem Autenticação) */}
      <Route path="/catalogo/:companyId" element={<CatalogoPublico />} />
      <Route path="/catalogo" element={<Navigate to="/catalogo/lifesurf" replace />} />

      {/* 1. Rota Pública de Login */}
      <Route path="/login" element={<Login />} />

      {/* 2. Rota Protegida de Seleção de Empresa (Home Multiempresa) */}
      <Route
        path="/selecionar-empresa"
        element={
          <ProtectedRoute requireTenant={false}>
            <SelectCompany />
          </ProtectedRoute>
        }
      />

      {/* 3. Rotas Protegidas Operacionais com Layout Principal (Exigem Tenant Ativo) */}
      <Route element={<ProtectedRoute requireTenant={true} />}>
        <Route element={<MainLayout />}>
          {/* Redirecionamento raiz para o Workspace ou Selecionar Empresa */}
          <Route path="/" element={<Navigate to="/workspace" replace />} />

          {/* Painel Interno da Empresa (Workspace) */}
          <Route path="/workspace" element={<Workspace />} />

          {/* Módulos Operacionais */}
          <Route path="/pdv" element={<Pdv />} />
          <Route path="/estoque-loja" element={<EstoqueLoja />} />
          <Route path="/estoque-fabrica" element={<EstoqueFabrica />} />
          <Route path="/estoque" element={<Navigate to="/estoque-loja" replace />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/etiquetas" element={<Etiquetas />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/clientes" element={<OperationalPlaceholder title="Gestão de Clientes" description="Cadastro de clientes, histórico de compras e limites de crédito." />} />
          <Route path="/a-ver" element={<OperationalPlaceholder title="Contas A Ver / Fiado" description="Controle de recebíveis e pagamentos pendentes." />} />

          {/* Rotas Administrativas */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.GERENTE]}
                requireTenant={true}
              />
            }
          >
            <Route path="/configuracoes" element={<OperationalPlaceholder title="Configurações da Loja" description="Parâmetros fiscais, impressora térmica e dados cadastrais." />} />
          </Route>

          {/* Gestão Global Multiempresa */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]}
              />
            }
          >
            <Route path="/empresas" element={<Navigate to="/selecionar-empresa" replace />} />
          </Route>
        </Route>
      </Route>

      {/* Tratamento de Erros e 404 */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
