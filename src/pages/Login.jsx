import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../security/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Waves, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.error || "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Após o login, direciona para a seleção de empresa
      const from = location.state?.from?.pathname || "/selecionar-empresa";
      navigate(from, { replace: true });
    } catch (err) {
      console.error("[Login] Falha na autenticação:", err);
      setError("Credenciais inválidas ou conta não encontrada.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header com Logo Life Oficial */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/assets/logo-white.png"
            alt="LifeSurf Confecções"
            className="h-14 w-auto max-w-[220px] object-contain drop-shadow-md select-none"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling.style.display = "flex";
            }}
          />

          {/* Fallback */}
          <div className="hidden flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-xl shadow-sky-500/20">
              <Waves className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wider text-white">
                LIFE<span className="text-sky-400">SURF</span>
              </h1>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Sistema Integrado de PDV & Confecções
          </p>
        </div>

        {/* Card de Login */}
        <Card className="p-6 sm:p-8 space-y-5 border-slate-800/90 shadow-2xl">
          <div className="space-y-1">
            <CardTitle className="text-xl">Acesso ao Sistema</CardTitle>
            <CardDescription>
              Informe seu e-mail e senha corporativos para iniciar o turno.
            </CardDescription>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail de Acesso"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@lifesurf.com"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Senha"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              variant="primary"
              type="submit"
              className="w-full h-11"
              isLoading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Entrar no Sistema
            </Button>
          </form>

          <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ambiente seguro com criptografia Firebase Auth</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
