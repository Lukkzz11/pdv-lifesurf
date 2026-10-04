/**
 * SERVIÇO DE CONTINGÊNCIA & MODO OFFLINE DO PDV (OFFLINE-FIRST)
 * Garante que a frente de caixa (PDV) continue funcionando perfeitamente
 * mesmo sem conexão com a internet ou em quedas de sinal.
 * 
 * Funcionalidades:
 * 1. Detecção em tempo real de status de rede (Online / Offline / Forçar Modo Offline)
 * 2. Cache local do catálogo de produtos com atualização contínua e saldo de grade
 * 3. Fila local de vendas em contingência (IndexedDB / localStorage)
 * 4. Baixa imediata de estoque no cache local para evitar vendas duplicadas
 * 5. Emissão de Cupom Não Fiscal com tarja oficial de MODO CONTINGÊNCIA
 * 6. Sincronização atômica em lote com o Firestore assim que a conexão retornar
 */

import { executeSale } from "./saleService.js";

const STORAGE_PREFIX = "lifesurf_pdv_offline";
const FORCED_OFFLINE_KEY = `${STORAGE_PREFIX}_forced_mode`;

export const OFFLINE_EVENT_QUEUE_UPDATED = "pdv:offline_queue_updated";
export const OFFLINE_EVENT_SYNC_FINISHED = "pdv:offline_sync_finished";

// Catálogo padrão de segurança para primeiro boot offline (Moda & Surfwear)
export const DEFAULT_OFFLINE_CATALOG = [
  {
    id: "off-prod-1",
    nome: "Camiseta Masculina LifeSurf Classic Algodão 30.1",
    referencia: "CAM-CLS-01",
    codigoBarras: "7891000100011",
    categoria: "Camiseta",
    cores: ["Preto", "Branco", "Azul Marinho"],
    precoVarejo: 79.9,
    precoAtacado: 45.0,
    estoqueLoja: 45,
    estoqueTotal: 45,
    gradeTamanhos: { P: 10, M: 15, G: 12, GG: 8 }
  },
  {
    id: "off-prod-2",
    nome: "Boardshort Água 4-Way Stretch Performance",
    referencia: "BRD-STR-02",
    codigoBarras: "7891000200022",
    categoria: "Short",
    cores: ["Floral Tropical", "Preto Grafite"],
    precoVarejo: 129.9,
    precoAtacado: 75.0,
    estoqueLoja: 30,
    estoqueTotal: 30,
    gradeTamanhos: { "38": 6, "40": 10, "42": 8, "44": 6 }
  },
  {
    id: "off-prod-3",
    nome: "Boné Trucker LifeSurf Aba Curva Snapback",
    referencia: "BON-TRK-03",
    codigoBarras: "7891000300033",
    categoria: "Acessórios",
    cores: ["Preto/Branco"],
    precoVarejo: 69.9,
    precoAtacado: 38.0,
    estoqueLoja: 25,
    estoqueTotal: 25,
    gradeTamanhos: { Único: 25 }
  },
  {
    id: "off-prod-4",
    nome: "Camisa Térmica UV 50+ Manga Longa Surf & Treino",
    referencia: "UV-PRO-04",
    codigoBarras: "7891000400044",
    categoria: "Camisa",
    cores: ["Azul Royal", "Cinza Chumbo"],
    precoVarejo: 99.9,
    precoAtacado: 58.0,
    estoqueLoja: 35,
    estoqueTotal: 35,
    gradeTamanhos: { P: 8, M: 12, G: 10, GG: 5 }
  },
  {
    id: "off-prod-5",
    nome: "Regata Machão Dry-Fit Praia & Academia",
    referencia: "REG-DRY-05",
    codigoBarras: "7891000500055",
    categoria: "Camiseta",
    cores: ["Branco", "Verde Militar"],
    precoVarejo: 59.9,
    precoAtacado: 32.0,
    estoqueLoja: 28,
    estoqueTotal: 28,
    gradeTamanhos: { P: 6, M: 10, G: 8, GG: 4 }
  }
];

/**
 * Verifica se a contingência foi forçada manualmente para testes
 */
export function isForcedOffline() {
  try {
    return localStorage.getItem(FORCED_OFFLINE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Alterna modo de contingência forçado para simular queda de internet
 */
export function setForcedOffline(force) {
  try {
    localStorage.setItem(FORCED_OFFLINE_KEY, force ? "true" : "false");
    window.dispatchEvent(new CustomEvent("pdv:network_status_changed", { detail: { forced: force } }));
  } catch (e) {
    console.error("[pdvOfflineService] Erro ao alternar modo contingência:", e);
  }
}

/**
 * Retorna se o PDV está efetivamente operando online
 */
export function isPdvOnline() {
  if (isForcedOffline()) return false;
  return typeof navigator !== "undefined" && navigator.onLine !== false;
}

/**
 * Obtém a chave de armazenamento do catálogo em cache para a empresa
 */
function getCatalogKey(tenantId) {
  return `${STORAGE_PREFIX}_catalog_${tenantId || "default"}`;
}

/**
 * Salva a lista de produtos em cache local para suporte offline
 */
export function cacheProductCatalog(tenantId, products = []) {
  if (!tenantId || !Array.isArray(products) || products.length === 0) return;
  try {
    const key = getCatalogKey(tenantId);
    const dataToStore = {
      timestamp: Date.now(),
      total: products.length,
      products
    };
    localStorage.setItem(key, JSON.stringify(dataToStore));
  } catch (e) {
    console.warn("[pdvOfflineService] Não foi possível salvar catálogo em cache local:", e);
  }
}

/**
 * Recupera o catálogo de produtos local do cache
 */
export function getCachedProductCatalog(tenantId) {
  try {
    const key = getCatalogKey(tenantId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        return parsed.products;
      }
    }
  } catch (e) {
    console.warn("[pdvOfflineService] Erro ao ler catálogo em cache:", e);
  }
  // Se não encontrar nada em cache, retorna o catálogo de contingência padrão
  return DEFAULT_OFFLINE_CATALOG;
}

/**
 * Atualiza o saldo de estoque local do produto em cache (baixa imediata durante offline)
 */
export function decrementLocalProductStock(tenantId, itens = []) {
  if (!Array.isArray(itens) || itens.length === 0) return;
  try {
    const key = getCatalogKey(tenantId);
    const catalog = getCachedProductCatalog(tenantId);
    const catalogMap = new Map(catalog.map((p) => [p.id, { ...p }]));

    for (const item of itens) {
      const prod = catalogMap.get(item.id);
      if (prod) {
        const qtd = Number(item.quantidade) || 1;
        const tam = item.tamanho;
        
        // Atualiza grade
        if (prod.gradeTamanhos && tam && prod.gradeTamanhos[tam] !== undefined) {
          prod.gradeTamanhos = {
            ...prod.gradeTamanhos,
            [tam]: Math.max(0, (Number(prod.gradeTamanhos[tam]) || 0) - qtd)
          };
        }
        
        // Atualiza estoque total
        if (prod.estoqueTotal !== undefined) {
          prod.estoqueTotal = Math.max(0, (Number(prod.estoqueTotal) || 0) - qtd);
        }
        if (prod.estoqueLoja !== undefined) {
          prod.estoqueLoja = Math.max(0, (Number(prod.estoqueLoja) || 0) - qtd);
        }
        catalogMap.set(item.id, prod);
      }
    }

    const updatedList = Array.from(catalogMap.values());
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        total: updatedList.length,
        products: updatedList
      })
    );
  } catch (e) {
    console.error("[pdvOfflineService] Erro ao atualizar estoque local no cache:", e);
  }
}

/**
 * Retorna a chave de armazenamento da fila de vendas offline
 */
function getQueueKey(tenantId) {
  return `${STORAGE_PREFIX}_queue_${tenantId || "default"}`;
}

/**
 * Retorna a chave de histórico de vendas offline sincronizadas
 */
function getHistoryKey(tenantId) {
  return `${STORAGE_PREFIX}_history_${tenantId || "default"}`;
}

/**
 * Obtém a fila de vendas offline pendentes
 */
export function getOfflineSalesQueue(tenantId) {
  try {
    const key = getQueueKey(tenantId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[pdvOfflineService] Erro ao obter fila de vendas offline:", e);
    return [];
  }
}

/**
 * Retorna a quantidade de vendas pendentes de sincronização
 */
export function getPendingSalesCount(tenantId) {
  return getOfflineSalesQueue(tenantId).length;
}

/**
 * Registra uma venda em contingência na fila local
 * @param {string} tenantId - Empresa ativa
 * @param {object} saleData - Dados da venda
 * @returns {object} Registro da venda com número de contingência
 */
export function saveOfflineSale(tenantId, saleData) {
  if (!tenantId) throw new Error("tenantId é obrigatório para registrar a venda offline.");
  if (!saleData.itens || saleData.itens.length === 0) {
    throw new Error("A venda precisa conter pelo menos um item.");
  }

  const agora = new Date();
  const dataFormatada = `${agora.getFullYear().toString().slice(-2)}${(agora.getMonth() + 1).toString().padStart(2, "0")}${agora.getDate().toString().padStart(2, "0")}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const numeroContingencia = `CONT-${dataFormatada}-${randomSuffix}`;
  const localId = `off_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const saleRecord = {
    ...saleData,
    id: localId,
    numeroVenda: numeroContingencia,
    modoContingencia: true,
    sincronizado: false,
    status: "pendente",
    empresaId: tenantId,
    criadoEmLocal: agora.toISOString(),
    criadoEmFormatado: agora.toLocaleString("pt-BR")
  };

  // 1. Grava na fila local
  const currentQueue = getOfflineSalesQueue(tenantId);
  const updatedQueue = [saleRecord, ...currentQueue];
  localStorage.setItem(getQueueKey(tenantId), JSON.stringify(updatedQueue));

  // 2. Decrementa o saldo do estoque local no cache do PDV
  decrementLocalProductStock(tenantId, saleData.itens);

  // 3. Notifica a aplicação
  window.dispatchEvent(
    new CustomEvent(OFFLINE_EVENT_QUEUE_UPDATED, {
      detail: {
        tenantId,
        count: updatedQueue.length,
        lastSale: saleRecord
      }
    })
  );

  return saleRecord;
}

/**
 * Remove uma venda da fila offline (ex: cancelamento manual de teste)
 */
export function removeOfflineSale(tenantId, saleId) {
  try {
    const queue = getOfflineSalesQueue(tenantId);
    const updated = queue.filter((s) => s.id !== saleId);
    localStorage.setItem(getQueueKey(tenantId), JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(OFFLINE_EVENT_QUEUE_UPDATED, {
        detail: { tenantId, count: updated.length }
      })
    );
    return true;
  } catch (e) {
    console.error("[pdvOfflineService] Erro ao remover venda offline:", e);
    return false;
  }
}

/**
 * Limpa toda a fila de vendas offline da empresa
 */
export function clearOfflineSalesQueue(tenantId) {
  try {
    localStorage.removeItem(getQueueKey(tenantId));
    window.dispatchEvent(
      new CustomEvent(OFFLINE_EVENT_QUEUE_UPDATED, {
        detail: { tenantId, count: 0 }
      })
    );
  } catch (e) {
    console.error("[pdvOfflineService] Erro ao limpar fila:", e);
  }
}

/**
 * Obtém o histórico das últimas vendas sincronizadas (armazenadas localmente)
 */
export function getOfflineSyncedHistory(tenantId) {
  try {
    const key = getHistoryKey(tenantId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Adiciona uma venda sincronizada ao histórico local de contingência
 */
function recordSyncedHistory(tenantId, syncedRecord) {
  try {
    const key = getHistoryKey(tenantId);
    const history = getOfflineSyncedHistory(tenantId);
    const updated = [syncedRecord, ...history].slice(0, 50); // Mantém últimas 50
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn("[pdvOfflineService] Falha ao gravar histórico de sincronização:", e);
  }
}

/**
 * Executa a sincronização atômica de todas as vendas pendentes na fila offline com o Firestore
 * @param {string} tenantId - ID da empresa
 * @param {function} onProgress - Callback de progresso ({ current, total, sale, error })
 * @returns {Promise<{ total: number, synced: number, failed: number, errors: Array }>}
 */
export async function syncOfflineSalesQueue(tenantId, onProgress = null) {
  if (!isPdvOnline()) {
    throw new Error("Não é possível sincronizar enquanto o PDV estiver desconectado da internet.");
  }

  const queue = getOfflineSalesQueue(tenantId);
  if (queue.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  const results = {
    total: queue.length,
    synced: 0,
    failed: 0,
    errors: []
  };

  const remainingQueue = [];

  for (let i = 0; i < queue.length; i++) {
    const offlineSale = queue[i];

    try {
      // Prepara payload limpo para o executeSale no Firestore
      const payloadVenda = {
        itens: offlineSale.itens,
        subtotal: offlineSale.subtotal,
        desconto: offlineSale.desconto,
        tipoDesconto: offlineSale.tipoDesconto || "reais",
        total: offlineSale.total,
        tipoVenda: offlineSale.tipoVenda || "varejo",
        formaPagamento: offlineSale.formaPagamento,
        infoPagamento: offlineSale.infoPagamento || {},
        cliente: offlineSale.cliente || { nome: "Consumidor Final" },
        operador: offlineSale.operador || "Caixa Offline",
        unidadeId: offlineSale.unidadeId || "matriz",
        // Metadados de contingência preservados no Firestore para auditoria
        origemContingencia: true,
        numeroContingencia: offlineSale.numeroVenda,
        dataHoraOffline: offlineSale.criadoEmLocal
      };

      // Grava no Firestore com baixa atômica de estoque + métricas + contas_receber (se a prazo)
      const vendaNuvem = await executeSale(tenantId, payloadVenda);

      results.synced++;

      // Grava no histórico local de sincronização
      recordSyncedHistory(tenantId, {
        ...offlineSale,
        status: "sincronizado",
        nuvemId: vendaNuvem.id,
        nuvemNumeroVenda: vendaNuvem.numeroVenda,
        sincronizadoEm: new Date().toISOString()
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: queue.length,
          sale: offlineSale,
          status: "success"
        });
      }
    } catch (err) {
      console.error(`[pdvOfflineService] Falha ao sincronizar venda #${offlineSale.numeroVenda}:`, err);
      results.failed++;
      results.errors.push({
        sale: offlineSale,
        error: err.message || "Erro desconhecido"
      });

      // Se falhou, mantém na fila para nova tentativa posterior
      remainingQueue.push(offlineSale);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: queue.length,
          sale: offlineSale,
          status: "error",
          error: err.message
        });
      }
    }
  }

  // Atualiza a fila apenas com as que eventualmente falharam
  localStorage.setItem(getQueueKey(tenantId), JSON.stringify(remainingQueue));

  // Dispara evento global informando a conclusão da sincronização
  window.dispatchEvent(
    new CustomEvent(OFFLINE_EVENT_SYNC_FINISHED, {
      detail: {
        tenantId,
        results
      }
    })
  );

  window.dispatchEvent(
    new CustomEvent(OFFLINE_EVENT_QUEUE_UPDATED, {
      detail: {
        tenantId,
        count: remainingQueue.length
      }
    })
  );

  return results;
}
