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
      setDinheiroContado("");
      getTodayCashierSummary(activeTenantId)
        .then((data) => {
          setSummary(data);
          if (data?.trocoInicial) {
            setFundoTroco(Number(data.trocoInicial).toFixed(2));
          }
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

  // Cálculos de divergência em tempo real
  const trocoNum = Number(fundoTroco) || 0;
  const dinheiroVendas = Number(summary?.dinheiro) || 0;
  const esperadoGaveta = trocoNum + dinheiroVendas;
  const contadoNum = Number(dinheiroContado) || 0;
  const diferenca = contadoNum - esperadoGaveta;

  const handleFinalizarFechamento = async () => {
    if (!dinheiroContado && dinheiroContado !== "0") {
      alert("Por favor, digite o valor físico em dinheiro apurado na gaveta.");
      return;
    }

    setProcessando(true);
    try {
      const res = await closeCashier(
        activeTenantId,
        {
          ...summary,
          trocoInicial: trocoNum,
          valorFisicoInformado: contadoNum,
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
        description="Conferência física de valores, apuração de divergências e geração de relatório em PDF."
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
                O relatório oficial consolidado do turno foi baixado em PDF para arquivamento e conferência contábil.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Faturado no Turno:</span>
                <span className="font-bold text-white">{formatCurrency(resultadoFechamento?.totalVendido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Esperado na Gaveta:</span>
                <span className="text-slate-200">{formatCurrency(resultadoFechamento?.esperadoGaveta)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Físico Informado:</span>
                <span className="text-slate-200">{formatCurrency(resultadoFechamento?.informadoGaveta)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Status Divergência:</span>
                <Badge
                  variant={
                    resultadoFechamento?.statusDivergencia === "CORRETO"
                      ? "success"
                      : resultadoFechamento?.statusDivergencia === "SOBRA"
                      ? "info"
                      : "danger"
                  }
                  size="sm"
                  withDot={true}
                >
                  {resultadoFechamento?.statusDivergencia}: {formatCurrency(Math.abs(resultadoFechamento?.diferenca || 0))}
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
                helperText="Valor de troco que já estava na gaveta na abertura."
              />

              <Input
                label="Valor Físico em Dinheiro Conferido na Gaveta (R$)"
                type="number"
                step="0.01"
                required
                autoFocus
                value={dinheiroContado}
                onChange={(e) => setDinheiroContado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFinalizarFechamento();
                  }
                }}
                placeholder="Ex: 540.00"
                helperText="Some todo o dinheiro em espécie presente na gaveta (Pressione Enter para confirmar)."
              />
            </div>

            {/* Caixa de Apuração de Divergência em Tempo Real */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Esperado em Gaveta (Troco + Vendas Dinheiro):</span>
                <strong className="text-white text-sm">{formatCurrency(esperadoGaveta)}</strong>
              </div>

              {dinheiroContado !== "" && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-sky-400" />
                    Resultado da Conferência:
                  </span>

                  {Math.abs(diferenca) < 0.01 ? (
                    <Badge variant="success" size="md" withDot={true}>
                      Caixa Correto (R$ 0,00)
                    </Badge>
                  ) : diferenca > 0 ? (
                    <Badge variant="info" size="md" withDot={true}>
                      Sobra de Caixa: + {formatCurrency(diferenca)}
                    </Badge>
                  ) : (
                    <Badge variant="danger" size="md" withDot={true}>
                      Falta de Caixa: - {formatCurrency(Math.abs(diferenca))}
                    </Badge>
                  )}
                </div>
              )}
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
