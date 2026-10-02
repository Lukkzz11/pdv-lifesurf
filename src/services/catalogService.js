import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * SERVIÇO PÚBLICO DE CATÁLOGO & VITRINE DIGITAL (FASE 6)
 * Acesso leve e seguro para clientes finais sem autenticação.
 */

// Produtos de demonstração caso a empresa ainda não tenha produtos cadastrados no Firestore
export const DEMO_CATALOG_PRODUCTS = [
  {
    id: "demo-1",
    nome: "Camiseta Silk Waves Classic",
    categoria: "Camiseta",
    referencia: "CAM-001",
    precoVarejo: 89.90,
    precoAtacado: 54.90,
    descricao: "Camiseta 100% algodão penteado fio 30.1 com estampa silk toque zero inspirada no surf cearense.",
    cores: ["Preto", "Branco", "Azul Marinho"],
    gradeTamanhos: { P: 12, M: 25, G: 18, GG: 10 },
    fotoUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true
  },
  {
    id: "demo-2",
    nome: "Bermuda Água Boardshort 4-Way Stretch",
    categoria: "Bermuda",
    referencia: "BER-002",
    precoVarejo: 149.90,
    precoAtacado: 89.90,
    descricao: "Bermuda de surf com secagem ultra-rápida, bolso lateral com zíper selado e elasticidade multidirecional.",
    cores: ["Preto/Turquesa", "Floral Degradê"],
    gradeTamanhos: { "38": 8, "40": 15, "42": 20, "44": 12 },
    fotoUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true
  },
  {
    id: "demo-3",
    nome: "Camisa Polo Piquet Premium LifeSurf",
    categoria: "Camisa Gola Polo",
    referencia: "POL-003",
    precoVarejo: 119.90,
    precoAtacado: 72.00,
    descricao: "Polo casual em malha piquet encorpada com bordado de alta definição no peito e botões personalizados.",
    cores: ["Off-White", "Marinho", "Bordô"],
    gradeTamanhos: { P: 6, M: 14, G: 16, GG: 8 },
    fotoUrl: "https://images.unsplash.com/photo-1625910513413-7e54c5991448?w=600&auto=format&fit=crop&q=80",
    destaque: false,
    ativo: true
  },
  {
    id: "demo-4",
    nome: "Short Praia Tactel Floral Retrô",
    categoria: "Short",
    referencia: "SHO-004",
    precoVarejo: 79.90,
    precoAtacado: 48.00,
    descricao: "Short leve com cós elástico, cordão ajustável e bolsos telados para drenagem rápida na praia.",
    cores: ["Floral Amarelo", "Floral Azul"],
    gradeTamanhos: { P: 10, M: 18, G: 12, GG: 6 },
    fotoUrl: "https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=600&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true
  },
  {
    id: "demo-5",
    nome: "Boné Aba Curva Strapback Bordado",
    categoria: "Acessórios",
    referencia: "ACC-005",
    precoVarejo: 69.90,
    precoAtacado: 42.00,
    descricao: "Boné estilo dad hat com fivela metálica de ajuste traseiro e bordado frontal de alta precisão.",
    cores: ["Preto", "Areia", "Verde Militar"],
    gradeTamanhos: { Único: 30 },
    fotoUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&auto=format&fit=crop&q=80",
    destaque: false,
    ativo: true
  },
  {
    id: "demo-6",
    nome: "Regata Machão DryFit Performance",
    categoria: "Camiseta",
    referencia: "REG-006",
    precoVarejo: 64.90,
    precoAtacado: 38.00,
    descricao: "Regata com cava profunda em tecido dryfit com proteção solar UV50+ ideal para treinos e praia.",
    cores: ["Preto", "Cinza Mescla"],
    gradeTamanhos: { P: 8, M: 15, G: 14, GG: 8 },
    fotoUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&auto=format&fit=crop&q=80",
    destaque: false,
    ativo: true
  }
];

/**
 * Busca dados da empresa para exibir cabeçalho da vitrine
 */
export async function fetchCompanyPublicInfo(companyId) {
  if (!companyId) return null;

  try {
    const docRef = doc(db, "empresas", companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao buscar dados da empresa:", err);
  }

  // Fallback com dados padrão da LifeSurf
  return {
    id: companyId,
    nome: companyId === "lifesurf" ? "LifeSurf Surfwear & Confecções" : companyId.replace("-", " ").toUpperCase(),
    cidade: "Fortaleza - CE",
    telefone: "(85) 98888-7777",
    whatsapp: "85988887777",
    mensagemCatalogo: "Produtos de alta qualidade com fabricação própria e envio rápido!"
  };
}

/**
 * Busca produtos ativos no catálogo público
 */
export async function fetchPublicCatalog(companyId) {
  if (!companyId) return DEMO_CATALOG_PRODUCTS;

  try {
    const produtosCol = collection(db, "empresas", companyId, "produtos");
    const q = query(produtosCol, limit(100));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((prod) => prod.ativo !== false);

      if (items.length > 0) return items;
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao buscar produtos reais, utilizando catálogo base:", err);
  }

  return DEMO_CATALOG_PRODUCTS;
}

/**
 * Envia o pedido público do checkout sem fricção
 */
export async function submitPublicOrder(companyId, orderData) {
  if (!companyId) throw new Error("ID da empresa é obrigatório");

  const ordersCol = collection(db, "empresas", companyId, "pedidos");
  const agora = new Date();
  const codigoPedido = `PED-${agora.getFullYear().toString().slice(-2)}${(agora.getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const payload = {
    numeroPedido: codigoPedido,
    cliente: {
      nome: orderData.nome || "Cliente Catálogo",
      telefone: orderData.whatsapp || "",
      endereco: orderData.endereco || "Retirar no Balcão"
    },
    itens: orderData.itens || [],
    subtotal: Number(orderData.subtotal) || 0,
    desconto: Number(orderData.desconto) || 0,
    total: Number(orderData.total) || 0,
    formaPagamento: orderData.formaPagamento || "pix",
    tipoPagamento: orderData.formaPagamento || "pix",
    origem: "catalogo",
    status: "novo",
    observacoes: orderData.observacoes || "",

    notificacoes: {
      whatsappPendente: Boolean(orderData.whatsapp),
      origemCatalogo: true,
      alertaPainelPendente: true
    },

    empresaId: companyId,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  const docRef = await addDoc(ordersCol, payload);
  return { id: docRef.id, ...payload };
}
