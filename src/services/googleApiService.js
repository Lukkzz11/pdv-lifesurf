/**
 * SERVIÇO DE INTEGRAÇÃO COM GOOGLE WORKSPACE / GOOGLE CLOUD APIS (FREE TIER)
 * Arquitetura 100% Client-Side sem custos de servidor (Zero Cost):
 * - Google Identity Services (GIS) OAuth 2.0 Token Client
 * - Google Calendar API v3 (1.000.000 requisições/dia grátis)
 * - Gmail API v1 (250 a 2.000 e-mails/dia grátis para notificações transacionais)
 * - Google Drive API v3 (15 GB grátis / 1.000.000 requisições/dia para PDFs)
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// Chaves de armazenamento LocalStorage
export const GOOGLE_STORAGE_KEYS = {
  CLIENT_ID: "lifesurf_google_client_id",
  ACCESS_TOKEN: "lifesurf_google_access_token",
  TOKEN_EXPIRY: "lifesurf_google_token_expiry",
  USER_INFO: "lifesurf_google_user_info",
  SETTINGS: "lifesurf_google_settings"
};

// Escopos mínimos necessários para as operações Free Tier
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");

// Configurações padrão de integração
export const DEFAULT_GOOGLE_SETTINGS = {
  calendarEnabled: true,
  gmailEnabled: true,
  driveEnabled: true,
  driveFolderName: "LifeSurf ERP - Documentos Operacionais",
  driveFolderId: null,
  autoBackupCashierPdf: true,
  autoBackupPickingPdf: true,
  autoEmailNewOrder: true,
  autoEmailStatusChange: true
};

/**
 * Retorna o Client ID configurado (no localStorage, Firestore ou .env)
 */
export function getGoogleClientId() {
  const localId = localStorage.getItem(GOOGLE_STORAGE_KEYS.CLIENT_ID);
  if (localId && localId.trim()) return localId.trim();

  const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (envId && envId.trim()) return envId.trim();

  return "";
}

/**
 * Salva o Client ID no armazenamento local
 */
export function saveGoogleClientId(clientId) {
  if (!clientId) {
    localStorage.removeItem(GOOGLE_STORAGE_KEYS.CLIENT_ID);
  } else {
    localStorage.setItem(GOOGLE_STORAGE_KEYS.CLIENT_ID, clientId.trim());
  }
}

/**
 * Retorna o Access Token ativo ou null se expirado/inexistente
 */
export function getGoogleAccessToken() {
  const token = localStorage.getItem(GOOGLE_STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = Number(localStorage.getItem(GOOGLE_STORAGE_KEYS.TOKEN_EXPIRY)) || 0;

  if (!token || Date.now() >= expiry) {
    return null;
  }
  return token;
}

/**
 * Retorna os dados do usuário Google autenticado
 */
export function getGoogleUserInfo() {
  try {
    const raw = localStorage.getItem(GOOGLE_STORAGE_KEYS.USER_INFO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Verifica se a conexão com o Google está ativa e válida
 */
export function isGoogleConnected() {
  return Boolean(getGoogleAccessToken());
}

/**
 * Carrega as preferências de integração do Google (do Firestore e localStorage)
 */
export async function fetchGoogleSettings(tenantId) {
  let settings = { ...DEFAULT_GOOGLE_SETTINGS };

  // Lê do cache local
  try {
    const local = localStorage.getItem(GOOGLE_STORAGE_KEYS.SETTINGS);
    if (local) {
      settings = { ...settings, ...JSON.parse(local) };
    }
  } catch (e) {
    console.warn("[googleApiService] Erro ao ler settings locais:", e);
  }

  // Tenta sincronizar com o Firestore
  if (tenantId) {
    try {
      const docRef = doc(db, "empresas", tenantId, "configuracoes", "google_workspace");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        settings = { ...settings, ...snap.data() };
        localStorage.setItem(GOOGLE_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
    } catch (e) {
      console.warn("[googleApiService] Erro ao buscar settings no Firestore:", e);
    }
  }

  return settings;
}

/**
 * Salva as preferências de integração do Google no Firestore e localStorage
 */
export async function saveGoogleSettings(tenantId, newSettings) {
  const merged = { ...DEFAULT_GOOGLE_SETTINGS, ...newSettings };
  localStorage.setItem(GOOGLE_STORAGE_KEYS.SETTINGS, JSON.stringify(merged));

  if (tenantId) {
    try {
      const docRef = doc(db, "empresas", tenantId, "configuracoes", "google_workspace");
      await setDoc(docRef, merged, { merge: true });
    } catch (e) {
      console.warn("[googleApiService] Erro ao salvar settings no Firestore:", e);
    }
  }
  return merged;
}

/**
 * Inicia o fluxo de autorização OAuth 2.0 Token Client via Google Identity Services
 * Permite selecionar a conta/e-mail desejado e valida o formato do Client ID.
 */
export function requestGoogleAccessToken({
  clientId: customClientId,
  prompt = "select_account",
  loginHint = ""
} = {}) {
  return new Promise((resolve, reject) => {
    let clientId = (customClientId || getGoogleClientId() || "").trim();

    if (!clientId) {
      reject(
        new Error(
          "Google Client ID não configurado. Por favor, insira o seu Client ID do Google Cloud Console."
        )
      );
      return;
    }

    // Se o usuário colou um e-mail no lugar do Client ID
    if (clientId.includes("@")) {
      reject(
        new Error(
          `Você digitou um endereço de e-mail ("${clientId}") no campo de Client ID! O Google Client ID é um código fornecido pelo Google Cloud Console que termina com ".apps.googleusercontent.com".`
        )
      );
      return;
    }

    // Se o usuário colou uma chave de API (AIzaSy...)
    if (clientId.startsWith("AIzaSy")) {
      reject(
        new Error(
          `Você digitou uma chave de API ("${clientId.slice(0, 10)}...") no lugar do Client ID. Para autenticar o Drive, é necessário um "ID do cliente OAuth 2.0" (terminado em .apps.googleusercontent.com).`
        )
      );
      return;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(
        new Error(
          "A biblioteca Google Identity Services (GIS) ainda está carregando no navegador. Aguarde alguns segundos e clique novamente."
        )
      );
      return;
    }

    try {
      const clientConfig = {
        client_id: clientId,
        scope: GOOGLE_SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error("[googleApiService] Erro no token OAuth:", tokenResponse);
            let msg = tokenResponse.error_description || tokenResponse.error;
            if (
              tokenResponse.error === "invalid_client" ||
              tokenResponse.error.includes("invalid_client")
            ) {
              msg = `Erro 401 (invalid_client): O Google não reconheceu este Client ID ou as "Origens JavaScript autorizadas" não contêm a URL atual ("${window.location.origin}"). Verifique suas credenciais no Google Cloud Console.`;
            } else if (tokenResponse.error === "access_denied") {
              msg = "Permissão recusada ou cancelada na janela do Google.";
            }
            reject(new Error(msg));
            return;
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = (Number(tokenResponse.expires_in) || 3599) * 1000;
          const expiryDate = Date.now() + expiresIn - 60000; // margem de 1 minuto

          localStorage.setItem(GOOGLE_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
          localStorage.setItem(GOOGLE_STORAGE_KEYS.TOKEN_EXPIRY, expiryDate.toString());

          // Busca perfil do usuário autenticado para exibir no painel
          let userInfo = { email: loginHint || "conta@gmail.com", name: "Conta Google" };
          try {
            const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              userInfo = await userRes.json();
              localStorage.setItem(GOOGLE_STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
            }
          } catch (err) {
            console.warn("[googleApiService] Não foi possível obter userinfo:", err);
          }

          resolve({
            accessToken,
            expiryDate,
            userInfo
          });
        },
        error_callback: (errorDetails) => {
          console.error("[googleApiService] Erro de inicialização GIS:", errorDetails);
          let erroMsg = errorDetails?.message || "Erro ao abrir autenticação do Google.";
          if (erroMsg.includes("invalid_client") || errorDetails?.type === "invalid_client") {
            erroMsg = `Erro 401 (invalid_client): O Client ID informado não existe no Google Cloud ou a origem "${window.location.origin}" não foi autorizada.`;
          }
          reject(new Error(erroMsg));
        }
      };

      const tokenClient = window.google.accounts.oauth2.initTokenClient(clientConfig);

      // Abre a janela de consentimento forçando a escolha do e-mail desejado
      const requestOptions = {
        prompt: prompt || "select_account"
      };

      if (loginHint && loginHint.trim()) {
        requestOptions.hint = loginHint.trim();
      }

      tokenClient.requestAccessToken(requestOptions);
    } catch (err) {
      console.error("[googleApiService] Falha crítica na chamada GIS:", err);
      let errMsg = err.message || "Erro desconhecido na autorização Google.";
      if (errMsg.includes("invalid_client")) {
        errMsg = `Erro 401 (invalid_client): Verifique o Client ID e configure "${window.location.origin}" nas origens JavaScript autorizadas.`;
      }
      reject(new Error(errMsg));
    }
  });
}

/**
 * Desconecta a conta Google e limpa credenciais salvas
 */
export function disconnectGoogle() {
  const token = localStorage.getItem(GOOGLE_STORAGE_KEYS.ACCESS_TOKEN);
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {
        console.log("[googleApiService] Token revogado com sucesso.");
      });
    } catch (e) {
      console.warn("[googleApiService] Falha ao revogar token:", e);
    }
  }

  localStorage.removeItem(GOOGLE_STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(GOOGLE_STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(GOOGLE_STORAGE_KEYS.USER_INFO);
}

/* =========================================================================
 * 1. GOOGLE CALENDAR API (CALENDÁRIO OPERACIONAL - FREE TIER)
 * Cota gratuita: 1.000.000 requisições diárias
 * ========================================================================= */

/**
 * Mapeia o tipo de evento operacional para as cores oficiais da Google Calendar API
 * 1: Lavender, 2: Sage, 3: Grape (Roxo), 6: Tangerine (Laranja), 7: Peacock (Azul Celeste), 10: Basil (Verde)
 */
function getGoogleCalendarColorId(tipo) {
  switch (tipo) {
    case "entrega_pedido":
      return "10"; // Basil / Verde
    case "retirada_balcao":
      return "7"; // Peacock / Azul Claro
    case "producao_op":
      return "3"; // Grape / Roxo
    case "chegada_tecido":
      return "6"; // Tangerine / Laranja
    default:
      return "8"; // Graphite / Cinza
  }
}

/**
 * Sincroniza um evento diretamente com a Google Calendar API
 */
export async function syncEventToGoogleCalendar(event) {
  const token = getGoogleAccessToken();

  if (!token) {
    throw new Error("Conta Google não conectada. Conecte-a em Configurações para sincronizar.");
  }

  const horaInicio = event.horario || "09:00";
  const [h, m] = horaInicio.split(":").map(Number);
  const fimHour = String(h + 1).padStart(2, "0");
  const horaFim = `${fimHour}:${String(m || 0).padStart(2, "0")}`;

  const payload = {
    summary: `[LifeSurf] ${event.titulo}`,
    description: `${event.descricao || "Sem observações adicionais."}\n\nResponsável: ${event.responsavel || "Equipe LifeSurf"}\nCliente: ${event.cliente || "Balcão / Geral"}\nTipo: ${event.tipo?.toUpperCase() || "GERAL"}\nOrigem: ERP LifeSurf`,
    start: {
      dateTime: `${event.data}T${horaInicio}:00-03:00`,
      timeZone: "America/Fortaleza"
    },
    end: {
      dateTime: `${event.data}T${horaFim}:00-03:00`,
      timeZone: "America/Fortaleza"
    },
    colorId: getGoogleCalendarColorId(event.tipo),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "popup", minutes: 120 }
      ]
    }
  };

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Erro ${response.status} na Google Calendar API`);
  }

  const data = await response.json();
  return {
    success: true,
    eventId: data.id,
    htmlLink: data.htmlLink
  };
}

/**
 * Gera URL de deep link para o Google Calendar (adiciona em 1 clique sem OAuth)
 */
export function generateGoogleCalendarUrl(event) {
  const horaInicio = (event.horario || "09:00").replace(":", "");
  const [h, m] = (event.horario || "09:00").split(":").map(Number);
  const horaFim = `${String(h + 1).padStart(2, "0")}${String(m || 0).padStart(2, "0")}`;

  const dataFormatada = (event.data || new Date().toISOString().split("T")[0]).replace(/-/g, "");
  const dates = `${dataFormatada}T${horaInicio}00/${dataFormatada}T${horaFim}00`;

  const title = encodeURIComponent(`[LifeSurf] ${event.titulo}`);
  const details = encodeURIComponent(
    `${event.descricao || ""}\n\nResponsável: ${event.responsavel || "Equipe"}\nCliente: ${event.cliente || "Geral"}\nTipo: ${event.tipo || ""}\nGerado pelo ERP LifeSurf`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

/* =========================================================================
 * 2. GMAIL API (COMUNICAÇÃO TRANSACIONAL - FREE TIER)
 * Cota gratuita: 250 (pessoal) a 2.000 (Workspace) e-mails diários
 * ========================================================================= */

/**
 * Converte string UTF-8 para Base64URL RFC 2822
 */
function toBase64Url(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Dispara e-mail transacional via Gmail API v1
 */
export async function sendTransactionalEmail({ to, subject, htmlBody, textBody }) {
  const token = getGoogleAccessToken();

  if (!token) {
    throw new Error("Conta Google não conectada. Conecte-a em Configurações para enviar e-mails via Gmail API.");
  }

  if (!to || !to.includes("@")) {
    throw new Error("Endereço de e-mail do destinatário inválido.");
  }

  const emailLines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlBody || textBody || ""
  ];

  const rawEmail = emailLines.join("\r\n");
  const encodedEmail = toBase64Url(rawEmail);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: encodedEmail })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Erro ${response.status} ao disparar e-mail via Gmail API`);
  }

  const data = await response.json();
  return {
    success: true,
    messageId: data.id
  };
}

/**
 * Cria template HTML profissional para o e-mail de pedido
 */
export function buildOrderEmailHtml({ order, storeInfo = {}, statusTitle, statusBadge, messageIntro }) {
  const empresaNome = storeInfo.nome || "LifeSurf Surfwear & Confecções";
  const telefone = storeInfo.telefone || "(85) 98888-7777";
  const cidade = storeInfo.cidade || "Fortaleza - CE";
  const endereco = storeInfo.endereco || "Av. Beira Mar, 2100";

  const itensTable = (order.itens || [])
    .map(
      (it) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; font-size: 13px; color: #1e293b; font-weight: 500;">
          ${it.nome} <br />
          <span style="font-size: 11px; color: #64748b;">Tamanho: ${it.tamanho || "U"} | Cor: ${it.cor || "Padrão"}</span>
        </td>
        <td style="padding: 10px 8px; font-size: 13px; color: #334155; text-align: center;">
          ${it.quantidade}x
        </td>
        <td style="padding: 10px 8px; font-size: 13px; color: #0284c7; text-align: right; font-weight: bold;">
          R$ ${Number(it.precoUnitario || 0).toFixed(2).replace(".", ",")}
        </td>
      </tr>
    `
    )
    .join("");

  const totalFormatado = Number(order.total || 0).toFixed(2).replace(".", ",");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); padding: 32px 24px; text-align: center; }
        .title { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
        .subtitle { color: #bae6fd; font-size: 12px; margin-top: 6px; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 32px 28px; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">${empresaNome}</h1>
          <div class="subtitle">Notificação Oficial de Pedido</div>
        </div>

        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge" style="background: #e0f2fe; color: #0284c7; border: 1px solid #7dd3fc;">
              ${statusBadge || "ATUALIZAÇÃO DE PEDIDO"}
            </span>
            <h2 style="font-size: 18px; color: #0f172a; margin: 12px 0 6px 0;">${statusTitle}</h2>
            <p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.5;">${messageIntro}</p>
          </div>

          <div class="card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-size: 12px; color: #64748b;">Nº do Pedido:</td>
                <td style="font-size: 13px; font-weight: bold; color: #0f172a; text-align: right;">${order.numeroPedido || order.id || "SEM NÚMERO"}</td>
              </tr>
              <tr>
                <td style="font-size: 12px; color: #64748b;">Cliente:</td>
                <td style="font-size: 13px; font-weight: bold; color: #0f172a; text-align: right;">${order.cliente?.nome || "Consumidor"}</td>
              </tr>
              <tr>
                <td style="font-size: 12px; color: #64748b;">Data do Pedido:</td>
                <td style="font-size: 13px; color: #334155; text-align: right;">${new Date().toLocaleDateString("pt-BR")}</td>
              </tr>
              <tr>
                <td style="font-size: 12px; color: #64748b;">Forma de Pagamento:</td>
                <td style="font-size: 13px; color: #334155; text-align: right; text-transform: uppercase;">${order.formaPagamento || "A Combinar"}</td>
              </tr>
            </table>
          </div>

          <h3 style="font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 24px 0 10px 0; border-bottom: 2px solid #0284c7; padding-bottom: 4px;">
            Itens do Pedido
          </h3>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 8px; text-align: left; font-size: 11px; color: #475569;">PRODUTO</th>
                <th style="padding: 8px; text-align: center; font-size: 11px; color: #475569;">QTD</th>
                <th style="padding: 8px; text-align: right; font-size: 11px; color: #475569;">VALOR</th>
              </tr>
            </thead>
            <tbody>
              ${itensTable}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 12px 8px; font-size: 15px; font-weight: bold; color: #0f172a; text-align: right;">
                  TOTAL GERAL:
                </td>
                <td style="padding: 12px 8px; font-size: 16px; font-weight: 800; color: #0284c7; text-align: right;">
                  R$ ${totalFormatado}
                </td>
              </tr>
            </tfoot>
          </table>

          ${order.observacoes ? `<p style="font-size: 12px; color: #64748b; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;"><strong>Observação:</strong> ${order.observacoes}</p>` : ""}

          <div style="text-align: center; margin-top: 28px;">
            <p style="font-size: 13px; color: #475569; margin-bottom: 6px;">Qualquer dúvida, fale conosco pelo WhatsApp ou telefone:</p>
            <p style="font-size: 15px; font-weight: bold; color: #0284c7; margin: 0;">${telefone}</p>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0 0 4px 0; font-weight: 600;">${empresaNome} • ${cidade}</p>
          <p style="margin: 0;">${endereco} • Mensagem gerada automaticamente pelo ERP LifeSurf via Gmail API (Free Tier).</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Dispara e-mail transacional de Confirmação de Novo Pedido
 */
export async function sendOrderCreatedEmail(order, storeInfo) {
  const emailCliente = order.cliente?.email;
  if (!emailCliente) return { skipped: true, reason: "Cliente sem e-mail" };

  const html = buildOrderEmailHtml({
    order,
    storeInfo,
    statusTitle: "Recebemos o seu pedido!",
    statusBadge: "Pedido Confirmado",
    messageIntro: "Seu pedido foi registrado em nossa esteira operacional e já está aguardando início da separação no estoque."
  });

  return sendTransactionalEmail({
    to: emailCliente,
    subject: `Confirmação de Pedido #${order.numeroPedido || order.id} • ${storeInfo?.nome || "LifeSurf"}`,
    htmlBody: html
  });
}

/**
 * Dispara e-mail transacional de Atualização de Status do Pedido
 */
export async function sendOrderStatusUpdateEmail(order, novoStatus, storeInfo) {
  const emailCliente = order.cliente?.email;
  if (!emailCliente) return { skipped: true, reason: "Cliente sem e-mail" };

  let statusTitle = "Atualização de status do seu pedido";
  let statusBadge = "Status Atualizado";
  let messageIntro = "O andamento do seu pedido foi atualizado pela nossa equipe.";

  switch (novoStatus) {
    case "em_separacao":
      statusTitle = "Seu pedido está em separação!";
      statusBadge = "Em Separação";
      messageIntro = "Nossa equipe da confecção e estoque começou a coletar e conferir as peças do seu pedido.";
      break;
    case "separado":
      statusTitle = "Peças separadas e conferidas!";
      statusBadge = "Separado & Conferido";
      messageIntro = "Todas as peças foram separadas, inspecionadas e estão aguardando empacotamento para expedição.";
      break;
    case "pronto_retirada":
      statusTitle = "Seu pedido está pronto para retirada!";
      statusBadge = "Pronto para Retirada";
      messageIntro = "Oba! Seu pedido já está embalado e disponível para retirada no balcão da loja ou pronto para coleta do motoboy.";
      break;
    case "entregue":
      statusTitle = "Pedido entregue com sucesso!";
      statusBadge = "Entregue";
      messageIntro = "Seu pedido foi finalizado e entregue. Muito obrigado por escolher a LifeSurf!";
      break;
    case "cancelado":
      statusTitle = "Aviso sobre cancelamento do pedido";
      statusBadge = "Pedido Cancelado";
      messageIntro = "Informamos que o seu pedido foi cancelado no sistema. Entre em contato conosco para mais detalhes.";
      break;
    default:
      break;
  }

  const html = buildOrderEmailHtml({
    order: { ...order, status: novoStatus },
    storeInfo,
    statusTitle,
    statusBadge,
    messageIntro
  });

  return sendTransactionalEmail({
    to: emailCliente,
    subject: `[${statusBadge}] Pedido #${order.numeroPedido || order.id} • ${storeInfo?.nome || "LifeSurf"}`,
    htmlBody: html
  });
}

/* =========================================================================
 * 3. GOOGLE DRIVE API (ARMAZENAMENTO EM NUVEM DE PDFS - FREE TIER)
 * Cota gratuita: 15 GB padrão + 1.000.000 requisições diárias
 * ========================================================================= */

/**
 * Localiza ou cria a pasta corporativa dedicada no Google Drive da empresa
 */
export async function ensureDriveFolder({ folderName = "LifeSurf ERP - Documentos Operacionais" } = {}) {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Conta Google não conectada.");

  // 1. Pesquisa pasta existente pelo nome
  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0];
    }
  }

  // 2. Se não existir, cria a pasta
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      description: "Pasta de armazenamento seguro de relatórios e documentos operacionais do LifeSurf ERP"
    })
  });

  if (!createRes.ok) {
    const errorBody = await createRes.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || "Falha ao criar pasta no Google Drive.");
  }

  return await createRes.json();
}

/**
 * Faz upload multipart de um arquivo PDF gerado para a pasta do Google Drive
 *
 * @param {object} params
 * @param {Blob} params.pdfBlob - O Blob do arquivo PDF gerado
 * @param {string} params.fileName - Nome do arquivo (ex: Fechamento_Caixa_2026-10-02.pdf)
 * @param {string} params.folderName - Nome da pasta no Drive
 * @param {string} params.description - Descrição do documento
 */
export async function uploadPdfToGoogleDrive({
  pdfBlob,
  fileName,
  folderName = "LifeSurf ERP - Documentos Operacionais",
  description = "Documento operacional gerado automaticamente pelo ERP LifeSurf"
}) {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada. Conecte-a nas Configurações para salvar no Google Drive.");
  }

  if (!pdfBlob) {
    throw new Error("Blob do arquivo PDF não fornecido.");
  }

  // Garante a existência da pasta segura
  const folder = await ensureDriveFolder({ folderName });
  const folderId = folder.id;

  // Monta requisição multipart/related
  const boundary = `-------LifeSurfBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: "application/pdf",
    parents: [folderId],
    description
  };

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `${delimiter}Content-Type: application/pdf\r\n\r\n`;

  // Lê bytes do PDF Blob
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);

  // Concatena as partes em um único Blob
  const multipartBlob = new Blob([
    new TextEncoder().encode(metadataPart),
    new TextEncoder().encode(fileHeader),
    pdfBytes,
    new TextEncoder().encode(closeDelimiter)
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink";
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: multipartBlob
  });

  if (!uploadRes.ok) {
    const errorBody = await uploadRes.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Erro ${uploadRes.status} ao enviar arquivo para o Google Drive`);
  }

  const fileData = await uploadRes.json();
  return {
    success: true,
    fileId: fileData.id,
    fileName: fileData.name,
    webViewLink: fileData.webViewLink,
    folderName: folder.name || folderName
  };
}

export const MESES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

/**
 * Localiza ou cria a estrutura de pastas do mês para comprovantes no Google Drive:
 * Raiz (LifeSurf ERP) -> Comprovantes -> YYYY-MM (Nome do Mês)
 */
export async function ensureMonthlyReceiptsDriveFolder({
  year,
  month,
  rootFolderName = "LifeSurf ERP - Documentos Operacionais"
} = {}) {
  const token = getGoogleAccessToken();
  if (!token) throw new Error("Conta Google não conectada. Conecte nas Configurações para salvar no Google Drive.");

  const dataAtual = new Date();
  const targetYear = year || dataAtual.getFullYear();
  const targetMonth = month || dataAtual.getMonth() + 1;
  const mesNum = String(targetMonth).padStart(2, "0");
  const mesNome = MESES_NOMES[(Number(targetMonth) - 1) % 12] || "Mês";
  const monthFolderName = `${targetYear}-${mesNum} (${mesNome})`;

  // 1. Garante a pasta raiz do ERP
  const rootFolder = await ensureDriveFolder({ folderName: rootFolderName });

  // 2. Garante a pasta 'Comprovantes' dentro da raiz
  let comprovantesFolderId = null;
  let comprovantesFolderLink = null;
  const queryComprovantes = `'${rootFolder.id}' in parents and name = 'Comprovantes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchCompRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryComprovantes)}&fields=files(id, name, webViewLink)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchCompRes.ok) {
    const data = await searchCompRes.json();
    if (data.files && data.files.length > 0) {
      comprovantesFolderId = data.files[0].id;
      comprovantesFolderLink = data.files[0].webViewLink;
    }
  }

  if (!comprovantesFolderId) {
    const createCompRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Comprovantes",
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolder.id],
        description: "Pasta central de comprovantes de gastos e receitas do LifeSurf ERP"
      })
    });
    if (createCompRes.ok) {
      const data = await createCompRes.json();
      comprovantesFolderId = data.id;
      comprovantesFolderLink = data.webViewLink;
    } else {
      comprovantesFolderId = rootFolder.id;
    }
  }

  // 3. Garante a subpasta do mês dentro de 'Comprovantes'
  const queryMonth = `'${comprovantesFolderId}' in parents and name = '${monthFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchMonthRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryMonth)}&fields=files(id, name, webViewLink)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchMonthRes.ok) {
    const data = await searchMonthRes.json();
    if (data.files && data.files.length > 0) {
      return {
        id: data.files[0].id,
        name: data.files[0].name,
        webViewLink: data.files[0].webViewLink
      };
    }
  }

  // Cria a pasta do mês
  const createMonthRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: monthFolderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [comprovantesFolderId],
      description: `Comprovantes de gastos e entradas do mês de ${mesNome}/${targetYear}`
    })
  });

  if (!createMonthRes.ok) {
    const errorBody = await createMonthRes.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || "Falha ao criar pasta do mês no Google Drive.");
  }

  const newMonthFolder = await createMonthRes.json();
  return {
    id: newMonthFolder.id,
    name: newMonthFolder.name || monthFolderName,
    webViewLink: newMonthFolder.webViewLink
  };
}

/**
 * Faz upload de imagem de comprovante direto para a pasta do mês no Google Drive
 */
export async function uploadReceiptImageToDrive({
  imageBlob,
  fileName,
  year,
  month,
  description = "Comprovante financeiro LifeSurf",
  rootFolderName = "LifeSurf ERP - Documentos Operacionais"
}) {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada. Conecte-a para sincronizar com o Google Drive.");
  }

  if (!imageBlob) {
    throw new Error("Imagem não fornecida para upload.");
  }

  // Localiza ou cria a pasta do mês
  const monthFolder = await ensureMonthlyReceiptsDriveFolder({ year, month, rootFolderName });

  const mimeType = imageBlob.type || "image/jpeg";
  const safeFileName =
    fileName || `Comprovante_${Date.now()}.${mimeType.includes("png") ? "png" : "jpg"}`;

  // Monta multipart/related
  const boundary = `-------LifeSurfReceiptBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: safeFileName,
    mimeType,
    parents: [monthFolder.id],
    description
  };

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  const arrayBuffer = await imageBlob.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const multipartBlob = new Blob(
    [
      new TextEncoder().encode(metadataPart),
      new TextEncoder().encode(fileHeader),
      fileBytes,
      new TextEncoder().encode(closeDelimiter)
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadUrl =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink";
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: multipartBlob
  });

  if (!uploadRes.ok) {
    const errorBody = await uploadRes.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Erro ${uploadRes.status} ao enviar foto para o Google Drive`);
  }

  const fileData = await uploadRes.json();
  return {
    success: true,
    fileId: fileData.id,
    fileName: fileData.name,
    webViewLink: fileData.webViewLink,
    webContentLink: fileData.webContentLink,
    thumbnailLink: fileData.thumbnailLink,
    folderName: monthFolder.name,
    folderWebViewLink: monthFolder.webViewLink
  };
}
