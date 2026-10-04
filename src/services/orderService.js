import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * SERVIÇO DE GESTÃO DE PEDIDOS & PIPELINE KANBAN (FIREBASE FIRESTORE)
 * Otimizado para o plano Blaze com leituras controladas e listeners em tempo real.
 */

export const ORDER_STATUS = {
  NOVO: "novo",
  EM_SEPARACAO: "em_separacao",
  SEPARADO: "separado",
  PRONTO_RETIRADA: "pronto_retirada",
  ENTREGUE: "entregue",
  CANCELADO: "cancelado"
};

// Configuração completa de cada coluna do Kanban (ordem, labels, temas)
export const KANBAN_COLUMNS = [
  {
    id: ORDER_STATUS.NOVO,
    label: "Novo",
    shortLabel: "Novo",
    color: "sky",
    badgeVariant: "info",
    headerBg: "bg-sky-500/10 border-sky-500/30 text-sky-400",
    dotColor: "bg-sky-400",
    description: "Novos pedidos aguardando início da separação"
  },
  {
    id: ORDER_STATUS.EM_SEPARACAO,
    label: "Em Separação",
    shortLabel: "Separação",
    color: "amber",
    badgeVariant: "warning",
    headerBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    dotColor: "bg-amber-400",
    description: "Itens sendo coletados no estoque da loja ou fábrica"
  },
  {
    id: ORDER_STATUS.SEPARADO,
    label: "Separado",
    shortLabel: "Separado",
    color: "purple",
    badgeVariant: "info",
    headerBg: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    dotColor: "bg-purple-400",
    description: "Itens conferidos na expedição. Gera lista de separação em PDF"
  },
  {
    id: ORDER_STATUS.PRONTO_RETIRADA,
    label: "Pronto para Retirada",
    shortLabel: "Pronto",
    color: "emerald",
    badgeVariant: "success",
    headerBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    dotColor: "bg-emerald-400",
    description: "Embalado e pronto para entrega ou retirada no balcão"
  },
  {
    id: ORDER_STATUS.ENTREGUE,
    label: "Entregue/Retirado",
    shortLabel: "Entregue",
    color: "slate",
    badgeVariant: "neutral",
    headerBg: "bg-slate-800/80 border-slate-700/80 text-slate-300",
    dotColor: "bg-slate-400",
    description: "Pedido concluído e entregue com sucesso"
  },
  {
    id: ORDER_STATUS.CANCELADO,
    label: "Cancelado",
    shortLabel: "Cancelado",
    color: "rose",
    badgeVariant: "danger",
    headerBg: "bg-rose-500/10 border-rose-500/30 text-rose-400",
    dotColor: "bg-rose-400",
    description: "Pedidos descartados ou cancelados"
  }
];

/**
 * Normaliza status legados salvos no banco para as novas colunas
 */
export function normalizeOrderStatus(rawStatus) {
  if (!rawStatus) return ORDER_STATUS.NOVO;
  const statusStr = String(rawStatus).toLowerCase();

  if (statusStr === "pendente" || statusStr === "aprovado" || statusStr === "novo") {
    return ORDER_STATUS.NOVO;
  }
  if (statusStr === "em_producao" || statusStr === "em_separacao") {
    return ORDER_STATUS.EM_SEPARACAO;
  }
  if (statusStr === "separado") {
    return ORDER_STATUS.SEPARADO;
  }
  if (statusStr === "pronto" || statusStr === "pronto_retirada") {
    return ORDER_STATUS.PRONTO_RETIRADA;
  }
  if (statusStr === "entregue") {
    return ORDER_STATUS.ENTREGUE;
  }
  if (statusStr === "cancelado") {
    return ORDER_STATUS.CANCELADO;
  }

  return ORDER_STATUS.NOVO;
}

/**
 * Grava um novo pedido na subcoleção da empresa
 */
export async function createOrder(tenantId, orderData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  const ordersCol = collection(db, "empresas", tenantId, "pedidos");
  const agora = new Date();
  const codigoPedido = `PED-${agora.getFullYear().toString().slice(-2)}${(agora.getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const payload = {
    numeroPedido: codigoPedido,
    cliente: orderData.cliente || { nome: "Consumidor Final" },
    itens: orderData.itens || [],
    subtotal: Number(orderData.subtotal) || Number(orderData.total) || 0,
    desconto: Number(orderData.desconto) || 0,
    total: Number(orderData.total) || 0,
    formaPagamento: orderData.formaPagamento || "dinheiro",
    origem: orderData.origem || "whatsapp", // "whatsapp", "balcao", "catalogo", "encomenda"
    status: orderData.status || ORDER_STATUS.NOVO,
    observacoes: orderData.observacoes || "",

    // Notificações / Gatilhos Blaze
    notificacoes: {
      whatsappPendente: Boolean(orderData.cliente?.telefone),
      emailPendente: Boolean(orderData.cliente?.email),
      alertaPainelPendente: true
    },

    empresaId: tenantId,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  const docRef = await addDoc(ordersCol, payload);
  return { id: docRef.id, ...payload };
}

/**
 * Busca pedidos recentes uma única vez (sem live listener)
 */
export async function fetchRecentOrders(tenantId, maxResults = 50) {
  if (!tenantId) return [];

  const ordersCol = collection(db, "empresas", tenantId, "pedidos");
  const q = query(ordersCol, orderBy("criadoEm", "desc"), limit(maxResults));

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      status: normalizeOrderStatus(docSnap.data().status)
    }));
  } catch (err) {
    const fallbackQ = query(ordersCol, limit(maxResults));
    const fallbackSnap = await getDocs(fallbackQ);
    return fallbackSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      status: normalizeOrderStatus(docSnap.data().status)
    }));
  }
}

/**
 * Inscreve um listener em tempo real no Firestore para atualizar o Kanban imediatamente
 * Retorna a função de unsubscribe
 */
export function subscribeToOrders(tenantId, onUpdate, onError, maxResults = 60) {
  if (!tenantId) return () => {};

  const ordersCol = collection(db, "empresas", tenantId, "pedidos");
  const q = query(ordersCol, orderBy("criadoEm", "desc"), limit(maxResults));

  try {
    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          status: normalizeOrderStatus(docSnap.data().status)
        }));
        onUpdate(orders);
      },
      (error) => {
        console.warn("[orderService] Erro com query ordenada, usando fallback simples:", error);
        // Fallback sem orderBy em caso de índice composto não propagado
        const fallbackQ = query(ordersCol, limit(maxResults));
        return onSnapshot(
          fallbackQ,
          (fallbackSnap) => {
            const orders = fallbackSnap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
              status: normalizeOrderStatus(docSnap.data().status)
            }));
            onUpdate(orders);
          },
          onError
        );
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Atualiza o status do pedido em tempo real no Firestore
 */
export async function updateOrderStatus(tenantId, orderId, novoStatus) {
  if (!tenantId || !orderId) return;
  const docRef = doc(db, "empresas", tenantId, "pedidos", orderId);
  await updateDoc(docRef, {
    status: novoStatus,
    atualizadoEm: serverTimestamp()
  });
}
