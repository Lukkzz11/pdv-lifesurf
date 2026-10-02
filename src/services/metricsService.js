import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * SERVIÇO DE MÉTRICAS AGREGADAS (OTIMIZAÇÃO DO PLANO BLAZE)
 *
 * REGRA DE OURO:
 * Em vez de fazer getDocs() em coleções inteiras de milhares de vendas ou produtos,
 * lemos apenas 1 DOCUMENTO DESNORMALIZADO de métricas.
 * Isso economiza 99% das leituras do plano Blaze.
 */

/**
 * Retorna as métricas consolidadas do dashboard da empresa em apenas 1 leitura
 * @param {string} tenantId - ID da empresa
 */
export async function getTenantDashboardMetrics(tenantId) {
  if (!tenantId) return null;

  try {
    const metricsRef = doc(db, "empresas", tenantId, "metricas", "dashboard");
    const docSnap = await getDoc(metricsRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }

    // Inicialização do documento agregado se ainda não existir
    const initialMetrics = {
      totalVendasHoje: 0,
      qtdVendasHoje: 0,
      totalMes: 0,
      totalEstoqueLojaPecas: 0,
      totalEstoqueFabricaPecas: 0,
      caixasAbertos: 1,
      atualizadoEm: serverTimestamp()
    };

    await setDoc(metricsRef, initialMetrics, { merge: true });
    return initialMetrics;
  } catch (error) {
    console.error("[metricsService] Erro ao buscar métricas agregadas:", error);
    return {
      totalVendasHoje: 0,
      qtdVendasHoje: 0,
      totalMes: 0,
      totalEstoqueLojaPecas: 0,
      totalEstoqueFabricaPecas: 0,
      caixasAbertos: 1
    };
  }
}

/**
 * Atualiza os contadores agregados da empresa atomicamente via increment()
 * Não lê nenhum documento adicional, apenas computa a soma no Firestore.
 */
export async function recordSaleMetrics(tenantId, sale) {
  if (!tenantId || !sale) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const metricsRef = doc(db, "empresas", tenantId, "metricas", "dashboard");
  const dailySummaryRef = doc(db, "empresas", tenantId, "resumo_diario", todayStr);

  const saleTotal = Number(sale.total) || 0;
  const paymentMethod = sale.formaPagamento || "dinheiro";

  const paymentIncrement = {
    dinheiro: paymentMethod === "dinheiro" ? increment(saleTotal) : increment(0),
    pix: paymentMethod === "pix" ? increment(saleTotal) : increment(0),
    debito: paymentMethod === "debito" ? increment(saleTotal) : increment(0),
    credito: paymentMethod === "credito" ? increment(saleTotal) : increment(0),
    prazo: paymentMethod === "a_ver" || paymentMethod === "prazo" ? increment(saleTotal) : increment(0)
  };

  try {
    // 1. Atualiza métricas gerais da empresa
    await setDoc(
      metricsRef,
      {
        totalVendasHoje: increment(saleTotal),
        qtdVendasHoje: increment(1),
        totalMes: increment(saleTotal),
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );

    // 2. Atualiza resumo diário para fechamento de caixa sem varredura de coleção
    await setDoc(
      dailySummaryRef,
      {
        data: todayStr,
        totalGeral: increment(saleTotal),
        qtdVendas: increment(1),
        ...paymentIncrement,
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[metricsService] Falha ao gravar agregação da venda:", err);
  }
}

/**
 * Atualiza o contador de estoque de loja ou fábrica desnormalizado
 */
export async function updateStockAggregateCount(tenantId, tipoEstoque, deltaPecas) {
  if (!tenantId) return;
  const metricsRef = doc(db, "empresas", tenantId, "metricas", "dashboard");
  const field = tipoEstoque === "fabrica" ? "totalEstoqueFabricaPecas" : "totalEstoqueLojaPecas";

  try {
    await updateDoc(metricsRef, {
      [field]: increment(deltaPecas),
      atualizadoEm: serverTimestamp()
    });
  } catch (e) {
    // Se o doc ainda não existia, cria com setDoc merge
    await setDoc(metricsRef, { [field]: deltaPecas }, { merge: true });
  }
}
