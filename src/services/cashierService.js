import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";
import { generateCashierClosingPDF } from "./pdfService";

/**
 * SERVIÇO DE FECHAMENTO E GESTÃO DE CAIXA DIÁRIO
 */

/**
 * Busca o resumo diário do caixa atual (1 única leitura de documento desnormalizado no Blaze)
 */
export async function getTodayCashierSummary(tenantId) {
  if (!tenantId) return null;

  const todayStr = new Date().toISOString().split("T")[0];
  const summaryRef = doc(db, "empresas", tenantId, "resumo_diario", todayStr);

  try {
    const docSnap = await getDoc(summaryRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      data: todayStr,
      totalGeral: 0,
      qtdVendas: 0,
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      prazo: 0,
      trocoInicial: 100
    };
  } catch (err) {
    console.error("[cashierService] Erro ao buscar resumo diário:", err);
    return {
      data: todayStr,
      totalGeral: 0,
      qtdVendas: 0,
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      prazo: 0,
      trocoInicial: 100
    };
  }
}

/**
 * Busca as últimas vendas do dia para detalhamento no relatório
 */
export async function getTodaySales(tenantId, maxResults = 30) {
  if (!tenantId) return [];

  const vendasCol = collection(db, "empresas", tenantId, "vendas");
  const q = query(vendasCol, orderBy("criadoEm", "desc"), limit(maxResults));

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (err) {
    // Fallback sem orderBy caso o índice ainda não exista
    const fallbackQ = query(vendasCol, limit(maxResults));
    const fallbackSnap = await getDocs(fallbackQ);
    return fallbackSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  }
}

/**
 * Executa a rotina de Fechamento de Caixa, calcula divergências e emite o PDF
 *
 * @param {string} tenantId - ID da empresa
 * @param {object} closeData - Informações informadas pelo operador
 * @param {object} storeInfo - Dados cadastrais da loja
 */
export async function closeCashier(tenantId, closeData, storeInfo = {}) {
  if (!tenantId) throw new Error("tenantId é obrigatório para fechamento.");

  const trocoInicial = Number(closeData.trocoInicial) || 0;
  const dinheiroVendas = Number(closeData.dinheiro) || 0;
  const esperadoGaveta = trocoInicial + dinheiroVendas;
  const informadoGaveta = Number(closeData.valorFisicoInformado) || 0;
  const diferenca = informadoGaveta - esperadoGaveta;

  const fechamentoRegistro = {
    dataTurno: closeData.dataTurno || new Date().toLocaleDateString("pt-BR"),
    horaFechamento: new Date().toLocaleTimeString("pt-BR"),
    operador: closeData.operador || "Operador Geral",
    unidadeId: closeData.unidadeId || "matriz",
    trocoInicial,
    totalVendido: Number(closeData.totalGeral) || 0,
    qtdVendas: Number(closeData.qtdVendas) || 0,
    dinheiro: dinheiroVendas,
    pix: Number(closeData.pix) || 0,
    debito: Number(closeData.debito) || 0,
    credito: Number(closeData.credito) || 0,
    prazo: Number(closeData.prazo) || 0,
    esperadoGaveta,
    informadoGaveta,
    diferenca,
    statusDivergencia:
      Math.abs(diferenca) < 0.01
        ? "CORRETO"
        : diferenca > 0
        ? "SOBRA"
        : "FALTA",
    empresaId: tenantId,
    criadoEm: serverTimestamp()
  };

  // 1. Salva o registro histórico de fechamento de caixa
  const colRef = collection(db, "empresas", tenantId, "caixas_fechamentos");
  const docRef = await addDoc(colRef, fechamentoRegistro);

  // 2. Busca lista de vendas para o anexo do PDF
  const vendasDoDia = await getTodaySales(tenantId, 50);

  // 3. Emite o PDF oficial instantaneamente
  generateCashierClosingPDF(
    {
      ...fechamentoRegistro,
      vendas: vendasDoDia.map((v) => ({
        numeroVenda: v.numeroVenda || v.id?.slice(-4),
        hora: v.criadoEm?.toDate ? v.criadoEm.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--",
        tipoVenda: v.tipoVenda || "varejo",
        itensDescricao: v.itens?.map((it) => `${it.quantidade}x ${it.nome} (${it.tamanho || "U"})`).join(", ") || "Itens diversos",
        formaPagamento: v.formaPagamento || "dinheiro",
        total: v.total
      }))
    },
    storeInfo
  );

  return { id: docRef.id, ...fechamentoRegistro };
}
