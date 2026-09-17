import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  runTransaction,
  serverTimestamp 
} from "firebase/firestore";
import { 
  Users, 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Edit, 
  DollarSign, 
  Printer, 
  Home, 
  CheckCircle, 
  Clock, 
  X, 
  ShoppingBag, 
  AlertTriangle 
} from "lucide-react";

const EMAILS_COMPARTILHADOS = ["jarbasantonio201@gmail.com", "lucasesilva438@gmail.com"];
const FORMAS_PAGAMENTO = ["Pix", "Cartão de Débito", "Cartão de Crédito", "Dinheiro"];

export default function Clientes({ cores, usuarioLogado, voltarHome }) {
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [vendasAtacado, setVendasAtacado] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros e Pesquisa
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // "todos" | "ativos" | "inativos" | "abertos"

  // Modais
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null); // null para novo, objeto para edição
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  // Formulário Cliente
  const [formCliente, setFormCliente] = useState({
    nomeResponsavel: "",
    nomeLoja: "",
    cnpj: "",
    telefone: "",
    endereco: "",
    cidade: "",
    observacao: "",
    status: "Ativo"
  });

  // Perfil e Histórico do Cliente
  const [clientePerfil, setClientePerfil] = useState(null);
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);

  // PDV Atacado do Cliente
  const [modalPdvAberto, setModalPdvAberto] = useState(false);
  const [clientePdv, setClientePdv] = useState(null);
  const [carrinhoAtacado, setCarrinhoAtacado] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [tamanhoSelecionadoModal, setTamanhoSelecionadoModal] = useState({});
  const [tipoPagamentoPdv, setTipoPagamentoPdv] = useState("a_receber"); // "pago_agora" | "a_receber"
  const [formaPgPdv, setFormaPgPdv] = useState("Pix");
  const [valorPagoAgoraPdv, setValorPagoAgoraPdv] = useState("");
  const [processandoVenda, setProcessandoVenda] = useState(false);

  // Pagamento Parcial / Conta Corrente
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [vendaParaPagar, setVendaParaPagar] = useState(null);
  const [valorPagoAgoraInput, setValorPagoAgoraInput] = useState("");
  const [formaPgPagamento, setFormaPgPagamento] = useState("Pix");
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Recibo Térmico de Venda Atacado
  const [reciboAtacadoLocal, setReciboAtacadoLocal] = useState(null);

  const isCompartilhado = usuarioLogado?.email && EMAILS_COMPARTILHADOS.includes(usuarioLogado.email);
  const lojaIdAtual = isCompartilhado ? "compartilhado_jarbas_lucas" : (usuarioLogado?.uid || "loja_padrao");
  const operadorEmail = usuarioLogado?.email || "@sistema";

  const inputStyle = {
    width: "100%",
    padding: "10px",
    background: cores.inputBg || cores.bgCard || "transparent",
    border: `1px solid ${cores.borda}`,
    color: cores.texto,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "13px",
    outline: "none"
  };

  // Carregar Dados do Firestore
  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      const [snapCli, snapProd, snapVendas] = await Promise.all([
        getDocs(collection(db, "clientes_atacado")),
        getDocs(collection(db, "produtos")),
        getDocs(collection(db, "vendas_atacado"))
      ]);

      const listaCli = snapCli.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => !c.lojaId || c.lojaId === lojaIdAtual);

      const listaProd = snapProd.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.lojaId || p.lojaId === lojaIdAtual);

      const listaVendas = snapVendas.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => !v.lojaId || v.lojaId === lojaIdAtual);

      setClientes(listaCli);
      setProdutos(listaProd);
      setVendasAtacado(listaVendas);
    } catch (err) {
      console.error("Erro ao carregar dados de clientes atacado:", err);
    } finally {
      setCarregando(false);
    }
  }, [lojaIdAtual]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Fechar modais com ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setModalCadastroAberto(false);
        setModalPerfilAberto(false);
        setModalPdvAberto(false);
        setModalPagamentoAberto(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Consolidação Financeira por Cliente
  const clientesComFinanceiro = useMemo(() => {
    return clientes.map(cli => {
      const vendasDoCliente = vendasAtacado.filter(v => v.clienteId === cli.id && v.status !== "devolvido");
      let totalComprado = 0;
      let totalPago = 0;
      let totalEmAberto = 0;

      vendasDoCliente.forEach(v => {
        const vTotal = Number(v.valorTotal || 0);
        const vPago = Number(v.valorPago || 0);
        totalComprado += vTotal;
        totalPago += vPago;
        if (v.status !== "pago") {
          totalEmAberto += Math.max(0, vTotal - vPago);
        }
      });

      return {
        ...cli,
        totalComprado,
        totalPago,
        totalEmAberto,
        vendas: vendasAtacado.filter(v => v.clienteId === cli.id)
      };
    });
  }, [clientes, vendasAtacado]);

  // Resumo Geral do Topo
  const resumoGeral = useMemo(() => {
    let ativos = 0;
    let emAbertoTotal = 0;
    let vendidoTotal = 0;

    clientesComFinanceiro.forEach(c => {
      if (c.status === "Ativo") ativos++;
      emAbertoTotal += c.totalEmAberto;
      vendidoTotal += c.totalComprado;
    });

    return {
      totalCadastrados: clientes.length,
      ativos,
      emAbertoTotal,
      vendidoTotal
    };
  }, [clientes, clientesComFinanceiro]);

  // Filtragem de Clientes
  const clientesFiltrados = useMemo(() => {
    return clientesComFinanceiro.filter(c => {
      const termo = busca.toLowerCase();
      const matchBusca = 
        (c.nomeResponsavel || "").toLowerCase().includes(termo) ||
        (c.nomeLoja || "").toLowerCase().includes(termo) ||
        (c.cnpj || "").toLowerCase().includes(termo) ||
        (c.telefone || "").toLowerCase().includes(termo) ||
        (c.cidade || "").toLowerCase().includes(termo);

      if (!matchBusca) return false;

      if (filtroStatus === "ativos") return c.status === "Ativo";
      if (filtroStatus === "inativos") return c.status === "Inativo";
      if (filtroStatus === "abertos") return c.totalEmAberto > 0;

      return true;
    });
  }, [clientesComFinanceiro, busca, filtroStatus]);

  // Manipulação do Cadastro de Cliente
  function abrirModalNovoCliente() {
    setClienteEditando(null);
    setFormCliente({
      nomeResponsavel: "",
      nomeLoja: "",
      cnpj: "",
      telefone: "",
      endereco: "",
      cidade: "",
      observacao: "",
      status: "Ativo"
    });
    setModalCadastroAberto(true);
  }

  function abrirModalEditarCliente(cli) {
    setClienteEditando(cli);
    setFormCliente({
      nomeResponsavel: cli.nomeResponsavel || "",
      nomeLoja: cli.nomeLoja || "",
      cnpj: cli.cnpj || "",
      telefone: cli.telefone || "",
      endereco: cli.endereco || "",
      cidade: cli.cidade || "",
      observacao: cli.observacao || "",
      status: cli.status || "Ativo"
    });
    setModalCadastroAberto(true);
  }

  async function salvarCliente(e) {
    e.preventDefault();
    if (salvandoCliente) return;

    const cnpjLimpo = formCliente.cnpj.trim();
    if (cnpjLimpo) {
      const duplicado = clientes.find(c => c.cnpj?.trim() === cnpjLimpo && c.id !== clienteEditando?.id);
      if (duplicado) {
        alert("Já existe um cliente cadastrado com este CNPJ.");
        return;
      }
    }

    setSalvandoCliente(true);
    try {
      const clienteId = clienteEditando ? clienteEditando.id : doc(collection(db, "clientes_atacado")).id;
      const clienteData = {
        ...formCliente,
        lojaId: lojaIdAtual,
        atualizadoEm: serverTimestamp()
      };

      if (!clienteEditando) {
        clienteData.criadoEm = serverTimestamp();
      }

      await setDoc(doc(db, "clientes_atacado", clienteId), clienteData, { merge: true });
      alert(clienteEditando ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!");
      setModalCadastroAberto(false);
      await carregarDados();
    } catch (err) {
      alert("Erro ao salvar cliente: " + err.message);
    } finally {
      setSalvandoCliente(false);
    }
  }

  async function excluirCliente(id) {
    if (!confirm("Tem certeza que deseja excluir este cliente? O histórico de vendas associado poderá ficar órfão.")) return;
    try {
      await deleteDoc(doc(db, "clientes_atacado", id));
      alert("Cliente excluído com sucesso!");
      await carregarDados();
    } catch (err) {
      alert("Erro ao excluir cliente: " + err.message);
    }
  }

  // Abertura do PDV Atacado para o Cliente
  function abrirPdvAtacado(cli) {
    setClientePdv(cli);
    setCarrinhoAtacado([]);
    setBuscaProduto("");
    setTamanhoSelecionadoModal({});
    setTipoPagamentoPdv("a_receber");
    setFormaPgPdv("Pix");
    setValorPagoAgoraPdv("");
    setModalPerfilAberto(false);
    setModalPdvAberto(true);
  }

  // Adicionar Produto ao Carrinho Atacado
  function adicionarAoCarrinho(prod, tamanho = null) {
    const precoAtacado = Number(prod.precoAtacado || prod.preco || 0);
    const itemKey = `${prod.id}_${tamanho || 'padrao'}`;

    setCarrinhoAtacado(prev => {
      const index = prev.findIndex(item => item.cartKey === itemKey);
      if (index >= 0) {
        const copia = [...prev];
        copia[index].quantidade += 1;
        return copia;
      } else {
        return [...prev, {
          cartKey: itemKey,
          id: prod.id,
          nome: prod.nome || prod.titulo || "Produto",
          precoUnitario: precoAtacado,
          quantidade: 1,
          tamanhoSelecionado: tamanho,
          estoqueDisponivel: tamanho ? (prod.tamanhos?.[tamanho] ?? prod.estoque ?? 0) : (prod.estoque ?? 0)
        }];
      }
    });
  }

  const subtotalCarrinhoAtacado = useMemo(() => {
    return carrinhoAtacado.reduce((acc, it) => acc + (it.quantidade * it.precoUnitario), 0);
  }, [carrinhoAtacado]);

  // Finalizar Venda Atacado (Com Transação Atômica no Firestore)
  async function finalizarVendaAtacado(e) {
    e.preventDefault();
    if (!clientePdv || carrinhoAtacado.length === 0 || processandoVenda) return;

    let valorPagoNum = 0;
    if (tipoPagamentoPdv === "pago_agora") {
      valorPagoNum = subtotalCarrinhoAtacado;
    } else {
      valorPagoNum = parseFloat(valorPagoAgoraPdv) || 0;
      if (valorPagoNum < 0 || valorPagoNum > subtotalCarrinhoAtacado) {
        alert("O valor pago agora é inválido.");
        return;
      }
    }

    const statusVenda = valorPagoNum >= subtotalCarrinhoAtacado ? "pago" : (valorPagoNum > 0 ? "parcial" : "pendente");

    setProcessandoVenda(true);
    try {
      const vendaRef = doc(collection(db, "vendas_atacado"));
      const numeroVenda = Math.floor(1000 + Math.random() * 9000);
      const dataStr = new Date().toLocaleDateString("pt-BR");
      const itensDescricao = carrinhoAtacado.map(it => `${it.quantidade}x ${it.nome}${it.tamanhoSelecionado ? ` (${it.tamanhoSelecionado})` : ""}`).join("; ");

      const dadosVenda = {
        lojaId: lojaIdAtual,
        numeroVenda,
        clienteId: clientePdv.id,
        clienteNome: clientePdv.nomeResponsavel,
        lojaNome: clientePdv.nomeLoja,
        tipoVenda: "atacado_cliente",
        itens: carrinhoAtacado,
        itensDescricao,
        valorTotal: subtotalCarrinhoAtacado,
        valorPago: valorPagoNum,
        formaPagamento: tipoPagamentoPdv === "pago_agora" ? formaPgPdv : (valorPagoNum > 0 ? formaPgPdv : "A Receber"),
        status: statusVenda,
        dataRetirada: dataStr,
        operadorEmail,
        criadoEm: serverTimestamp()
      };

      // Executar Transação Atômica: Baixar estoque na coleção produtos e salvar a venda
      await runTransaction(db, async (transaction) => {
        // Verificar estoque atual de cada produto
        for (const item of carrinhoAtacado) {
          const prodRef = doc(db, "produtos", item.id);
          const prodDoc = await transaction.get(prodRef);
          if (!prodDoc.exists()) {
            throw new Error(`Produto ${item.nome} não encontrado no estoque.`);
          }
          const pData = prodDoc.data();
          const permiteNegativo = !!pData.permiteNegativo;

          if (item.tamanhoSelecionado) {
            const tamEstoque = Number(pData.tamanhos?.[item.tamanhoSelecionado] || 0);
            if (!permiteNegativo && tamEstoque < item.quantidade) {
              throw new Error(`Estoque insuficiente para ${item.nome} [Tam: ${item.tamanhoSelecionado}]. Disponível: ${tamEstoque}`);
            }
            const novosTamanhos = { ...pData.tamanhos, [item.tamanhoSelecionado]: tamEstoque - item.quantidade };
            const novoEstoqueTotal = Number(pData.estoque || 0) - item.quantidade;
            transaction.update(prodRef, { tamanhos: novosTamanhos, estoque: novoEstoqueTotal });
          } else {
            const estoqueAtual = Number(pData.estoque || 0);
            if (!permiteNegativo && estoqueAtual < item.quantidade) {
              throw new Error(`Estoque insuficiente para ${item.nome}. Disponível: ${estoqueAtual}`);
            }
            transaction.update(prodRef, { estoque: estoqueAtual - item.quantidade });
          }
        }

        // Salvar venda
        transaction.set(vendaRef, dadosVenda);
      });

      // Preparar recibo térmico
      const reciboInfo = {
        numeroVenda,
        cliente: clientePdv.nomeResponsavel,
        loja: clientePdv.nomeLoja,
        dataHora: new Date().toLocaleString("pt-BR"),
        itens: carrinhoAtacado,
        valorTotal: subtotalCarrinhoAtacado,
        valorPago: valorPagoNum,
        restante: Math.max(0, subtotalCarrinhoAtacado - valorPagoNum),
        status: statusVenda.toUpperCase(),
        formaPagamento: dadosVenda.formaPagamento
      };

      setReciboAtacadoLocal(reciboInfo);
      setModalPdvAberto(false);
      await carregarDados();

      setTimeout(() => {
        window.print();
        setTimeout(() => setReciboAtacadoLocal(null), 500);
      }, 300);

      alert("Venda de atacado realizada com sucesso!");
    } catch (err) {
      alert("Erro ao finalizar venda: " + err.message);
    } finally {
      setProcessandoVenda(false);
    }
  }

  // Registrar Pagamento Parcial / Total Posterior
  async function confirmarPagamentoConta(e) {
    e.preventDefault();
    if (!vendaParaPagar || processandoPagamento) return;

    const valorPagoAgora = parseFloat(valorPagoAgoraInput);
    if (isNaN(valorPagoAgora) || valorPagoAgora <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const valorTotal = Number(vendaParaPagar.valorTotal || 0);
    const jaPago = Number(vendaParaPagar.valorPago || 0);
    const restanteAtual = Math.max(0, valorTotal - jaPago);

    if (valorPagoAgora > restanteAtual) {
      alert(`O valor excede o saldo restante devendo (R$ ${restanteAtual.toFixed(2)}).`);
      return;
    }

    const novoTotalPago = jaPago + valorPagoAgora;
    const novoStatus = novoTotalPago >= valorTotal ? "pago" : "parcial";

    setProcessandoPagamento(true);
    try {
      const vendaRef = doc(db, "vendas_atacado", vendaParaPagar.id);
      await updateDoc(vendaRef, {
        valorPago: novoTotalPago,
        status: novoStatus,
        formaPagamento: formaPgPagamento
      });

      alert("Pagamento registrado com sucesso!");
      setModalPagamentoAberto(false);
      setVendaParaPagar(null);
      setValorPagoAgoraInput("");
      await carregarDados();

      // Recarregar perfil aberto se houver
      if (clientePerfil) {
        const cliAtualizado = clientesComFinanceiro.find(c => c.id === clientePerfil.id);
        if (cliAtualizado) setClientePerfil(cliAtualizado);
      }
    } catch (err) {
      alert("Erro ao registrar pagamento: " + err.message);
    } finally {
      setProcessandoPagamento(false);
    }
  }

  // Imprimir Recibo de Venda do Histórico
  function imprimirReciboHistorico(v) {
    const totalP = Number(v.valorTotal) || 0;
    const pagoP = Number(v.valorPago) || 0;
    const devendoP = Math.max(0, totalP - pagoP);

    const reciboInfo = {
      numeroVenda: v.numeroVenda || v.id.slice(-6),
      cliente: v.clienteNome,
      loja: v.lojaNome,
      dataHora: v.dataRetirada || new Date().toLocaleString("pt-BR"),
      itens: v.itens || [],
      valorTotal: totalP,
      valorPago: pagoP,
      restante: devendoP,
      status: v.status?.toUpperCase() || "PENDENTE",
      formaPagamento: v.formaPagamento || "Pix"
    };

    setReciboAtacadoLocal(reciboInfo);
    setTimeout(() => {
      window.print();
      setTimeout(() => setReciboAtacadoLocal(null), 500);
    }, 300);
  }

  async function excluirVendaAtacado(vId) {
    if (!confirm("Tem certeza que deseja excluir esta venda do histórico? Nota: O estoque NÃO será estornado automaticamente por segurança.")) return;
    try {
      await deleteDoc(doc(db, "vendas_atacado", vId));
      alert("Venda excluída do histórico.");
      await carregarDados();
    } catch (err) {
      alert("Erro ao excluir venda: " + err.message);
    }
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "20px", boxSizing: "border-box", background: cores.bgGeral, color: cores.texto, fontFamily: "sans-serif" }}>
      
      {/* Estilos para Impressão Térmica (80mm) */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          @page { size: 80mm auto; margin: 0mm; }
          .print-recibo-atacado, .print-recibo-atacado * { visibility: visible !important; }
          .print-recibo-atacado {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            background: #fff !important;
            color: #000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            font-weight: bold !important;
            padding: 3mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
        }
        @media screen {
          .print-recibo-atacado { display: none; }
        }
      `}</style>

      {/* Recibo Térmico Oculto para Impressão */}
      {reciboAtacadoLocal && (
        <div className="print-recibo-atacado" style={{ color: "#000", background: "#fff", fontWeight: "bold" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>LIFE SURF - ATACADO</h2>
            <p style={{ margin: "2px 0", fontSize: "11px" }}>COMPROVANTE DE PEDIDO</p>
            <p style={{ margin: "2px 0", fontSize: "10px" }}>Pedido: #{reciboAtacadoLocal.numeroVenda}</p>
            <p style={{ margin: "2px 0", fontSize: "10px" }}>Cliente: {reciboAtacadoLocal.cliente} ({reciboAtacadoLocal.loja})</p>
            <p style={{ margin: "2px 0", fontSize: "10px" }}>Data: {reciboAtacadoLocal.dataHora}</p>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>ITEM / QTD x V.UN (ATACADO)</span>
            <span>TOTAL</span>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "4px 0 6px 0" }}></div>
          {reciboAtacadoLocal.itens?.map((it, idx) => (
            <div key={idx} style={{ marginBottom: "5px", fontSize: "11px" }}>
              <div>{it.nome} {it.tamanhoSelecionado ? `[${it.tamanhoSelecionado}]` : ""}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{it.quantidade}x R$ {Number(it.precoUnitario).toFixed(2)}</span>
                <span>R$ {(it.quantidade * it.precoUnitario).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Valor Total:</span>
            <span>R$ {reciboAtacadoLocal.valorTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Valor Pago:</span>
            <span>R$ {reciboAtacadoLocal.valorPago.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", marginTop: "4px" }}>
            <span>SALDO EM ABERTO:</span>
            <span>R$ {reciboAtacadoLocal.restante.toFixed(2)}</span>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ textAlign: "center", fontSize: "11px" }}>
            <p style={{ margin: "2px 0" }}>Forma: {reciboAtacadoLocal.formaPagamento}</p>
            <p style={{ margin: "2px 0" }}>Status: {reciboAtacadoLocal.status}</p>
          </div>
          <div style={{ borderBottom: "1px solid #000", margin: "6px 0" }}></div>
          <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
            OBRIGADO PELA PARCERIA COMERCIAL!
          </div>
        </div>
      )}

      {/* TELA PRINCIPAL DE CLIENTES */}
      <div className="no-print">
        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={24} /> Gerenciamento de Clientes Atacado
            </h1>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>Cadastre parceiros, realize vendas exclusivamente no atacado e controle valores a receber.</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={abrirModalNovoCliente} style={{ background: "#28a745", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus size={16} /> Novo Cliente Atacado
            </button>
            {voltarHome && (
              <button onClick={voltarHome} style={{ background: "#6c757d", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Home size={16} /> Menu Principal
              </button>
            )}
          </div>
        </div>

        {/* Resumo Financeiro Geral */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" }}>
          <div style={{ background: cores.bgCard, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>👥 Clientes Ativos</span>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#38a169", marginTop: "5px" }}>{resumoGeral.ativos} / {resumoGeral.totalCadastrados}</div>
          </div>
          <div style={{ background: cores.bgCard, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>⏳ Total em Aberto (A Receber)</span>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#e67e22", marginTop: "5px" }}>R$ {resumoGeral.emAbertoTotal.toFixed(2)}</div>
          </div>
          <div style={{ background: cores.bgCard, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
            <span style={{ fontSize: "12px", color: cores.textoSecundario }}>💰 Total Vendido no Atacado</span>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#3182ce", marginTop: "5px" }}>R$ {resumoGeral.vendidoTotal.toFixed(2)}</div>
          </div>
        </div>

        {/* Barra de Pesquisa e Filtros */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "10px", top: "12px", color: cores.textoSecundario }} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome, loja, CNPJ, telefone ou cidade..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "34px" }}
            />
          </div>
          <div>
            <select 
              value={filtroStatus} 
              onChange={e => setFiltroStatus(e.target.value)}
              style={{ ...inputStyle, width: "auto" }}
            >
              <option value="todos" style={{ background: cores.bgCard, color: cores.texto }}>Todos os Clientes</option>
              <option value="ativos" style={{ background: cores.bgCard, color: cores.texto }}>Ativos</option>
              <option value="inativos" style={{ background: cores.bgCard, color: cores.texto }}>Inativos</option>
              <option value="abertos" style={{ background: cores.bgCard, color: cores.texto }}>Com Valores em Aberto</option>
            </select>
          </div>
        </div>

        {/* Tabela / Listagem de Clientes */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "800px" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${cores.borda}`, color: cores.textoSecundario, fontSize: "12px" }}>
                <th style={{ padding: "12px" }}>Cliente / Loja</th>
                <th style={{ padding: "12px" }}>CNPJ</th>
                <th style={{ padding: "12px" }}>Telefone</th>
                <th style={{ padding: "12px" }}>Total em Aberto</th>
                <th style={{ padding: "12px" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan="6" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>Carregando clientes...</td></tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: "20px", textAlign: "center", color: cores.textoSecundario }}>Nenhum cliente atacadista encontrado.</td></tr>
              ) : (
                clientesFiltrados.map(cli => (
                  <tr key={cli.id} style={{ borderBottom: `1px solid ${cores.borda}`, fontSize: "13px" }}>
                    <td style={{ padding: "12px" }}>
                      <strong style={{ display: "block", color: cores.texto }}>{cli.nomeResponsavel}</strong>
                      <span style={{ fontSize: "11px", color: cores.textoSecundario }}>{cli.nomeLoja || "Ponto de Venda"} {cli.cidade ? `• ${cli.cidade}` : ""}</span>
                    </td>
                    <td style={{ padding: "12px", color: cores.textoSecundario }}>{cli.cnpj || "Não informado"}</td>
                    <td style={{ padding: "12px", color: cores.textoSecundario }}>{cli.telefone || "—"}</td>
                    <td style={{ padding: "12px", fontWeight: "bold", color: cli.totalEmAberto > 0 ? "#e67e22" : "#28a745" }}>
                      R$ {cli.totalEmAberto.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", background: cli.status === "Ativo" ? "#d4edda" : "#f8d7da", color: cli.status === "Ativo" ? "#155724" : "#721c24" }}>
                        {cli.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={() => { setClientePerfil(cli); setModalPerfilAberto(true); }} style={{ background: "#007bff", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }} title="Abrir Perfil e Histórico">
                          Perfil
                        </button>
                        <button onClick={() => abrirPdvAtacado(cli)} style={{ background: "#28a745", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }} title="Nova Venda Atacado">
                          + Venda
                        </button>
                        <button onClick={() => abrirModalEditarCliente(cli)} style={{ background: "#ffc107", color: "#000", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }} title="Editar">
                          <Edit size={12} />
                        </button>
                        <button onClick={() => excluirCliente(cli.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }} title="Excluir">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO DE CLIENTE */}
      {modalCadastroAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "550px", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${cores.borda}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: cores.texto }}>{clienteEditando ? "✏️ Editar Cliente Atacado" : "➕ Novo Cliente Atacado"}</h3>
              <button onClick={() => setModalCadastroAberto(false)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}><X size={16} /></button>
            </div>

            <form onSubmit={salvarCliente}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Nome do Responsável *</label>
                  <input type="text" value={formCliente.nomeResponsavel} onChange={e => setFormCliente({...formCliente, nomeResponsavel: e.target.value})} style={inputStyle} required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Nome da Loja / Ponto *</label>
                  <input type="text" value={formCliente.nomeLoja} onChange={e => setFormCliente({...formCliente, nomeLoja: e.target.value})} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>CNPJ</label>
                  <input type="text" placeholder="00.000.000/0000-00" value={formCliente.cnpj} onChange={e => setFormCliente({...formCliente, cnpj: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Telefone / WhatsApp *</label>
                  <input type="text" placeholder="(00) 00000-0000" value={formCliente.telefone} onChange={e => setFormCliente({...formCliente, telefone: e.target.value})} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Endereço</label>
                  <input type="text" value={formCliente.endereco} onChange={e => setFormCliente({...formCliente, endereco: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Cidade / UF</label>
                  <input type="text" value={formCliente.cidade} onChange={e => setFormCliente({...formCliente, cidade: e.target.value})} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Status</label>
                <select value={formCliente.status} onChange={e => setFormCliente({...formCliente, status: e.target.value})} style={inputStyle}>
                  <option value="Ativo" style={{ background: cores.bgCard, color: cores.texto }}>Ativo</option>
                  <option value="Inativo" style={{ background: cores.bgCard, color: cores.texto }}>Inativo</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Observações</label>
                <textarea rows="3" value={formCliente.observacao} onChange={e => setFormCliente({...formCliente, observacao: e.target.value})} style={inputStyle}></textarea>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setModalCadastroAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancelar</button>
                <button type="submit" disabled={salvandoCliente} style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", opacity: salvandoCliente ? 0.7 : 1 }}>{salvandoCliente ? "Salvando..." : "Salvar Cliente"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PERFIL E HISTÓRICO DO CLIENTE */}
      {modalPerfilAberto && clientePerfil && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "25px", borderRadius: "12px", width: "100%", maxWidth: "850px", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${cores.borda}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "12px", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", color: cores.texto }}>👤 Perfil do Atacadista: {clientePerfil.nomeResponsavel} ({clientePerfil.nomeLoja})</h2>
              <button onClick={() => setModalPerfilAberto(false)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}><X size={16} /></button>
            </div>

            {/* Resumo Financeiro Conta Corrente */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: cores.bgCardSecundario, padding: "12px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                <span style={{ fontSize: "11px", color: cores.textoSecundario }}>Total Comprado</span>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: cores.texto }}>R$ {clientePerfil.totalComprado.toFixed(2)}</div>
              </div>
              <div style={{ background: cores.bgCardSecundario, padding: "12px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                <span style={{ fontSize: "11px", color: cores.textoSecundario }}>Total Pago</span>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#28a745" }}>R$ {clientePerfil.totalPago.toFixed(2)}</div>
              </div>
              <div style={{ background: cores.bgCardSecundario, padding: "12px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                <span style={{ fontSize: "11px", color: cores.textoSecundario }}>Saldo em Aberto</span>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#e67e22" }}>R$ {clientePerfil.totalEmAberto.toFixed(2)}</div>
              </div>
            </div>

            {/* Ação PDV Atacado */}
            <div style={{ marginBottom: "20px" }}>
              <button onClick={() => abrirPdvAtacado(clientePerfil)} style={{ background: "#28a745", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShoppingBag size={18} /> ➕ Nova Venda Atacado
              </button>
            </div>

            <h3 style={{ fontSize: "15px", marginBottom: "12px", color: cores.texto }}>📜 Histórico de Vendas Atacado</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {clientePerfil.vendas.length === 0 ? (
                <p style={{ color: cores.textoSecundario, fontSize: "13px" }}>Nenhuma venda registrada para este cliente.</p>
              ) : (
                clientePerfil.vendas.map(v => {
                  const totalV = Number(v.valorTotal || 0);
                  const pagoV = Number(v.valorPago || 0);
                  const restanteV = Math.max(0, totalV - pagoV);

                  return (
                    <div key={v.id} style={{ background: cores.bgCardSecundario, padding: "14px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px", color: cores.textoSecundario }}>
                        <span>Venda #{v.numeroVenda || "—"} | Data: <strong>{v.dataRetirada || "—"}</strong></span>
                        <span>Status: <strong style={{ color: v.status === "pago" ? "#28a745" : (v.status === "parcial" ? "#3182ce" : "#e67e22") }}>{v.status?.toUpperCase()}</strong></span>
                      </div>
                      <div style={{ fontSize: "13px", marginBottom: "8px", color: cores.texto }}>
                        <strong>Produtos:</strong> {v.itensDescricao}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", borderTop: `1px solid ${cores.borda}`, paddingTop: "8px", flexWrap: "wrap", gap: "8px", color: cores.texto }}>
                        <div>
                          Total: <strong>R$ {totalV.toFixed(2)}</strong> | Pago: <span style={{ color: "#28a745", fontWeight: "bold" }}>R$ {pagoV.toFixed(2)}</span> | Em Aberto: <span style={{ color: "#e53e3e", fontWeight: "bold" }}>R$ {restanteV.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button onClick={() => imprimirReciboHistorico(v)} style={{ background: "#17a2b8", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }} title="Imprimir Recibo">
                            <Printer size={12} /> Recibo
                          </button>
                          {restanteV > 0 && (
                            <button onClick={() => { setVendaParaPagar(v); setValorPagoAgoraInput(restanteV.toFixed(2)); setModalPagamentoAberto(true); }} style={{ background: "#28a745", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                              💰 Registrar Pagamento
                            </button>
                          )}
                          <button onClick={() => excluirVendaAtacado(v.id)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDV EXCLUSIVO DE ATACADO */}
      {modalPdvAberto && clientePdv && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "900px", maxHeight: "92vh", overflowY: "auto", border: `1px solid ${cores.borda}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cores.borda}`, paddingBottom: "12px", marginBottom: "15px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: cores.texto }}>🛍️ PDV Atacado — Cliente: {clientePdv.nomeResponsavel} ({clientePdv.nomeLoja})</h2>
                <span style={{ fontSize: "12px", color: "#e67e22", fontWeight: "bold" }}>⚡ ATENÇÃO: Utilizando exclusivamente PREÇO DE ATACADO</span>
              </div>
              <button onClick={() => setModalPdvAberto(false)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}><X size={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
              {/* Coluna da Esquerda: Pesquisa de Produtos */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: cores.texto }}>🔎 Buscar Produtos no Estoque</h4>
                <input 
                  type="text" 
                  placeholder="Nome, referência ou código de barras..." 
                  value={buscaProduto}
                  onChange={e => setBuscaProduto(e.target.value)}
                  style={{ ...inputStyle, marginBottom: "12px" }}
                />

                <div style={{ maxHeight: "40vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {produtos
                    .filter(p => {
                      const termo = buscaProduto.toLowerCase();
                      return (
                        (p.nome || p.titulo || "").toLowerCase().includes(termo) ||
                        (p.referencia || "").toLowerCase().includes(termo) ||
                        (p.codigoBarras || "").toLowerCase().includes(termo)
                      );
                    })
                    .map(p => {
                      const precoAtacado = Number(p.precoAtacado || p.preco || 0);
                      const temTamanhos = p.tamanhos && typeof p.tamanhos === "object" && Object.keys(p.tamanhos).length > 0;

                      return (
                        <div key={p.id} style={{ background: cores.bgCardSecundario, padding: "10px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ fontSize: "13px", color: cores.texto, display: "block" }}>{p.nome || p.titulo}</strong>
                              <span style={{ fontSize: "11px", color: cores.textoSecundario }}>Ref: {p.referencia || "—"} | Estoque Total: {p.estoque ?? 0}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#28a745", display: "block" }}>R$ {precoAtacado.toFixed(2)}</span>
                              <span style={{ fontSize: "10px", color: cores.textoSecundario }}>Preço Atacado</span>
                            </div>
                          </div>

                          {/* Se tiver tamanhos */}
                          {temTamanhos ? (
                            <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: "11px", color: cores.textoSecundario }}>Tamanhos:</span>
                              {Object.entries(p.tamanhos).map(([tam, qtd]) => (
                                <button 
                                  key={tam} 
                                  onClick={() => adicionarAoCarrinho(p, tam)}
                                  style={{ background: "#007bff", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }}
                                >
                                  {tam} ({qtd})
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: "8px", textAlign: "right" }}>
                              <button 
                                onClick={() => adicionarAoCarrinho(p, null)}
                                style={{ background: "#28a745", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }}
                              >
                                + Adicionar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Coluna da Direita: Carrinho e Fechamento */}
              <div style={{ background: cores.bgCardSecundario, padding: "15px", borderRadius: "8px", border: `1px solid ${cores.borda}` }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: cores.texto }}>🛒 Carrinho Atacado</h4>
                
                <div style={{ maxHeight: "25vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" }}>
                  {carrinhoAtacado.length === 0 ? (
                    <span style={{ fontSize: "12px", color: cores.textoSecundario }}>Nenhum produto adicionado.</span>
                  ) : (
                    carrinhoAtacado.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: cores.bgCard, padding: "8px", borderRadius: "6px", border: `1px solid ${cores.borda}`, fontSize: "12px" }}>
                        <div>
                          <strong style={{ display: "block", color: cores.texto }}>{it.nome} {it.tamanhoSelecionado ? `[${it.tamanhoSelecionado}]` : ""}</strong>
                          <span style={{ color: cores.textoSecundario }}>R$ {it.precoUnitario.toFixed(2)} un</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input 
                            type="number" 
                            min="1" 
                            value={it.quantidade} 
                            onChange={e => {
                              const q = parseInt(e.target.value) || 1;
                              const copia = [...carrinhoAtacado];
                              copia[idx].quantidade = q;
                              setCarrinhoAtacado(copia);
                            }}
                            style={{ width: "45px", padding: "4px", textAlign: "center", background: cores.inputBg, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "4px" }}
                          />
                          <button onClick={() => setCarrinhoAtacado(carrinhoAtacado.filter((_, i) => i !== idx))} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ borderTop: `1px solid ${cores.borda}`, paddingTop: "10px", marginBottom: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "bold", color: cores.texto }}>
                    <span>TOTAL ATACADO:</span>
                    <span style={{ color: "#28a745" }}>R$ {subtotalCarrinhoAtacado.toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={finalizarVendaAtacado}>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", fontSize: "11px", color: cores.textoSecundario, marginBottom: "3px" }}>Condição de Pagamento:</label>
                    <select value={tipoPagamentoPdv} onChange={e => setTipoPagamentoPdv(e.target.value)} style={inputStyle}>
                      <option value="a_receber" style={{ background: cores.bgCard, color: cores.texto }}>A Receber (Conta Corrente / Pendente)</option>
                      <option value="pago_agora" style={{ background: cores.bgCard, color: cores.texto }}>Pago Integralmente Agora</option>
                      <option value="parcial" style={{ background: cores.bgCard, color: cores.texto }}>Pagamento Parcial Agora</option>
                    </select>
                  </div>

                  {tipoPagamentoPdv === "pago_agora" && (
                    <div style={{ marginBottom: "10px" }}>
                      <label style={{ display: "block", fontSize: "11px", color: cores.textoSecundario, marginBottom: "3px" }}>Forma de Pagamento:</label>
                      <select value={formaPgPdv} onChange={e => setFormaPgPdv(e.target.value)} style={inputStyle}>
                        {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp} style={{ background: cores.bgCard, color: cores.texto }}>{fp}</option>)}
                      </select>
                    </div>
                  )}

                  {tipoPagamentoPdv === "parcial" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", color: cores.textoSecundario, marginBottom: "3px" }}>Valor Pago Agora (R$):</label>
                        <input type="number" step="0.01" value={valorPagoAgoraPdv} onChange={e => setValorPagoAgoraPdv(e.target.value)} style={inputStyle} required />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", color: cores.textoSecundario, marginBottom: "3px" }}>Forma:</label>
                        <select value={formaPgPdv} onChange={e => setFormaPgPdv(e.target.value)} style={inputStyle}>
                          {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp} style={{ background: cores.bgCard, color: cores.texto }}>{fp}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={processandoVenda || carrinhoAtacado.length === 0}
                    style={{ width: "100%", padding: "12px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", opacity: (processandoVenda || carrinhoAtacado.length === 0) ? 0.7 : 1 }}
                  >
                    {processandoVenda ? "Processando Venda e Estoque..." : "Concluir Venda Atacado & Imprimir Recibo"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO / ACERTO DE CONTA */}
      {modalPagamentoAberto && vendaParaPagar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000, padding: "15px", boxSizing: "border-box" }}>
          <div style={{ background: cores.bgCard, padding: "20px", borderRadius: "10px", width: "100%", maxWidth: "360px", border: `1px solid ${cores.borda}` }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: cores.texto }}>💰 Registrar Pagamento (Atacado)</h3>
            <form onSubmit={confirmarPagamentoConta}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Valor Pago Agora (R$):</label>
                <input type="number" step="0.01" value={valorPagoAgoraInput} onChange={e => setValorPagoAgoraInput(e.target.value)} style={{ width: "100%", padding: "12px", fontSize: "18px", fontWeight: "bold", textAlign: "center", background: cores.inputBg, border: `2px solid #28a745`, color: cores.texto, borderRadius: "6px", boxSizing: "border-box", outline: "none" }} autoFocus required />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "12px", color: cores.textoSecundario, marginBottom: "4px" }}>Forma de Pagamento:</label>
                <select value={formaPgPagamento} onChange={e => setFormaPgPagamento(e.target.value)} style={inputStyle}>
                  {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp} style={{ background: cores.bgCard, color: cores.texto }}>{fp}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => setModalPagamentoAberto(false)} style={{ flex: 1, padding: "10px", background: cores.bgCardSecundario, color: cores.texto, border: `1px solid ${cores.borda}`, borderRadius: "6px", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" disabled={processandoPagamento} style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", opacity: processandoPagamento ? 0.7 : 1 }}>{processandoPagamento ? "Salvando..." : "Confirmar Pagamento"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}