import { useState, useEffect, useMemo } from "react";
import { useTenant } from "../contexts/TenantContext";
import { fetchStockProducts } from "../services/stockService";
import {
  TEMPLATES_ETIQUETA,
  generateBarcodeSVG,
  printLabels
} from "../services/labelService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { formatCurrency } from "../utils/formatters";
import { cn } from "../utils/cn";
import {
  Tag,
  Printer,
  Barcode,
  Layers,
  Sparkles,
  Scissors,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  Copy
} from "lucide-react";

export default function Etiquetas() {
  const { activeTenantId } = useTenant();

  const [produtos, setProdutos] = useState([]);
  const [templateSelecionado, setTemplateSelecionado] = useState("TAG_ROUPA");
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");

  // Dados da Etiqueta Editável
  const [nomeProduto, setNomeProduto] = useState("Camiseta Silk Waves Classic");
  const [referencia, setReferencia] = useState("CAM-001");
  const [tamanho, setTamanho] = useState("G");
  const [cor, setCor] = useState("Preto");
  const [precoVarejo, setPrecoVarejo] = useState("89.90");
  const [precoAtacado, setPrecoAtacado] = useState("59.90");
  const [codigoBarras, setCodigoBarras] = useState("7898523691234");
  const [exibirAtacado, setExibirAtacado] = useState(false);
  const [copias, setCopias] = useState(1);

  // Carregar produtos da loja para seleção rápida
  useEffect(() => {
    if (!activeTenantId) return;
    fetchStockProducts(activeTenantId, "loja", 50).then((data) => {
      setProdutos(data);
    });
  }, [activeTenantId]);

  // Ao selecionar um produto da lista
  const handleSelecionarProduto = (id) => {
    setProdutoSelecionadoId(id);
    const prod = produtos.find((p) => p.id === id);
    if (prod) {
      setNomeProduto(prod.nome || "");
      setReferencia(prod.referencia || "001");
      setPrecoVarejo(prod.precoVarejo ? String(prod.precoVarejo) : "89.90");
      setPrecoAtacado(prod.precoAtacado ? String(prod.precoAtacado) : "59.90");
      setCodigoBarras(prod.codigoBarras || `789${Math.floor(1000000000 + Math.random() * 9000000000)}`);
      if (prod.gradeTamanhos) {
        const tams = Object.keys(prod.gradeTamanhos);
        if (tams.length > 0) setTamanho(tams[0]);
      }
    }
  };

  const gerarNovoCodigoBarras = () => {
    setCodigoBarras(`789${Math.floor(1000000000 + Math.random() * 9000000000)}`);
  };

  const templateAtual = TEMPLATES_ETIQUETA[templateSelecionado] || TEMPLATES_ETIQUETA.TAG_ROUPA;

  const handleImprimir = () => {
    printLabels(
      {
        marca: "LIFESURF",
        nome: nomeProduto,
        referencia,
        tamanho,
        cor,
        precoVarejo,
        precoAtacado,
        codigoBarras,
        exibirAtacado
      },
      templateSelecionado,
      Math.max(1, parseInt(copias, 10) || 1)
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info" size="sm" withDot={true}>
              Editor de Etiquetas Estilo BarTender
            </Badge>
            <span className="text-xs text-slate-400">
              Templates de Tags Térmicas, Gôndola e Código de Barras
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Emissor de Etiquetas Térmicas
          </h1>
          <p className="text-xs text-slate-400">
            Personalize tags para roupas com grade, código de barras e envie para impressoras Zebra, Elgin ou Argox.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleImprimir}
          leftIcon={<Printer className="w-4 h-4" />}
          className="shadow-lg shadow-sky-500/20"
        >
          Imprimir Etiquetas ({copias}x)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Customização dos Dados da Etiqueta */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Seleção do Template de Etiqueta
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.values(TEMPLATES_ETIQUETA).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateSelecionado(tpl.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    templateSelecionado === tpl.id
                      ? "bg-sky-500/15 border-sky-400 text-white ring-1 ring-sky-400"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
                  )}
                >
                  <strong className="text-xs font-bold text-white block">{tpl.nome}</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                    {tpl.descricao}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. Conteúdo da Etiqueta
                </h3>
              </div>

              {/* Puxar do estoque existente */}
              {produtos.length > 0 && (
                <select
                  value={produtoSelecionadoId}
                  onChange={(e) => handleSelecionarProduto(e.target.value)}
                  className="bg-slate-900 text-sky-400 text-xs rounded-lg px-2.5 py-1 border border-slate-800 focus:outline-none"
                >
                  <option value="">+ Puxar do Estoque</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <Input
                label="Nome do Produto / Descrição"
                required
                value={nomeProduto}
                onChange={(e) => setNomeProduto(e.target.value)}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Referência"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
                <Input
                  label="Tamanho"
                  value={tamanho}
                  onChange={(e) => setTamanho(e.target.value)}
                />
                <Input
                  label="Cor"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Preço de Varejo (R$)"
                  type="number"
                  step="0.01"
                  value={precoVarejo}
                  onChange={(e) => setPrecoVarejo(e.target.value)}
                />
                <Input
                  label="Preço de Atacado (R$)"
                  type="number"
                  step="0.01"
                  value={precoAtacado}
                  onChange={(e) => setPrecoAtacado(e.target.value)}
                />
              </div>

              {/* Código de barras com gerador */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Código de Barras (EAN / Numérico):
                </label>
                <div className="flex gap-2">
                  <Input
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    className="flex-1 font-mono"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={gerarNovoCodigoBarras}
                    title="Gerar código aleatório"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Gerar
                  </Button>
                </div>
              </div>

              {/* Toggles e Cópias */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={exibirAtacado}
                    onChange={(e) => setExibirAtacado(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500"
                  />
                  <span>Imprimir Preço de Atacado na Etiqueta</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Cópias:</span>
                  <input
                    type="number"
                    min="1"
                    value={copias}
                    onChange={(e) => setCopias(e.target.value)}
                    className="w-16 h-8 text-center font-bold font-mono bg-slate-950 text-white rounded border border-slate-800"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Painel Direito: Pré-Visualização ao Vivo Estilo BarTender */}
        <div className="lg:col-span-6">
          <Card className="p-5 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Pré-visualização Térmica ao Vivo
                </h3>
              </div>
              <Badge variant="neutral" size="sm">
                Dimensões: {templateAtual.larguraMm}x{templateAtual.alturaMm}mm
              </Badge>
            </div>

            {/* Simulação da Etiqueta com proporções reais */}
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-950/90 rounded-2xl border border-slate-900">
              <div
                className="bg-white text-black rounded-lg shadow-2xl p-4 flex flex-col justify-between text-center transition-all select-none border border-slate-300 relative"
                style={{
                  width: `${templateAtual.larguraMm * 5.2}px`,
                  minHeight: `${templateAtual.alturaMm * 5.2}px`
                }}
              >
                {templateAtual.tipo === "tag_furo" && (
                  <div className="w-4 h-4 rounded-full border-2 border-dashed border-slate-400 mx-auto mb-2" />
                )}

                {/* Topo: Marca com Logo Oficial */}
                <div>
                  <img
                    src="/assets/logo-black.png"
                    alt="LifeSurf"
                    className="h-6 w-auto max-w-[110px] mx-auto object-contain mb-1 select-none"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling.style.display = "block";
                    }}
                  />
                  <div className="font-black text-sm tracking-widest uppercase">LIFESURF</div>
                  <div className="text-[9px] text-slate-500 uppercase font-semibold">
                    Original Surfwear
                  </div>
                  <h4 className="font-bold text-xs mt-2 leading-tight line-clamp-2">
                    {nomeProduto}
                  </h4>
                </div>

                {/* Centro: Grade, Cor e Ref */}
                <div className="my-3 py-2 border-y-2 border-black flex justify-around items-center">
                  <div>
                    <span className="text-[8px] uppercase text-slate-600 block">Tam</span>
                    <strong className="text-base font-black font-mono">{tamanho}</strong>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-slate-600 block">Cor</span>
                    <span className="text-[10px] font-bold">{cor}</span>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-slate-600 block">Ref</span>
                    <span className="text-[10px] font-mono">{referencia}</span>
                  </div>
                </div>

                {/* Preço */}
                <div className="my-1">
                  <span className="text-[8px] uppercase text-slate-600 block">Preço à Vista</span>
                  <div className="text-xl font-black tracking-tight text-slate-900">
                    R$ {Number(precoVarejo || 0).toFixed(2).replace(".", ",")}
                  </div>
                  {exibirAtacado && precoAtacado && (
                    <div className="text-[9px] text-slate-600 font-bold mt-0.5">
                      Atacado: R$ {Number(precoAtacado).toFixed(2).replace(".", ",")}
                    </div>
                  )}
                </div>

                {/* Código de barras vetorial */}
                <div className="mt-2 pt-2 border-t border-slate-300">
                  <div
                    className="flex justify-center"
                    dangerouslySetInnerHTML={{
                      __html: generateBarcodeSVG(codigoBarras, 170, 36)
                    }}
                  />
                  <span className="text-[9px] font-mono tracking-widest block mt-0.5 text-slate-800">
                    {codigoBarras}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleImprimir}
              leftIcon={<Printer className="w-4 h-4" />}
              className="w-full h-11 text-xs font-bold"
            >
              Imprimir {copias} Etiqueta(s) Agora
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
