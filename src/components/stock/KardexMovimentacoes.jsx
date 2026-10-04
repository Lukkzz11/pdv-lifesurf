import { useState, useMemo } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import {
  TIPOS_MOVIMENTACAO,
  CONFIG_MOVIMENTACOES
} from "../../services/stockService";
import { formatCurrency } from "../../utils/formatters";
import {
  Search,
  Filter,
  ArrowRightLeft,
  Calendar,
  User,
  ShieldCheck,
  FileText,
  AlertCircle,
  Trash2
} from "lucide-react";

export default function KardexMovimentacoes({ movimentacoes = [], loading = false, onDeleteMovimento }) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");
  const [movimentoDetalhe, setMovimentoDetalhe] = useState(null);

  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter((m) => {
      const matchBusca =
        m.produtoNome?.toLowerCase().includes(busca.toLowerCase()) ||
        m.referencia?.toLowerCase().includes(busca.toLowerCase()) ||
        m.documentoRef?.toLowerCase().includes(busca.toLowerCase()) ||
        m.justificativa?.toLowerCase().includes(busca.toLowerCase()) ||
        m.responsavel?.nome?.toLowerCase().includes(busca.toLowerCase());

      const matchTipo = tipoFiltro === "TODOS" || m.tipo === tipoFiltro;

      return matchBusca && matchTipo;
    });
  }, [movimentacoes, busca, tipoFiltro]);

  return (
    <div className="space-y-4">
      {/* Barra de Filtros do Kardex */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Buscar por produto, ref, NF, justificativa ou responsável..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="w-full sm:w-64">
          <Select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
          >
            <option value="TODOS">Todos os Tipos de Movimento</option>
            {Object.keys(TIPOS_MOVIMENTACAO).map((key) => (
              <option key={key} value={key}>
                {CONFIG_MOVIMENTACOES[key]?.label || key}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tabela Kardex */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
        <Table>
          <TableHeader>
            <TableRow isInteractive={false}>
              <TableHead>Data / Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto & Ref</TableHead>
              <TableHead>Qtd. Movimentada</TableHead>
              <TableHead>Origem ➔ Destino</TableHead>
              <TableHead>Motivo / Justificativa</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimentacoesFiltradas.map((mov) => {
              const config = CONFIG_MOVIMENTACOES[mov.tipo] || {
                label: mov.tipo,
                badge: "neutral",
                color: "text-slate-300",
                sinal: ""
              };
              const isPositivo = Number(mov.quantidade) > 0;

              return (
                <TableRow
                  key={mov.id}
                  onClick={() => setMovimentoDetalhe(mov)}
                  className="cursor-pointer hover:bg-slate-800/60 transition-colors"
                >
                  <TableCell className="font-mono text-xs text-slate-400 whitespace-nowrap">
                    {mov.dataHora || "02/10/2026"}
                  </TableCell>

                  <TableCell>
                    <Badge variant={config.badge} size="sm">
                      {config.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold text-white text-xs">{mov.produtoNome}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Ref: {mov.referencia || "S/Ref"}
                      {mov.documentoRef && ` • Doc: ${mov.documentoRef}`}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isPositivo ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPositivo ? `+${mov.quantidade}` : mov.quantidade} un
                    </span>
                    {mov.saldoNovo !== undefined && (
                      <span className="block text-[10px] text-slate-400 font-mono">
                        Saldo: {mov.saldoNovo} un
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-slate-300 max-w-[180px] truncate">
                    <span className="text-slate-400">{mov.origem || "Loja"}</span>
                    <span className="text-sky-400 mx-1">➔</span>
                    <span className="text-white">{mov.destino || "Balcão"}</span>
                  </TableCell>

                  <TableCell className="text-xs text-slate-300 max-w-[200px]">
                    <div className="font-medium text-slate-200 truncate">{mov.motivo}</div>
                    {mov.justificativa && (
                      <div className="text-[11px] text-slate-400 truncate italic">
                        "{mov.justificativa}"
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs font-semibold text-white">
                      {mov.responsavel?.nome || "Operador"}
                    </div>
                    <div className="text-[10px] text-sky-400 font-mono uppercase">
                      {mov.responsavel?.role || "gerente"}
                    </div>
                  </TableCell>

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {onDeleteMovimento && (
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => onDeleteMovimento(mov.id)}
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Excluir movimentação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {movimentacoesFiltradas.length === 0 && !loading && (
              <TableEmpty
                title="Nenhuma movimentação de estoque encontrada"
                description="As movimentações por nota de compra, vendas no PDV e baixas por avaria aparecerão aqui com rastreabilidade completa."
                colSpan={8}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Detalhes da Movimentação */}
      {movimentoDetalhe && (
        <Modal isOpen={Boolean(movimentoDetalhe)} onClose={() => setMovimentoDetalhe(null)} size="md">
          <ModalHeader
            title="Auditoria Detalhada de Movimentação"
            description={`Registro de Kardex #${movimentoDetalhe.id}`}
            onClose={() => setMovimentoDetalhe(null)}
          />
          <ModalBody className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tipo de Movimento:</span>
                <strong className="text-white">
                  {CONFIG_MOVIMENTACOES[movimentoDetalhe.tipo]?.label || movimentoDetalhe.tipo}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Produto:</span>
                <strong className="text-white">{movimentoDetalhe.produtoNome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Referência:</span>
                <span className="font-mono text-white">{movimentoDetalhe.referencia || "S/Ref"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quantidade:</span>
                <strong
                  className={`font-mono text-sm ${
                    Number(movimentoDetalhe.quantidade) > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {Number(movimentoDetalhe.quantidade) > 0
                    ? `+${movimentoDetalhe.quantidade}`
                    : movimentoDetalhe.quantidade}{" "}
                  peças
                </strong>
              </div>
              {movimentoDetalhe.documentoRef && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Documento Fiscal / OP:</span>
                  <span className="font-mono text-sky-400">{movimentoDetalhe.documentoRef}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Origem:</span>
                <span className="text-slate-300">{movimentoDetalhe.origem}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destino:</span>
                <span className="text-slate-300">{movimentoDetalhe.destino}</span>
              </div>
            </div>

            {/* Grade Movimentada se houver */}
            {movimentoDetalhe.gradeMovimentada &&
              Object.keys(movimentoDetalhe.gradeMovimentada).length > 0 && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Grade de Tamanhos Específica:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(movimentoDetalhe.gradeMovimentada)
                      .filter(([, qtd]) => qtd !== 0)
                      .map(([tam, qtd]) => (
                        <span
                          key={tam}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                        >
                          {tam}: <strong>{qtd}</strong> un
                        </span>
                      ))}
                  </div>
                </div>
              )}

            {/* Justificativa Obrigatória Registrada */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Motivo & Justificativa Declarada:
              </span>
              <p className="text-xs text-white leading-relaxed font-medium">
                {movimentoDetalhe.motivo}
              </p>
              {movimentoDetalhe.justificativa && (
                <p className="text-xs text-slate-300 italic bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  "{movimentoDetalhe.justificativa}"
                </p>
              )}
            </div>

            {/* Carimbo de Auditoria */}
            <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-bold text-white">
                    Assinado por: {movimentoDetalhe.responsavel?.nome || "Operador"}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {movimentoDetalhe.responsavel?.email || "balcao@lifesurf.com.br"} • Perfil:{" "}
                    {movimentoDetalhe.responsavel?.role || "operador"}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {movimentoDetalhe.dataHora}
              </span>
            </div>
          </ModalBody>
          <ModalFooter className="flex items-center justify-between">
            {onDeleteMovimento && (
              <Button
                variant="outline"
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  const id = movimentoDetalhe.id;
                  setMovimentoDetalhe(null);
                  onDeleteMovimento(id);
                }}
              >
                Excluir Registro
              </Button>
            )}
            <Button variant="secondary" onClick={() => setMovimentoDetalhe(null)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
