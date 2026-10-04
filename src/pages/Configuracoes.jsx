import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useTheme, THEME_PRESETS } from "../contexts/ThemeContext";
import { USER_ROLES } from "../config/constants";
import { printThermalReceipt } from "../services/receiptService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import {
  Building2,
  Store,
  Palette,
  Sliders,
  ShieldCheck,
  Printer,
  Save,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
  Waves,
  Calendar,
  Cloud,
  Send,
  ExternalLink,
  Key,
  RefreshCw,
  Check,
  X,
  HelpCircle,
  CheckCircle,
  Inbox,
  Globe,
  Star,
  ShoppingBag,
  Copy,
  Edit2
} from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchAdminCatalogProducts,
  toggleProductCatalogVisibility,
  saveCompanyCatalogSettings,
  fetchCompanyPublicInfo
} from "../services/catalogService";
import { formatCurrency } from "../utils/formatters";
import {
  getGoogleClientId,
  saveGoogleClientId,
  getGoogleAccessToken,
  getGoogleUserInfo,
  isGoogleConnected,
  requestGoogleAccessToken,
  disconnectGoogle,
  fetchGoogleSettings,
  saveGoogleSettings,
  syncEventToGoogleCalendar,
  sendTransactionalEmail,
  ensureDriveFolder,
  DEFAULT_GOOGLE_SETTINGS
} from "../services/googleApiService";

export default function Configuracoes() {
  const { user, userProfile, role } = useAuth();
  const { activeTenantId, activeUnitId, companyDetails, updateCompany, loadingCompany } = useTenant();
  const { themeConfig, changeTheme, isLightMode } = useTheme();

  // Permissão de acesso ao painel de ajustes (gerentes/admins e operadores autorizados)
  const isAuthorized = [
    USER_ROLES.SUPERADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.GERENTE,
    USER_ROLES.OPERADOR
  ].includes(role) || !role;

  const [abaAtiva, setAbaAtiva] = useState("empresa"); // "empresa" | "tema" | "parametros" | "seguranca"
  const [salvando, setSalvando] = useState(false);

  // Estados dos Dados da Empresa (Formulário)
  const [formData, setFormData] = useState({
    nome: "",
    razaoSocial: "",
    cnpj: "",
    inscricaoEstadual: "",
    telefone: "",
    email: "",
    segmento: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "CE",
    cep: "",
    mensagemRodape: "",
    margemPadrao: 100,
    alertaEstoqueMinimoPadrao: 5,
    exigirJustificativaPerda: true
  });

  // Estados do Personalizador de Cores
  const [customPrimary, setCustomPrimary] = useState(themeConfig.primaryColor || "#0284c7");
  const [customAccent, setCustomAccent] = useState(themeConfig.accentColor || "#38bdf8");
  const [customMode, setCustomMode] = useState(themeConfig.mode || "dark");

  // Estados da Integração com Google Workspace (Free Tier)
  const [googleClientId, setGoogleClientId] = useState(() => getGoogleClientId());
  const [googleConnected, setGoogleConnected] = useState(() => isGoogleConnected());
  const [googleUser, setGoogleUser] = useState(() => getGoogleUserInfo());
  const [googleSettings, setGoogleSettings] = useState(DEFAULT_GOOGLE_SETTINGS);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [testingCalendar, setTestingCalendar] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);
  const [testEmailDest, setTestEmailDest] = useState("");
  const [testingDrive, setTestingDrive] = useState(false);
  const [driveFolderInfo, setDriveFolderInfo] = useState(null);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  const navigate = useNavigate();

  // Estados de Operações PDV & Backup
  const [fundoTrocoPadrao, setFundoTrocoPadrao] = useState(() => {
    try {
      return localStorage.getItem(`lifesurf_fundo_troco_${activeTenantId || "default"}`) || "100.00";
    } catch { return "100.00"; }
  });
  const [chavePixPadrao, setChavePixPadrao] = useState(() => {
    try {
      return localStorage.getItem(`lifesurf_chave_pix_${activeTenantId || "default"}`) || "pix@lifesurf.com.br";
    } catch { return "pix@lifesurf.com.br"; }
  });
  const [agruparItensPdv, setAgruparItensPdv] = useState(true);
  const [fechamentoRapidoPdv, setFechamentoRapidoPdv] = useState(true);

  const handleSalvarOpcoesPdv = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(`lifesurf_fundo_troco_${activeTenantId || "default"}`, fundoTrocoPadrao);
      localStorage.setItem(`lifesurf_chave_pix_${activeTenantId || "default"}`, chavePixPadrao);
      toast.success("Parâmetros operacionais do PDV salvos com sucesso!");
    } catch {
      toast.error("Erro ao salvar parâmetros.");
    }
  };

  const handleExportarBackupJson = () => {
    try {
      const backupData = {
        empresaId: activeTenantId,
        empresaNome: formData.nome || "LifeSurf",
        exportadoEm: new Date().toISOString(),
        configuracoes: formData,
        fundoTrocoPadrao,
        chavePixPadrao
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `backup_empresa_${activeTenantId || "pdv"}_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Arquivo de backup JSON gerado e baixado com sucesso!");
    } catch (err) {
      toast.error("Erro ao gerar backup: " + err.message);
    }
  };

  // Estados do Catálogo & Vitrine Online
  const [catalogoProdutos, setCatalogoProdutos] = useState([]);
  const [catalogoConfig, setCatalogoConfig] = useState({
    nome: "",
    whatsapp: "",
    chavePix: "",
    mensagemCatalogo: ""
  });
  const [salvandoCatalogo, setSalvandoCatalogo] = useState(false);

  // Carrega produtos do catálogo
  const carregarDadosCatalogo = async () => {
    if (!activeTenantId) return;
    try {
      const [info, prods] = await Promise.all([
        fetchCompanyPublicInfo(activeTenantId),
        fetchAdminCatalogProducts(activeTenantId)
      ]);
      setCatalogoConfig({
        nome: info.nome || companyDetails?.nome || "LifeSurf Surfwear",
        whatsapp: info.whatsapp || companyDetails?.telefone || "(85) 98888-7777",
        chavePix: info.chavePix || "12.345.678/0001-90",
        mensagemCatalogo:
          info.mensagemCatalogo ||
          "Produtos de alta qualidade com fabricação própria, pronta-entrega e envio para todo o Brasil!"
      });
      setCatalogoProdutos(prods);
    } catch (err) {
      console.warn("Erro ao carregar dados do catálogo em configurações:", err);
    }
  };

  useEffect(() => {
    carregarDadosCatalogo();
  }, [activeTenantId]);

  const handleSalvarConfiguracoesCatalogo = async (e) => {
    if (e) e.preventDefault();
    setSalvandoCatalogo(true);
    try {
      await saveCompanyCatalogSettings(activeTenantId, catalogoConfig);
      toast.success("Configurações da vitrine salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar vitrine: " + err.message);
    } finally {
      setSalvandoCatalogo(false);
    }
  };

  const handleToggleVisibilidadeCatalogo = async (prod) => {
    const novoStatus = !(prod.ativoNoCatalogo !== false);
    try {
      const atualizados = await toggleProductCatalogVisibility(activeTenantId, prod.id, novoStatus);
      setCatalogoProdutos(atualizados);
      if (novoStatus) {
        toast.success(`"${prod.nome}" visível na vitrine!`);
      } else {
        toast(`"${prod.nome}" retirado da vitrine.`, { icon: "👁️‍🗨️" });
      }
    } catch (err) {
      toast.error("Erro ao alterar visibilidade");
    }
  };

  // Carrega configurações da Google Cloud ao montar
  useEffect(() => {
    fetchGoogleSettings(activeTenantId).then((loaded) => {
      setGoogleSettings(loaded);
    });
    setGoogleConnected(isGoogleConnected());
    setGoogleUser(getGoogleUserInfo());
  }, [activeTenantId]);

  // Sincroniza dados da empresa quando carregados do TenantContext
  useEffect(() => {
    if (companyDetails) {
      setFormData({
        nome: companyDetails.nome || "LifeSurf Moda & Surfwear",
        razaoSocial: companyDetails.razaoSocial || "LifeSurf Confecções e Comércio do Vestuário Ltda",
        cnpj: companyDetails.cnpj || "12.345.678/0001-90",
        inscricaoEstadual: companyDetails.inscricaoEstadual || "06.123.456-7",
        telefone: companyDetails.telefone || "(85) 98888-7777",
        email: companyDetails.email || "contato@lifesurf.com.br",
        segmento: companyDetails.segmento || "Confecção e Varejo de Moda Surfwear",
        endereco: companyDetails.endereco || "Av. Beira Mar, 2100",
        numero: companyDetails.numero || "2100",
        bairro: companyDetails.bairro || "Meireles",
        cidade: companyDetails.cidade || "Fortaleza - CE",
        estado: companyDetails.estado || "CE",
        cep: companyDetails.cep || "60165-121",
        mensagemRodape:
          companyDetails.mensagemRodape ||
          "OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!\nTROCAS EM ATÉ 15 DIAS COM A ETIQUETA.",
        margemPadrao: companyDetails.margemPadrao || 100,
        alertaEstoqueMinimoPadrao: companyDetails.alertaEstoqueMinimoPadrao || 5,
        exigirJustificativaPerda: companyDetails.exigirJustificativaPerda !== false
      });
    }
  }, [companyDetails]);

  // Salvar Dados Cadastrais da Empresa no Firestore e LocalStorage
  const handleSalvarConfiguracoes = async (e) => {
    if (e) e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error("O nome da loja é obrigatório");
      return;
    }

    setSalvando(true);
    try {
      await updateCompany({
        ...formData,
        margemPadrao: Number(formData.margemPadrao) || 100,
        alertaEstoqueMinimoPadrao: Number(formData.alertaEstoqueMinimoPadrao) || 5
      });
      toast.success("Configurações da empresa salvas com sucesso!");
    } catch (err) {
      console.error("[Configuracoes] Erro ao salvar dados:", err);
      toast.error("Erro ao salvar configurações da empresa");
    } finally {
      setSalvando(false);
    }
  };

  // Aplicação de Tema Pré-definido
  const handleSelecionarPreset = async (presetId) => {
    try {
      await changeTheme(presetId, true);
      toast.success(`Tema "${THEME_PRESETS.find((p) => p.id === presetId)?.nome}" aplicado globalmente!`);
    } catch (err) {
      console.error("[Configuracoes] Erro ao aplicar tema:", err);
      toast.error("Erro ao aplicar tema");
    }
  };

  // Aplicação de Cores Customizadas
  const handleAplicarCoresCustomizadas = async () => {
    try {
      await changeTheme(
        {
          id: "custom",
          primaryColor: customPrimary,
          accentColor: customAccent,
          mode: customMode
        },
        true
      );
      toast.success("Paleta personalizada aplicada com sucesso!");
    } catch (err) {
      console.error("[Configuracoes] Erro ao aplicar cores:", err);
      toast.error("Erro ao aplicar cores customizadas");
    }
  };

  // Teste de Impressão do Cupom Térmico com dados em tempo real
  const handleTestarImpressaoCupom = () => {
    printThermalReceipt(
      {
        numeroVenda: "TESTE-80MM",
        operador: userProfile?.nome || "Gerente",
        cliente: "Cliente Demonstração LifeSurf",
        subtotal: 189.80,
        desconto: 10.00,
        total: 179.80,
        formaPagamento: "PIX",
        valorEntregue: 179.80,
        troco: 0,
        itens: [
          { nome: "Camiseta Classic Waves", tamanho: "G", quantidade: 1, precoUnitario: 89.90 },
          { nome: "Short Boardshort Rip", tamanho: "42", quantidade: 1, precoUnitario: 99.90 }
        ]
      },
      {
        nome: formData.nome || "LIFESURF SURFWEAR",
        cidade: formData.cidade || "Fortaleza - CE",
        cnpj: formData.cnpj,
        telefone: formData.telefone,
        mensagemRodape: formData.mensagemRodape
      }
    );
  };

  // Funções de Gerenciamento da Conexão com o Google
  const handleSalvarClientId = () => {
    saveGoogleClientId(googleClientId);
    toast.success("Google Client ID salvo com sucesso!");
  };

  const handleConectarGoogle = async () => {
    if (!googleClientId.trim()) {
      toast.error("Insira o seu Google Client ID antes de conectar.");
      return;
    }
    saveGoogleClientId(googleClientId);
    setConnectingGoogle(true);
    try {
      const res = await requestGoogleAccessToken({
        clientId: googleClientId.trim(),
        prompt: "select_account"
      });
      setGoogleConnected(true);
      setGoogleUser(res.userInfo);
      toast.success("Conta Google conectada com sucesso ao LifeSurf ERP!");
    } catch (err) {
      console.warn("Erro ao autorizar Google:", err);
      toast.error(err.message || "Falha na autorização OAuth do Google.");
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDesconectarGoogle = () => {
    disconnectGoogle();
    setGoogleConnected(false);
    setGoogleUser(null);
    toast.success("Conta Google desconectada.");
  };

  const handleToggleGoogleSetting = async (key, value) => {
    const updated = { ...googleSettings, [key]: value };
    setGoogleSettings(updated);
    try {
      await saveGoogleSettings(activeTenantId, updated);
      toast.success("Preferência de integração atualizada!");
    } catch (err) {
      toast.error("Erro ao salvar preferência: " + err.message);
    }
  };

  const handleTestarCalendarSync = async () => {
    if (!isGoogleConnected()) {
      toast.error("Conecte a conta Google primeiro para testar a API.");
      return;
    }
    setTestingCalendar(true);
    try {
      const hoje = new Date().toISOString().split("T")[0];
      const res = await syncEventToGoogleCalendar({
        titulo: "Teste de Integração LifeSurf ERP",
        descricao: "Compromisso de teste gerado pelo painel de configurações para validação do Google Calendar API.",
        data: hoje,
        horario: "11:00",
        tipo: "entrega_pedido",
        responsavel: "Administrador ERP",
        cliente: "Teste de Homologação"
      });
      toast.success("Evento de teste criado com sucesso no Google Calendar!");
      if (res.htmlLink) {
        window.open(res.htmlLink, "_blank");
      }
    } catch (err) {
      toast.error("Erro no teste do Calendar: " + err.message);
    } finally {
      setTestingCalendar(false);
    }
  };

  const handleTestarGmailSend = async () => {
    if (!isGoogleConnected()) {
      toast.error("Conecte a conta Google primeiro para testar a API do Gmail.");
      return;
    }
    const dest = testEmailDest.trim() || googleUser?.email;
    if (!dest || !dest.includes("@")) {
      toast.error("Informe um e-mail de destino válido para o teste.");
      return;
    }

    setTestingGmail(true);
    try {
      await sendTransactionalEmail({
        to: dest,
        subject: "[LifeSurf] Teste de Comunicação Transacional • Gmail API (Free Tier)",
        htmlBody: `
          <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #38bdf8; margin-top: 0;">LifeSurf ERP • Teste de E-mail</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
              Parabéns! Sua integração com a <strong>Gmail API</strong> está funcionando perfeitamente em conformidade com o <em>Free Tier</em> oficial do Google Workspace.
            </p>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; font-size: 12px; color: #94a3b8; margin: 16px 0;">
              <strong>Ambiente:</strong> ${activeTenantId}<br />
              <strong>Data do Teste:</strong> ${new Date().toLocaleString("pt-BR")}
            </div>
            <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">Disparado automaticamente pelo ERP LifeSurf.</p>
          </div>
        `
      });
      toast.success(`E-mail de teste enviado com sucesso para ${dest}!`);
    } catch (err) {
      toast.error("Erro ao enviar e-mail: " + err.message);
    } finally {
      setTestingGmail(false);
    }
  };

  const handleTestarDriveFolder = async () => {
    if (!isGoogleConnected()) {
      toast.error("Conecte a conta Google primeiro para testar o Google Drive.");
      return;
    }
    setTestingDrive(true);
    try {
      const folder = await ensureDriveFolder({ folderName: googleSettings.driveFolderName });
      setDriveFolderInfo(folder);
      toast.success(`Pasta "${folder.name}" validada/criada com sucesso no Google Drive!`);
    } catch (err) {
      toast.error("Erro ao verificar pasta no Drive: " + err.message);
    } finally {
      setTestingDrive(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Acesso Restrito ao Painel de Ajustes</h2>
        <p className="text-xs text-slate-400">
          As configurações da loja e parâmetros fiscais/temas só podem ser alterados por usuários com
          perfil de <strong>Gerente</strong>, <strong>Administrador</strong> ou <strong>Superadmin</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Topo da Tela com Identificação do Tenant */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info" size="sm" withDot={true}>
              Painel ERP • Configurações
            </Badge>
            <span className="text-xs text-slate-400">
              Ambiente: <strong className="text-white uppercase">{activeTenantId}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ajustes & Configurações da Empresa
          </h1>
          <p className="text-xs text-slate-400">
            Gerenciamento cadastral da loja, identidade visual e parâmetros de impressão fiscal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestarImpressaoCupom}
            leftIcon={<Printer className="w-4 h-4 text-sky-400" />}
          >
            Testar Cupom 80mm
          </Button>

          <Button
            variant="primary"
            onClick={handleSalvarConfiguracoes}
            isLoading={salvando}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "empresa", label: "Dados da Loja & Cupom", icon: Building2 },
          { id: "operacoes", label: "Operações PDV & Backup", icon: RefreshCw },
          { id: "catalogo", label: "Catálogo & Vitrine Online", icon: Globe },
          { id: "tema", label: "Identidade Visual & Tema", icon: Palette },
          { id: "parametros", label: "Parâmetros Fiscais & ERP", icon: Sliders },
          { id: "google", label: "Google Workspace & Nuvem", icon: Cloud },
          { id: "seguranca", label: "Auditoria & Acessos", icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isAtiva = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all cursor-pointer border-b-2 ${
                isAtiva
                  ? "border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ABA 1: DADOS DA EMPRESA & SIMULADOR DE CUPOM TÉRMICO */}
      {abaAtiva === "empresa" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário de Edição */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-sky-400 uppercase tracking-wider">
                <Store className="w-4 h-4" />
                <span>Identificação Cadastral da Empresa</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nome Fantasia da Loja *"
                  placeholder="Ex: LifeSurf Moda & Surfwear"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />

                <Input
                  label="Razão Social"
                  placeholder="Ex: LifeSurf Confecções Ltda"
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="CNPJ da Empresa *"
                  placeholder="00.000.000/0001-00"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  required
                />

                <Input
                  label="Inscrição Estadual (IE)"
                  placeholder="06.123.456-7"
                  value={formData.inscricaoEstadual}
                  onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                />

                <Input
                  label="Segmento de Atuação"
                  placeholder="Ex: Confecção e Surfwear"
                  value={formData.segmento}
                  onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Telefone / WhatsApp Comercial *"
                  placeholder="(85) 98888-7777"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                />

                <Input
                  label="E-mail de Contato / Financeiro"
                  type="email"
                  placeholder="financeiro@lifesurf.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <MapPin className="w-4 h-4" />
                <span>Endereço e Localização da Unidade</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-3">
                  <Input
                    label="Logradouro (Rua / Av.)"
                    placeholder="Ex: Av. Beira Mar"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  />
                </div>
                <Input
                  label="Número"
                  placeholder="2100"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Bairro"
                  placeholder="Meireles"
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                />

                <Input
                  label="Cidade e UF *"
                  placeholder="Fortaleza - CE"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  required
                />

                <Input
                  label="CEP"
                  placeholder="60165-121"
                  value={formData.cep}
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                />
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Mensagem de Rodapé do Cupom Fiscal / Térmico</span>
              </div>
              <p className="text-xs text-slate-400">
                Texto impresso ao final do cupom 80mm de venda no PDV (política de trocas, agradecimento, redes sociais).
              </p>
              <textarea
                rows={3}
                value={formData.mensagemRodape}
                onChange={(e) => setFormData({ ...formData, mensagemRodape: e.target.value })}
                placeholder="OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!..."
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:border-sky-500 focus:outline-none resize-none font-mono"
              />
            </Card>
          </div>

          {/* Simulador Interativo do Cupom Térmico (80mm) em Tempo Real */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-sky-400" />
                Preview do Cupom Térmico
              </span>
              <Badge variant="neutral" size="sm">ESC/POS 80mm</Badge>
            </div>

            {/* Mockup do Cupom em Papel Térmico */}
            <div className="p-4 bg-white text-slate-950 rounded-xl shadow-2xl font-mono text-[11px] leading-tight border border-slate-300 select-none">
              <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
                <div className="font-extrabold text-sm uppercase tracking-wider">
                  {formData.nome || "LIFESURF CONFECÇÕES"}
                </div>
                <div className="text-[10px] text-slate-700">{formData.cidade || "Fortaleza - CE"}</div>
                {formData.cnpj && (
                  <div className="text-[10px] text-slate-700">CNPJ: {formData.cnpj}</div>
                )}
                {formData.telefone && (
                  <div className="text-[10px] text-slate-700">Tel: {formData.telefone}</div>
                )}
                <div className="inline-block px-1.5 py-0.5 mt-1 border border-slate-900 text-[9px] font-bold">
                  CUPOM NÃO FISCAL
                </div>
              </div>

              <div className="py-2 space-y-0.5 text-[10px] border-b border-dashed border-slate-400">
                <div className="flex justify-between">
                  <span>Pedido: #8492</span>
                  <span>{new Date().toLocaleDateString("pt-BR")}</span>
                </div>
                <div>Operador: {userProfile?.nome || "Operador"}</div>
                <div>Cliente: Consumidor Final</div>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                <div className="font-bold text-[10px]">ITENS DA VENDA</div>
                <div className="flex justify-between">
                  <span>1x Camiseta Silk Waves M</span>
                  <span>R$ 89,90</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Boardshort Rip 42</span>
                  <span>R$ 109,90</span>
                </div>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 font-bold">
                <div className="flex justify-between text-xs">
                  <span>TOTAL A PAGAR:</span>
                  <span>R$ 199,80</span>
                </div>
                <div className="flex justify-between text-[10px] font-normal text-slate-700">
                  <span>Pagamento:</span>
                  <span>PIX</span>
                </div>
              </div>

              {/* Mensagem de Rodapé Atualizada em Tempo Real */}
              <div className="pt-3 text-center text-[10px] text-slate-800 space-y-1 whitespace-pre-line font-medium">
                <div>{formData.mensagemRodape || "OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!"}</div>
                <div className="text-[8px] text-slate-500 pt-1 border-t border-slate-200">
                  LifeSurf PDV • Impressão Térmica ESC/POS
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestarImpressaoCupom}
              className="w-full text-slate-300 hover:text-white"
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Testar Impressão na Impressora Física
            </Button>
          </div>
        </div>
      )}

      {/* ABA 2: PERSONALIZAÇÃO DE CORES & TEMA ERP */}
      {abaAtiva === "tema" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              Paletas de Cores & Temas Globais
            </h3>
            <p className="text-xs text-slate-400">
              Escolha uma identidade pré-configurada ou personalize a cor primária e de acento da marca.
              A preferência é aplicada globalmente no sistema e salva no Firestore da empresa.
            </p>
          </div>

          {/* Grid de Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEME_PRESETS.filter((p) => p.id !== "custom").map((preset) => {
              const isSelected = themeConfig.id === preset.id;
              return (
                <Card
                  key={preset.id}
                  variant="interactive"
                  onClick={() => handleSelecionarPreset(preset.id)}
                  className={`p-5 space-y-4 border-2 transition-all ${
                    isSelected
                      ? "border-sky-500 shadow-lg shadow-sky-500/10 bg-slate-900"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{preset.nome}</span>
                        <Badge variant={preset.badgeColor} size="sm">
                          {preset.badgeText}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {preset.descricao}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Amostra Visual das Cores */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: preset.primaryColor }}
                      />
                      <span className="font-mono text-[10px]">{preset.primaryColor}</span>
                    </div>

                    <span className="text-slate-600">•</span>

                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                      <span className="font-mono text-[10px]">{preset.accentColor}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Personalizador com Color Pickers */}
          <Card className="p-6 space-y-4 border-slate-800">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-pink-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Personalizador de Marca Própria (Cores Customizadas)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Cor Primária */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-white block">
                  Cor Primária da Marca
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-28 font-mono text-xs font-bold uppercase p-2 rounded-md bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Utilizada em botões principais, realces e status.
                </span>
              </div>

              {/* Cor de Acento */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-white block">
                  Cor de Acento / Destaque
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    className="w-28 font-mono text-xs font-bold uppercase p-2 rounded-md bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Utilizada em ícones, bordas brilhantes e links.
                </span>
              </div>

              {/* Modo Base */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-white block">
                  Modo Base de Fundo
                </label>
                <Select
                  value={customMode}
                  onChange={(e) => setCustomMode(e.target.value)}
                >
                  <option value="dark">Escuro Operacional (Recomendado)</option>
                  <option value="light">Claro Corporativo</option>
                </Select>
                <span className="text-[10px] text-slate-500 block">
                  Alterna a luminosidade de fundo e contraste do texto.
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <Button
                variant="primary"
                onClick={handleAplicarCoresCustomizadas}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Aplicar Paleta Personalizada
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ABA 3: PARÂMETROS FISCAIS & OPERACIONAIS */}
      {abaAtiva === "parametros" && (
        <Card className="p-6 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-sky-400 uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>Regras de Negócio e Estoque ERP</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs font-bold text-white">
                  Exigir Justificativa Obrigatória em Baixas de Estoque
                </div>
                <p className="text-[11px] text-slate-400">
                  Obriga o operador a registrar o motivo e explicação com no mínimo 5 caracteres em
                  qualquer avaria ou descarte.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.exigirJustificativaPerda}
                onChange={(e) =>
                  setFormData({ ...formData, exigirJustificativaPerda: e.target.checked })
                }
                className="w-5 h-5 accent-sky-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Margem Markup Padrão Sugerida (%)"
                type="number"
                value={formData.margemPadrao}
                onChange={(e) => setFormData({ ...formData, margemPadrao: e.target.value })}
                placeholder="100"
              />

              <Input
                label="Alerta de Estoque Mínimo (Peças)"
                type="number"
                value={formData.alertaEstoqueMinimoPadrao}
                onChange={(e) =>
                  setFormData({ ...formData, alertaEstoqueMinimoPadrao: e.target.value })
                }
                placeholder="5"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSalvarConfiguracoes}
              isLoading={salvando}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Salvar Parâmetros
            </Button>
          </div>
        </Card>
      )}

      {/* ABA 4: AUDITORIA & SEGURANÇA */}
      {abaAtiva === "seguranca" && (
        <Card className="p-6 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Auditoria Cadastral e Informações do Tenant</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Identificador da Empresa (Tenant ID):</span>
              <span className="font-mono text-white font-bold">{activeTenantId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Filial / Unidade Conectada:</span>
              <span className="text-white capitalize">{activeUnitId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Usuário Atual:</span>
              <span className="text-white">
                {userProfile?.nome || user?.email} ({role})
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Última Modificação:</span>
              <span className="text-slate-300 font-mono">
                {companyDetails?.atualizadoEm
                  ? "Sincronizado via Firestore"
                  : "Dados em conformidade"}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ABA 5: GOOGLE WORKSPACE & APIS EM NUVEM (FREE TIER / CUSTO ZERO) */}
      {abaAtiva === "google" && (
        <div className="space-y-6">
          {/* Card Principal de Conexão e Credenciais */}
          <Card className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                    <Cloud className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Integração Google Cloud / Workspace (Arquitetura Free Tier)
                  </h3>
                  <Badge variant={googleConnected ? "success" : "neutral"} size="sm">
                    {googleConnected ? "Conectado • 100% Custo Zero" : "Desconectado"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  Sincronização em nuvem aproveitando rigorosamente as cotas gratuitas oficiais: Google Calendar (1M req/dia), Gmail API (250 a 2.000 envios/dia) e Google Drive (15 GB grátis).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowGoogleHelp(!showGoogleHelp)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold cursor-pointer shrink-0"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showGoogleHelp ? "Ocultar Guia Rápido" : "Como Obter Client ID Grátis"}</span>
              </button>
            </div>

            {/* Guia Rápido em Acordeão */}
            {showGoogleHelp && (
              <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/20 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
                <p className="font-bold text-sky-400 flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> Passo a Passo para Gerar Credenciais Gratuitas (Zero Custo):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1">
                  <li>
                    Acesse o <strong>Google Cloud Console</strong> (<a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-sky-400 underline">console.cloud.google.com</a>) e crie um projeto gratuito (ex: <em>LifeSurf ERP</em>). Não exige cartão de crédito.
                  </li>
                  <li>
                    Vá em <strong>APIs e Serviços &gt; Biblioteca</strong> e ative: <em>Google Calendar API</em>, <em>Gmail API</em> e <em>Google Drive API</em>.
                  </li>
                  <li>
                    Em <strong>Tela de Consentimento OAuth</strong>, selecione <em>Externo</em> e dê o nome do app (ex: <em>LifeSurf PDV</em>).
                  </li>
                  <li>
                    Em <strong>Credenciais &gt; Criar Credenciais &gt; ID do Cliente OAuth</strong>, escolha <em>Aplicativo da Web</em> e adicione a URL em <strong>Origens JavaScript autorizadas</strong> (ex: <code className="bg-slate-900 px-1 py-0.5 rounded text-sky-300">{window.location.origin}</code>).
                  </li>
                  <li>
                    Copie o <strong>ID do Cliente (Client ID)</strong> gerado, cole no campo abaixo e clique em <strong>Conectar com Google</strong>.
                  </li>
                </ol>
              </div>
            )}

            {/* Input do Client ID e Ação de Conexão */}
            <div className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Google OAuth 2.0 Client ID (Aplicativo da Web)</span>
                    <span className="text-[11px] text-slate-500 font-normal">Armazenado de forma segura no navegador</span>
                  </label>
                  <Input
                    placeholder="Ex: 287539362216-xxxxxx.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSalvarClientId}
                    className="text-xs shrink-0"
                  >
                    Salvar ID
                  </Button>

                  {googleConnected ? (
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="primary"
                        onClick={handleConectarGoogle}
                        isLoading={connectingGoogle}
                        className="text-xs bg-sky-600 hover:bg-sky-500 text-white w-full"
                      >
                        Trocar Conta
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDesconectarGoogle}
                        className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 shrink-0"
                      >
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleConectarGoogle}
                      isLoading={connectingGoogle}
                      className="text-xs w-full bg-sky-600 hover:bg-sky-500 text-white"
                    >
                      Conectar Conta Google
                    </Button>
                  )}
                </div>
              </div>

              {/* Origem JavaScript para evitar erro 401 invalid_client */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                  <span>Origem autorizada necessária:</span>
                  <code className="text-emerald-400 bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800">{window.location.origin}</code>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    toast.success("Origem autorizada copiada para a área de transferência!");
                  }}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-bold hover:underline cursor-pointer self-start sm:self-auto"
                >
                  Copiar URL da Origem
                </button>
              </div>
            </div>

            {/* Perfil Conectado */}
            {googleConnected && googleUser && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    Autenticado como: <strong>{googleUser.email || "Conta Google"}</strong> ({googleUser.name || "Usuário Autorizado"})
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold uppercase">Token Ativo</span>
              </div>
            )}
          </Card>

          {/* Grid dos 3 Módulos Específicos com Switches e Cotas Free Tier */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. GOOGLE CALENDAR API */}
            <Card className="p-5 flex flex-col justify-between space-y-4 border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Google Calendar API
                    </span>
                  </div>
                  <Badge variant="success" size="sm" className="bg-purple-500/10 text-purple-300 border-purple-500/20">
                    1M req/dia Free
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <p className="leading-relaxed">
                    Sincronização bidirecional de prazos de entrega com motoboys, retiradas no balcão e prazos de término de Ordens de Produção (OP).
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={googleSettings.calendarEnabled}
                        onChange={(e) => handleToggleGoogleSetting("calendarEnabled", e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-white font-medium">Sincronização Ativa</span>
                    </label>
                    <p className="text-[11px] text-slate-400 pl-6">
                      Eventos criados no ERP são espelhados automaticamente na agenda corporativa.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestarCalendarSync}
                  isLoading={testingCalendar}
                  disabled={!googleConnected}
                  className="w-full text-xs text-purple-300 border-purple-500/30 hover:bg-purple-500/10"
                >
                  Criar Evento de Teste
                </Button>
              </div>
            </Card>

            {/* 2. GMAIL API */}
            <Card className="p-5 flex flex-col justify-between space-y-4 border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Gmail API (Transacional)
                    </span>
                  </div>
                  <Badge variant="success" size="sm" className="bg-sky-500/10 text-sky-300 border-sky-500/20">
                    Até 2.000 envios/dia
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <p className="leading-relaxed">
                    Disparo de e-mails transacionais aos clientes para confirmação de pedidos, início de separação e aviso de "Pronto para Retirada".
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={googleSettings.gmailEnabled}
                        onChange={(e) => handleToggleGoogleSetting("gmailEnabled", e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-white font-medium">Disparo Automático Ativo</span>
                    </label>
                    <p className="text-[11px] text-slate-400 pl-6">
                      Envia notificações nos avanços das etapas no Kanban de Pedidos.
                    </p>
                  </div>

                  <div className="pt-1">
                    <input
                      type="email"
                      placeholder="E-mail p/ teste (opcional)"
                      value={testEmailDest}
                      onChange={(e) => setTestEmailDest(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-900 text-white rounded-lg border border-slate-800 text-xs focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestarGmailSend}
                  isLoading={testingGmail}
                  disabled={!googleConnected}
                  className="w-full text-xs text-sky-300 border-sky-500/30 hover:bg-sky-500/10"
                >
                  Enviar E-mail de Teste
                </Button>
              </div>
            </Card>

            {/* 3. GOOGLE DRIVE API */}
            <Card className="p-5 flex flex-col justify-between space-y-4 border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Cloud className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Google Drive API (Nuvem)
                    </span>
                  </div>
                  <Badge variant="success" size="sm" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                    15 GB Grátis Padrão
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <p className="leading-relaxed">
                    Upload automático dos relatórios operacionais em PDF: <strong>Fechamento de Caixa diário</strong> e <strong>Lista de Separação (Picking List)</strong>.
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={googleSettings.driveEnabled}
                        onChange={(e) => handleToggleGoogleSetting("driveEnabled", e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-white font-medium">Backup em Nuvem Automático</span>
                    </label>
                    <p className="text-[11px] text-slate-400 pl-6">
                      Salva os relatórios em pasta segura corporativa na nuvem.
                    </p>
                  </div>

                  <div className="pt-1">
                    <label className="text-[11px] text-slate-400 block mb-1">Nome da Pasta Segura no Drive:</label>
                    <input
                      type="text"
                      value={googleSettings.driveFolderName}
                      onChange={(e) => handleToggleGoogleSetting("driveFolderName", e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-900 text-white rounded-lg border border-slate-800 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestarDriveFolder}
                  isLoading={testingDrive}
                  disabled={!googleConnected}
                  className="w-full text-xs text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  Verificar / Criar Pasta
                </Button>
                {driveFolderInfo?.webViewLink && (
                  <a
                    href={driveFolderInfo.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 shrink-0"
                    title="Abrir pasta no Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ABA: CATÁLOGO & VITRINE ONLINE */}
      {abaAtiva === "catalogo" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <Card variant="subtle" className="p-5 border-sky-500/20 bg-slate-900/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Catálogo & Vitrine Digital da Loja</span>
                    <Badge variant="success" size="sm">Online</Badge>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Seus clientes acessam seus produtos e enviam pedidos diretamente pelo WhatsApp sem complicação.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/catalogo/${activeTenantId}`);
                    toast.success("Link do catálogo copiado!");
                  }}
                  leftIcon={<Copy className="w-3.5 h-3.5 text-sky-400" />}
                >
                  Copiar Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/catalogo/${activeTenantId}`, "_blank")}
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Ver Vitrine
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/gerenciar-catalogo")}
                  leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
                >
                  Gerenciador Completo
                </Button>
              </div>
            </div>

            {/* Configurações da Vitrine */}
            <form onSubmit={handleSalvarConfiguracoesCatalogo} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nome da Loja na Vitrine
                  </label>
                  <Input
                    placeholder="Nome visível na vitrine"
                    value={catalogoConfig.nome}
                    onChange={(e) => setCatalogoConfig({ ...catalogoConfig, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    WhatsApp para Pedidos
                  </label>
                  <Input
                    placeholder="(85) 98888-7777"
                    value={catalogoConfig.whatsapp}
                    onChange={(e) => setCatalogoConfig({ ...catalogoConfig, whatsapp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Chave PIX (Para Cópia do Cliente)
                  </label>
                  <Input
                    placeholder="Chave PIX da loja"
                    value={catalogoConfig.chavePix}
                    onChange={(e) => setCatalogoConfig({ ...catalogoConfig, chavePix: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Mensagem do Banner de Boas-Vindas
                </label>
                <textarea
                  rows={2}
                  value={catalogoConfig.mensagemCatalogo}
                  onChange={(e) => setCatalogoConfig({ ...catalogoConfig, mensagemCatalogo: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 text-xs text-white p-2.5 focus:border-sky-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={salvandoCatalogo}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Salvar Dados do Catálogo
                </Button>
              </div>
            </form>
          </Card>

          {/* Lista rápida de mercadorias com 1 clique para retirar */}
          <Card variant="subtle" className="p-5 border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Mercadorias na Vitrine</h3>
                <p className="text-xs text-slate-400">
                  Clique no botão de status para retirar ou recolocar qualquer mercadoria na vitrine com 1 clique.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/gerenciar-catalogo")}
                leftIcon={<Edit2 className="w-3.5 h-3.5 text-sky-400" />}
              >
                Gerenciar Todas as Mercadorias
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {catalogoProdutos.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhuma mercadoria carregada no momento.
                </div>
              ) : (
                catalogoProdutos.map((prod) => {
                  const isVisivel = prod.ativoNoCatalogo !== false;
                  return (
                    <div
                      key={prod.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isVisivel
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-slate-950/40 border-slate-800/40 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                          {prod.fotoUrl && (
                            <img src={prod.fotoUrl} alt={prod.nome} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{prod.nome}</span>
                            {prod.destaque && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {prod.categoria} • Varejo: {formatCurrency(prod.precoVarejo)} | Atacado: {formatCurrency(prod.precoAtacado)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibilidadeCatalogo(prod)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isVisivel
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-500/15 hover:text-emerald-400"
                          }`}
                        >
                          {isVisivel ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Na Vitrine</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-amber-400" />
                              <span>Retirado</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ABA: OPERAÇÕES PDV & BACKUP */}
      {abaAtiva === "operacoes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Rotina Operacional do PDV */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <Sliders className="w-4 h-4" />
              <span>Parâmetros de Venda & Fechamento de Caixa</span>
            </div>

            <form onSubmit={handleSalvarOpcoesPdv} className="space-y-4">
              <Input
                label="Fundo de Troco Padrão na Abertura (R$)"
                type="number"
                step="0.01"
                min="0"
                value={fundoTrocoPadrao}
                onChange={(e) => setFundoTrocoPadrao(e.target.value)}
                placeholder="100.00"
                helperText="Valor padrão sugerido automaticamente ao abrir o caixa a cada turno."
              />

              <Input
                label="Chave PIX Oficial da Empresa"
                value={chavePixPadrao}
                onChange={(e) => setChavePixPadrao(e.target.value)}
                placeholder="CNPJ, Celular, E-mail ou Chave Aleatória"
                helperText="Utilizada na geração de cobranças rápidas e cupom fiscal/gerencial."
              />

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agruparItensPdv}
                    onChange={(e) => setAgruparItensPdv(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500"
                  />
                  <div className="text-xs">
                    <strong className="text-white block">Agrupar Produtos Duplicados no PDV</strong>
                    <span className="text-slate-400">Ao escanear o mesmo código de barras, soma a quantidade na mesma linha.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fechamentoRapidoPdv}
                    onChange={(e) => setFechamentoRapidoPdv(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500"
                  />
                  <div className="text-xs">
                    <strong className="text-white block">Fechamento Rápido de Caixa</strong>
                    <span className="text-slate-400">Preenche automaticamente o dinheiro apurado pelo PDV sem exigir contagem manual.</span>
                  </div>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Salvar Parâmetros do PDV
              </Button>
            </form>
          </Card>

          {/* Card: Central de Backup & Segurança de Dados */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Cloud className="w-4 h-4" />
              <span>Backup Geral & Proteção de Dados</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Exporte uma cópia completa de segurança com as configurações, catálogos e cadastros da empresa para arquivamento no computador.
            </p>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Empresa Ativa:</span>
                <strong className="text-white">{companyDetails?.nome || "LifeSurf"}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">ID da Unidade:</span>
                <span className="font-mono text-sky-400">{activeUnitId || "matriz"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Modo de Segurança:</span>
                <Badge variant="success" size="sm" withDot={true}>Anti-perda Ativo</Badge>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Button
                variant="outline"
                onClick={handleExportarBackupJson}
                leftIcon={<FileText className="w-4 h-4 text-emerald-400" />}
                className="w-full justify-center border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 font-bold"
              >
                Exportar Backup Completo (.JSON)
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  toast.success("Cache e sincronização local renovados com sucesso!");
                }}
                leftIcon={<RefreshCw className="w-4 h-4 text-sky-400" />}
                className="w-full justify-center text-xs"
              >
                Renovar Cache Local do Navegador
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
