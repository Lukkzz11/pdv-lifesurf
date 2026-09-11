import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Configuracoes({ usuarioLogado, cores }) {
  const lojaId = usuarioLogado?.uid || "loja_padrao";

  const [nomeLoja, setNomeLoja] = useState("LIFESURF");
  const [logoUrl, setLogoUrl] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagemRodape, setMensagemRodape] = useState("OBRIGADO PELA PREFERENCIA! VOLTE SEMPRE!");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregarConfig() {
      try {
        const docRef = doc(db, "configuracoes", lojaId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setNomeLoja(data.nomeLoja || "LIFESURF");
          setLogoUrl(data.logoUrl || "");
          setEndereco(data.endereco || "");
          setTelefone(data.telefone || "");
          setMensagemRodape(data.mensagemRodape || "OBRIGADO PELA PREFERENCIA! VOLTE SEMPRE!");
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      }
    }
    carregarConfig();
  }, [lojaId]);

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await setDoc(doc(db, "configuracoes", lojaId), {
        nomeLoja,
        logoUrl,
        endereco,
        telefone,
        mensagemRodape,
        atualizadoEm: new Date()
      }, { merge: true });
      alert("Configurações salvas com sucesso!");
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: cores.bgCard, padding: "25px", borderRadius: "12px", border: `1px solid ${cores.borda}` }}>
      <h2 style={{ color: cores.texto, marginTop: 0 }}>⚙️ Configurações da Loja & Cupom</h2>
      <p style={{ color: cores.textoSecundario, fontSize: "13px", marginBottom: "20px" }}>
        Personalize o nome, a logo e as informações que saem no cupom não fiscal impresso para os seus clientes.
      </p>
      {/* O formulário continua igual abaixo... */}

      <form onSubmit={handleSalvar}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Nome da Loja / Cabeçalho:</label>
          <input 
            type="text" 
            value={nomeLoja} 
            onChange={(e) => setNomeLoja(e.target.value)}
            style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>URL da Logo (Link da imagem):</label>
          <input 
            type="text" 
            placeholder="Ex: https://i.imgur.com/sua-logo.png" 
            value={logoUrl} 
            onChange={(e) => setLogoUrl(e.target.value)}
            style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
          />
          <small style={{ color: cores.textoSuave, fontSize: "11px" }}>Dica: Cole um link direto de imagem (PNG/JPG) hospedada na web para aparecer no topo do cupom.</small>
        </div>

        {logoUrl && (
          <div style={{ marginBottom: "15px", textAlign: "center", background: cores.bgCardSecundario, padding: "10px", borderRadius: "6px", border: `1px solid ${cores.borda}` }}>
            <span style={{ display: "block", fontSize: "11px", color: cores.textoSecundario, marginBottom: "5px" }}>Pré-visualização da Logo:</span>
            <img src={logoUrl} alt="Logo Preview" style={{ maxHeight: "50px", maxWidth: "150px", objectFit: "contain" }} onError={(e) => e.target.style.display = 'none'} />
          </div>
        )}

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Endereço / Cidade:</label>
          <input 
            type="text" 
            placeholder="Ex: Rua Principal, 123 - Caruaru/PE" 
            value={endereco} 
            onChange={(e) => setEndereco(e.target.value)}
            style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Telefone / Contato:</label>
          <input 
            type="text" 
            placeholder="Ex: (81) 99999-9999" 
            value={telefone} 
            onChange={(e) => setTelefone(e.target.value)}
            style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", color: cores.textoSecundario, marginBottom: "5px" }}>Mensagem de Rodapé do Cupom:</label>
          <input 
            type="text" 
            value={mensagemRodape} 
            onChange={(e) => setMensagemRodape(e.target.value)}
            style={{ width: "100%", padding: "10px", background: cores.inputBg, border: `1px solid ${cores.bordaClara}`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <button 
          type="submit" 
          disabled={salvando}
          style={{ width: "100%", padding: "12px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "15px" }}
        >
          {salvando ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>
    </div>
  );
}