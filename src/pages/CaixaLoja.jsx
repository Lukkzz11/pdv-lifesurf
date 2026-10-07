import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import { useAuth } from "../security/AuthContext";
import {
  fetchSales,
  updateSale,
  deleteSale
} from "../services/saleService";
import { printThermalReceipt } from "../services/receiptService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from "../components/ui/Table";
import { formatCurrency, formatDate } from "../utils/formatters";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Search,
  Download,
  Printer,
  Edit2,
  Trash2,
  RefreshCw,
  Filter,
  Calendar,
  User,
  ShoppingBag,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Zap
} from "lucide-react";

export default function CaixaLoja() {
  const { activeTenantId, companyDetails } = useTenant();
  const { userProfile } = useAuth();

  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState("TODOS");
  const [filtroData, setFiltroData] = useState("");

  // Modal de Edição de Venda
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [vendaEditando, setVendaEditando] = useState(null);
  const [formEditar, setFormEditar] = useState({
    clienteNome: "",
    operador: "",
    formaPagamento: "dinheiro",
    desconto: 0,
    observacoes: ""
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Modal de Exclusão de Venda
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [vendaExcluindo, setVendaExcluindo] = useState(null);
  const [restaurarEstoque, setRestaurarEstoque] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  // Modal de Detalhes dos Itens da Venda
  const [modalItensAberto, setModalItensAberto] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState(null);

  const carregarVendas = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const lista = await fetchSales(activeTenantId, 150);
      setVendas(lista);
    } catch (err) {
      console.error("[CaixaLoja] Erro ao carregar vendas:", err);
      toast.error("Erro ao carregar vendas do caixa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarVendas();
  }, [activeTenantId]);

  // Vendas filtradas
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      const buscaMatch =
        !busca.trim() ||
        v.numeroVenda?.toLowerCase().includes(busca.toLowerCase()) ||
        v.cliente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        v.operador?.toLowerCase().includes(busca.toLowerCase()) ||
        (Array.isArray(v.itens) &&
          v.itens.some((i) => i.nome?.toLowerCase().includes(busca.toLowerCase())));

      const forma = (v.formaPagamento || "dinheiro").toLowerCase();
      const pagMatch =
        filtroPagamento === "TODOS" ||
        forma === filtroPagamento.toLowerCase();

      const dataStr = v.criadoEm?.toDate
        ? v.criadoEm.toDate().toISOString().split("T")[0]
        : v.dataHoraFormatada?.split(" ")[0] || "";
      const dataMatch = !filtroData || dataStr.includes(filtroData);

      return buscaMatch && pagMatch && dataMatch;
    });
  }, [vendas, busca, filtroPagamento, filtroData]);

  // Totais e KPIs calculados
  const totais = useMemo(() => {
    const totalFaturado = vendasFiltradas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    const qtdVendas = vendasFiltradas.length;
    const ticketMedio = qtdVendas > 0 ? totalFaturado / qtdVendas : 0;

    let totalPix = 0;
    let totalDinheiro = 0;
    let totalCartao = 0;
    let totalPrazo = 0;

    vendasFiltradas.forEach((v) => {
      const val = Number(v.total) || 0;
      const forma = (v.formaPagamento || "").toLowerCase();
      if (forma === "pix") totalPix += val;
      else if (forma === "dinheiro") totalDinheiro += val;
      else if (forma.includes("cartao") || forma.includes("credito") || forma.includes("debito")) {
        totalCartao += val;
      } else if (forma === "prazo") {
        totalPrazo += val;
      }
    });

    return {
      totalFaturado,
      qtdVendas,
      ticketMedio,
      totalPix,
      totalDinheiro,
      totalCartao,
      totalPrazo
    };
  }, [vendasFiltradas]);

  // Abertura do modal de edição
  const handleAbrirEditar = (venda) => {
    setVendaEditando(venda);
    setFormEditar({
      clienteNome: venda.cliente?.nome || "Consumidor Final",
      operador: venda.operador || "Caixa Geral",
      formaPagamento: venda.formaPagamento || "dinheiro",
      desconto: venda.desconto || 0,
      observacoes: venda.observacoes || ""
    });
    setModalEditarAberto(true);
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    if (!vendaEditando) return;

    setSalvandoEdicao(true);
    try {
      const updatedFields = {
        cliente: {
          ...(vendaEditando.cliente || {}),
          nome: formEditar.clienteNome
        },
        operador: formEditar.operador,
        formaPagamento: formEditar.formaPagamento,
        desconto: Number(formEditar.desconto) || 0,
        observacoes: formEditar.observacoes
      };

      await updateSale(activeTenantId, vendaEditando.id, updatedFields);
      toast.success("Venda atualizada com sucesso!");
      setModalEditarAberto(false);
      await carregarVendas();
    } catch (err) {
      console.error("[CaixaLoja] Erro ao editar venda:", err);
      toast.error("Erro ao salvar alterações da venda.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Abertura do modal de exclusão
  const handleAbrirExcluir = (venda) => {
    setVendaExcluindo(venda);
    setRestaurarEstoque(!venda.semBaixaEstoque);
    setModalExcluirAberto(true);
  };

  const handleConfirmarExclusao = async () => {
    if (!vendaExcluindo) return;

    setExcluindo(true);
    try {
      await deleteSale(activeTenantId, vendaExcluindo.id, restaurarEstoque, vendaExcluindo);
      toast.success("Registro de venda excluído com sucesso!");
      setModalExcluirAberto(false);
      await carregarVendas();
    } catch (err) {
      console.error("[CaixaLoja] Erro ao excluir venda:", err);
      toast.error("Erro ao excluir registro de venda.");
    } finally {
      setExcluindo(false);
    }
  };

  // Reimpressão de cupom térmico
  const handleReimprimirCupom = (venda) => {
    try {
      printThermalReceipt({
        numeroVenda: venda.numeroVenda,
        itens: venda.itens || [],
        subtotal: venda.subtotal || venda.total,
        desconto: venda.desconto || 0,
        total: venda.total,
        formaPagamento: venda.formaPagamento,
        tipoVenda: venda.tipoVenda || "varejo",
        cliente: venda.cliente || { nome: "Consumidor Final" },
        operador: venda.operador || userProfile?.nome || "Caixa Geral",
        dataHora: venda.dataHoraFormatada || new Date().toLocaleString("pt-BR")
      }, companyDetails);
      toast.success("Enviado para impressão térmica!");
    } catch (err) {
      toast.error("Erro ao imprimir cupom: " + err.message);
    }
  };

  // Exportar Relatório em CSV (Excel)
  const handleExportarCsv = () => {
    if (vendasFiltradas.length === 0) {
      toast.error("Nenhuma venda disponível para exportar.");
      return;
    }

    const headers = [
      "Numero_Venda",
      "Data_Hora",
      "Cliente",
      "Operador",
      "Forma_Pagamento",
      "Itens_Qtd",
      "Subtotal",
      "Desconto",
      "Total",
      "Sem_Baixa_Estoque"
    ];

    const rows = vendasFiltradas.map((v) => {
      const qtdTotalItens = Array.isArray(v.itens)
        ? v.itens.reduce((acc, i) => acc + (Number(i.quantidade) || 1), 0)
        : 0;

      return [
        `"${v.numeroVenda || v.id}"`,
        `"${v.dataHoraFormatada || ""}"`,
        `"${(v.cliente?.nome || "Consumidor Final").replace(/"/g, '""')}"`,
        `"${(v.operador || "Caixa").replace(/"/g, '""')}"`,
        `"${v.formaPagamento || "dinheiro"}"`,
        qtdTotalItens,
        Number(v.subtotal || v.total || 0).toFixed(2),
        Number(v.desconto || 0).toFixed(2),
        Number(v.total || 0).toFixed(2),
        v.semBaixaEstoque ? "SIM" : "NAO"
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio_caixa_loja_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório CSV baixado com sucesso!");
  };

  // Exportar Relatório em PDF Elegante
  const handleExportarPdf = () => {
    if (vendasFiltradas.length === 0) {
      toast.error("Nenhuma venda disponível para gerar PDF.");
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const nomeLoja = companyDetails?.nome || "LifeSurf ERP - Caixa Loja";

      // Cabeçalho Corporativo
      doc.setFillColor(9, 13, 22);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(nomeLoja.toUpperCase(), 14, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(186, 230, 253);
      doc.text("RELATÓRIO DE FECHAMENTO & OPERAÇÕES DE CAIXA DA LOJA", 14, 21);

      const agora = new Date().toLocaleString("pt-BR");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Emitido em: ${agora}`, pageWidth - 14, 21, { align: "right" });

      // Bloco de Totais
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMO CONSOLIDADO DO PERÍODO:", 14, 38);

      const kpiData = [
        ["Total Faturado:", formatCurrency(totais.totalFaturado), "Vendas Realizadas:", `${totais.qtdVendas} pedidos`],
        ["Ticket Médio:", formatCurrency(totais.ticketMedio), "Total PIX:", formatCurrency(totais.totalPix)],
        ["Total Dinheiro:", formatCurrency(totais.totalDinheiro), "Total Cartão:", formatCurrency(totais.totalCartao)]
      ];

      autoTable(doc, {
        startY: 42,
        body: kpiData,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: "bold", textColor: [71, 85, 105], width: 35 },
          1: { fontStyle: "bold", textColor: [2, 132, 199], width: 45 },
          2: { fontStyle: "bold", textColor: [71, 85, 105], width: 45 },
          3: { fontStyle: "bold", textColor: [16, 185, 129], width: 45 }
        }
      });

      // Tabela de Vendas
      const tableRows = vendasFiltradas.map((v) => {
        const itensResumo = Array.isArray(v.itens)
          ? v.itens.map((i) => `${i.quantidade}x ${i.nome}${i.tamanho ? ` (${i.tamanho})` : ""}`).join(", ")
          : "Nenhum item";

        return [
          v.numeroVenda || v.id?.substring(0, 8),
          v.dataHoraFormatada || "-",
          v.cliente?.nome || "Consumidor Final",
          (v.formaPagamento || "dinheiro").toUpperCase(),
          v.operador || "Caixa",
          itensResumo.length > 40 ? itensResumo.substring(0, 37) + "..." : itensResumo,
          formatCurrency(v.total)
        ];
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Nº Venda", "Data/Hora", "Cliente", "Pagamento", "Operador", "Itens", "Total"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [2, 132, 199],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5
        },
        columnStyles: {
          0: { fontStyle: "bold" },
          6: { fontStyle: "bold", halign: "right", textColor: [2, 132, 199] }
        }
      });

      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${pageCount} • Sistema ERP LifeSurf`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(`extrato_caixa_loja_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Relatório PDF gerado e baixado com sucesso!");
    } catch (err) {
      console.error("[CaixaLoja] Erro ao gerar PDF:", err);
      toast.error("Falha ao exportar PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            Caixa Loja
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Centralização operacional de todas as vendas do PDV, operador, forma de pagamento, edições e extratos.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarVendas}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-4 h-4 text-slate-400" />}
          >
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
          >
            Exportar CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportarPdf}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold"
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Baixar Relatório (PDF)
          </Button>
        </div>
      </div>

      {/* Cards de Resumo / KPIs do Caixa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="subtle" className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Faturado</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(totais.totalFaturado)}
          </div>
          <div className="text-[11px] text-slate-400">
            {totais.qtdVendas} vendas computadas
          </div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Ticket Médio</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-400 font-mono">
            {formatCurrency(totais.ticketMedio)}
          </div>
          <div className="text-[11px] text-slate-400">Média por atendimento</div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Recebimentos PIX</span>
            <QrCode className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-400 font-mono">
            {formatCurrency(totais.totalPix)}
          </div>
          <div className="text-[11px] text-slate-400">
            Dinheiro: {formatCurrency(totais.totalDinheiro)}
          </div>
        </Card>

        <Card variant="subtle" className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Cartões (Déb/Créd)</span>
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-400 font-mono">
            {formatCurrency(totais.totalCartao)}
          </div>
          <div className="text-[11px] text-slate-400">
            A Prazo: {formatCurrency(totais.totalPrazo)}
          </div>
        </Card>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <Card className="p-4 border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Buscar por nº da venda, cliente, operador ou produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div>
            <Select
              value={filtroPagamento}
              onChange={(e) => setFiltroPagamento(e.target.value)}
            >
              <option value="TODOS">Forma de Pagamento (Todas)</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="prazo">A Prazo (Fiado)</option>
            </Select>
          </div>

          <div>
            <Input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              placeholder="Filtrar por data"
            />
          </div>
        </div>
      </Card>

      {/* Tabela de Vendas do Caixa Loja */}
      <Card className="border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Venda</TableHead>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Itens / Produtos</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasFiltradas.map((venda) => {
                const itensCount = Array.isArray(venda.itens)
                  ? venda.itens.reduce((acc, i) => acc + (Number(i.quantidade) || 1), 0)
                  : 0;

                return (
                  <TableRow key={venda.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-sky-400 text-xs">
                        <Receipt className="w-3.5 h-3.5" />
                        <span>#{venda.numeroVenda || venda.id.substring(0, 8)}</span>
                      </div>
                      {venda.semBaixaEstoque && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mt-0.5">
                          <Zap className="w-2.5 h-2.5" /> Sem Baixa
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-300">
                        {venda.dataHoraFormatada || "-"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-white text-xs">
                        {venda.cliente?.nome || "Consumidor Final"}
                      </div>
                      {venda.cliente?.telefone && (
                        <div className="text-[10px] text-slate-400">
                          {venda.cliente.telefone}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="neutral" size="sm">
                        <User className="w-3 h-3 mr-1" />
                        {venda.operador || "Caixa"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          venda.formaPagamento === "pix"
                            ? "info"
                            : venda.formaPagamento === "dinheiro"
                            ? "success"
                            : venda.formaPagamento === "prazo"
                            ? "warning"
                            : "purple"
                        }
                        size="sm"
                      >
                        {(venda.formaPagamento || "dinheiro").toUpperCase()}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <button
                        type="button"
                        onClick={() => {
                          setVendaSelecionada(venda);
                          setModalItensAberto(true);
                        }}
                        className="text-xs text-sky-400 hover:text-sky-300 underline font-medium cursor-pointer inline-flex items-center gap-1"
                        title="Ver produtos desta venda"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{itensCount} item(ns)</span>
                      </button>
                    </TableCell>

                    <TableCell>
                      <div className="font-mono font-extrabold text-sm text-emerald-400">
                        {formatCurrency(venda.total)}
                      </div>
                      {venda.desconto > 0 && (
                        <div className="text-[10px] text-slate-400">
                          Desc: -{formatCurrency(venda.desconto)}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleReimprimirCupom(venda)}
                          title="Reimprimir Cupom Térmico (80mm)"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-300" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleAbrirEditar(venda)}
                          title="Editar Venda"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => handleAbrirExcluir(venda)}
                          title="Excluir Registro de Venda"
                          className="hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {vendasFiltradas.length === 0 && !loading && (
                <TableEmpty
                  title="Nenhuma venda encontrada"
                  description="Realize vendas no PDV ou ajuste os filtros de pesquisa para visualizar os registros."
                  colSpan={8}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* MODAL 1: EDITAR REGISTRO DE VENDA */}
      <Modal isOpen={modalEditarAberto} onClose={() => setModalEditarAberto(false)} size="md">
        <form onSubmit={handleSalvarEdicao}>
          <ModalHeader
            title={`Editar Venda #${vendaEditando?.numeroVenda || ""}`}
            description="Atualize o operador, nome do cliente, forma de pagamento ou observações do registro."
            onClose={() => setModalEditarAberto(false)}
          />
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome do Cliente *"
                required
                value={formEditar.clienteNome}
                onChange={(e) => setFormEditar({ ...formEditar, clienteNome: e.target.value })}
              />

              <Input
                label="Operador / Vendedor *"
                required
                value={formEditar.operador}
                onChange={(e) => setFormEditar({ ...formEditar, operador: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Forma de Pagamento *"
                value={formEditar.formaPagamento}
                onChange={(e) => setFormEditar({ ...formEditar, formaPagamento: e.target.value })}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="prazo">A Prazo (A Ver / Fiado)</option>
              </Select>

              <Input
                label="Desconto Aplicado (R$)"
                type="number"
                step="0.01"
                min="0"
                value={formEditar.desconto}
                onChange={(e) => setFormEditar({ ...formEditar, desconto: e.target.value })}
              />
            </div>

            <Input
              label="Observações da Venda"
              placeholder="Ex: Retirada no balcão, pagamento em 2 vezes..."
              value={formEditar.observacoes}
              onChange={(e) => setFormEditar({ ...formEditar, observacoes: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setModalEditarAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={salvandoEdicao}
              className="bg-sky-600 text-white font-bold"
            >
              Salvar Alterações
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO DE VENDA */}
      <Modal isOpen={modalExcluirAberto} onClose={() => setModalExcluirAberto(false)} size="sm">
        <ModalHeader
          title="Excluir Registro de Venda"
          description="Atenção: esta ação removerá o registro do caixa e do faturamento."
          onClose={() => setModalExcluirAberto(false)}
        />
        <ModalBody className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-1">
                Deseja realmente apagar a Venda #{vendaExcluindo?.numeroVenda}?
              </p>
              <p>
                Valor: <strong>{formatCurrency(vendaExcluindo?.total)}</strong>
                {" • "}
                Cliente: <strong>{vendaExcluindo?.cliente?.nome || "Consumidor Final"}</strong>
              </p>
            </div>
          </div>

          {!vendaExcluindo?.semBaixaEstoque && (
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-900 border border-slate-800">
              <input
                type="checkbox"
                checked={restaurarEstoque}
                onChange={(e) => setRestaurarEstoque(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 cursor-pointer"
              />
              <span>
                Devolver e estornar automaticamente os itens vendidos ao Estoque da Loja.
              </span>
            </label>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" type="button" onClick={() => setModalExcluirAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            isLoading={excluindo}
            onClick={handleConfirmarExclusao}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
          >
            Confirmar Exclusão
          </Button>
        </ModalFooter>
      </Modal>

      {/* MODAL 3: ITENS DETALHADOS DA VENDA */}
      <Modal isOpen={modalItensAberto} onClose={() => setModalItensAberto(false)} size="md">
        <ModalHeader
          title={`Itens da Venda #${vendaSelecionada?.numeroVenda || ""}`}
          description={`Cliente: ${vendaSelecionada?.cliente?.nome || "Consumidor"} • Total: ${formatCurrency(vendaSelecionada?.total)}`}
          onClose={() => setModalItensAberto(false)}
        />
        <ModalBody className="space-y-3">
          <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
            {vendaSelecionada?.itens?.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{item.nome}</div>
                  <div className="text-[11px] text-slate-400">
                    Tamanho: <span className="text-sky-400 font-mono font-bold">{item.tamanho || "U"}</span>
                    {" • "}
                    Qtd: <span className="text-white font-bold">{item.quantidade}x</span>
                    {" • "}
                    Unit: {formatCurrency(item.precoUnitario || item.precoVarejo)}
                  </div>
                </div>
                <div className="font-mono font-bold text-emerald-400 text-sm">
                  {formatCurrency((Number(item.quantidade) || 1) * (Number(item.precoUnitario || item.precoVarejo) || 0))}
                </div>
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalItensAberto(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
