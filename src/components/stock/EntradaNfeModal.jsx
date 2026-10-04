import { useState, useMemo } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Badge } from "../ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/Table";
import {
  CATEGORIAS_MODA,
  TAMANHOS_LETRAS,
  calculateGradeTotal,
  registerPurchaseInvoice
} from "../../services/stockService";
import { formatCurrency } from "../../utils/formatters";
import {
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Barcode,
  Truck,
  CheckCircle2,
  Layers,
  ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";

export default function EntradaNfeModal({
  isOpen,
  onClose,
  tenantId,
  produtosExistentes = [],
  userAuth,
  onSuccess
}) {
  const [salvando, setSalvando] = useState(false);

  // Dados do Cabeçalho da NF-e
  const [numeroNota, setNumeroNota] = useState("");
  const [serie, setSerie] = useState("1");
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().split("T")[0]);
  const [destinoEstoque, setDestinoEstoque] = useState("loja");
  const [valorFrete, setValorFrete] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Dados do Item Sendo Adicionado
  const [modoItem, setModoItem] = useState("existente"); // "existente" | "novo"
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
  const [itemNome, setItemNome] = useState("");
  const [itemReferencia, setItemReferencia] = useState("");
  const [itemCategoria, setItemCategoria] = useState("Camiseta");
  const [itemCustoUnitario, setItemCustoUnitario] = useState("");
  const [itemMarkup, setItemMarkup] = useState("100"); // % markup
  const [itemGrade, setItemGrade] = useState({ P: 5, M: 10, G: 10, GG: 5 });

  // Lista de Itens na Nota
  const [itensNota, setItensNota] = useState([]);

  // Gera chave de acesso simulada padrão SEFAZ (44 dígitos numéricos)
  const gerarChaveAcessoSimulada = () => {
    const uf = "23"; // CE
    const aamm = "2610";
    const cnpjLimpo = (fornecedorCnpj || "07892123000144").replace(/\D/g, "").padStart(14, "0").slice(0, 14);
    const mod = "55";
    const ser = serie.padStart(3, "0");
    const num = (numeroNota || Math.floor(1000 + Math.random() * 9000)).toString().padStart(9, "0");
    const tipoEmis = "1";
    const codigoAleatorio = Math.floor(10000000 + Math.random() * 90000000).toString();
    const dv = "8";
    const chave = `${uf}${aamm}${cnpjLimpo}${mod}${ser}${num}${tipoEmis}${codigoAleatorio}${dv}`;
    setChaveAcesso(chave);
    toast.success("Chave de Acesso NF-e gerada!");
  };

  // Quando seleciona produto existente
  const handleSelecionarProdutoExistente = (prodId) => {
    setProdutoSelecionadoId(prodId);
    const prod = produtosExistentes.find((p) => p.id === prodId);
    if (prod) {
      setItemNome(prod.nome || "");
      setItemReferencia(prod.referencia || "");
      setItemCategoria(prod.categoria || "Camiseta");
      if (prod.custoUnitario) {
        setItemCustoUnitario(prod.custoUnitario.toString());
      }
    }
  };

  const precoVarejoCalculado = useMemo(() => {
    const custo = Number(itemCustoUnitario) || 0;
    const markup = Number(itemMarkup) || 100;
    return (custo * (1 + markup / 100)).toFixed(2);
  }, [itemCustoUnitario, itemMarkup]);

  const precoAtacadoCalculado = useMemo(() => {
    const custo = Number(itemCustoUnitario) || 0;
    const markup = Number(itemMarkup) || 100;
    return (custo * (1 + (markup * 0.6) / 100)).toFixed(2);
  }, [itemCustoUnitario, itemMarkup]);

  const totalPecasItemAtual = useMemo(() => {
    return calculateGradeTotal(itemGrade);
  }, [itemGrade]);

  const handleAdicionarItem = (e) => {
    e.preventDefault();
    if (!itemNome.trim()) {
      toast.error("Informe o nome do produto");
      return;
    }
    const custo = Number(itemCustoUnitario);
    if (!custo || custo <= 0) {
      toast.error("Informe um custo unitário válido");
      return;
    }
    if (totalPecasItemAtual <= 0) {
      toast.error("Informe as quantidades na grade de tamanhos");
      return;
    }

    const novoItem = {
      id: `item-${Date.now()}`,
      produtoId: modoItem === "existente" ? produtoSelecionadoId : null,
      nome: itemNome.trim(),
      referencia: itemReferencia.trim(),
      categoria: itemCategoria,
      custoUnitario: custo,
      precoVarejoSugerido: Number(precoVarejoCalculado),
      precoAtacadoSugerido: Number(precoAtacadoCalculado),
      quantidade: totalPecasItemAtual,
      gradeTamanhos: { ...itemGrade },
      subtotal: custo * totalPecasItemAtual
    };

    setItensNota((prev) => [...prev, novoItem]);
    toast.success(`Item "${itemNome}" adicionado à NF!`);

    // Limpa campos do item
    setItemNome("");
    setItemReferencia("");
    setItemCustoUnitario("");
    setProdutoSelecionadoId("");
    setItemGrade({ P: 0, M: 0, G: 0, GG: 0 });
  };

  const handleRemoverItem = (id) => {
    setItensNota((prev) => prev.filter((i) => i.id !== id));
  };

  // Cálculos da Nota
  const totalPecasNota = useMemo(() => {
    return itensNota.reduce((acc, curr) => acc + curr.quantidade, 0);
  }, [itensNota]);

  const totalProdutosValor = useMemo(() => {
    return itensNota.reduce((acc, curr) => acc + curr.subtotal, 0);
  }, [itensNota]);

  const totalNotaComFrete = useMemo(() => {
    return totalProdutosValor + (Number(valorFrete) || 0);
  }, [totalProdutosValor, valorFrete]);

  // Submissão da Entrada
  const handleProcessarEntrada = async () => {
    if (!numeroNota.trim()) {
      toast.error("Preencha o número da Nota Fiscal");
      return;
    }
    if (!fornecedorNome.trim()) {
      toast.error("Informe o nome do Fornecedor");
      return;
    }
    if (itensNota.length === 0) {
      toast.error("Adicione ao menos um produto à nota de compra");
      return;
    }

    setSalvando(true);
    try {
      await registerPurchaseInvoice(
        tenantId,
        {
          numeroNota: numeroNota.trim(),
          serie: serie.trim() || "1",
          chaveAcesso: chaveAcesso.trim() || `352610${Date.now()}`,
          fornecedorNome: fornecedorNome.trim(),
          fornecedorCnpj: fornecedorCnpj.trim(),
          dataEmissao,
          destinoEstoque,
          valorTotalNota: totalNotaComFrete,
          valorFrete: Number(valorFrete) || 0,
          observacoes,
          itens: itensNota
        },
        userAuth
      );

      toast.success(`Nota de Compra #${numeroNota} processada com sucesso no estoque!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("[EntradaNfeModal] Erro ao registrar NF-e:", err);
      toast.error(err.message || "Erro ao registrar nota de compra");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader
        title="Entrada por Nota Fiscal de Compra (NF-e)"
        description="Alimente o estoque em lote com fornecedor, chave da nota, atualização de custo médio e rastreabilidade total."
        onClose={onClose}
      />

      <ModalBody className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Bloco 1: Dados da Nota Fiscal e Fornecedor */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>Dados da Nota & Emitente</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input
              label="Número da NF *"
              placeholder="Ex: 004820"
              value={numeroNota}
              onChange={(e) => setNumeroNota(e.target.value)}
              required
            />

            <Input
              label="Série"
              placeholder="1"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
            />

            <Input
              label="Data de Emissão"
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
            />

            <Select
              label="Destino no Estoque"
              value={destinoEstoque}
              onChange={(e) => setDestinoEstoque(e.target.value)}
            >
              <option value="loja">Estoque Loja (Balcão)</option>
              <option value="fabrica">Estoque Fábrica (Central)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Fornecedor / Razão Social *"
                placeholder="Ex: Têxtil Ceará Confecções Ltda"
                value={fornecedorNome}
                onChange={(e) => setFornecedorNome(e.target.value)}
                required
              />
            </div>
            <Input
              label="CNPJ do Fornecedor"
              placeholder="00.000.000/0001-00"
              value={fornecedorCnpj}
              onChange={(e) => setFornecedorCnpj(e.target.value)}
            />
          </div>

          {/* Chave de Acesso com gerador automático */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Chave de Acesso (44 dígitos da NF-e)
              </label>
              <button
                type="button"
                onClick={gerarChaveAcessoSimulada}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer transition-colors"
              >
                <Sparkles className="w-3 h-3" /> Gerar Chave Simulada
              </button>
            </div>
            <Input
              placeholder="23261007892123000144550010000048201987654321..."
              value={chaveAcesso}
              onChange={(e) => setChaveAcesso(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Bloco 2: Adicionar Itens à Nota */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Adicionar Produto à Nota</span>
            </div>

            {/* Alternador Existente vs Novo */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setModoItem("existente")}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  modoItem === "existente"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Produto Cadastrado
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoItem("novo");
                  setProdutoSelecionadoId("");
                }}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  modoItem === "novo"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                + Novo Produto
              </button>
            </div>
          </div>

          {modoItem === "existente" && (
            <Select
              label="Selecione o Produto do Catálogo"
              value={produtoSelecionadoId}
              onChange={(e) => handleSelecionarProdutoExistente(e.target.value)}
            >
              <option value="">-- Escolha um produto para dar entrada --</option>
              {produtosExistentes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.referencia || "S/Ref"}) - Saldo Atual: {p.estoqueTotal || 0} un
                </option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Descrição do Produto"
              placeholder="Ex: Camiseta Classic Surf waves"
              value={itemNome}
              onChange={(e) => setItemNome(e.target.value)}
              required
            />
            <Input
              label="Referência / Código"
              placeholder="Ex: CAM-001"
              value={itemReferencia}
              onChange={(e) => setItemReferencia(e.target.value)}
            />
            <Select
              label="Categoria"
              value={itemCategoria}
              onChange={(e) => setItemCategoria(e.target.value)}
            >
              {CATEGORIAS_MODA.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>

          {/* Custos e Formação de Preço */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <Input
              label="Custo Unitário da NF (R$) *"
              type="number"
              step="0.01"
              placeholder="45.00"
              value={itemCustoUnitario}
              onChange={(e) => setItemCustoUnitario(e.target.value)}
              required
            />
            <Input
              label="Markup Desejado (%)"
              type="number"
              placeholder="100"
              value={itemMarkup}
              onChange={(e) => setItemMarkup(e.target.value)}
            />
            <div className="flex flex-col justify-center">
              <span className="text-[11px] text-slate-400">Preço Varejo Sugerido:</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {formatCurrency(precoVarejoCalculado)}
              </span>
              <span className="text-[10px] text-slate-500">
                Atacado: {formatCurrency(precoAtacadoCalculado)}
              </span>
            </div>
          </div>

          {/* Grade de Tamanhos do Item */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                Distribuição por Tamanho (Grade de Confecção):
              </span>
              <span className="font-bold text-sky-400 font-mono">
                Total deste Item: {totalPecasItemAtual} un
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {TAMANHOS_LETRAS.slice(0, 8).map((tam) => (
                <div key={tam} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[11px] font-mono font-bold text-slate-400 block">{tam}</span>
                  <input
                    type="number"
                    min="0"
                    value={itemGrade[tam] || 0}
                    onChange={(e) =>
                      setItemGrade((prev) => ({
                        ...prev,
                        [tam]: Math.max(0, parseInt(e.target.value, 10) || 0)
                      }))
                    }
                    className="w-full bg-slate-950 text-white rounded mt-1 text-center font-bold text-xs h-7 border border-slate-700 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAdicionarItem}
            className="w-full text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Adicionar Este Item à Nota de Compra
          </Button>
        </div>

        {/* Bloco 3: Lista de Itens Adicionados na Nota */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Itens da Nota ({itensNota.length})
            </h4>
            <span className="text-xs text-slate-400">
              Total de Peças: <strong className="text-white font-mono">{totalPecasNota} un</strong>
            </span>
          </div>

          {itensNota.length > 0 ? (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow isInteractive={false}>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd / Grade</TableHead>
                    <TableHead>Custo Unit.</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensNota.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold text-white">{item.nome}</div>
                        <div className="text-[11px] text-slate-400">
                          Ref: {item.referencia || "S/Ref"} • {item.categoria}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-bold text-white">
                          {item.quantidade} un
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {Object.entries(item.gradeTamanhos)
                            .filter(([, q]) => q > 0)
                            .map(([t, q]) => `${t}:${q}`)
                            .join(" | ")}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-slate-300">
                        {formatCurrency(item.custoUnitario)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-emerald-400">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoverItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remover Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-xs text-slate-500">
              Nenhum item adicionado ainda. Preencha os campos acima e clique em "Adicionar Este Item".
            </div>
          )}
        </div>

        {/* Bloco 4: Frete e Resumo Financeiro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div>
            <Input
              label="Frete / Despesas Acessórias (R$)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={valorFrete}
              onChange={(e) => setValorFrete(e.target.value)}
              leftIcon={<Truck className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="flex flex-col justify-end text-right space-y-1">
            <div className="text-xs text-slate-400">
              Produtos: <span className="font-mono font-semibold text-white">{formatCurrency(totalProdutosValor)}</span>
            </div>
            {Number(valorFrete) > 0 && (
              <div className="text-xs text-slate-400">
                Frete: <span className="font-mono text-white">{formatCurrency(Number(valorFrete))}</span>
              </div>
            )}
            <div className="text-base font-extrabold text-white flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
              <span>Total da Nota:</span>
              <span className="text-emerald-400 font-mono text-lg">
                {formatCurrency(totalNotaComFrete)}
              </span>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleProcessarEntrada}
          isLoading={salvando}
          leftIcon={<CheckCircle2 className="w-4 h-4" />}
          disabled={itensNota.length === 0}
        >
          Confirmar & Processar Entrada no Estoque
        </Button>
      </ModalFooter>
    </Modal>
  );
}
