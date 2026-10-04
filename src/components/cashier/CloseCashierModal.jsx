import { useState, useEffect } from "react";
import { useAuth } from "../../security/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { getTodayCashierSummary, closeCashier } from "../../services/cashierService";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { formatCurrency } from "../../utils/formatters";
import {
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calculator,
  ArrowRight,
  TrendingDown,
  TrendingUp
} from "lucide-react";

export function CloseCashierModal({ isOpen, onClose, onClosedSuccess }) {
  const { userProfile } = useAuth();
  const { activeTenantId, activeUnitId } = useTenant();

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [fundoTroco, setFundoTroco] = useState("100.00");
  const [dinheiroContado, setDinheiroContado] = useState("");
  const [processando, setProcessando] = useState(false);
  const [fechamentoConcluido, setFechamentoConcluido] = useState(false);
  const [resultadoFechamento, setResultadoFechamento] = useState(null);

  useEffect(() => {
    if (isOpen && activeTenantId) {
      setLoadingSummary(true);
      setFechamentoConcluido(false);
      getTodayCashierSummary(activeTenantId)
        .then((data) => {
          setSummary(data);
          const trocoVal = data?.trocoInicial !== undefined ? Number(data.trocoInicial) : 100;
          setFundoTroco(trocoVal.toFixed(2));
          // Preenche automaticamente o dinheiro com o valor já apurado pelo PDV (Troco + Vendas em Dinheiro)
          const totalDinheiroSistema = trocoVal + (Number(data?.dinheiro) || 0);
          setDinheiroContado(totalDinheiroSistema.toFixed(2));
        })
        .finally(() => setLoadingSummary(false));
    }
  }, [isOpen, activeTenantId]);

  useEffect(() => {
    if (!isOpen || !fechamentoConcluido) return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, fechamentoConcluido, onClose]);

  // Cálculos consolidados em tempo real
  const trocoNum = Number(fundoTroco) || 0;
  const dinheiroVendas = Number(summary?.dinheiro) || 0;
  const esperadoGaveta = trocoNum + dinheiroVendas;
  const contadoNum = dinheiroContado !== "" ? Number(dinheiroContado) : esperadoGaveta;
  const diferenca = contadoNum - esperadoGaveta;

  const handleFinalizarFechamento = async () => {
    setProcessando(true);
    try {
      const valorFinalInformado = contadoNum;
      const res = await closeCashier(
        activeTenantId,
        {
          ...summary,
          trocoInicial: trocoNum,
          valorFisicoInformado: valorFinalInformado,
          operador: userProfile?.nome || "Operador LifeSurf",
          unidadeId: activeUnitId || "matriz"
        },
        {
          nome: "LIFESURF CONFECÇÕES & SURFWEAR",
          unidade: (activeUnitId || "Matriz").toUpperCase(),
          cidade: "Fortaleza - CE"
        }
      );

      setResultadoFechamento(res);
      setFechamentoConcluido(true);
      if (onClosedSuccess) onClosedSuccess(res);
    } catch (err) {
      console.error("[CloseCashierModal] Falha ao fechar caixa:", err);
      alert("Ocorreu um erro ao processar o fechamento de caixa.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="Fechamento de Caixa Diário"
        description="Fechamento com valores apurados automaticamente pelas vendas do PDV e emissão do PDF oficial."
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {fechamentoConcluido ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Caixa Encerrado com Sucesso!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                O relatório executivo oficial consolidado do turno foi baixado em PDF para arquivamento e conferência contábil.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Faturado no Turno:</span>
                <span className="font-bold text-white">{formatCurrency(resultadoFechamento?.totalVendido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total em Dinheiro na Gaveta:</span>
                <span className="text-slate-200 font-bold">{formatCurrency(resultadoFechamento?.esperadoGaveta)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fundo de Troco:</span>
                <span className="text-slate-200">{formatCurrency(resultadoFechamento?.trocoInicial)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Status do Caixa:</span>
                <Badge variant="success" size="sm" withDot={true}>
                  Encerrado e Conciliado ✓
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Resumo do Turno Atual */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Total Vendido</span>
                <strong className="text-sm text-emerald-400 font-bold">
                  {formatCurrency(summary?.totalGeral || 0)}
                </strong>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Em Dinheiro</span>
                <strong className="text-sm text-white font-bold">
                  {formatCurrency(summary?.dinheiro || 0)}
                </strong>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Pix Recebido</span>
                <strong className="text-sm text-sky-400 font-bold">
                  {formatCurrency(summary?.pix || 0)}
                </strong>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Cartões (D/C)</span>
                <strong className="text-sm text-purple-400 font-bold">
                  {formatCurrency((Number(summary?.debito) || 0) + (Number(summary?.credito) || 0))}
                </strong>
              </div>
            </div>

            {/* Inputs de Conferência */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Input
                label="Fundo de Troco Inicial (Gaveta)"
                type="number"
                step="0.01"
                value={fundoTroco}
                onChange={(e) => setFundoTroco(e.target.value)}
                helperText="Valor de troco que estava na gaveta na abertura."
              />

              <Input
                label="Total em Dinheiro na Gaveta (Apurado pelo PDV)"
                type="number"
                step="0.01"
                value={dinheiroContado}
                onChange={(e) => setDinheiroContado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFinalizarFechamento();
                  }
                }}
                helperText="Valor calculado automaticamente (Troco + Vendas). Altere somente se necessário."
              />
            </div>

            {/* Card com o Total em Dinheiro e Confirmação */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total em Dinheiro na Gaveta:</span>
                <strong className="text-emerald-400 font-bold text-base">{formatCurrency(esperadoGaveta)}</strong>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Conferência do Sistema:
                </span>
                <Badge variant="success" size="md" withDot={true}>
                  Valor Pronto para Fechamento
                </Badge>
              </div>
            </div>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {fechamentoConcluido ? "Fechar" : "Cancelar"}
        </Button>
        {!fechamentoConcluido && (
          <Button
            variant="success"
            onClick={handleFinalizarFechamento}
            isLoading={processando}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Confirmar e Gerar PDF
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

export default CloseCashierModal;
