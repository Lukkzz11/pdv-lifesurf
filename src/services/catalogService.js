import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * SERVIÇO PÚBLICO & ADMINISTRATIVO DE CATÁLOGO & VITRINE DIGITAL
 * Permite que clientes façam pedidos online sem login e que os donos da loja
 * editem nomes, descrições, preços, fotos e retirem/adicionem mercadorias da vitrine.
 */

import { DEFAULT_COMPANY } from "./tenantService";
import { getProductImageUrl } from "./imageUploadService";

// Produtos padrão da vitrine (Coleção Oficial LifeSurf)
export const DEMO_CATALOG_PRODUCTS = [
  {
    id: "demo-1",
    nome: "Camiseta Silk Waves Classic Algodão 30.1",
    categoria: "Camiseta",
    referencia: "CAM-001",
    precoVarejo: 89.90,
    precoAtacado: 48.00,
    descricao: "Camiseta 100% algodão penteado fio 30.1 com estampa silk toque zero inspirada nas ondas do Ceará. Conforto térmico absoluto e caimento regular.",
    cores: ["Preto", "Branco", "Azul Marinho"],
    gradeTamanhos: { P: 12, M: 25, G: 18, GG: 10 },
    fotoUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=700&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-2",
    nome: "Boardshort Água 4-Way Stretch Performance",
    categoria: "Bermuda",
    referencia: "BER-002",
    precoVarejo: 149.90,
    precoAtacado: 79.90,
    descricao: "Bermuda de surf com secagem ultra-rápida, bolso lateral com zíper selado à prova d'água e elastano multidirecional de alta flexibilidade.",
    cores: ["Preto/Turquesa", "Floral Degradê"],
    gradeTamanhos: { "38": 8, "40": 15, "42": 20, "44": 12 },
    fotoUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=700&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-3",
    nome: "Camisa Polo Piquet Premium LifeSurf",
    categoria: "Camisa Gola Polo",
    referencia: "POL-003",
    precoVarejo: 119.90,
    precoAtacado: 65.00,
    descricao: "Polo casual em malha piquet encorpada com bordado de alta definição no peito e botões personalizados em madrepérola.",
    cores: ["Off-White", "Marinho", "Bordô"],
    gradeTamanhos: { P: 6, M: 14, G: 16, GG: 8 },
    fotoUrl: "https://images.unsplash.com/photo-1625910513413-7e54c5991448?w=700&auto=format&fit=crop&q=80",
    destaque: false,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-4",
    nome: "Short Praia Tactel Floral Retrô Summer",
    categoria: "Short",
    referencia: "SHO-004",
    precoVarejo: 79.90,
    precoAtacado: 42.00,
    descricao: "Short leve com cós elástico anatômico, cordão reforçado e bolsos telados para drenagem instantânea de água e areia.",
    cores: ["Floral Amarelo", "Floral Azul"],
    gradeTamanhos: { P: 10, M: 18, G: 12, GG: 6 },
    fotoUrl: "https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=700&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-5",
    nome: "Boné Trucker Aba Curva LifeSurf Snapback",
    categoria: "Acessórios",
    referencia: "ACC-005",
    precoVarejo: 69.90,
    precoAtacado: 35.00,
    descricao: "Boné trucker com tela respirável traseira, fivela de regulagem snapback e bordado frontal em alto-relevo 3D.",
    cores: ["Preto/Branco", "Areia/Marrom", "Verde Militar"],
    gradeTamanhos: { Único: 30 },
    fotoUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=700&auto=format&fit=crop&q=80",
    destaque: false,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-6",
    nome: "Regata Machão DryFit Treino & Praia",
    categoria: "Camiseta",
    referencia: "REG-006",
    precoVarejo: 64.90,
    precoAtacado: 32.00,
    descricao: "Regata com cava profunda em malha dry-fit com microperfurações térmicas e tecnologia anti-odor.",
    cores: ["Preto", "Cinza Chumbo", "Branco"],
    gradeTamanhos: { P: 8, M: 15, G: 14, GG: 8 },
    fotoUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=700&auto=format&fit=crop&q=80",
    destaque: false,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-7",
    nome: "Camisa Térmica UV 50+ Manga Longa Surf Pro",
    categoria: "Camisa",
    referencia: "UV-007",
    precoVarejo: 109.90,
    precoAtacado: 58.00,
    descricao: "Camisa de compressão com fator de proteção solar UV50+ permanente contra raios UVA/UVB para esportes náuticos.",
    cores: ["Azul Royal", "Preto Grafite"],
    gradeTamanhos: { P: 10, M: 16, G: 14, GG: 8 },
    fotoUrl: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true,
    ativoNoCatalogo: true
  },
  {
    id: "demo-8",
    nome: "Jaqueta Corta-Vento Windbreaker Repelente à Água",
    categoria: "Casaco",
    referencia: "CAS-008",
    precoVarejo: 189.90,
    precoAtacado: 105.00,
    descricao: "Jaqueta corta-vento ultra-compacta com capuz anatômico, zíper tratorado e tecido ripstop impermeável.",
    cores: ["Preto", "Azul Marinho/Cinza"],
    gradeTamanhos: { P: 6, M: 12, G: 10, GG: 6 },
    fotoUrl: "https://images.unsplash.com/photo-1544441893-675973e31985?w=700&auto=format&fit=crop&q=80",
    destaque: true,
    ativo: true,
    ativoNoCatalogo: true
  }
];

/**
 * Retorna produtos da vitrine armazenados localmente (cache resiliente)
 */
export function getLocalCatalogProducts(companyId) {
  const tenant = companyId || "lifesurf";
  try {
    const raw = localStorage.getItem(`lifesurf_catalog_products_${tenant}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao ler catálogo local:", err);
  }
  return DEMO_CATALOG_PRODUCTS;
}

/**
 * Salva produtos no cache local para persistência instantânea e contingência
 */
export function saveLocalCatalogProducts(companyId, products) {
  const tenant = companyId || "lifesurf";
  try {
    localStorage.setItem(`lifesurf_catalog_products_${tenant}`, JSON.stringify(products));
    window.dispatchEvent(
      new CustomEvent("lifesurf:catalog_updated", { detail: { companyId: tenant, products } })
    );
  } catch (err) {
    console.warn("[catalogService] Erro ao salvar catálogo local:", err);
  }
}

/**
 * Busca dados da empresa para exibir cabeçalho da vitrine
 */
export async function fetchCompanyPublicInfo(companyId) {
  if (!companyId) return DEFAULT_COMPANY;

  let cached = null;
  try {
    const local = localStorage.getItem(`lifesurf_company_settings_${companyId}`);
    if (local) {
      cached = JSON.parse(local);
    }
  } catch {}

  try {
    const docRef = doc(db, "empresas", companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const firestoreData = { id: snap.id, ...DEFAULT_COMPANY, ...cached, ...snap.data() };
      return firestoreData;
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao buscar dados da empresa no Firestore:", err);
  }

  if (cached) {
    return { ...DEFAULT_COMPANY, ...cached };
  }

  // Fallback com dados oficiais da LifeSurf
  return {
    ...DEFAULT_COMPANY,
    id: companyId,
    nome: companyId === "lifesurf" ? "LifeSurf Surfwear & Confecções" : companyId.replace("-", " ").toUpperCase(),
    cidade: "Fortaleza - CE",
    telefone: "(85) 98888-7777",
    whatsapp: "85988887777",
    chavePix: "12.345.678/0001-90",
    mensagemCatalogo: "Produtos de alta qualidade com fabricação própria, pronta-entrega e envio para todo o Brasil!"
  };
}

/**
 * Salva as configurações públicas do catálogo (Nome da Loja, WhatsApp, Banner, Chave PIX, etc.)
 */
export async function saveCompanyCatalogSettings(companyId, settings) {
  const tenantId = companyId || "lifesurf";

  const payload = {
    ...settings,
    atualizadoEm: serverTimestamp()
  };

  // 1. Salva no Firestore se possível
  try {
    const docRef = doc(db, "empresas", tenantId);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn("[catalogService] Aviso ao salvar configurações do catálogo no Firestore:", err);
  }

  // 2. Salva no cache local
  try {
    const storageKey = `lifesurf_company_settings_${tenantId}`;
    const previous = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const merged = { ...previous, ...settings };
    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {}

  return payload;
}

/**
 * Busca TODOS os produtos para a tela administrativa de gestão da vitrine
 * (Retorna itens visíveis e itens retirados/ocultos)
 */
export async function fetchAdminCatalogProducts(companyId) {
  const tenantId = companyId || "lifesurf";

  try {
    const produtosCol = collection(db, "empresas", tenantId, "produtos");
    const q = query(produtosCol, limit(150));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const foto = getProductImageUrl(data);
        return {
          id: docSnap.id,
          ...data,
          fotoUrl: foto,
          imageUrl: foto,
          imagem: foto,
          ativoNoCatalogo: data.ativoNoCatalogo !== false
        };
      });

      if (items.length > 0) {
        saveLocalCatalogProducts(tenantId, items);
        return items;
      }
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao buscar produtos admin no Firestore:", err);
  }

  // Fallback para lista local normalizada
  const localItems = getLocalCatalogProducts(tenantId);
  return localItems.map((prod) => {
    const foto = getProductImageUrl(prod);
    return {
      ...prod,
      fotoUrl: foto,
      imageUrl: foto,
      imagem: foto
    };
  });
}

/**
 * Busca produtos ativos no catálogo público (Filtra apenas visíveis)
 */
export async function fetchPublicCatalog(companyId) {
  const tenantId = companyId || "lifesurf";

  try {
    const produtosCol = collection(db, "empresas", tenantId, "produtos");
    const q = query(produtosCol, limit(150));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const items = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const foto = getProductImageUrl(data);
          return {
            id: docSnap.id,
            ...data,
            fotoUrl: foto,
            imageUrl: foto,
            imagem: foto,
            ativoNoCatalogo: data.ativoNoCatalogo !== false
          };
        })
        .filter((prod) => prod.ativo !== false && prod.ativoNoCatalogo !== false && prod.ocultoNoCatalogo !== true);

      if (items.length > 0) return items;
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao buscar produtos reais para a vitrine:", err);
  }

  // Fallback: filtra produtos do cache local normalizados
  const localItems = getLocalCatalogProducts(tenantId);
  return localItems
    .map((prod) => {
      const foto = getProductImageUrl(prod);
      return {
        ...prod,
        fotoUrl: foto,
        imageUrl: foto,
        imagem: foto
      };
    })
    .filter(
      (prod) => prod.ativo !== false && prod.ativoNoCatalogo !== false && prod.ocultoNoCatalogo !== true
    );
}

/**
 * Alterna a visibilidade de uma mercadoria no catálogo (Retirar da vitrine ou Reexibir)
 */
export async function toggleProductCatalogVisibility(companyId, productId, isVisible) {
  const tenantId = companyId || "lifesurf";

  // 1. Tenta atualizar no Firestore
  try {
    const docRef = doc(db, "empresas", tenantId, "produtos", productId);
    await updateDoc(docRef, {
      ativoNoCatalogo: isVisible,
      atualizadoEm: serverTimestamp()
    });
  } catch (err) {
    console.warn("[catalogService] Firestore update doc aviso:", err);
  }

  // 2. Atualiza localmente
  const current = getLocalCatalogProducts(tenantId);
  const updated = current.map((p) => {
    if (p.id === productId) {
      return { ...p, ativoNoCatalogo: isVisible };
    }
    return p;
  });
  saveLocalCatalogProducts(tenantId, updated);
  return updated;
}

/**
 * Alterna o selo de Destaque da mercadoria na vitrine
 */
export async function toggleProductCatalogDestaque(companyId, productId, isDestaque) {
  const tenantId = companyId || "lifesurf";

  try {
    const docRef = doc(db, "empresas", tenantId, "produtos", productId);
    await updateDoc(docRef, {
      destaque: isDestaque,
      atualizadoEm: serverTimestamp()
    });
  } catch (err) {
    console.warn("[catalogService] Firestore update destaque aviso:", err);
  }

  const current = getLocalCatalogProducts(tenantId);
  const updated = current.map((p) => {
    if (p.id === productId) {
      return { ...p, destaque: isDestaque };
    }
    return p;
  });
  saveLocalCatalogProducts(tenantId, updated);
  return updated;
}

/**
 * Salva ou atualiza uma mercadoria na vitrine (Nome, preços, foto, descrição, etc.)
 */
export async function saveCatalogProduct(companyId, productData, productId = null) {
  const tenantId = companyId || "lifesurf";
  const fotoNormalizada = getProductImageUrl(productData);

  const payload = {
    ...productData,
    fotoUrl: fotoNormalizada,
    imageUrl: fotoNormalizada,
    imagem: fotoNormalizada,
    ativo: productData.ativo !== false,
    ativoNoCatalogo: productData.ativoNoCatalogo !== false,
    destaque: Boolean(productData.destaque),
    precoVarejo: Number(productData.precoVarejo) || 0,
    precoAtacado: Number(productData.precoAtacado) || 0,
    atualizadoEm: serverTimestamp()
  };

  let savedId = productId;

  try {
    const produtosCol = collection(db, "empresas", tenantId, "produtos");
    if (productId && !productId.startsWith("demo-")) {
      const docRef = doc(produtosCol, productId);
      await updateDoc(docRef, payload);
    } else {
      payload.criadoEm = serverTimestamp();
      const docRef = await addDoc(produtosCol, payload);
      savedId = docRef.id;
    }
  } catch (err) {
    console.warn("[catalogService] Erro ao gravar produto no Firestore, salvando no cache local:", err);
    if (!savedId) {
      savedId = `prod-local-${Date.now()}`;
    }
  }

  // Atualiza cache local garantindo sincronização
  const current = getLocalCatalogProducts(tenantId);
  let updated;
  if (productId) {
    updated = current.map((p) => (p.id === productId ? { ...p, ...payload, id: savedId } : p));
  } else {
    updated = [{ ...payload, id: savedId }, ...current];
  }
  saveLocalCatalogProducts(tenantId, updated);

  return { id: savedId, ...payload };
}

/**
 * Remove ou retira uma mercadoria da vitrine
 * @param {boolean} permanent - Se true, remove definitivamente; se false, apenas oculta da vitrine (ativoNoCatalogo: false)
 */
export async function removeProductFromCatalog(companyId, productId, permanent = false) {
  const tenantId = companyId || "lifesurf";

  if (permanent) {
    try {
      const docRef = doc(db, "empresas", tenantId, "produtos", productId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("[catalogService] Erro ao deletar produto do Firestore:", err);
    }

    const current = getLocalCatalogProducts(tenantId);
    const updated = current.filter((p) => p.id !== productId);
    saveLocalCatalogProducts(tenantId, updated);
    return updated;
  } else {
    return toggleProductCatalogVisibility(tenantId, productId, false);
  }
}

/**
 * Restaura o catálogo padrão de demonstração da LifeSurf
 */
export function resetCatalogToDefault(companyId) {
  const tenantId = companyId || "lifesurf";
  saveLocalCatalogProducts(tenantId, DEMO_CATALOG_PRODUCTS);
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

