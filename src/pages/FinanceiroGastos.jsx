import { useState, useEffect, useMemo, useRef } from "react";
import { useTenant } from "../contexts/TenantContext";
import { useAuth } from "../security/AuthContext";
import {
  fetchCashFlowTransactions,
  saveCashFlowTransaction,
  deleteCashFlowTransaction,
  calculateCashFlowSummary,
  CATEGORIAS_ENTRADA,
  CATEGORIAS_GASTO,
  FORMAS_PAGAMENTO_FINANCEIRO
} from "../services/financialService";
import {
  isGoogleConnected,
  getGoogleUserInfo,
  getGoogleClientId,
  requestGoogleAccessToken,
  uploadReceiptImageToDrive,
  ensureMonthlyReceiptsDriveFolder,
  MESES_NOMES
} from "../services/googleApiService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import GoogleConnectModal from "../components/google/GoogleConnectModal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from "../components/ui/Table";
import { formatCurrency, formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import toast from "react-hot-toast";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Camera,
  Upload,
  Cloud,
  Folder,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Image as ImageIcon,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Eye,
  Layers,
  Building2
} from "lucide-react";

export const CATEGORIAS_GASTO_PESSOAL = [
  "Alimentação & Supermercado",
  "Moradia & Aluguel / Condomínio",
  "Energia, Água & Internet",
  "Transporte & Combustível",
  "Saúde & Farmácia",
  "Lazer, Viagens & Restaurantes",
  "Educação & Cursos",
  "Compras Pessoais & Roupas",
  "Transferência / Envio Familiar",
  "Manutenção & Consertos",
  "Outros Gastos Pessoais"
];

export const CATEGORIAS_ENTRADA_PESSOAL = [
  "Salário / Pró-Labore",
  "Recebimento de Terceiros / Amigos",
  "Aluguel / Renda Passiva",
  "Venda de Bem Pessoal",
  "Reembolso",
  "Outros Recebimentos Pessoais"
];

export default function FinanceiroGastos() {
  const { activeTenantId } = useTenant();
  const { userProfile } = useAuth();
  const tenantId = activeTenantId || "lifesurf";
  const isPersonalTenant = tenantId === "financas-pessoal" || tenantId.includes("pessoal");

  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status de Conexão com Google Drive
  const [googleConectado, setGoogleConectado] = useState(() => isGoogleConnected());
  const [googleUser, setGoogleUser] = useState(() => getGoogleUserInfo());
  const [conectandoGoogle, setConectandoGoogle] = useState(false);
  const [pastaMesInfo, setPastaMesInfo] = useState(null);
  const [modalGoogleAberto, setModalGoogleAberto] = useState(false);

  // Filtros de Período e Busca
  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr);
  const [filtroTipo, setFiltroTipo] = useState("todos"); // "todos" | "saida" | "entrada" | "comprovante"
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");

  // Modal de Adicionar / Editar Lançamento (Gasto ou Entrada)
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoTransacao, setEditandoTransacao] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Formulário do Lançamento
  const [formData, setFormData] = useState({
    tipo: "saida", // "saida" (gasto) ou "entrada" (receita)
    descricao: "",
    fornecedorOuCliente: "",
    responsavel: userProfile?.nome || "Lucas",
    categoria: isPersonalTenant ? "Alimentação & Supermercado" : "Matéria-Prima (Tecidos / Malhas)",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    formaPagamento: isPersonalTenant ? "dinheiro" : "pix",
    status: "concluido",
    observacoes: ""
  });

  // Imagem de Comprovante Anexada / Tirada na Câmera
  const [imagemBlob, setImagemBlob] = useState(null);
  const [imagemPreview, setImagemPreview] = useState(null);
  const [nomeArquivoFoto, setNomeArquivoFoto] = useState("");
  const [enviarParaDrive, setEnviarParaDrive] = useState(true);

  // Câmera ao vivo / Visualizador de Captura
  const [modalCameraAoVivo, setModalCameraAoVivo] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputCameraRef = useRef(null);
  const fileInputUploadRef = useRef(null);

  // Modal de Visualização de Comprovante
  const [modalPreviewComprovante, setModalPreviewComprovante] = useState(null);

  // 1. CARREGAMENTO DAS TRANSAÇÕES E PASTA DO DRIVE
  const carregarDadosFinanceiros = async () => {
    setLoading(true);
    try {
      const data = await fetchCashFlowTransactions(tenantId);
      setTransacoes(data);

      // Se o Google estiver conectado, descobre o link da pasta do mês no Drive
      if (isGoogleConnected()) {
        const [anoStr, mesStr] = mesSelecionado.split("-");
        ensureMonthlyReceiptsDriveFolder({
          year: parseInt(anoStr, 10),
          month: parseInt(mesStr, 10)
        })
          .then((folder) => setPastaMesInfo(folder))
          .catch((err) => console.warn("Erro ao obter pasta do mês:", err));
      }
    } catch (err) {
      console.error("Erro ao carregar transações financeiras:", err);
      toast.error("Erro ao carregar lançamentos financeiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosFinanceiros();
  }, [tenantId, mesSelecionado]);

  // 2. CONECTAR CONTA GOOGLE PARA SALVAR NO DRIVE
  const handleConectarGoogle = () => {
    setModalGoogleAberto(true);
  };

  // 3. CAPTURA DE FOTO VIA INPUT DE ARQUIVO / CÂMERA NATIVA DO APARELHO
  const handleArquivoSelecionado = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivoFoto(file.name);
    setImagemBlob(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagemPreview(event.target.result);
    };
    reader.readAsDataURL(file);
    toast.success("Foto do comprovante capturada!");
  };

  // 4. CÂMERA AO VIVO WEBCAM / CELULAR
  const iniciarCameraAoVivo = async () => {
    try {
      setModalCameraAoVivo(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn("Não foi possível acessar a câmera diretamente:", err);
      setModalCameraAoVivo(false);
      // Fallback para input de captura padrão que funciona em todos os aparelhos
      if (fileInputCameraRef.current) {
        fileInputCameraRef.current.click();
      } else {
        toast.error("Permissão de câmera negada ou não disponível. Use o botão de escolher foto.");
      }
    }
  };

  const tirarFotoCameraAoVivo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setImagemBlob(blob);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setImagemPreview(dataUrl);
        setNomeArquivoFoto(`Comprovante_${Date.now()}.jpg`);
        toast.success("Foto capturada com sucesso!");
        encerrarCameraAoVivo();
      }
    }, "image/jpeg", 0.9);
  };

  const encerrarCameraAoVivo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setModalCameraAoVivo(false);
  };

  // 5. ABRIR MODAL PARA NOVO GASTO OU ENTRADA
  const handleAbrirModalNovo = (tipoPadrao = "saida") => {
    setEditandoTransacao(null);
    setFormData({
      tipo: tipoPadrao,
      descricao: "",
      fornecedorOuCliente: "",
      responsavel: userProfile?.nome || "Lucas",
      categoria:
        tipoPadrao === "saida"
          ? (isPersonalTenant ? "Alimentação & Supermercado" : "Matéria-Prima (Tecidos / Malhas)")
          : (isPersonalTenant ? "Salário / Pró-Labore" : "Venda Balcão / PDV"),
      valor: "",
      data: new Date().toISOString().split("T")[0],
      formaPagamento: isPersonalTenant ? "dinheiro" : "pix",
      status: "concluido",
      observacoes: ""
    });
    setImagemBlob(null);
    setImagemPreview(null);
    setNomeArquivoFoto("");
    setEnviarParaDrive(true);
    setModalAberto(true);
  };

  const handleAbrirModalEditar = (t) => {
    setEditandoTransacao(t);
    setFormData({
      tipo: t.tipo || "saida",
      descricao: t.descricao || "",
      fornecedorOuCliente: t.fornecedorOuCliente || "",
      responsavel: t.responsavel || userProfile?.nome || "Lucas",
      categoria: t.categoria || "Outros",
      valor: t.valor || "",
      data: t.data || new Date().toISOString().split("T")[0],
      formaPagamento: t.formaPagamento || "pix",
      status: t.status || "concluido",
      observacoes: t.observacoes || ""
    });
    setImagemBlob(null);
    setImagemPreview(t.comprovante?.previewLocal || null);
    setNomeArquivoFoto(t.comprovante?.nomeArquivo || "");
    setEnviarParaDrive(true);
    setModalAberto(true);
  };

  // 6. SALVAR LANÇAMENTO FINANCEIRO E ENVIAR AO GOOGLE DRIVE NA PASTA DO MÊS
  const handleSalvarTransacao = async (e) => {
    if (e) e.preventDefault();

    if (!formData.descricao.trim()) {
      toast.error("Digite a descrição do lançamento");
      return;
    }
    if (!formData.valor || Number(formData.valor) <= 0) {
      toast.error("Informe um valor superior a R$ 0,00");
      return;
    }

    setSalvando(true);
    let comprovanteInfo = editandoTransacao?.comprovante || null;

    try {
      // Se houver uma foto capturada e o envio ao Drive estiver marcado
      if (imagemBlob && enviarParaDrive) {
        const dataLancamento = new Date(formData.data + "T12:00:00");
        const ano = dataLancamento.getFullYear();
        const mes = dataLancamento.getMonth() + 1;

        if (isGoogleConnected()) {
          const toastId = toast.loading("Enviando foto para a pasta do mês no Google Drive...");
          try {
            const driveRes = await uploadReceiptImageToDrive({
              imageBlob: imagemBlob,
              fileName:
                nomeArquivoFoto ||
                `Comprovante_${formData.tipo}_${Date.now()}.jpg`,
              year: ano,
              month: mes,
              description: `${formData.tipo === "saida" ? "Gasto" : "Entrada"}: ${formData.descricao} (R$ ${formData.valor})`
            });

            toast.dismiss(toastId);
            toast.success(
              `Comprovante salvo com sucesso na pasta "${driveRes.folderName}" do Google Drive!`,
              { duration: 4000 }
            );

            comprovanteInfo = {
              driveFileId: driveRes.fileId,
              driveUrl: driveRes.webViewLink,
              driveFolderUrl: driveRes.folderWebViewLink,
              driveFolderName: driveRes.folderName,
              nomeArquivo: driveRes.fileName,
              previewLocal: imagemPreview || null,
              enviadoDrive: true
            };
          } catch (driveErr) {
            toast.dismiss(toastId);
            console.warn("Falha no upload do Drive:", driveErr);
            toast.error("Não foi possível enviar ao Drive: " + driveErr.message);

            // Fallback para armazenamento do preview local
            comprovanteInfo = {
              nomeArquivo: nomeArquivoFoto || "comprovante_local.jpg",
              previewLocal: imagemPreview || null,
              enviadoDrive: false
            };
          }
        } else {
          // Salva localmente se Google não estiver conectado
          comprovanteInfo = {
            nomeArquivo: nomeArquivoFoto || "comprovante_local.jpg",
            previewLocal: imagemPreview || null,
            enviadoDrive: false
          };
          toast("Comprovante armazenado localmente. Conecte sua conta Google para enviar à nuvem.", {
            icon: "💾"
          });
        }
      }

      const payload = {
        ...formData,
        responsavel: formData.responsavel?.trim() || userProfile?.nome || "Lucas",
        valor: Number(formData.valor),
        comprovante: comprovanteInfo
      };

      const salvo = await saveCashFlowTransaction(
        tenantId,
        payload,
        editandoTransacao?.id || null
      );

      if (editandoTransacao) {
        setTransacoes((prev) =>
          prev.map((t) => (t.id === editandoTransacao.id ? { ...t, ...salvo } : t))
        );
        toast.success("Lançamento financeiro atualizado com sucesso!");
      } else {
        setTransacoes((prev) => [salvo, ...prev]);
        toast.success(
          `${formData.tipo === "saida" ? "Gasto registrado" : "Entrada registrada"} com sucesso!`
        );
      }

      setModalAberto(false);
    } catch (err) {
      console.error("Erro ao salvar lançamento financeiro:", err);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // 7. EXCLUIR TRANSAÇÃO
  const handleExcluirTransacao = async (t) => {
    const confirmar = window.confirm(
      `Deseja realmente excluir este lançamento de ${t.tipo === "saida" ? "gasto" : "entrada"}: "${t.descricao}" no valor de ${formatCurrency(t.valor)}?`
    );
    if (!confirmar) return;

    try {
      const atualizados = await deleteCashFlowTransaction(tenantId, t.id);
      setTransacoes(atualizados);
      toast.success("Lançamento excluído com sucesso.");
    } catch (err) {
      toast.error("Erro ao excluir lançamento");
    }
  };

  // 8. FILTROS E CÁLCULO DE RESUMO
  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter((t) => {
      // Filtro Mês
      const matchMes = !mesSelecionado || t.data?.startsWith(mesSelecionado);

      // Filtro Tipo
      let matchTipo = true;
      if (filtroTipo === "saida") matchTipo = t.tipo === "saida";
      if (filtroTipo === "entrada") matchTipo = t.tipo === "entrada";
      if (filtroTipo === "comprovante") matchTipo = Boolean(t.comprovante?.driveUrl || t.comprovante?.previewLocal);

      // Filtro Categoria
      const matchCat = categoriaFiltro === "TODAS" || t.categoria === categoriaFiltro;

      // Filtro Texto
      const matchBusca =
        !busca.trim() ||
        t.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
        t.fornecedorOuCliente?.toLowerCase().includes(busca.toLowerCase()) ||
        t.categoria?.toLowerCase().includes(busca.toLowerCase());

      return matchMes && matchTipo && matchCat && matchBusca;
    });
  }, [transacoes, mesSelecionado, filtroTipo, categoriaFiltro, busca]);

  const resumo = useMemo(() => {
    return calculateCashFlowSummary(transacoes, mesSelecionado);
  }, [transacoes, mesSelecionado]);

  // Lista de Categorias dinâmicas de acordo com o tipo selecionado no modal
  const categoriasDoTipo =
    formData.tipo === "entrada"
      ? (isPersonalTenant ? CATEGORIAS_ENTRADA_PESSOAL : CATEGORIAS_ENTRADA)
      : (isPersonalTenant ? CATEGORIAS_GASTO_PESSOAL : CATEGORIAS_GASTO);

  const categoriasListaFiltro = isPersonalTenant
    ? [...CATEGORIAS_GASTO_PESSOAL, ...CATEGORIAS_ENTRADA_PESSOAL]
    : [...CATEGORIAS_GASTO, ...CATEGORIAS_ENTRADA];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Inputs ocultos para Câmera Nativa e Seleção de Arquivo */}
      <input
        type="file"
        ref={fileInputCameraRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleArquivoSelecionado}
      />
      <input
        type="file"
        ref={fileInputUploadRef}
        accept="image/*"
        className="hidden"
        onChange={handleArquivoSelecionado}
      />

      {/* 1. TOPO DA TELA & AÇÕES DE CÂMERA E DRIVE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success" size="sm" withDot={true}>
              Fluxo de Caixa & Livro Caixa
            </Badge>
            <span className="text-xs text-slate-400">
              Ambiente: <strong className="text-white uppercase">{tenantId}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            Controle de Gastos & Entradas
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Adicione despesas e receitas, capture fotos de comprovantes diretamente pela câmera e
            guarde tudo organizado automaticamente na pasta do mês no seu Google Drive.
          </p>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Câmera Rápida */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              handleAbrirModalNovo("saida");
              setTimeout(() => {
                iniciarCameraAoVivo();
              }, 200);
            }}
            className="border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
            leftIcon={<Camera className="w-4 h-4 text-sky-400" />}
          >
            Tirar Foto de Comprovante
          </Button>

          {/* Botão Conectar / Gerenciar Conta Google */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalGoogleAberto(true)}
            leftIcon={<Cloud className={`w-4 h-4 ${googleConectado ? "text-emerald-400" : "text-sky-400"}`} />}
            className={
              googleConectado
                ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs"
                : "border-sky-500/50 text-sky-400 hover:bg-sky-500/10 text-xs font-bold shadow-sm"
            }
          >
            {googleConectado ? (
              <span className="flex items-center gap-1.5 truncate max-w-[190px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">{googleUser?.email || "Google Conectado"}</span>
              </span>
            ) : (
              "Conectar Conta Google (Drive)"
            )}
          </Button>

          {/* Botão Abrir Pasta do Mês no Drive */}
          {googleConectado && pastaMesInfo?.webViewLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(pastaMesInfo.webViewLink, "_blank")}
              leftIcon={<Folder className="w-4 h-4 text-amber-400" />}
              title="Abrir pasta de comprovantes deste mês no Google Drive"
            >
              Pasta do Mês no Drive
            </Button>
          )}

          {/* Botão Nova Entrada */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAbrirModalNovo("entrada")}
            leftIcon={<ArrowUpRight className="w-4 h-4 text-emerald-400" />}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            + Nova Entrada
          </Button>

          {/* Botão Novo Gasto */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleAbrirModalNovo("saida")}
            leftIcon={<ArrowDownRight className="w-4 h-4 text-white" />}
            className="bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20"
          >
            + Adicionar Gasto
          </Button>
        </div>
      </div>

      {/* Banner Especial para Modo Financeiro Pessoal Colaborativo */}
      {isPersonalTenant && (
        <Card variant="subtle" className="p-4 border-indigo-500/30 bg-indigo-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Controlador de Gastos & Entradas Pessoais
                <Badge variant="purple" size="sm">Colaborativo • Dinheiro Físico & PIX</Badge>
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie despesas do dia a dia, dinheiro físico e entradas. Outras pessoas autorizadas podem lançar valores informando o nome no campo &quot;Quem Lançou&quot;.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 2. CARDS DE RESUMO DO MÊS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Entradas */}
        <Card variant="subtle" className="p-4 border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Total de Entradas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(resumo.totalEntradas)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Receitas e vendas registradas no mês
          </div>
        </Card>

        {/* Total de Gastos */}
        <Card variant="subtle" className="p-4 border-rose-500/20 bg-rose-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Total de Gastos (Saídas)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            {formatCurrency(resumo.totalGastos)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Despesas operacionais e insumos
          </div>
        </Card>

        {/* Saldo Líquido do Mês */}
        <Card
          variant="subtle"
          className={cn(
            "p-4 border",
            resumo.saldoLiquido >= 0
              ? "border-sky-500/30 bg-sky-950/10"
              : "border-amber-500/30 bg-amber-950/10"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Saldo Líquido do Caixa</span>
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                resumo.saldoLiquido >= 0
                  ? "bg-sky-500/10 text-sky-400"
                  : "bg-amber-500/10 text-amber-400"
              )}
            >
              {resumo.saldoLiquido >= 0 ? "+" : "-"}
            </div>
          </div>
          <div
            className={cn(
              "text-2xl font-black font-mono",
              resumo.saldoLiquido >= 0 ? "text-sky-400" : "text-amber-400"
            )}
          >
            {formatCurrency(resumo.saldoLiquido)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {resumo.saldoLiquido >= 0 ? "Balanço superavitário no período" : "Atenção: saídas superam entradas"}
          </div>
        </Card>

        {/* Comprovantes no Google Drive */}
        <Card variant="subtle" className="p-4 border-amber-500/20 bg-slate-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Comprovantes no Drive</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {resumo.countComprovantesDrive}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Fotos na pasta do mês</span>
            {googleConectado ? (
              <Badge variant="success" size="sm">Drive Ativo</Badge>
            ) : (
              <Badge variant="warning" size="sm">Desconectado</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* 3. BARRA DE FILTROS & SELEÇÃO DE MÊS */}
      <Card variant="subtle" className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Seletor de Mês */}
          <div className="w-full sm:w-48">
            <Input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4 text-sky-400" />}
              title="Filtrar lançamentos por mês"
            />
          </div>

          {/* Campo de Busca */}
          <div className="flex-1">
            <Input
              placeholder="Buscar por descrição, fornecedor, cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Filtro por Tipo */}
          <div className="w-full sm:w-44">
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos os Lançamentos</option>
              <option value="saida">Apenas Gastos (Saídas)</option>
              <option value="entrada">Apenas Entradas (Receitas)</option>
              <option value="comprovante">Com Comprovante Anexo</option>
            </Select>
          </div>

          {/* Filtro por Categoria */}
          <div className="w-full sm:w-48">
            <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
              <option value="TODAS">Todas as Categorias</option>
              {categoriasListaFiltro.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* 4. TABELA DE GASTOS E ENTRADAS */}
      <Card variant="subtle" className="overflow-hidden border-slate-800">
        <Table>
          <TableHeader>
            <TableRow isInteractive={false}>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Quem Lançou</TableHead>
              <TableHead>Descrição & Fornecedor/Cliente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="text-center">Comprovante (Drive)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {transacoesFiltradas.length === 0 ? (
              <TableEmpty
                colSpan={9}
                message={
                  loading
                    ? "Carregando lançamentos..."
                    : "Nenhum lançamento encontrado para o período e filtros selecionados."
                }
              />
            ) : (
              transacoesFiltradas.map((t) => {
                const isSaida = t.tipo === "saida";
                const temComprovante = Boolean(t.comprovante?.driveUrl || t.comprovante?.previewLocal);

                return (
                  <TableRow key={t.id}>
                    {/* Tipo Badge */}
                    <TableCell>
                      <Badge
                        variant={isSaida ? "danger" : "success"}
                        size="sm"
                        className="font-bold uppercase tracking-wider"
                      >
                        {isSaida ? "Gasto" : "Entrada"}
                      </Badge>
                    </TableCell>

                    {/* Data */}
                    <TableCell>
                      <div className="text-xs text-white font-mono">{formatDate(t.data)}</div>
                    </TableCell>

                    {/* Quem Lançou */}
                    <TableCell>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700 whitespace-nowrap">
                        {t.responsavel || "Lucas"}
                      </span>
                    </TableCell>

                    {/* Descrição & Fornecedor */}
                    <TableCell>
                      <div className="font-bold text-white text-xs sm:text-sm">{t.descricao}</div>
                      {t.fornecedorOuCliente && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{t.fornecedorOuCliente}</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Categoria */}
                    <TableCell>
                      <Badge variant="subtle" size="sm">
                        {t.categoria || "Geral"}
                      </Badge>
                    </TableCell>

                    {/* Forma de Pagamento */}
                    <TableCell>
                      <span className="text-xs font-mono uppercase text-slate-300">
                        {t.formaPagamento || "PIX"}
                      </span>
                    </TableCell>

                    {/* Valor */}
                    <TableCell>
                      <div
                        className={cn(
                          "font-extrabold font-mono text-sm",
                          isSaida ? "text-rose-400" : "text-emerald-400"
                        )}
                      >
                        {isSaida ? "- " : "+ "}
                        {formatCurrency(t.valor)}
                      </div>
                    </TableCell>

                    {/* Comprovante / Drive */}
                    <TableCell className="text-center">
                      {temComprovante ? (
                        <div className="flex items-center justify-center gap-1">
                          {t.comprovante?.driveUrl ? (
                            <a
                              href={t.comprovante.driveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                              title={`Abrir foto na pasta ${t.comprovante.driveFolderName || "do Drive"}`}
                            >
                              <Cloud className="w-3.5 h-3.5" />
                              <span>No Drive</span>
                              <ExternalLink className="w-3 h-3 text-sky-400/70" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModalPreviewComprovante(t.comprovante)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Ver foto armazenada localmente"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Ver Foto</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAbrirModalEditar(t)}
                          className="text-[11px] text-slate-500 hover:text-sky-400 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Anexar</span>
                        </button>
                      )}
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleAbrirModalEditar(t)}
                          title="Editar Lançamento"
                          className="text-sky-400 hover:text-sky-300"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleExcluirTransacao(t)}
                          title="Excluir Lançamento"
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 5. MODAL DE CADASTRO / EDIÇÃO COM FOTO E GOOGLE DRIVE */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} size="lg">
        <ModalHeader onClose={() => setModalAberto(false)}>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>
              {editandoTransacao
                ? "Editar Lançamento Financeiro"
                : formData.tipo === "saida"
                ? "Adicionar Novo Gasto (Despesa)"
                : "Adicionar Nova Entrada (Receita)"}
            </span>
          </div>
        </ModalHeader>

        <form onSubmit={handleSalvarTransacao}>
          <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Seletor de Tipo (Gasto vs Entrada) */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    tipo: "saida",
                    categoria: "Matéria-Prima (Tecidos / Malhas)"
                  })
                }
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  formData.tipo === "saida"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Gasto (Saída / Despesa)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    tipo: "entrada",
                    categoria: "Venda Balcão / PDV"
                  })
                }
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  formData.tipo === "entrada"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Entrada (Receita / Aporte)</span>
              </button>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Descrição do Lançamento *
              </label>
              <Input
                placeholder={
                  formData.tipo === "saida"
                    ? "Ex: Compra de 150kg de tecido malha 30.1 penteada"
                    : "Ex: Recebimento de pedido atacado ou venda balcão"
                }
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                required
              />
            </div>

            {/* Valor & Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Valor (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  leftIcon={<span className="text-xs font-mono font-bold text-slate-400">R$</span>}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Data do Lançamento *
                </label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Categoria & Fornecedor/Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Categoria *
                </label>
                <Select
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                >
                  {categoriasDoTipo.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {formData.tipo === "saida" ? "Fornecedor / Favorecido" : "Cliente / Origem"}
                </label>
                <Input
                  placeholder={
                    formData.tipo === "saida"
                      ? "Ex: Têxtil Ceará, Enel, Dona Rita Costuras"
                      : "Ex: Surf House, Cliente Balcão, Aporte"
                  }
                  value={formData.fornecedorOuCliente}
                  onChange={(e) => setFormData({ ...formData, fornecedorOuCliente: e.target.value })}
                />
              </div>
            </div>

            {/* Forma de Pagamento & Quem Lançou */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Forma de Pagamento
                </label>
                <Select
                  value={formData.formaPagamento}
                  onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value })}
                >
                  {FORMAS_PAGAMENTO_FINANCEIRO.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {isPersonalTenant ? "Quem Lançou (Colaborativo) *" : "Quem Lançou / Responsável"}
                </label>
                <Input
                  placeholder="Ex: Lucas, Maria, João..."
                  value={formData.responsavel || ""}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                />
              </div>
            </div>

            {isPersonalTenant && (
              <p className="text-[11px] text-indigo-300 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/30 leading-relaxed">
                💡 <strong>Modo Pessoal Colaborativo:</strong> Você e outras pessoas autorizadas podem registrar despesas e recebimentos em dinheiro físico ou PIX, identificando quem lançou no campo acima.
              </p>
            )}

            {/* SEÇÃO DA FOTO DO COMPROVANTE & GOOGLE DRIVE */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-sky-400" />
                  Foto do Comprovante (Google Drive)
                </span>
                {googleConectado ? (
                  <Badge variant="success" size="sm">
                    Google Drive Conectado
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={handleConectarGoogle}
                    className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                  >
                    Conectar Google
                  </button>
                )}
              </div>

              {/* Botoes de Acao da Foto */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={iniciarCameraAoVivo}
                  leftIcon={<Camera className="w-4 h-4 text-sky-400" />}
                >
                  Tirar Foto Agora
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputUploadRef.current?.click()}
                  leftIcon={<Upload className="w-4 h-4 text-slate-400" />}
                >
                  Escolher Imagem
                </Button>
              </div>

              {/* Preview da Imagem */}
              {imagemPreview && (
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 p-2 flex items-center gap-3">
                  <img
                    src={imagemPreview}
                    alt="Preview Comprovante"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {nomeArquivoFoto || "comprovante_capturado.jpg"}
                    </div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Foto pronta para envio</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImagemBlob(null);
                      setImagemPreview(null);
                      setNomeArquivoFoto("");
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remover foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Opção de Envio para a Pasta do Mês no Drive */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarParaDrive}
                  onChange={(e) => setEnviarParaDrive(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-700 bg-slate-900"
                />
                <span className="text-xs text-slate-300">
                  Salvar automaticamente na pasta do mês (ex:{" "}
                  <strong className="text-white">
                    Comprovantes / {mesSelecionado}
                  </strong>
                  ) no Google Drive
                </span>
              </label>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={salvando}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {editandoTransacao ? "Salvar Alterações" : "Gravar Lançamento"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* 6. MODAL DA CÂMERA AO VIVO */}
      <Modal isOpen={modalCameraAoVivo} onClose={encerrarCameraAoVivo} size="md">
        <ModalHeader onClose={encerrarCameraAoVivo}>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-400" />
            <span>Tirar Foto do Comprovante</span>
          </div>
        </ModalHeader>
        <ModalBody className="p-0 overflow-hidden bg-black flex flex-col items-center">
          <div className="relative w-full aspect-4/3 max-h-[60vh] bg-black overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Marcadores de enquadramento do comprovante */}
            <div className="absolute inset-8 border-2 border-dashed border-sky-400/60 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[11px] text-sky-200/80 bg-slate-950/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                Enquadre a nota ou recibo aqui
              </span>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex items-center justify-between">
          <Button variant="ghost" onClick={encerrarCameraAoVivo}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={tirarFotoCameraAoVivo}
            leftIcon={<Camera className="w-4 h-4" />}
            className="bg-sky-500 hover:bg-sky-400 text-white font-bold"
          >
            Capturar Foto
          </Button>
        </ModalFooter>
      </Modal>

      {/* 7. MODAL DE PRÉ-VISUALIZAÇÃO DE COMPROVANTE LOCAL */}
      {modalPreviewComprovante && (
        <Modal isOpen={true} onClose={() => setModalPreviewComprovante(null)} size="lg">
          <ModalHeader onClose={() => setModalPreviewComprovante(null)}>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-sky-400" />
              <span>{modalPreviewComprovante.nomeArquivo || "Comprovante"}</span>
            </div>
          </ModalHeader>
          <ModalBody className="p-4 flex items-center justify-center bg-slate-950">
            {modalPreviewComprovante.previewLocal ? (
              <img
                src={modalPreviewComprovante.previewLocal}
                alt="Comprovante"
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain border border-slate-800"
              />
            ) : (
              <div className="text-slate-400 text-xs py-8">Imagem não disponível para pré-visualização.</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModalPreviewComprovante(null)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Modal Dedicado para Conectar Google / Escolher E-mail */}
      <GoogleConnectModal
        isOpen={modalGoogleAberto}
        onClose={() => setModalGoogleAberto(false)}
        onSuccess={(info) => {
          setGoogleConectado(true);
          setGoogleUser(info);
          carregarDadosFinanceiros();
        }}
      />
    </div>
  );
}
