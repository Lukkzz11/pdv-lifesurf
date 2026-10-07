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
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { arenaDb } from "../config/arenaFirebase";

export const ARENA_COURTS = [
  { id: "quadra-1", nome: "Quadra 01 - Principal Coberta", tipo: "Beach Tennis / Futevôlei", valorHora: 100 },
  { id: "quadra-2", nome: "Quadra 02 - Areia Praia", tipo: "Beach Tennis / Vôlei", valorHora: 80 },
  { id: "quadra-3", nome: "Quadra 03 - Areia Sol", tipo: "Beach Tennis / Treino", valorHora: 80 }
];

export const ARENA_HORARIOS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00"
];

export const MODALIDADES_ARENA = [
  "Beach Tennis",
  "Futevôlei",
  "Vôlei de Praia",
  "Funcional de Areia",
  "Aluguel / Day Use"
];

const ARENA_COLLECTION = "arena_agendamentos";

/**
 * Busca agendamentos de uma data específica (YYYY-MM-DD)
 */
export async function fetchArenaBookings(dataStr) {
  try {
    const colRef = collection(arenaDb, ARENA_COLLECTION);
    const q = query(colRef, where("data", "==", dataStr));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (err) {
    console.error("[arenaService] Erro ao buscar agendamentos da Arena:", err);
    // Fallback offline / local storage para garantir continuidade
    const local = localStorage.getItem(`arena_bookings_${dataStr}`);
    return local ? JSON.parse(local) : [];
  }
}

/**
 * Cria um novo agendamento ou locação de horário
 */
export async function createArenaBooking(bookingData) {
  try {
    const payload = {
      quadraId: bookingData.quadraId || "quadra-1",
      quadraNome: bookingData.quadraNome || "Quadra 01",
      horario: bookingData.horario, // ex: "18:00"
      data: bookingData.data, // YYYY-MM-DD
      clienteNome: bookingData.clienteNome || "Cliente Avulso",
      clienteTelefone: bookingData.clienteTelefone || "",
      modalidade: bookingData.modalidade || "Beach Tennis",
      valor: Number(bookingData.valor) || 90,
      formaPagamento: bookingData.formaPagamento || "pix",
      statusPagamento: bookingData.statusPagamento || "pendente", // "pendente", "pago"
      observacoes: bookingData.observacoes || "",
      criadoEm: serverTimestamp()
    };

    const colRef = collection(arenaDb, ARENA_COLLECTION);
    const docRef = await addDoc(colRef, payload);

    return { id: docRef.id, ...payload };
  } catch (err) {
    console.error("[arenaService] Erro ao criar agendamento:", err);
    // Fallback local
    const dataStr = bookingData.data;
    const existing = JSON.parse(localStorage.getItem(`arena_bookings_${dataStr}`) || "[]");
    const novo = {
      id: "local-" + Date.now(),
      ...bookingData,
      criadoEm: new Date().toISOString()
    };
    existing.push(novo);
    localStorage.setItem(`arena_bookings_${dataStr}`, JSON.stringify(existing));
    return novo;
  }
}

/**
 * Atualiza status, dados ou pagamento de um agendamento
 */
export async function updateArenaBooking(bookingId, updates) {
  try {
    if (bookingId.startsWith("local-")) {
      return;
    }
    const docRef = doc(arenaDb, ARENA_COLLECTION, bookingId);
    await updateDoc(docRef, {
      ...updates,
      atualizadoEm: serverTimestamp()
    });
  } catch (err) {
    console.error("[arenaService] Erro ao atualizar agendamento:", err);
  }
}

/**
 * Exclui / cancela um agendamento
 */
export async function deleteArenaBooking(bookingId) {
  try {
    if (bookingId.startsWith("local-")) {
      return;
    }
    const docRef = doc(arenaDb, ARENA_COLLECTION, bookingId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("[arenaService] Erro ao excluir agendamento:", err);
  }
}

/**
 * Calcula resumo financeiro e ocupação da Arena no dia
 */
export function calculateArenaDailyMetrics(bookings = []) {
  const totalSlotsPossiveis = ARENA_COURTS.length * ARENA_HORARIOS.length;
  const agendados = bookings.length;
  const taxaOcupacao = totalSlotsPossiveis > 0 ? Math.round((agendados / totalSlotsPossiveis) * 100) : 0;

  const totalFaturado = bookings.reduce((acc, b) => acc + (Number(b.valor) || 0), 0);
  const totalPago = bookings
    .filter((b) => b.statusPagamento === "pago")
    .reduce((acc, b) => acc + (Number(b.valor) || 0), 0);
  const totalPendente = totalFaturado - totalPago;

  return {
    totalSlotsPossiveis,
    agendados,
    taxaOcupacao,
    totalFaturado,
    totalPago,
    totalPendente
  };
}
