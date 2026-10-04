import { useState, useMemo } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Badge } from "../ui/Badge";
import {
  MOTIVOS_AJUSTE_PERDA,
  TIPOS_MOVIMENTACAO,
  registerStockLossOrAdjustment,
  calculateGradeTotal
} from "../../services/stockService";
import { formatCurrency } from "../../utils/formatters";
import {
  AlertTriangle,
  Layers,
  ShieldAlert,
  User,
  CheckCircle2,
  FileText
} from "lucide-react";
import toast from "react-hot-toast";

export default function AjusteEstoqueModal({
  isOpen,
  onClose,
  tenantId,
  produtos = [],
  tipoEstoque = "loja",
  userAuth,
  onSuccess
}) {
  const [salvando, setSalvando] = useState(false);

  // Estados do Formulário
  const [produtoId, setProdutoId] = useState("");
  const [tipoAjuste, setTipoAjuste] = useState(TIPOS_MOVIMENTACAO.BAIXA_AVARIA);
  const [motivo, setMotivo] = useState("defeito_fabricacao");
  const [justificativa, setJustificativa] = useState("");
  const [gradeAjuste, setGradeAjuste] = useState({});

  const produtoSelecionado = useMemo(() => {
    return produtos.find((p) => p.id === produtoId) || null;
  }, [produtos, produtoId]);

  // Quantidade total a ser ajustada
  const quantidadeTotalAjuste = useMemo(() => {
    return calculateGradeTotal(gradeAjuste);
  }, [gradeAjuste]);

  // Custo estimado do prejuízo
  const custoEstimadoPrejuizo = useMemo(() => {
    if (!produtoSelecionado) return 0;
    const custo = Number(produtoSelecionado.custoUnitario) || Number(produtoSelecionado.precoAtacado * 0.5) || 35.0;
    return custo * quantidadeTotalAjuste;
  }, [produtoSelecionado, quantidadeTotalAjuste]);

  const handleTamChange = (tam, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setGradeAjuste((prev) => ({
      ...prev,
      [tam]: num
    }));
  };

  const handleConfirmarAjuste = async (e) => {
    e.preventDefault();
    if (!produtoId) {
      toast.error("Selecione o produto a ser ajustado");
      return;
    }
    if (quantidadeTotalAjuste <= 0) {
      toast.error("Informe ao menos 1 peça na grade para o ajuste");
      return;
    }
    if (!justificativa || justificativa.trim().length < 5) {
      toast.error("A justificativa detalhada é obrigatória (mínimo 5 caracteres)");
      return;
    }

    setSalvando(true);
    try {
      const motivoLabel = MOTIVOS_AJUSTE_PERDA.find((m) => m.value === motivo)?.label || motivo;

      await registerStockLossOrAdjustment(
        tenantId,
        {
          produtoId,
          produtoNome: produtoSelecionado?.nome,
          referencia: produtoSelecionado?.referencia,
          tipoEstoque,
          tipoAjuste,
          motivo: motivoLabel,
          justificativa: justificativa.trim(),
          quantidade: quantidadeTotalAjuste,
          gradeAjuste,
          custoEstimado: custoEstimadoPrejuizo
        },
        userAuth
      );

      toast.success("Baixa de estoque e auditoria registradas com sucesso!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("[AjusteEstoqueModal] Erro ao registrar baixa:", err);
      toast.error(err.message || "Erro ao registrar ajuste de estoque");
    } finally {
      setSalvando(false);
    }
  };

  const isBaixa = tipoAjuste === TIPOS_MOVIMENTACAO.BAIXA_AVARIA;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={handleConfirmarAjuste}>
        <ModalHeader
          title={isBaixa ? "Baixa por Avaria, Defeito ou Perda" : "Ajuste de Balanço / Inventário"}
          description="Controle rigoroso estilo ERP com justificativa obrigatória e rastreabilidade do operador."
          onClose={onClose}
        />

        <ModalBody className="space-y-4">
          {/* Alerta de Responsabilidade e Auditoria */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <strong className="block text-white font-bold">Rastreabilidade ERP Ativa</strong>
              Esta movimentação será registrada permanentemente no Kardex da empresa com carimbo
              de data/hora e o usuário autenticado:{" "}
              <strong className="text-white underline">
                {userAuth?.nome || "Usuário Conectado"} ({userAuth?.role || "Operador"})
              </strong>.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tipo de Movimentação *"
              value={tipoAjuste}
              onChange={(e) => setTipoAjuste(e.target.value)}
            >
              <option value={TIPOS_MOVIMENTACAO.BAIXA_AVARIA}>
                Baixa por Avaria / Defeito / Furto (Reduz Saldo)
              </option>
              <option value={TIPOS_MOVIMENTACAO.AJUSTE_INVENTARIO}>
                Ajuste por Balanço de Inventário
              </option>
              <option value={TIPOS_MOVIMENTACAO.ENTRADA_AVULSA}>
                Entrada Avulsa / Reclassificação (Soma Saldo)
              </option>
            </Select>

            <Select
              label="Motivo Formal da Ocorrência *"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS_AJUSTE_PERDA.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>

          {/* Seleção do Produto */}
          <div>
            <Select
              label="Produto do Estoque *"
              value={produtoId}
              onChange={(e) => {
                setProdutoId(e.target.value);
                setGradeAjuste({});
              }}
              required
            >
              <option value="">-- Selecione o produto afetado --</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.referencia || "S/Ref"}) • Saldo Atual: {p.estoqueTotal || 0} un
                </option>
              ))}
            </Select>
          </div>

          {/* Grade de Tamanhos a Ajustar */}
          {produtoSelecionado && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Informe as Peças Afetadas por Tamanho:
                </span>
                <span className="text-xs font-bold text-rose-400 font-mono">
                  {isBaixa ? "-" : "±"} {quantidadeTotalAjuste} peças
                </span>
              </div>

              {/* Se o produto tem grade cadastrada */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Object.keys(produtoSelecionado.gradeTamanhos || { P: 0, M: 0, G: 0, GG: 0 }).map((tam) => {
                  const saldoAtualTam = produtoSelecionado.gradeTamanhos?.[tam] || 0;
                  return (
                    <div key={tam} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                      <span className="text-[11px] font-mono font-bold text-slate-300 block">{tam}</span>
                      <span className="text-[9px] text-slate-500 block mb-1">({saldoAtualTam} un)</span>
                      <input
                        type="number"
                        min="0"
                        max={isBaixa ? saldoAtualTam : 999}
                        value={gradeAjuste[tam] || 0}
                        onChange={(e) => handleTamChange(tam, e.target.value)}
                        className="w-full bg-slate-950 text-white rounded text-center font-bold text-xs h-7 border border-slate-700 focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              {isBaixa && custoEstimadoPrejuizo > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Prejuízo Financeiro Estimado:</span>
                  <span className="font-mono font-bold text-rose-400">
                    {formatCurrency(custoEstimadoPrejuizo)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Justificativa Obrigatória */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Justificativa Obrigatória da Ocorrência *</span>
              <span className="text-[10px] text-slate-500">Mínimo 5 caracteres</span>
            </label>
            <textarea
              required
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Peça apresentou descostura lateral grave durante o manuseio no provador. Impossível reparo comercial."
              className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:border-sky-500 focus:outline-none resize-none"
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant={isBaixa ? "danger" : "primary"}
            type="submit"
            isLoading={salvando}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            disabled={!produtoId || quantidadeTotalAjuste <= 0 || justificativa.trim().length < 5}
          >
            {isBaixa ? "Confirmar Baixa por Avaria" : "Confirmar Ajuste no Estoque"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
