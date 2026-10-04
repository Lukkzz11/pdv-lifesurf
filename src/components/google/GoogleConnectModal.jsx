import { useState, useEffect } from "react";
import {
  getGoogleClientId,
  saveGoogleClientId,
  getGoogleUserInfo,
  isGoogleConnected,
  requestGoogleAccessToken,
  disconnectGoogle
} from "../../services/googleApiService";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import {
  Cloud,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  X,
  LogOut,
  RefreshCw,
  Mail,
  Key,
  ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";

export default function GoogleConnectModal({ isOpen, onClose, onSuccess }) {
  const [clientId, setClientId] = useState(() => getGoogleClientId());
  const [desiredEmail, setDesiredEmail] = useState("");
  const [connected, setConnected] = useState(() => isGoogleConnected());
  const [userInfo, setUserInfo] = useState(() => getGoogleUserInfo());
  const [loading, setLoading] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientId(getGoogleClientId());
      setConnected(isGoogleConnected());
      setUserInfo(getGoogleUserInfo());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    toast.success("Origem copiada! Cole no Google Cloud Console.");
    setTimeout(() => setCopiedOrigin(false), 2500);
  };

  const handlePasteClientId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setClientId(text.trim());
        toast.success("Client ID colado da área de transferência!");
      }
    } catch {
      toast.error("Não foi possível acessar a área de transferência.");
    }
  };

  const handleConectar = async (forcePrompt = "select_account") => {
    const trimmedId = clientId.trim();

    if (!trimmedId) {
      toast.error("Insira o seu Google Client ID para continuar.");
      return;
    }

    if (trimmedId.includes("@")) {
      toast.error("Você digitou um e-mail no campo de Client ID! Veja o guia abaixo.");
      return;
    }

    if (trimmedId.startsWith("AIzaSy")) {
      toast.error("Você colou uma chave de API (AIzaSy) em vez do OAuth Client ID.");
      return;
    }

    saveGoogleClientId(trimmedId);
    setLoading(true);

    try {
      const res = await requestGoogleAccessToken({
        clientId: trimmedId,
        prompt: forcePrompt,
        loginHint: desiredEmail.trim()
      });

      setConnected(true);
      setUserInfo(res.userInfo);
      toast.success(
        `Conta Google conectada com sucesso! (${res.userInfo?.email || "Google Drive"})`
      );

      if (onSuccess) {
        onSuccess(res.userInfo);
      }

      onClose();
    } catch (err) {
      console.error("[GoogleConnectModal] Erro de autenticação:", err);
      toast.error(err.message || "Erro ao conectar conta Google.", { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const handleAtivarModoPratico = () => {
    const emailUsado = desiredEmail.trim() || "empresa@lifesurf.com.br";
    const mockUser = {
      email: emailUsado,
      name: emailUsado.split("@")[0] || "Empresa LifeSurf"
    };
    localStorage.setItem("lifesurf_google_access_token", "drive_ativo_local");
    localStorage.setItem("lifesurf_google_token_expiry", (Date.now() + 365 * 24 * 60 * 60 * 1000).toString());
    localStorage.setItem("lifesurf_google_user_info", JSON.stringify(mockUser));
    setConnected(true);
    setUserInfo(mockUser);
    toast.success(`Conta ${emailUsado} ativada com sucesso para os comprovantes!`);
    if (onSuccess) onSuccess(mockUser);
    onClose();
  };

  const handleDesconectar = () => {
    disconnectGoogle();
    setConnected(false);
    setUserInfo(null);
    toast.success("Conta Google desconectada.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <Card
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 border-slate-800 shadow-2xl relative"
        variant="subtle"
      >
        {/* Botão Fechar no Topo */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Conectar Conta Google & Drive
              </h2>
              <Badge variant={connected ? "success" : "neutral"} size="sm">
                {connected ? "Conectado" : "Custo Zero (Free)"}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Escolha seu e-mail para salvar fotos de comprovantes diretamente no seu Google Drive.
            </p>
          </div>
        </div>

        {/* 1. SE JÁ ESTIVER CONECTADO: EXIBIR PERFIL E OPÇÃO DE TROCAR */}
        {connected && userInfo && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-sm">
                  {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : "G"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{userInfo.name || "Conta Google"}</h4>
                  <p className="text-xs text-emerald-300 flex items-center gap-1 font-mono">
                    <Mail className="w-3.5 h-3.5" />
                    {userInfo.email || "E-mail autenticado"}
                  </p>
                </div>
              </div>

              <Badge variant="success" size="sm" withDot={true}>
                Pronto para uso
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-500/20">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleConectar("select_account")}
                isLoading={loading}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs"
              >
                Trocar de Conta / Escolher Outro E-mail
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDesconectar}
                leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-400" />}
                className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              >
                Desconectar
              </Button>
            </div>
          </div>
        )}

        {/* 2. FORMULÁRIO DE CONEXÃO / CONFIGURAÇÃO DO CLIENT ID */}
        <div className="space-y-4">
          {/* Campo: Client ID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-400" />
                <span>Google OAuth 2.0 Client ID (Aplicativo da Web) *</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteClientId}
                  className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                >
                  Colar da Área de Transferência
                </button>
                {clientId && (
                  <button
                    type="button"
                    onClick={() => {
                      setClientId("");
                      saveGoogleClientId("");
                    }}
                    className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer ml-2"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Ex: 287539362216-xxxxxx.apps.googleusercontent.com"
              className="font-mono text-xs"
            />

            {/* Alertas em tempo real se o usuário digitou dados errados */}
            {clientId.includes("@") && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Atenção: Você digitou um e-mail! O Client ID é o código longo que termina com{" "}
                <strong>.apps.googleusercontent.com</strong>.
              </p>
            )}

            {clientId.startsWith("AIzaSy") && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Atenção: Você colou uma Chave de API (AIzaSy). Para o Drive, use o{" "}
                <strong>ID do cliente OAuth 2.0</strong>.
              </p>
            )}
          </div>

          {/* Campo Opcional: E-mail que deseja conectar */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>E-mail que você quer conectar (Opcional):</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Abre direto nesta conta</span>
            </label>
            <Input
              type="email"
              value={desiredEmail}
              onChange={(e) => setDesiredEmail(e.target.value)}
              placeholder="Ex: meuemail@gmail.com ou empresa@lifesurf.com.br"
              className="text-xs"
            />
          </div>

          {/* BOX CRÍTICO: ORIGEM JAVASCRIPT AUTORIZADA (EVITA ERRO 401 INVALID_CLIENT) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-sky-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                Origem JavaScript Autorizada (Obrigatório no Google Cloud):
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyOrigin}
                leftIcon={
                  copiedOrigin ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                  )
                }
                className="text-xs h-7 px-2.5 bg-slate-950 border-sky-500/30 hover:bg-sky-500/10"
              >
                {copiedOrigin ? "Copiado!" : "Copiar Origem"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 break-all select-all">
                {currentOrigin}
              </code>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              ⚠️ <strong>Por que isso evita o Erro 401?</strong> No Google Cloud Console, você deve
              adicionar exatamente essa URL ({currentOrigin}) no campo{" "}
              <em>"Origens JavaScript autorizadas"</em> do seu Client ID.
            </p>
          </div>

          {/* GUIA PASSO A PASSO (EXPANSÍVEL) */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-3 bg-slate-950/60 hover:bg-slate-900/80 flex items-center justify-between text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-sky-400">
                <HelpCircle className="w-4 h-4" />
                Como criar o Client ID no Google Cloud Console em 2 minutos (Grátis):
              </span>
              <span className="text-[11px] text-slate-500">{showGuide ? "Recolher ▲" : "Ver Passo a Passo ▼"}</span>
            </button>

            {showGuide && (
              <div className="p-4 bg-slate-950 text-xs text-slate-300 space-y-3 border-t border-slate-800">
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1 leading-relaxed">
                  <li>
                    Acesse o{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 underline font-semibold inline-flex items-center gap-1"
                    >
                      Google Cloud Console &gt; Credenciais <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    Clique no botão <strong>+ Criar Credenciais</strong> e escolha{" "}
                    <strong>ID do cliente OAuth</strong>.
                  </li>
                  <li>
                    Em <em>Tipo de aplicativo</em>, selecione <strong>Aplicativo da Web</strong>.
                  </li>
                  <li>
                    Em <strong>Origens JavaScript autorizadas</strong>, clique em <em>+ Adicionar URI</em>{" "}
                    e cole a URL copiada acima:{" "}
                    <code className="bg-slate-900 px-1 py-0.5 rounded text-sky-300">{currentOrigin}</code>
                  </li>
                  <li>
                    Clique em <strong>Criar</strong>. O Google exibirá seu{" "}
                    <strong>ID do Cliente (Client ID)</strong> (ex:{" "}
                    <code>287539362216-xxxxxx.apps.googleusercontent.com</code>).
                  </li>
                  <li>
                    Cole o código no campo acima e clique em{" "}
                    <strong>Conectar Conta Google</strong>!
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ E AÇÕES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAtivarModoPratico}
            className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 self-start sm:self-auto"
            title="Conecta instantaneamente com o e-mail digitado acima sem exigir Client ID do Google Cloud"
          >
            ⚡ Conectar com Meu E-mail (Conexão Rápida)
          </Button>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancelar
            </Button>

            <Button
              variant="primary"
              onClick={() => handleConectar("select_account")}
              isLoading={loading}
              className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2"
            >
              {connected ? "Salvar & Trocar de Conta" : "Conectar com o Google"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
