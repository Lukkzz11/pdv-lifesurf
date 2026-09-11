import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login({ tema, alternarTema }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const cores = tema === "dark" ? {
    bg: "#121212",
    card: "#1c1c1c",
    input: "#2a2a2a",
    borda: "#333333",
    texto: "#ffffff",
    textoSecundario: "#aaaaaa"
  } : {
    bg: "#f4f5f7",
    card: "#ffffff",
    input: "#ffffff",
    borda: "#dcdfe6",
    texto: "#1a202c",
    textoSecundario: "#4a5568"
  };

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (err) {
      console.error("Erro no login:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setErro("E-mail ou senha incorretos.");
      } else if (err.code === "auth/invalid-email") {
        setErro("Formato de e-mail inválido.");
      } else {
        setErro("Erro ao acessar: " + err.message);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: cores.bg,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "sans-serif",
      color: cores.texto,
      padding: "20px"
    }}>
      <div style={{
        position: "absolute",
        top: "20px",
        right: "20px"
      }}>
        <button
          onClick={alternarTema}
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            border: `1px solid ${cores.borda}`,
            background: cores.card,
            color: cores.texto,
            cursor: "pointer",
            fontSize: "13px"
          }}
        >
          {tema === "dark" ? "☀️ Claro" : "🌙 Escuro"}
        </button>
      </div>

      <div style={{
        background: cores.card,
        padding: "35px 30px",
        borderRadius: "10px",
        border: `1px solid ${cores.borda}`,
        width: "100%",
        maxWidth: "380px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "26px" }}>⚡ LifeSurf</h1>
          <p style={{ margin: 0, color: cores.textoSecundario, fontSize: "14px" }}>
            Acesso ao Sistema de PDV & Caixa
          </p>
        </div>

        {erro && (
          <div style={{
            background: "rgba(229, 62, 62, 0.15)",
            border: "1px solid #e53e3e",
            color: "#e53e3e",
            padding: "10px",
            borderRadius: "6px",
            fontSize: "13px",
            marginBottom: "15px",
            textAlign: "center"
          }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: cores.textoSecundario }}>
              E-mail
            </label>
            <input
              type="email"
              placeholder="seuemail@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                background: cores.input,
                border: `1px solid ${cores.borda}`,
                borderRadius: "6px",
                color: cores.texto,
                boxSizing: "border-box",
                fontSize: "15px",
                outline: "none"
              }}
            />
          </div>

          <div style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", color: cores.textoSecundario }}>
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                background: cores.input,
                border: `1px solid ${cores.borda}`,
                borderRadius: "6px",
                color: cores.texto,
                boxSizing: "border-box",
                fontSize: "15px",
                outline: "none"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            style={{
              width: "100%",
              padding: "14px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: carregando ? "not-allowed" : "pointer"
            }}
          >
            {carregando ? "Autenticando..." : "Entrar no Sistema"}
          </button>
        </form>
      </div>
    </div>
  );
}