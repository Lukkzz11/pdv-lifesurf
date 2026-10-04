import { useState, useEffect } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Printer,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  ShieldCheck,
  Package,
  Layers,
  FileText
} from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import {
  isPdvOnline,
  isForcedOffline,
  setForcedOffline,
  getOfflineSalesQueue,
  removeOfflineSale,
  clearOfflineSalesQueue,
  getOfflineSyncedHistory,
  syncOfflineSalesQueue,
  OFFLINE_EVENT_QUEUE_UPDATED
} from "../../services/pdvOfflineService";
import { printThermalReceipt } from "../../services/receiptService";

export default function ModalFilaOffline({
  isOpen,
  onClose,
  tenantId,
  storeInfo = {},
  onSyncSuccess = null
}) {
  const [online, setOnline] = useState(isPdvOnline());
  const [forced, setForced] = useState(isForcedOffline());
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("pendentes"); // "pendentes" | "historico"
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const carregarDados = () => {
    if (!tenantId) return;
    setQueue(getOfflineSalesQueue(tenantId));
    setHistory(getOfflineSyncedHistory(tenantId));
    setOnline(isPdvOnline());
    setForced(isForcedOffline());
  };

  useEffect(() => {
    if (isOpen) {
      carregarDados();
      setSyncResult(null);
      setSyncProgress(null);
    }
  }, [isOpen, tenantId]);

  useEffect(() => {
    const handleQueueChange = () => carregarDados();
    const handleNetworkChange = () => carregarDados();

    window.addEventListener(OFFLINE_EVENT_QUEUE_UPDATED, handleQueueChange);
    window.addEventListener("pdv:network_status_changed", handleNetworkChange);
    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);

    return () => {
      window.removeEventListener(OFFLINE_EVENT_QUEUE_UPDATED, handleQueueChange);
      window.removeEventListener("pdv:network_status_changed", handleNetworkChange);
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
    };
  }, [tenantId]);

  // Alterna o modo de contingência forçado para testes
  const handleToggleForced = () => {
    const novoValor = !forced;
    setForcedOffline(novoValor);
    setForced(novoValor);
    setOnline(isPdvOnline());
  };

  // Dispara a sincronização de todas as vendas pendentes
  const handleSyncAll = async () => {
    if (!online) {
      alert("O PDV está sem internet ou em modo de contingência forçado. Restabeleça a conexão para sincronizar.");
      return;
    }
    if (queue.length === 0) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await syncOfflineSalesQueue(tenantId, (progress) => {
        setSyncProgress(progress);
      });
      setSyncResult(res);
      carregarDados();
      if (onSyncSuccess) onSyncSuccess(res);
    } catch (err) {
      alert("Erro durante a sincronização: " + (err.message || "Erro desconhecido"));
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  // Remove uma venda específica
  const handleRemove = (saleId, numeroVenda) => {
    if (confirm(`Deseja realmente excluir a venda #${numeroVenda} da fila local?`)) {
      removeOfflineSale(tenantId, saleId);
      carregarDados();
    }
  };

  // Limpa todas as vendas da fila
  const handleClearAll = () => {
    if (confirm("ATENÇÃO: Deseja descartar TODAS as vendas pendentes da fila local? Essa ação não pode ser desfeita.")) {
      clearOfflineSalesQueue(tenantId);
      carregarDados();
    }
  };

  // Reimprime cupom de contingência
  const handleReprint = (sale) => {
    printThermalReceipt(
      {
        ...sale,
        modoContingencia: true
      },
      storeInfo
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="Modo Contingência & Fila Offline"
        description="Gestão de vendas emitidas sem conexão e sincronização com o Firestore"
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {/* Painel de Status de Rede e Contingência */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                online
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              {online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {online ? "Conexão Estabelecida (Online)" : "Modo de Contingência (Offline)"}
                </span>
                <Badge variant={online ? "success" : "warning"} size="sm" withDot pulseDot={!online}>
                  {online ? "Nuvem Pronta" : "Fila Local Ativa"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {online
                  ? "Vendas são enviadas diretamente ao Firestore e sincronizações pendentes podem ser executadas."
                  : "Vendas e cupons funcionam normalmente sem internet e são guardados com segurança no navegador."}
              </p>
            </div>
          </div>

          {/* Botão de Simulação / Teste do Modo Offline */}
          <button
            type="button"
            onClick={handleToggleForced}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
              forced
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            {forced ? "Desativar Simulação Offline" : "Simular Caixa Offline"}
          </button>
        </div>

        {/* Notificação de Resultado de Sincronização */}
        {syncResult && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Sincronização concluída: <strong>{syncResult.synced} venda(s)</strong> gravadas com sucesso no Firestore!
              </span>
            </div>
            {syncResult.failed > 0 && (
              <Badge variant="danger" size="sm">
                {syncResult.failed} falha(s)
              </Badge>
            )}
          </div>
        )}

        {/* Barra de Progresso durante a sincronização */}
        {syncing && syncProgress && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs space-y-2">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
                Sincronizando venda {syncProgress.current} de {syncProgress.total}...
              </span>
              <span>
                {Math.round((syncProgress.current / syncProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-sky-500/20">
              <div
                className="bg-sky-400 h-full transition-all duration-200"
                style={{
                  width: `${(syncProgress.current / syncProgress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Abas: Pendentes vs Histórico */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("pendentes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === "pendentes"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Vendas Pendentes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/30 text-sky-200">
                {queue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("historico")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === "historico"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Histórico Sincronizado</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {history.length}
              </span>
            </button>
          </div>

          {activeTab === "pendentes" && queue.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
            >
              Descartar Todas
            </button>
          )}
        </div>

        {/* Conteúdo da Aba PENDENTES */}
        {activeTab === "pendentes" && (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {queue.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Nenhuma venda pendente na fila</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Todas as vendas realizadas até o momento já estão registradas e sincronizadas na nuvem.
                </p>
              </div>
            ) : (
              queue.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm" withDot>
                        {sale.numeroVenda}
                      </Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {sale.criadoEmFormatado || "Data Local"}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">Total</span>
                      <strong className="text-sm font-black text-emerald-400">
                        {formatCurrency(sale.total)}
                      </strong>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
                    <div className="space-x-2">
                      <span>Cliente: <strong>{sale.cliente?.nome || "Consumidor Final"}</strong></span>
                      <span className="text-slate-500">•</span>
                      <span>Pagto: <strong className="uppercase">{sale.formaPagamento}</strong></span>
                      <span className="text-slate-500">•</span>
                      <span>Itens: <strong>{sale.itens?.length || 0} produto(s)</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprint(sale)}
                        className="h-7 text-xs px-2"
                        leftIcon={<Printer className="w-3.5 h-3.5 text-sky-400" />}
                      >
                        Reimprimir
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleRemove(sale.id, sale.numeroVenda)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Descartar venda local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Resumo dos Itens */}
                  <div className="bg-slate-900/60 p-2 rounded-lg text-[11px] text-slate-400 space-y-0.5 font-mono">
                    {sale.itens?.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {it.quantidade}x {it.nome} {it.tamanho ? `(${it.tamanho})` : ""}
                        </span>
                        <span>{formatCurrency(it.subtotal || it.precoUnitario * it.quantidade)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Conteúdo da Aba HISTÓRICO */}
        {activeTab === "historico" && (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <FileText className="w-10 h-10 text-slate-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">Nenhum histórico recente</h4>
                <p className="text-xs text-slate-400">
                  O registro das vendas offline sincronizadas nesta máquina aparecerá aqui.
                </p>
              </div>
            ) : (
              history.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">Contingência #{item.numeroVenda}</span>
                      <Badge variant="success" size="sm">
                        Gravado na Nuvem #{item.nuvemNumeroVenda || "OK"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Cliente: {item.cliente?.nome || "Consumidor Final"} • Sincronizado em:{" "}
                      {new Date(item.sincronizadoEm).toLocaleTimeString("pt-BR")}
                    </div>
                  </div>

                  <strong className="text-emerald-400 font-bold font-mono">
                    {formatCurrency(item.total)}
                  </strong>
                </div>
              ))
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="success"
            onClick={handleSyncAll}
            isLoading={syncing}
            disabled={!online || queue.length === 0}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Sincronizar Todas Agora ({queue.length})
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
