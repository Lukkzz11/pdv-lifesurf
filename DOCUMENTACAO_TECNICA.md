# DOCUMENTAÇÃO TÉCNICA E ARQUITETURAL DO SISTEMA
## ERP & PDV LIFESURF • MULTIEMPRESA CLOUD & OFFLINE-FIRST

> **Versão da Documentação:** 2.6.0  
> **Última Atualização:** Outubro de 2026  
> **Ambiente Base:** React 19 + Vite 8 + TailwindCSS v4 + Firebase Firestore / Auth / Storage + Google Workspace APIs  
> **Padrão de Manutenção:** Este documento reflete com fidelidade o estado real e atualizado da base de código e **deve ser editado a cada nova feature, refatoração ou evolução de módulo**.

---

## 1. VISÃO GERAL DO PROJETO

O **LifeSurf ERP / PDV** é uma plataforma corporativa web de alta performance concebida para atender à gestão ponta a ponta de manufatura de moda/surfwear, comércio varejista (balcão e atacado), controle de espaços esportivos (arenas de praia) e controladoria financeira pessoal e empresarial.

### Principais Pilares Arquiteturais
1. **Multi-Tenancy Híbrido:** Separação lógica de dados em coleções particionadas no Firebase (`empresas/{tenantId}/...`) e suporte a instâncias autônomas de Firebase para operações isoladas (como a *Arena Sandplay* com backend próprio).
2. **Offline-First & PWA:** Funcionamento resiliente em frente de caixa (PDV) com cache local, sincronização de pedidos pendentes e compatibilidade com Service Worker para instalação como aplicativo de desktop/mobile.
3. **Integrações de Custo Zero (Free Tier):** Autenticação e sincronização com serviços Google Workspace (Google Drive para armazenamento de comprovantes fiscais/operacionais, Google Calendar para entregas e Gmail API para notificações).
4. **Design System Dinâmico & Tipografia Customizável:** Customização em tempo real de paletas de cores (fundos, cards, bordas, acentos) e tipografia (famílias Google Fonts e cores de cabeçalhos/textos) gravadas no Firestore da empresa.
5. **Formação Flexível de Painel:** Editor integrado nas configurações permitindo reorganizar a grade do painel inicial (2, 3 ou 4 colunas, densidades e ocultação de atalhos).

---

## 2. STACK TECNOLÓGICA & DEPENDÊNCIAS

| Camada | Tecnologias Utilizadas |
| :--- | :--- |
| **Frontend Framework** | React 19 (`react`, `react-dom`) |
| **Build & Dev Tooling** | Vite 8 (`vite`, `@vitejs/plugin-react`) |
| **Roteamento** | React Router DOM v7 (`react-router-dom`) |
| **Estilização** | TailwindCSS v4 (`tailwindcss`, `@tailwindcss/vite`), CSS Modules e variáveis CSS nativas |
| **Ícones & UI** | Lucide React (`lucide-react`) |
| **Notificações** | React Hot Toast (`react-hot-toast`) |
| **Backend & Banco de Dados** | Firebase v12 (`firebase/app`, `firebase/firestore`, `firebase/auth`, `firebase/storage`) |
| **Geração de Documentos** | jsPDF (`jspdf`), jsPDF-AutoTable (`jspdf-autotable`), html2canvas (`html2canvas`) |
| **Impressão Térmica** | Janela de impressão padronizada ESC/POS (80mm) compatível com drivers Epson/Elgin/Bematech |
| **APIs Externas** | Google Identity Services (OAuth 2.0 GIS), Google Drive API v3, Google Calendar API v3, Gmail API v1 |

---

## 3. ARQUITETURA MULTI-EMPRESA (MULTI-TENANCY)

### 3.1. Contexto e Gerenciamento (`TenantContext.jsx`)
O contexto `TenantContext` armazena e distribui:
- `activeTenantId`: Identificador único da empresa ativa (ex: `lifesurf-principal`, `arena-sandplay`, `jarbas-alugueis`, `financas-pessoal`).
- `activeUnitId`: Unidade operacional selecionada (ex: `loja-balcao`, `fabrica-matriz`).
- `companyDetails`: Metadados cadastrais, alíquotas fiscais, contatos e configurações visuais da empresa.
- `switchTenant(id)`: Alterna a empresa ativa, persistindo no `localStorage` e atualizando o escopo de dados.

### 3.2. Estrutura de Coleções no Firestore
```text
empresas/
  └── {tenantId}/
        ├── produtos/                 (Itens em estoque na loja balcão)
        ├── estoque_fabrica/          (Rolo de tecido, matéria-prima e cortes)
        ├── vendas/                   (Transações finalizadas no PDV)
        ├── pedidos/                  (Ordens de produção e atacado)
        ├── clientes/                 (Base de contatos e CRM)
        ├── fluxo_caixa/              (Entradas e saídas financeiras)
        ├── contas_a_ver/             (Crediário e fiado com parcelas)
        ├── catalogo_produtos/        (Produtos liberados para a vitrine digital)
        ├── agendamentos/             (Agendas e eventos operacionais)
        └── configuracoes/
              ├── geral               (Dados cadastrais e fiscais)
              ├── temaConfig          (Identidade visual, cores e tipografia)
              ├── painelConfig        (Formação de colunas, atalhos ativos e ordem)
              └── google_workspace    (Chaves e preferências Google)
```

---

## 4. MAPEAMENTO DE MÓDULOS E ROTAS

O roteamento da aplicação é centralizado em `src/routes/AppRoutes.jsx`, aplicando `ProtectedRoute` com base no perfil do usuário (`SUPERADMIN`, `ADMIN`, `GERENTE`, `OPERADOR`).

| Rota | Componente | Descrição / Responsabilidade |
| :--- | :--- | :--- |
| `/login` | `Login.jsx` | Autenticação via Firebase Auth (E-mail/Senha) com persistência de sessão. |
| `/selecionar-empresa` | `SelectCompany.jsx` | Painel de seleção e cadastro de empresas (Life Surf, Arena Sandplay, Jarbas Aluguéis, Finanças). |
| `/workspace` ou `/` | `Workspace.jsx` | Painel Geral com Torre de Controle Executiva e formação de atalhos customizável em tempo real. |
| `/pdv` | `Pdv.jsx` | Frente de Caixa ágil (tecla F2, leitor de código de barras, pagamentos mistos, cupom 80mm). |
| `/caixa-loja` ou `/caixa` | `CaixaLoja.jsx` | Centralizador de todas as vendas do PDV com edição, exclusão (com estorno opcional) e relatórios CSV/PDF. |
| `/estoque-loja` ou `/estoque`| `EstoqueLoja.jsx` | Gestão de estoque do balcão, grades expandidas (PP..G10 / 36..64) e venda sem baixa física. |
| `/estoque-fabrica` | `EstoqueFabrica.jsx` | Controle industrial (rolos, tecidos, aviamentos, corte, costura e envio à loja). |
| `/pedidos` | `Pedidos.jsx` | Fluxo de pedidos de atacado, separação, picking list e expedição. |
| `/financeiro` ou `/gastos` | `FinanceiroGastos.jsx`| Livro-caixa com comprovantes por câmera e envio de Comprovante Piso Loja (Prefeitura) ao Google Drive. |
| `/relatorios` | `Relatorios.jsx` | DRE Gerencial, gestão de cheques, botão "Zerar Relatório" e simulador dinâmico de CMV e Margem. |
| `/arena-sandplay` | `ArenaSandplay.jsx` | Frente esportiva dedicada a "Alugar Horário" e tipos de quadra, com backend Firebase independente. |
| `/catalogo/:companyId` | `CatalogoPublico.jsx`| Catálogo virtual público e responsivo com checkout direto no WhatsApp do vendedor. |
| `/gerenciar-catalogo` | `GerenciarCatalogo.jsx`| Gestão da vitrine digital, visibilidade de produtos e preços online. |
| `/etiquetas` | `Etiquetas.jsx` | Impressão térmica de etiquetas de código de barras padrão Code128. |
| `/calendario` | `Calendario.jsx` | Agenda integrada com o Google Calendar da empresa. |
| `/clientes` | `Clientes.jsx` | Cadastro de clientes, limite de crédito e histórico de compras. |
| `/a-ver` | `ContasAVer.jsx` | Controle de crediário/fiado, amortizações e comprovantes de liquidação. |
| `/configuracoes` | `Configuracoes.jsx` | Editor do Painel Geral, identidade visual, tipografia, conexão Google Drive e parâmetros da empresa. |

---

## 5. DETALHAMENTO DAS FUNCIONALIDADES E RECURSOS PRINCIPAIS

### 5.1. Identidade Visual e Customização Total de Tema
- **Arquivo de Contexto:** `src/contexts/ThemeContext.jsx`
- **Interface de Controle:** `src/pages/Configuracoes.jsx` (Aba *"Identidade Visual & Tema"*)
- **Recursos Suportados:**
  - **Paleta Dinâmica:** Personalização de cor primária, fundo da aplicação (`--bg-main`), blocos e cards (`--bg-card`), hover de cards (`--bg-card-hover`), cor de destaque/accent (`--color-accent`) e bordas sutis (`--border-subtle`).
  - **Propagação Universal de Superfícies & Cards:**
    - `MainLayout.jsx`: O contêiner raiz da aplicação consome dinamicamente `var(--bg-main)` e `var(--text-body)` com transição suave, eliminando o background cinza estático (`bg-slate-950`).
    - `Card.jsx`: Totalmente desacoplado de classes fixas do Tailwind Slate (`bg-slate-900/80` e `border-slate-800/90`). Aplica `.card-themed` com herança direta de `--bg-card`, `--border-subtle`, `--text-body` e títulos com `--text-heading`.
    - `src/index.css`: Camada de propagação universal intercepta seletores de superfície (`bg-slate-950`, `bg-slate-900`, `bg-slate-850`, `border-slate-800` e opacidades) garantindo que todas as telas legadas e modernas reflitam a paleta escolhida de ponta a ponta.
    - `Workspace.jsx` (Painel Geral): Títulos, cabeçalhos, divisórias e cartões de navegação operacional agora atualizam instantaneamente conforme a cor configurada.
  - **Tipografia Expandida:** Injeção dinâmica de Google Fonts via link assíncrono:
    - *System UI*, *Inter*, *Outfit*, *Poppins*, *Roboto*, *Montserrat*, *Plus Jakarta Sans*.
  - **Cores de Texto Específicas:** Configuração de cor para Títulos/Cabeçalhos (`--text-heading`) e corpo de texto (`--text-body`), com tratamento automático para alto contraste em Modo Claro.
  - **Persistência Híbrida:** Gravação simultânea no `localStorage` (renderização imediata sem flash visual) e no Firestore da empresa ativa (`empresas/{tenantId}/configuracoes/temaConfig`).

### 5.2. Editor do Painel Geral & Workspace Reestruturado
- **Editor nas Configurações:** `src/pages/Configuracoes.jsx` (Aba *"Editor do Painel Geral"*)
- **Tela de Exibição:** `src/pages/Workspace.jsx`
- **Serviço de Persistência:** `src/services/tenantService.js` (`getCompanyPainelConfig`, `updateCompanyPainelConfig`)
- **Recursos do Editor:**
  - **Formação de Colunas:** Permite escolher entre 2 colunas (`grid-cols-2`), 3 colunas (`grid-cols-3` padrão) ou 4 colunas (`grid-cols-4`) para distribuição dos blocos.
  - **Densidade Visual dos Cards:** Ajuste de espaçamento interno entre *Compacto* (`p-4`), *Padrão* (`p-6`) e *Expandido* (`p-7`).
  - **Gestão de Atalhos (Ativar / Desativar):** Permite desativar módulos não utilizados pela operação da empresa, ocultando-os do painel principal e deixando o carregamento mais leve.
  - **Reordenação de Posição:** Botões com setas de subida e descida para priorizar na formação os atalhos de uso mais frequente da equipe.
  - **Alternância de Alertas:** Opção para exibir ou ocultar a *Torre de Controle* (alertas críticos de pedidos pendentes, estoque mínimo e DRE) e a barra de ações rápidas no cabeçalho.
  - **Sincronização Reativa:** Disparo do evento customizado `lifesurf:painel_config_changed`, atualizando a tela inicial imediatamente sem necessidade de recarregar a página (`F5`).

### 5.3. Caixa Loja (Gestão e Auditoria de Vendas)
- **Arquivo:** `src/pages/CaixaLoja.jsx`
- **Serviço Responsável:** `src/services/saleService.js`
- **Recursos:**
  - Consulta detalhada de cada venda com produtos, operador, forma de pagamento e descontos.
  - Edição de método de pagamento e observações do operador.
  - Exclusão de venda com diálogo de confirmação que permite **estornar e repor os produtos de volta ao estoque** ou manter o estoque físico inalterado.
  - Reimpressão térmica de cupom não-fiscal (80mm) a qualquer momento.
  - Exportação de relatórios em formato **CSV** e **PDF Gerencial Diagramado**.

### 5.4. Estoque Loja: Venda Sem Baixa Imediata
- **Arquivo:** `src/pages/EstoqueLoja.jsx`
- **Finalidade:** Permite vender mercadorias que chegaram fisicamente à loja ou balcão mas ainda estão pendentes de contagem oficial no inventário.
- **Implementação:** Botão *"Vender s/ Baixa"* na coluna de ações do produto. Registra a transação com `semBaixaEstoque: true` diretamente no Caixa Loja sem abater a grade do produto.

### 5.5. Grade de Tamanhos Expandida
- **Arquivos:** `src/pages/EstoqueLoja.jsx` e `src/services/stockService.js`
- **Grades Suportadas:**
  - **Grade de Letras:** `PP`, `P`, `M`, `G`, `GG`, `XG`, `G1`, `G2`, `G3`, `G4`, `G5`, `G6`, `G7`, `G8`, `G9`, `G10`.
  - **Grade de Números:** `36`, `38`, `40`, `42`, `44`, `46`, `48`, `50`, `52`, `54`, `56`, `58`, `60`, `62`, `64`.
- **Comportamento:** Seletores de aba rápidos que exibem apenas a grade relevante, com somador automático de peças por variante.

### 5.6. Integração Google Drive & Comprovante Piso Loja (Prefeitura)
- **Arquivos:** `src/services/googleApiService.js` e `src/pages/FinanceiroGastos.jsx`
- **Recursos:**
  - Conexão OAuth 2.0 segura via Google Identity Services (GIS).
  - Tratamento automático de erro `401 Unauthorized`: se o token expirar, desconecta preventivamente sem gerar loop de requisições.
  - **Comprovante Piso Loja:** Modal específico solicitando nome/identificação do ponto comercial, data do pagamento, valor e pasta de destino no Google Drive (padrão: *"LifeSurf - Comprovantes Piso Loja (Prefeitura)"*).
  - Upload direto via API multipart/related com metadados e registro financeiro no livro-caixa.

### 5.7. Arena Sandplay (Front Esportivo de Locação & Firebase Independente)
- **Arquivos:** `src/pages/ArenaSandplay.jsx`, `src/config/arenaFirebase.js`, `src/services/arenaService.js`
- **Conceito de Separação:** A Arena Sandplay opera no mesmo ecossistema, porém com interface e backend desacoplados do ERP de varejo tradicional:
  - **Backend Firebase Dedicado:** A Arena pode apontar para um projeto Firebase totalmente próprio e autônomo (`arena_firebase_custom_config` no `localStorage` ou `VITE_ARENA_FIREBASE_*`), possuindo seu próprio banco Firestore, Authentication e Cloud Storage.
  - **Front Especializado em "Alugar Horário" & Tipo:**
    - Foco total na experiência de locação de quadras, livre de métricas de balcão e caixas comerciais.
    - **Seleção de Tipo de Quadra:** Cards interativos para *Quadra 01 - Principal Coberta*, *Quadra 02 - Areia Praia* e *Quadra 03 - Areia Sol*, com valores/hora e filtros rápidos.
    - **Seleção de Tipo de Esporte:** Filtros de modalidade (*Beach Tennis*, *Futevôlei*, *Vôlei de Praia*, *Funcional*, *Day Use*).
    - **Grade de Horários Disponíveis:** Visão diária das 06:00 às 22:00 com status claro de horários vagos e ocupados.
    - **Ação Direta de Aluguel:** Botão de agendamento ágil gerando comprovante de reserva e envio instantâneo dos dados no WhatsApp do cliente/atleta.

### 5.8. Relatórios, DRE Gerencial & Engenharia de Preço
- **Arquivo:** `src/pages/Relatorios.jsx`
- **Recursos:**
  - **Zerar Relatório:** Botão e modal com checkboxes para limpar dados acumulados de testes (lançamentos avulsos, cheques cadastrados e redefinição de margens).
  - **Engenharia de Custos, Margem & CMV Expandida:**
    - CMV / Insumos (%)
    - Impostos / Alíquota Tributária (%)
    - Taxas Médias de Cartão / Gateway (%)
    - Comissões de Vendas (%)
    - Custos Fixos Operacionais Estimados (R$)
    - Margem de Contribuição Alvo (%)
    - Simulador Dinâmico calculando Markup Sugerido (ex: `2.35x`) e sobra real para cada R$ 100 faturados.

---

## 6. ESTRUTURA DE DIRETÓRIOS DO CÓDIGO FONTE

```text
src/
├── components/
│   ├── cashier/              (Modais e componentes do caixa)
│   ├── google/               (Modal de conexão com o Google OAuth 2.0)
│   ├── layout/               (Header, Sidebar, MobileNav e MainLayout)
│   ├── stock/                (Modais de entrada NFe, movimentação e grades)
│   └── ui/                   (Design system: Button, Card, Input, Select, Modal, Table, Badge)
├── config/
│   ├── constants.js          (Perfis de usuário, status de pedidos e constantes gerais)
│   ├── firebase.js           (Inicialização do Firebase padrão da LifeSurf)
│   └── arenaFirebase.js      (Inicialização do Firebase isolado da Arena Sandplay)
├── contexts/
│   ├── TenantContext.jsx     (Controle de empresa e unidade operacional ativa)
│   └── ThemeContext.jsx      (Gerenciamento de temas, cores, fontes e CSS variables)
├── pages/                    (Telas operacionais mapeadas nas rotas)
├── routes/
│   └── AppRoutes.jsx         (Tabela central de rotas protegidas e públicas)
├── security/
│   ├── AuthContext.jsx       (Controle de autenticação, login e perfil)
│   └── ProtectedRoute.jsx    (Guarda de rotas por tenant e permissão de papel)
├── services/                 (Camada de abstração de dados e APIs externas)
│   ├── arenaService.js       (Agendamentos e métricas da Arena Sandplay)
│   ├── authService.js        (Login, logout e perfil do usuário)
│   ├── calendarService.js    (Sincronização com Google Calendar)
│   ├── cashierService.js     (Abertura, fechamento e sangrias do caixa)
│   ├── catalogService.js     (Vitrine pública e WhatsApp checkout)
│   ├── customerService.js    (Cadastro de clientes e débitos)
│   ├── financialService.js   (Lançamentos de fluxo de caixa e livro-caixa)
│   ├── googleApiService.js   (Integração Google Drive, Gmail, GIS e Piso Loja)
│   ├── orderService.js       (Pedidos atacado e ordem de produção)
│   ├── pdvOfflineService.js  (Cache local do PDV e sincronização offline)
│   ├── receiptService.js     (Impressão térmica 80mm ESC/POS)
│   ├── reportsService.js     (Cálculo e exportação do DRE em PDF)
│   ├── saleService.js        (Centralizador de vendas, baixas e cancelamentos)
│   ├── stockService.js       (Gestão de estoque, tamanhos PP..G10 e 36..64)
│   └── tenantService.js      (Cadastro e deleção de empresas multi-tenant)
└── utils/
    ├── cn.js                 (Utilitário de composição de classes Tailwind)
    └── formatters.js         (Formatação de moeda R$, datas e números)
```

---

## 8. REGISTRO DE ATUALIZAÇÕES RECENTES (CHANGELOG TÉCNICO)

### 8.1. Garantia Universal de Contraste em Abas Selecionadas
- **Problema Solucionado**: Abas ativas em telas como Estoque de Fábrica, Estoque de Loja, Relatórios e Contas a Ver sofriam de perda de contraste (texto azul/escuro sobre fundo azul sólido) devido a regras de injeção de tema dinâmico sobre classes do Tailwind.
- **Implementação**:
  - Em `src/index.css`, adicionadas regras de alta especificidade (`!important`) direcionadas a `button[class*="rounded-t-xl"]` e variações (`bg-sky-500`, `bg-emerald-500`, `border-sky-500`, etc.), forçando cor e traço do texto, ícones e badges filhos para branco puro (`#ffffff !important`).
  - Atualização dos componentes (`EstoqueFabrica.jsx`, `EstoqueLoja.jsx`, `Relatorios.jsx`, `ContasAVer.jsx`, `Configuracoes.jsx`) garantindo classes explícitas `!text-white font-extrabold shadow-md` em botões de navegação ativos.

### 8.2. Zeramento Completo de Relatórios e Demonstrativo DRE
- **Módulos Afetados**: `src/services/reportsService.js` e `src/pages/Relatorios.jsx`.
- **Implementação**:
  - Criação da constante `ZERO_FINANCIAL_METRICS`, redefinindo para `0` faturamento bruto, descontos, faturamento líquido, CMV, lucro bruto, margem de lucro, quantidade de vendas, ticket médio, peças vendidas e todas as formas de pagamento (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito, A Ver).
  - Funções `zerarFinancialReports(tenantId)`, `restaurarDemoFinancialReports(tenantId)` e `isReportsZerado(tenantId)` integradas ao `localStorage` para persistência de estado limpo sem fallback para números fictícios de demonstração.
  - Checkbox e fluxo no modal de confirmação para limpar faturamento, cheques e lançamentos avulsos simultaneamente, com botão de restauração facilitada.

### 8.3. Ferramenta "Zerar Tudo" em Contas a Ver & Financeiro
- **Módulos Afetados**: `src/services/financialService.js` e `src/pages/ContasAVer.jsx`.
- **Implementação**:
  - Inclusão das funções `zerarTodasContas(tenantId, options)`, `restaurarDemoContas(tenantId)` e `isContasAVerZerado(tenantId)`.
  - Botão de ação "Zerar Tudo" integrado ao cabeçalho principal do módulo com modal de confirmação dedicado (`Modal`), permitindo seleção modular de Contas a Receber (Fiado / Títulos) e Contas a Pagar (Despesas & Fornecedores).
  - Quando zerado, os 4 KPIs principais (A Receber, Contas a Pagar, Total Amortizado, Saldo Projetado Líquido) e a aba de Fluxo de Caixa passam a exibir rigorosamente `R$ 0,00`, mantendo a opção de "Restaurar Demonstração" visível no cabeçalho.

### 8.4. Isolamento Completo do Firebase da Arena Sandplay (arenasandplay-fc30f)
- **Módulos Afetados**: `src/config/arenaFirebase.js`, `src/services/arenaService.js` e `src/pages/ArenaSandplay.jsx`.
- **Implementação**:
  - Configuração direta e isolada das credenciais dedicadas do projeto `arenasandplay-fc30f` (API Key: `AIzaSyDIaSJmum3zGffNPOApFnHde9y3_L_PAnY`, Auth Domain: `arenasandplay-fc30f.firebaseapp.com`, Storage Bucket: `arenasandplay-fc30f.firebasestorage.app`, App ID: `1:559182170902:web:dde2cfc26c9761069a1e37`).
  - **Garantia de Isolamento Arquitetural**: O Firebase da Life Surf (`src/config/firebase.js`) permanece 100% inalterado e estritamente restrito à confecção e ao ERP. A Arena Sandplay não compartilha instâncias de banco, autenticação ou storage com a Life Surf, inicializando seu próprio app nomeado (`arena-sandplay-app`) e persistindo agendamentos e locações de quadras em seu Firestore dedicado.
### 8.5. Sincronização em Tempo Real e Persistência do Editor do Painel Geral
- **Problema Solucionado**: Alterações efetuadas na aba *"Editor do Painel Geral"* em `Configuracoes.jsx` (ativação/desativação de módulos, reordenação de atalhos, formação de 2/3/4 colunas e densidade de cartões) não eram refletidas no Painel Geral (`Workspace.jsx`), e as setas de ordenação falhavam silenciosamente devido a um descasamento de parâmetro de direção (`"up"` vs `"cima"`).
- **Implementação e Correções**:
  - **Correção da Reordenação de Módulos (`Configuracoes.jsx`)**: Função `handleMoverModulo` agora aceita tanto `"cima"` quanto `"up"`, bem como `"baixo"` e `"down"`, permitindo mover os cartões para frente ou para trás sem falhas na indexação do array.
  - **Propagação Instantânea de Parâmetros**: Criação de `handleAtualizarParametroPainel`, que salva imediatamente no `localStorage`, sincroniza com `updateCompanyPainelConfig` e despacha o evento global `lifesurf:painel_config_changed`, atualizando a interface sem exigir recarregamento da página.
  - **Sincronização com o Contexto Multi-Empresa (`TenantContext`)**: Ao clicar em *"Salvar Formação do Painel"*, o sistema chama tanto o serviço de persistência quanto `updateCompany({ painelConfig: salvo })`, garantindo que o objeto `companyDetails.painelConfig` esteja atualizado em toda a árvore de componentes.
  - **Resolução de Chaves de Tenant e Aliases (`tenantService.js`)**: `getCompanyPainelConfig` e `updateCompanyPainelConfig` utilizam resolução resiliente de IDs de tenant, verificando `lifesurf_painel_config_${tenantId}`, aliases comuns (`lifesurf-principal`, `lifesurf`) e a chave global ativa `lifesurf_painel_config_current`.
  - **Consumo Reativo no Painel Geral (`Workspace.jsx`)**: Inicialização do estado diretamente a partir das configurações salvas da empresa, com listeners adicionados para o evento customizado `lifesurf:painel_config_changed` e eventos de `storage`, recalculando a grade de colunas (`String(colunasGrid)`: 2, 3 ou 4) e densidade de espaçamento instantaneamente.

---

## 9. DIRETRIZES DE MANUTENÇÃO E POLÍTICA DE ATUALIZAÇÃO CONTÍNUA

> **REGRA FUNDAMENTAL:**  
> Sempre que qualquer novo recurso, endpoint, serviço, tela ou refatoração for desenvolvido no projeto, **este documento (`DOCUMENTACAO_TECNICA.md`) deve ser obrigatoriamente editado e incrementado** na mesma iteração de desenvolvimento, garantindo que o estado da documentação permaneça 100% sincronizado com a base de código em produção.


