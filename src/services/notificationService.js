import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import app, { db } from "../config/firebase";

/**
 * SERVIÇO DE NOTIFICAÇÕES PUSH (FCM) E INTEGRAÇÃO WHATSAPP (FASE 11)
 * Alertas sonoros, push notifications no celular e links diretos para WhatsApp.
 */

// Chave pública VAPID padrão do Firebase (ou via env)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

/**
 * 1. DISPARADOR DE ALERTA SONORO VIA WEB AUDIO API (Sintetizador Nativo)
 * Toca um som de sino/chime agradável anunciando novo pedido no PDV/Catálogo.
 */
export function playOrderAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Primeiro tom (D5 - 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Segundo tom (A5 - 880Hz) ligeiramente depois
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn("[notificationService] Falha ao tocar áudio Web Audio:", err);
  }
}

/**
 * 2. REGISTRO E INICIALIZAÇÃO DO FIREBASE CLOUD MESSAGING (FCM)
 */
export async function setupPushNotifications(tenantId, onMessageCallback) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.log("[FCM] Notificações não são suportadas neste navegador.");
    return null;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("[FCM] Firebase Messaging não é suportado neste ambiente.");
      return null;
    }

    // Solicita permissão se ainda não foi concedida
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.log("[FCM] Permissão de notificação não concedida:", permission);
      return null;
    }

    const messaging = getMessaging(app);

    // Obtém o token FCM
    const tokenOptions = VAPID_KEY ? { vapidKey: VAPID_KEY } : undefined;
    const currentToken = await getToken(messaging, tokenOptions);

    if (currentToken && tenantId) {
      // Salva o token FCM no Firestore para envio segmentado
      try {
        const tokenRef = doc(db, "empresas", tenantId, "dispositivos_fcm", currentToken.slice(0, 32));
        await setDoc(tokenRef, {
          token: currentToken,
          userAgent: navigator.userAgent,
          atualizadoEm: serverTimestamp()
        }, { merge: true });
      } catch (firestoreErr) {
        console.warn("[FCM] Não foi possível persistir token no Firestore:", firestoreErr);
      }
    }

    // Listener para quando o app estiver em primeiro plano
    if (onMessageCallback) {
      onMessage(messaging, (payload) => {
        playOrderAlertSound();
        if (payload?.notification) {
          sendLocalPushNotification(
            payload.notification.title || "Novo Pedido LifeSurf!",
            payload.notification.body || "Um novo pedido acabou de chegar."
          );
        }
        onMessageCallback(payload);
      });
    }

    return currentToken;
  } catch (err) {
    console.warn("[FCM] Erro ao inicializar notificações:", err);
    return null;
  }
}

/**
 * 3. NOTIFICAÇÃO NATIVA LOCAL DO NAVEGADOR
 */
export function sendLocalPushNotification(title, body, url = window.location.href) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200]
      });

      notif.onclick = () => {
        window.focus();
        if (url) window.location.href = url;
        notif.close();
      };
    } catch (e) {
      // Alguns browsers mobile requerem que seja via ServiceWorkerRegistration
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, { body, icon: "/favicon.ico" });
        });
      }
    }
  }
}

/**
 * 4. GERADOR DE LINKS E TEMPLATES DIRETOS PARA O WHATSAPP
 */
export const WHATSAPP_TEMPLATES = {
  PEDIDO_CONFIRMADO: "pedido_confirmado",
  PEDIDO_SEPARADO: "pedido_separado",
  PEDIDO_EM_ROTA: "pedido_em_rota",
  COBRANCA_PIX: "cobranca_pix",
  CONTATO_LIVRE: "contato_livre"
};

/**
 * Limpa e formata o telefone para o padrão internacional (DDI 55 Brasil)
 */
export function sanitizePhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("55") && cleaned.length >= 12) return cleaned;
  if (cleaned.length >= 10) return `55${cleaned}`;
  return cleaned;
}

/**
 * Gera URL pronta para o WhatsApp Web / App
 */
export function generateWhatsAppLink({
  phone,
  template = WHATSAPP_TEMPLATES.PEDIDO_CONFIRMADO,
  clienteNome = "Cliente",
  numeroPedido = "",
  total = "",
  chavePix = "",
  customMessage = ""
}) {
  const cleanPhone = sanitizePhone(phone);
  if (!cleanPhone) return null;

  let messageText = "";

  switch (template) {
    case WHATSAPP_TEMPLATES.PEDIDO_CONFIRMADO:
      messageText = `Olá, *${clienteNome}*! Tudo bem?\n\n` +
        `Recebemos o seu pedido *#${numeroPedido}* na *LifeSurf*! 🌊👕\n` +
        (total ? `*Valor Total:* ${total}\n` : "") +
        `Nosso time já está preparando sua encomenda com todo cuidado. Qualquer dúvida estamos à disposição!`;
      break;

    case WHATSAPP_TEMPLATES.PEDIDO_SEPARADO:
      messageText = `Boas notícias, *${clienteNome}*! 📦✨\n\n` +
        `Seu pedido *#${numeroPedido}* foi separado e conferido com sucesso!\n` +
        `Ele já está disponível para retirada em nossa loja ou pronto para envio.\n` +
        `Esperamos você!`;
      break;

    case WHATSAPP_TEMPLATES.PEDIDO_EM_ROTA:
      messageText = `Olá, *${clienteNome}*! 🛵💨\n\n` +
        `Seu pedido *#${numeroPedido}* acabou de sair para entrega com nosso entregador.\n` +
        `Por favor, fique atento ao endereço informado para o recebimento. Obrigado por escolher a LifeSurf!`;
      break;

    case WHATSAPP_TEMPLATES.COBRANCA_PIX:
      messageText = `Olá, *${clienteNome}*!\n\n` +
        `Aqui estão os dados para pagamento via PIX do seu pedido *#${numeroPedido}*:\n` +
        (total ? `*Total a pagar:* ${total}\n` : "") +
        (chavePix ? `*Chave PIX:* \`${chavePix}\`\n\n` : "\n") +
        `Assim que efetuar o pagamento, basta nos enviar o comprovante por aqui. Obrigado!`;
      break;

    case WHATSAPP_TEMPLATES.CONTATO_LIVRE:
    default:
      messageText = customMessage || `Olá, *${clienteNome}*! Estamos entrando em contato sobre seu pedido na LifeSurf.`;
      break;
  }

  const encoded = encodeURIComponent(messageText);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

/**
 * Abre o link do WhatsApp diretamente em uma nova aba
 */
export function openWhatsAppChat(params) {
  const link = generateWhatsAppLink(params);
  if (!link) {
    alert("Número de WhatsApp inválido ou não informado.");
    return false;
  }
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}
