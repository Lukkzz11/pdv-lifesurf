/**
 * SERVIÇO DE CRM & GESTÃO DE CLIENTES (VAREJO & ATACADO)
 * Suporte a diferenciação de CPF vs CNPJ, limites de crediário/fiado,
 * tabelas de preço de atacado e histórico consolidado.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

export const CUSTOMER_TYPES = {
  VAREJO: "varejo",
  ATACADO: "atacado"
};

export const DEMO_CUSTOMERS = [
  {
    id: "cli-1",
    nome: "Surf House Boardshop Ltda",
    razaoSocial: "Surf House Comércio de Artigos Esportivos Ltda",
    tipo: "atacado",
    documento: "34.567.890/0001-12",
    inscricaoEstadual: "06.987.654-3",
    telefone: "(85) 99123-4567",
    email: "compras@surfhouse.com.br",
    cidade: "Fortaleza",
    estado: "CE",
    endereco: "Av. Monsenhor Tabosa, 850 - Praia de Iracema",
    limiteCredito: 5000.0,
    saldoDevedor: 1250.0,
    descontoAtacadoPadrao: 20,
    totalGasto: 18450.0,
    qtdCompras: 14,
    ultimaCompra: "2026-09-28",
    observacoes: "Lojista parceiro desde 2024. Paga pontualmente via PIX."
  },
  {
    id: "cli-2",
    nome: "Carlos Eduardo P. Silva",
    tipo: "varejo",
    documento: "847.291.034-55",
    telefone: "(85) 98844-1122",
    email: "carlos.surf@gmail.com",
    cidade: "Fortaleza",
    estado: "CE",
    endereco: "Rua Silva Jatahy, 320, Apto 402 - Meireles",
    limiteCredito: 800.0,
    saldoDevedor: 189.9,
    descontoAtacadoPadrao: 0,
    totalGasto: 1240.0,
    qtdCompras: 5,
    ultimaCompra: "2026-09-30",
    observacoes: "Cliente assíduo de bermudas boardshort e regatas."
  },
  {
    id: "cli-3",
    nome: "Maresia Distribuidora Ceará",
    razaoSocial: "Maresia Distribuição e Representações Eireli",
    tipo: "atacado",
    documento: "19.876.543/0001-99",
    inscricaoEstadual: "06.554.332-1",
    telefone: "(85) 99877-3344",
    email: "pedidos@maresiadistrib.com.br",
    cidade: "Caucaia",
    estado: "CE",
    endereco: "Rodovia Estruturante, Km 14 - Galpão 03",
    limiteCredito: 10000.0,
    saldoDevedor: 3400.0,
    descontoAtacadoPadrao: 25,
    totalGasto: 46200.0,
    qtdCompras: 28,
    ultimaCompra: "2026-10-01",
    observacoes: "Revendedor atacadista regional. Grade mínima de 30 peças."
  },
  {
    id: "cli-4",
    nome: "Mariana Albuquerque",
    tipo: "varejo",
    documento: "623.119.843-02",
    telefone: "(85) 98765-4321",
    email: "mari.albuquerque@outlook.com",
    cidade: "Fortaleza",
    estado: "CE",
    endereco: "Rua Frederico Borges, 110 - Varjota",
    limiteCredito: 500.0,
    saldoDevedor: 0.0,
    descontoAtacadoPadrao: 0,
    totalGasto: 780.0,
    qtdCompras: 3,
    ultimaCompra: "2026-09-15",
    observacoes: "Prefere comprar vestidos e croppeds da linha feminina."
  }
];

/**
 * Busca clientes da empresa com suporte a filtros locais/remotos
 */
export async function fetchCustomers(tenantId) {
  if (!tenantId) return DEMO_CUSTOMERS;

  try {
    const colRef = collection(db, "empresas", tenantId, "clientes");
    const q = query(colRef, limit(100));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const dbCustomers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Junta clientes reais do Firestore com a base inicial caso ainda haja poucos
      const idsReais = new Set(dbCustomers.map((c) => c.documento || c.id));
      const demoFiltrado = DEMO_CUSTOMERS.filter((d) => !idsReais.has(d.documento));
      return [...dbCustomers, ...demoFiltrado];
    }
  } catch (err) {
    console.warn("[customerService] Usando demo customers por indisponibilidade:", err.message);
  }

  return DEMO_CUSTOMERS;
}

/**
 * Cadastra um novo cliente na empresa
 */
export async function createCustomer(tenantId, customerData) {
  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!customerData.nome?.trim()) throw new Error("Nome do cliente é obrigatório");

  const payload = {
    nome: customerData.nome.trim(),
    razaoSocial: customerData.razaoSocial?.trim() || "",
    tipo: customerData.tipo || CUSTOMER_TYPES.VAREJO,
    documento: customerData.documento?.trim() || "",
    inscricaoEstadual: customerData.inscricaoEstadual?.trim() || "",
    telefone: customerData.telefone?.trim() || "",
    email: customerData.email?.trim() || "",
    cidade: customerData.cidade?.trim() || "Fortaleza",
    estado: customerData.estado?.trim() || "CE",
    endereco: customerData.endereco?.trim() || "",
    limiteCredito: Number(customerData.limiteCredito) || 0,
    saldoDevedor: Number(customerData.saldoDevedor) || 0,
    descontoAtacadoPadrao: Number(customerData.descontoAtacadoPadrao) || 0,
    totalGasto: 0,
    qtdCompras: 0,
    ultimaCompra: null,
    observacoes: customerData.observacoes?.trim() || "",
    empresaId: tenantId,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  const colRef = collection(db, "empresas", tenantId, "clientes");
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
}

/**
 * Atualiza os dados de um cliente
 */
export async function updateCustomer(tenantId, customerId, customerData) {
  if (!tenantId || !customerId) throw new Error("IDs inválidos");

  const docRef = doc(db, "empresas", tenantId, "clientes", customerId);
  const payload = {
    ...customerData,
    atualizadoEm: serverTimestamp()
  };

  await updateDoc(docRef, payload);
  return { id: customerId, ...payload };
}

/**
 * Atualiza o saldo devedor do cliente após compras a prazo ou pagamentos
 */
export async function adjustCustomerDebt(tenantId, customerId, deltaAmount) {
  if (!tenantId || !customerId) return;

  try {
    const docRef = doc(db, "empresas", tenantId, "clientes", customerId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const atual = Number(snap.data().saldoDevedor) || 0;
      const novo = Math.max(0, atual + deltaAmount);
      await updateDoc(docRef, { saldoDevedor: novo, atualizadoEm: serverTimestamp() });
    }
  } catch (err) {
    console.warn("[customerService] Falha ao ajustar saldo devedor:", err.message);
  }
}

/**
 * Exclui um cliente
 */
export async function deleteCustomer(tenantId, customerId) {
  if (!tenantId || !customerId) return false;
  try {
    const docRef = doc(db, "empresas", tenantId, "clientes", customerId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("[customerService] Erro ao excluir cliente:", err.message);
    return true;
  }
}
