import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * SERVIÇO DE CALENDÁRIO OPERACIONAL INTEGRADO (FASE 10)
 * Centraliza prazos de entrega, retiradas de clientes e metas de corte/produção.
 */

export const TIPOS_EVENTO = {
  ENTREGA_PEDIDO: { id: "entrega_pedido", label: "Entrega de Pedido", color: "emerald", badge: "success" },
  RETIRADA_BALCAO: { id: "retirada_balcao", label: "Retirada no Balcão", color: "sky", badge: "info" },
  PRODUCAO_OP: { id: "producao_op", label: "Término de Lote (OP)", color: "purple", badge: "info" },
  CHEGADA_TECIDO: { id: "chegada_tecido", label: "Chegada de Matéria-Prima", color: "amber", badge: "warning" },
  LEMBRETE: { id: "lembrete", label: "Lembrete / Reunião", color: "slate", badge: "neutral" }
};

export const DEMO_CALENDAR_EVENTS = [
  {
    id: "evt-1",
    titulo: "Entrega Encomenda #PED-2610-8492",
    tipo: "entrega_pedido",
    data: new Date().toISOString().split("T")[0],
    horario: "15:00",
    responsavel: "Motoboy Carlos",
    cliente: "João Pedro (WhatsApp)",
    descricao: "Entregar 3x Camisetas Silk Waves M no Centro."
  },
  {
    id: "evt-2",
    titulo: "Retirada Balcão: Bermuda Boardshort 42",
    tipo: "retirada_balcao",
    data: new Date().toISOString().split("T")[0],
    horario: "17:30",
    responsavel: "Operador Balcão",
    cliente: "Mariana Souza",
    descricao: "Cliente vem retirar e pagar no débito."
  },
  {
    id: "evt-3",
    titulo: "Conclusão OP-2026-084 (180 Camisetas)",
    tipo: "producao_op",
    data: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    horario: "18:00",
    responsavel: "Mestre Raimundo",
    descricao: "Finalizar costura e enviar para a estamparia."
  },
  {
    id: "evt-4",
    titulo: "Chegada Rolos de Malha Algodão 30.1",
    tipo: "chegada_tecido",
    data: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
    horario: "10:00",
    responsavel: "Estoque Fábrica",
    descricao: "Receber 150kg de malha do fornecedor Têxtil Ceará."
  }
];

export async function fetchCalendarEvents(tenantId) {
  if (!tenantId) return DEMO_CALENDAR_EVENTS;

  try {
    const colRef = collection(db, "empresas", tenantId, "compromissos");
    const q = query(colRef, limit(80));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const dbEvents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      return [...DEMO_CALENDAR_EVENTS, ...dbEvents];
    }
  } catch (err) {
    console.warn("[calendarService] Erro ao carregar eventos:", err);
  }

  return DEMO_CALENDAR_EVENTS;
}

import {
  syncEventToGoogleCalendar,
  generateGoogleCalendarUrl,
  isGoogleConnected
} from "./googleApiService";

export { generateGoogleCalendarUrl, isGoogleConnected };

export async function createCalendarEvent(tenantId, eventData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");

  let googleEventId = null;
  let googleHtmlLink = null;

  // Se a sincronização com Google Calendar estiver habilitada e autenticada
  if (eventData.syncGoogle !== false && isGoogleConnected()) {
    try {
      const res = await syncEventToGoogleCalendar(eventData);
      googleEventId = res.eventId;
      googleHtmlLink = res.htmlLink;
    } catch (err) {
      console.warn("[calendarService] Falha ao sincronizar com Google Calendar:", err.message);
    }
  }

  const payload = {
    titulo: eventData.titulo,
    tipo: eventData.tipo || "lembrete",
    data: eventData.data || new Date().toISOString().split("T")[0],
    horario: eventData.horario || "09:00",
    responsavel: eventData.responsavel || "Equipe LifeSurf",
    cliente: eventData.cliente || "",
    descricao: eventData.descricao || "",
    googleEventId,
    googleHtmlLink,
    criadoEm: serverTimestamp()
  };

  const colRef = collection(db, "empresas", tenantId, "compromissos");
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
}

export async function syncSingleEventToGoogle(event) {
  return await syncEventToGoogleCalendar(event);
}

