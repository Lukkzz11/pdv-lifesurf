import { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { formatCurrency } from "../../utils/formatters";
import { FileText, Eye, Building, Calendar, Barcode, Trash2 } from "lucide-react";

export default function NotasCompraLista({ notas = [], onNovaNota, onDeleteNota }) {
  const [notaSelecionada, setNotaSelecionada] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Notas Fiscais de Compra (NF-e)</h3>
          <p className="text-xs text-slate-400">
            Histórico das notas de entrada registradas no ERP para conferência contábil e fiscal.
          </p>
        </div>
        {onNovaNota && (
          <Button variant="primary" size="sm" onClick={onNovaNota} leftIcon={<FileText className="w-4 h-4" />}>
            Nova Entrada por NF-e
          </Button>
        )}
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
        <Table>
          <TableHeader>
            <TableRow isInteractive={false}>
              <TableHead>Número / Série</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Data Entrada</TableHead>
              <TableHead>Total de Peças</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.map((n) => (
              <TableRow key={n.id}>
                <TableCell>
                  <div className="font-mono font-bold text-white text-xs">
                    NF #{n.numeroNota}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Série: {n.serie || "1"}</div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-white text-xs">{n.fornecedorNome}</div>
                  {n.fornecedorCnpj && (
                    <div className="text-[11px] text-slate-400 font-mono">{n.fornecedorCnpj}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-300">{n.dataEmissao || "-"}</TableCell>
                <TableCell className="text-xs text-slate-300">{n.dataEntrada || "-"}</TableCell>
                <TableCell>
                  <Badge variant="info" size="sm">
                    {n.totalItens || (n.itens?.reduce((acc, i) => acc + (i.quantidade || 0), 0)) || 0} un
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-bold text-emerald-400">
                  {formatCurrency(n.valorTotalNota || 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => setNotaSelecionada(n)}
                      title="Visualizar Detalhes da Nota"
                      className="cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-sky-400" />
                    </Button>
                    {onDeleteNota && (
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => onDeleteNota(n.id)}
                        title="Excluir Nota de Compra"
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {notas.length === 0 && (
              <TableEmpty
                title="Nenhuma nota fiscal de compra registrada"
                description="Clique em 'Nova Entrada por NF-e' para alimentar o estoque em lote."
                colSpan={7}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Detalhes da NF-e */}
      {notaSelecionada && (
        <Modal isOpen={Boolean(notaSelecionada)} onClose={() => setNotaSelecionada(null)} size="lg">
          <ModalHeader
            title={`Detalhes da NF-e #${notaSelecionada.numeroNota}`}
            description={`Entrada registrada em ${notaSelecionada.dataEntrada || "Recente"}`}
            onClose={() => setNotaSelecionada(null)}
          />
          <ModalBody className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">Fornecedor:</span>
                  <strong className="text-white text-sm">{notaSelecionada.fornecedorNome}</strong>
                  <div className="text-slate-400 font-mono text-[11px]">
                    CNPJ: {notaSelecionada.fornecedorCnpj || "Não informado"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[11px]">Valor Total da Nota:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {formatCurrency(notaSelecionada.valorTotalNota || 0)}
                  </span>
                  {notaSelecionada.valorFrete > 0 && (
                    <div className="text-[11px] text-slate-400">
                      Frete incluso: {formatCurrency(notaSelecionada.valorFrete)}
                    </div>
                  )}
                </div>
              </div>

              {notaSelecionada.chaveAcesso && (
                <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-[11px]">
                  <Barcode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-slate-400">Chave:</span>
                  <span className="font-mono text-slate-200 truncate">{notaSelecionada.chaveAcesso}</span>
                </div>
              )}
            </div>

            {/* Tabela de Itens da NF */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Itens Faturados nesta Nota:
              </span>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow isInteractive={false}>
                      <TableHead>Item</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Custo Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(notaSelecionada.itens || []).map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-semibold text-white text-xs">{it.nome}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {it.referencia || "S/Ref"} • {it.categoria}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-white">
                          {it.quantidade} un
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">
                          {formatCurrency(it.custoUnitario)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-400 text-xs">
                          {formatCurrency(it.subtotal || it.quantidade * it.custoUnitario)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex items-center justify-between">
            {onDeleteNota && (
              <Button
                variant="outline"
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  const id = notaSelecionada.id;
                  setNotaSelecionada(null);
                  onDeleteNota(id);
                }}
              >
                Excluir Nota Fiscal
              </Button>
            )}
            <Button variant="secondary" onClick={() => setNotaSelecionada(null)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
