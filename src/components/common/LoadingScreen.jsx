/**
 * Componente neutro de carregamento para verificação de autenticação e transições de rota
 */
export default function LoadingScreen({ message = "Carregando ambiente seguro..." }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "4px solid rgba(255, 255, 255, 0.1)",
          borderTopColor: "#38bdf8",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}
      />
      <p style={{ marginTop: "16px", fontSize: "14px", color: "#94a3b8" }}>
        {message}
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
